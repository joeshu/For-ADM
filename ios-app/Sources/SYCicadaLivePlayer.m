// SYCicadaLivePlayer.m
//
// 实现说明与证据链（复用 cctvhost MediaPlaybackCicadaAdapter 的手法，直播裁剪）：
//   1) SDK 符号一律运行时查找（NSClassFromString + respondsToSelector +
//      objc_msgSend），本文件不得出现 CicadaSDK.h 的 import 与任何
//      CicadaPlayer / CicadaConfig / CicadaUrlSource 类型引用——模拟器
//      构建不链接 CicadaPlayerSDK，且无 -Wl,-undefined,dynamic_lookup，
//      直接引用会在链接期失败。
//   2) 以下 API 在 CicadaPlayerSDK 二进制符号中已确认存在：
//      setConfig: / setUrlSource: / setPlayerView: / setDelegate: /
//      setEnableHardwareDecoder: / prepare / start / pause / stop / destroy /
//      setAutoPlay: / setScalingMode: / setVolume: / currentPosition /
//      CicadaConfig 的 setNetworkTimeout: / setNetworkRetryCount: /
//      setHttpHeaders: / setUserAgent: / setReferer: /
//      CicadaUrlSource 的 +urlWithString:（头文件写的是实例方法，
//      但 cctvhost 适配器按类方法调用并已验证；这里先试类方法，
//      再试实例方法，两路都走 respondsToSelector 守卫）。
//   3) Delegate 回调：以下 selector 在二进制中以字符串形式确认：
//      onError:errorModel:、onCurrentPositionUpdate:position:、
//      onLoadingProgress:progress:、onPlayerStatusChanged:oldStatus:newStatus:、
//      onVideoSizeChanged:width:height:rotation:。
//      其余（onPrepared:、onFirstFrameShow:、onLoadingStart:、onLoadingEnd:、
//      onSeekEnd:、onPlayerEvent:eventType:）只在 C++ 层或头文件中确认，
//      拼写为 best-effort，并用 1 秒位置轮询兜底：位置推进即视为首帧已出。
//      回调缺失时绝不静默黑屏——20 秒首帧看门狗会报错。
//      onPlayerEvent 的 CicadaEventFirstRenderedStart = 2（见 CicadaSDK.h
//      的 CicadaEventType），是头文件里明确的首帧信号。
//   4) 时长/位置单位：CicadaPlayer 的 currentPosition 按秒计；为防个别构建
//      返回毫秒，>360000 的值按毫秒折算（见归一化函数）。直播没有时长，
//      不读 duration、不做完成判断。
//      网络超时单位：CicadaConfig.networkTimeout 按毫秒计（仓库内证据：
//      直连路径传 15000）。公开 API 的 networkTimeout 参数仍按秒收，
//      prepare 里 ×1000 再传给 SDK。
//   5) scalingMode 按 CicadaScalingMode 枚举（0=SCALETOFILL、
//      1=SCALEASPECTFIT、2=SCALEASPECTFILL，见 CicadaSDK.h）。
//   6) 本播放器不做全局 SDK 初始化：CicadaPlayer 无需 startPlayerSDK
//      式调用，alloc/init 后直接配制即可（见 CicadaSDK.h，无初始化方法）。
#import "SYCicadaLivePlayer.h"
#import <AVFoundation/AVFoundation.h>
#import <objc/message.h>
#import <objc/runtime.h>

NSString * const SYCicadaLivePlayerErrorDomain = @"SYCicadaLivePlayerErrorDomain";

static const NSTimeInterval SYCicadaLivePositionPollInterval = 1.0;
static const NSTimeInterval SYCicadaLivePreparedFallbackDelay = 0.5;

// ---------- 运行时调用小工具（全部先 respondsToSelector，再 @try） ----------

static Class SYCicadaLiveClass(NSString *name) {
    return NSClassFromString(name);
}

static void SYCicadaCallVoid(id target, SEL sel) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL))objc_msgSend)(target, sel); } @catch (NSException *e) {}
}

static void SYCicadaCallVoidObject(id target, SEL sel, id arg) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL, id))objc_msgSend)(target, sel, arg); } @catch (NSException *e) {}
}

static void SYCicadaCallVoidBool(id target, SEL sel, BOOL arg) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL, BOOL))objc_msgSend)(target, sel, arg); } @catch (NSException *e) {}
}

static void SYCicadaCallVoidInt(id target, SEL sel, int arg) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL, int))objc_msgSend)(target, sel, arg); } @catch (NSException *e) {}
}

static void SYCicadaCallVoidFloat(id target, SEL sel, float arg) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL, float))objc_msgSend)(target, sel, arg); } @catch (NSException *e) {}
}

static void SYCicadaCallVoidDouble(id target, SEL sel, double arg) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL, double))objc_msgSend)(target, sel, arg); } @catch (NSException *e) {}
}

static void SYCicadaCallVoidDoubleLong(id target, SEL sel, double arg, long arg2) {
    if (!target || !sel || ![target respondsToSelector:sel]) return;
    @try { ((void (*)(id, SEL, double, long))objc_msgSend)(target, sel, arg, arg2); } @catch (NSException *e) {}
}

static double SYCicadaCallDouble(id target, SEL sel) {
    if (!target || !sel || ![target respondsToSelector:sel]) return 0;
    @try { return ((double (*)(id, SEL))objc_msgSend)(target, sel); } @catch (NSException *e) { return 0; }
}

static NSTimeInterval SYCicadaLiveNormalizeTimeValue(id value) {
    double seconds = 0;
    if ([value respondsToSelector:@selector(doubleValue)]) seconds = [value doubleValue];
    if (!isfinite(seconds) || seconds < 0) return 0;
    // 个别构建返回毫秒：超过 100 小时的一律按毫秒折算。
    if (seconds > 360000) seconds /= 1000.0;
    return seconds;
}

static NSString *SYCicadaLiveStringFromModel(id model, NSArray<NSString *> *keys) {
    for (NSString *key in keys) {
        SEL sel = NSSelectorFromString(key);
        if (![model respondsToSelector:sel]) continue;
        @try {
            id value = ((id (*)(id, SEL))objc_msgSend)(model, sel);
            if ([value isKindOfClass:NSString.class] && [(NSString *)value length]) return value;
        } @catch (NSException *e) {}
    }
    return nil;
}

static NSInteger SYCicadaLiveCodeFromModel(id model) {
    for (NSString *key in @[@"errorCode", @"code", @"error_code"]) {
        SEL sel = NSSelectorFromString(key);
        if (![model respondsToSelector:sel]) continue;
        @try {
            id value = ((id (*)(id, SEL))objc_msgSend)(model, sel);
            if ([value respondsToSelector:@selector(integerValue)]) return [value integerValue];
        } @catch (NSException *e) {}
    }
    return -1;
}

@interface SYCicadaLivePlayer ()
// state 对外只读，内部可写（公开头文件里是 readonly）。
@property (nonatomic, readwrite) SYCicadaLivePlayerState state;
@property (nonatomic, strong) NSURL *url;
@property (nonatomic, strong, nullable) NSDictionary<NSString *, NSString *> *headers;
@property (nonatomic) NSTimeInterval networkTimeout;
@property (nonatomic, strong, nullable) id player;
@property (nonatomic, strong, nullable) id config;
@property (nonatomic, strong, nullable) NSTimer *pollTimer;
@property (nonatomic, strong, nullable) NSTimer *firstFrameWatchdog;
@property (nonatomic, strong, nullable) NSTimer *preparedFallbackTimer;
@property (nonatomic) NSUInteger generation;
@property (nonatomic) BOOL preparedReported;
@property (nonatomic) BOOL firstFrameReported;
@property (nonatomic) BOOL startRequested;
@property (nonatomic) BOOL destroyed;
@property (nonatomic) BOOL enableHardwareDecoder;
@property (nonatomic) BOOL softwareRetryDone;
@property (nonatomic) CGSize videoSize;
@property (nonatomic) float pendingRate;
@property (nonatomic) BOOL hasPendingRate;
@property (nonatomic) BOOL startPositionApplied;
@property (nonatomic) BOOL paused;
@property (nonatomic) BOOL completedReported;
@property (nonatomic) NSTimeInterval lastProgressPosition;
@property (nonatomic) NSInteger stallSeconds;
@end

@implementation SYCicadaLivePlayer

+ (BOOL)isAvailable {
    return SYCicadaLiveClass(@"CicadaPlayer") != nil;
}

- (instancetype)initWithURL:(NSURL *)url headers:(NSDictionary<NSString *, NSString *> *)headers networkTimeout:(NSTimeInterval)timeoutSeconds {
    if (self = [super init]) {
        _url = url;
        _headers = [headers copy];
        _networkTimeout = MIN(40, MAX(5, timeoutSeconds > 0 ? timeoutSeconds : 20));
        _playerView = [UIView new];
        _playerView.backgroundColor = UIColor.blackColor;
        _playerView.clipsToBounds = YES;
        _state = SYCicadaLivePlayerStateIdle;
        _videoSize = CGSizeZero;
        _firstFrameTimeout = 20.0;
    }
    return self;
}

- (void)dealloc {
    [self destroy];
}

// ---------- 生命周期 ----------

- (void)prepare {
    [self prepareWithHardwareDecoder:YES];
}

- (void)prepareWithHardwareDecoder:(BOOL)enableHardwareDecoder {
    if (self.destroyed || self.player) return;
    self.enableHardwareDecoder = enableHardwareDecoder;
    Class playerClass = SYCicadaLiveClass(@"CicadaPlayer");
    Class configClass = SYCicadaLiveClass(@"CicadaConfig");
    Class sourceClass = SYCicadaLiveClass(@"CicadaUrlSource");
    if (!playerClass || !configClass || !sourceClass) {
        [self reportErrorWithCode:-1002 message:@"当前构建未包含 CicadaPlayer，无法使用软解回退"];
        return;
    }
    id player = nil;
    @try { player = [[playerClass alloc] init]; } @catch (NSException *e) { player = nil; }
    if (!player) {
        [self reportErrorWithCode:-1002 message:@"创建 CicadaPlayer 失败"];
        return;
    }
    self.player = player;
    self.generation++;
    self.state = SYCicadaLivePlayerStatePreparing;

    // 配置：网络超时读设置（调用方传入，已钳制 5–40 秒）；重试 2 次；
    // 请求头 / UA / Referer 由播放调用方带入（直播常需 Referer 才能出流）。
    // 注意：CicadaConfig.networkTimeout 单位是毫秒，公开 API 的秒数要 ×1000。
    id config = nil;
    @try { config = [[configClass alloc] init]; } @catch (NSException *e) { config = nil; }
    self.config = config;
    if (config) {
        SYCicadaCallVoidInt(config, NSSelectorFromString(@"setNetworkTimeout:"), (int)llround(self.networkTimeout * 1000.0));
        SYCicadaCallVoidInt(config, NSSelectorFromString(@"setNetworkRetryCount:"), 2);
        if (self.headers.count) {
            SYCicadaCallVoidObject(config, NSSelectorFromString(@"setHttpHeaders:"), self.headers);
            NSString *userAgent = self.headers[@"User-Agent"] ?: self.headers[@"user-agent"];
            NSString *referer = self.headers[@"Referer"] ?: self.headers[@"referer"];
            if (userAgent.length) SYCicadaCallVoidObject(config, NSSelectorFromString(@"setUserAgent:"), userAgent);
            if (referer.length) SYCicadaCallVoidObject(config, NSSelectorFromString(@"setReferer:"), referer);
        }
        // 点播缓冲：起播 300ms 即出画面，高水位 5s，最大 30s（与 AVPlayer 点播
        // 前向缓冲一致），让慢线路分片有足够时间到达；选择器不存在时静默跳过。
        SYCicadaCallVoidInt(config, NSSelectorFromString(@"setStartBufferDuration:"), 300);
        SYCicadaCallVoidInt(config, NSSelectorFromString(@"setHighBufferDuration:"), 5000);
        SYCicadaCallVoidInt(config, NSSelectorFromString(@"setMaxBufferDuration:"), 30000);
        SYCicadaCallVoidObject(player, NSSelectorFromString(@"setConfig:"), config);
    }
    SYCicadaCallVoidBool(player, NSSelectorFromString(@"setEnableHardwareDecoder:"), self.enableHardwareDecoder);
    SYCicadaCallVoidBool(player, NSSelectorFromString(@"setAutoPlay:"), NO);
    id source = [self makeUrlSourceWithClass:sourceClass];
    if (!source) {
        [self reportErrorWithCode:-1002 message:@"创建播放地址失败"];
        return;
    }
    SYCicadaCallVoidObject(player, NSSelectorFromString(@"setUrlSource:"), source);
    SYCicadaCallVoidObject(player, NSSelectorFromString(@"setPlayerView:"), self.playerView);
    SYCicadaCallVoidObject(player, NSSelectorFromString(@"setDelegate:"), self);
    SYCicadaCallVoid(player, NSSelectorFromString(@"prepare"));

    // 首帧看门狗：firstFrameTimeout 秒内无首帧即报错（硬解时走软解重试，软解时上报失败）。
    __weak typeof(self) weakSelf = self;
    NSUInteger generation = self.generation;
    self.firstFrameWatchdog = [NSTimer scheduledTimerWithTimeInterval:self.firstFrameTimeout repeats:NO block:^(NSTimer *timer) {
        SYCicadaLivePlayer *owner = weakSelf;
        if (!owner || generation != owner.generation || owner.destroyed) return;
        if (owner.firstFrameReported || owner.state == SYCicadaLivePlayerStateFailed) return;
        [owner reportErrorWithCode:-1001 message:[NSString stringWithFormat:@"CicadaPlayer %.0f 秒内未显示首帧", owner.firstFrameTimeout]];
    }];
    // onPrepared 回调的 selector 拼写未在二进制中直接确认：0.5 秒后无论是否收到
    // 回调都按已准备处理，保证起播不会因回调缺失而卡住。
    self.preparedFallbackTimer = [NSTimer scheduledTimerWithTimeInterval:SYCicadaLivePreparedFallbackDelay repeats:NO block:^(NSTimer *timer) {
        SYCicadaLivePlayer *owner = weakSelf;
        if (!owner || generation != owner.generation || owner.destroyed) return;
        [owner handlePrepared];
    }];
    [self startPollTimer];
}

// CicadaUrlSource 的创建：头文件写的是实例方法 -urlWithString:，
// cctvhost 适配器按类方法 +urlWithString: 调用并已验证。两路都试，
// 各走 respondsToSelector 守卫，哪路通走哪路。
- (nullable id)makeUrlSourceWithClass:(Class)sourceClass {
    SEL classSel = NSSelectorFromString(@"urlWithString:");
    @try {
        if ([sourceClass respondsToSelector:classSel]) {
            id source = ((id (*)(id, SEL, id))objc_msgSend)(sourceClass, classSel, self.url.absoluteString);
            if (source) return source;
        }
    } @catch (NSException *e) {}
    @try {
        id source = [[sourceClass alloc] init];
        if (source && [source respondsToSelector:classSel]) {
            ((void (*)(id, SEL, id))objc_msgSend)(source, classSel, self.url.absoluteString);
            return source;
        }
    } @catch (NSException *e) {}
    return nil;
}

- (void)start {
    if (self.destroyed || !self.player) return;
    if (!self.preparedReported) {
        // 尚未准备好：先记下，准备就绪（回调或 0.5 秒兜底）后自动起播。
        self.startRequested = YES;
        return;
    }
    self.startRequested = NO;
    self.paused = NO;
    self.completedReported = NO;
    if (self.startPosition > 0 && !self.startPositionApplied) {
        self.startPositionApplied = YES;
        [self seekToTime:self.startPosition];
    }
    if (self.hasPendingRate) [self applyPendingRate];
    SYCicadaCallVoid(self.player, NSSelectorFromString(@"start"));
    if (self.state != SYCicadaLivePlayerStateFailed) {
        self.state = SYCicadaLivePlayerStatePlaying;
    }
}

- (void)pause {
    if (self.destroyed || !self.player) return;
    self.startRequested = NO;
    self.paused = YES;
    SYCicadaCallVoid(self.player, NSSelectorFromString(@"pause"));
}

- (void)resume {
    if (self.destroyed || !self.player) return;
    if (!self.preparedReported) {
        self.startRequested = YES;
        return;
    }
    self.paused = NO;
    SYCicadaCallVoid(self.player, NSSelectorFromString(@"start"));
    if (self.state != SYCicadaLivePlayerStateFailed) {
        self.state = SYCicadaLivePlayerStatePlaying;
    }
}

- (void)seekToTime:(NSTimeInterval)seconds {
    if (self.destroyed || !self.player || !isfinite(seconds)) return;
    if (![self.player respondsToSelector:NSSelectorFromString(@"seekToTime:seekMode:")]) return;
    // CICADA_SEEKMODE_ACCURATE（0x01，见 CicadaSDK.h；cctvhost 适配器同值）。
    SYCicadaCallVoidDoubleLong(self.player, NSSelectorFromString(@"seekToTime:seekMode:"), MAX(0, seconds), 0x01);
}

- (void)setRate:(float)rate {
    if (!isfinite(rate)) return;
    self.pendingRate = MIN(3.0f, MAX(0.5f, rate));
    self.hasPendingRate = YES;
    [self applyPendingRate];
}

- (void)applyPendingRate {
    if (!self.player || !self.hasPendingRate) return;
    SYCicadaCallVoidDouble(self.player, NSSelectorFromString(@"setRate:"), (double)self.pendingRate);
}

- (void)stop {
    if (self.destroyed || !self.player) return;
    self.startRequested = NO;
    SYCicadaCallVoid(self.player, NSSelectorFromString(@"stop"));
    if (self.state != SYCicadaLivePlayerStateFailed) self.state = SYCicadaLivePlayerStateIdle;
}

- (void)destroy {
    if (self.destroyed && !self.player) return;
    self.destroyed = YES;
    self.generation++;
    [self.pollTimer invalidate]; self.pollTimer = nil;
    [self.firstFrameWatchdog invalidate]; self.firstFrameWatchdog = nil;
    [self.preparedFallbackTimer invalidate]; self.preparedFallbackTimer = nil;
    id player = self.player;
    self.player = nil;
    self.config = nil;
    if (player) {
        // 先摘 delegate 再停，避免拆解过程中的回调落到已释放的播放器。
        SYCicadaCallVoidObject(player, NSSelectorFromString(@"setDelegate:"), nil);
        SYCicadaCallVoid(player, NSSelectorFromString(@"stop"));
        SYCicadaCallVoid(player, NSSelectorFromString(@"destroy"));
    }
    self.state = SYCicadaLivePlayerStateIdle;
}

// ---------- 控制 ----------

- (void)applyVideoGravity:(NSString *)gravity {
    if (!self.player) return;
    // CicadaScalingMode（见 CicadaSDK.h）：0=SCALETOFILL、1=SCALEASPECTFIT、
    // 2=SCALEASPECTFILL。旧映射把 ResizeAspect 错写成 0、Resize 错写成 2，
    // 与直连路径用的命名常量正好颠倒（cctvhost 已修正）。
    int mode = 1;
    if ([gravity isEqualToString:AVLayerVideoGravityResizeAspectFill]) mode = 2;
    else if ([gravity isEqualToString:AVLayerVideoGravityResize]) mode = 0;
    SYCicadaCallVoidInt(self.player, NSSelectorFromString(@"setScalingMode:"), mode);
}

- (void)setMuted:(BOOL)muted {
    if (!self.player) return;
    SYCicadaCallVoidBool(self.player, NSSelectorFromString(@"setMuted:"), muted);
    SYCicadaCallVoidFloat(self.player, NSSelectorFromString(@"setVolume:"), muted ? 0.0f : 1.0f);
}

- (void)setVolume:(float)volume {
    if (!self.player) return;
    float clamped = fmaxf(0.0f, fminf(1.0f, volume));
    SYCicadaCallVoidFloat(self.player, NSSelectorFromString(@"setVolume:"), clamped);
}

// ---------- 位置轮询（首帧兜底） ----------

- (NSTimeInterval)currentPosition {
    if (!self.player) return 0;
    NSTimeInterval position = SYCicadaCallDouble(self.player, NSSelectorFromString(@"currentPosition"));
    return SYCicadaLiveNormalizeTimeValue(@(position));
}

- (NSTimeInterval)duration {
    if (!self.player) return 0;
    NSTimeInterval duration = SYCicadaCallDouble(self.player, NSSelectorFromString(@"duration"));
    if (duration <= 0) duration = SYCicadaCallDouble(self.player, NSSelectorFromString(@"getDuration"));
    return SYCicadaLiveNormalizeTimeValue(@(duration));
}

- (void)reportVODProgressWithPosition:(NSTimeInterval)position duration:(NSTimeInterval)duration {
    if (self.completedReported) return;
    if ([self.delegate respondsToSelector:@selector(cicadaLivePlayer:didUpdatePosition:duration:)]) {
        [self.delegate cicadaLivePlayer:self didUpdatePosition:position duration:duration];
    }
    // 播完兜底：位置到达时长末尾即视为播完（onCompletion 未到时也生效）。
    if (self.state == SYCicadaLivePlayerStatePlaying && duration > 0 && position >= duration - 0.1) {
        [self handleCompletion];
        return;
    }
    // 卡顿超时：首帧后 15 秒位置无推进即报错，交给调用方切线；暂停时不计。
    // 网络卡顿不是解码问题，不走软解重试，直接上报失败。
    if (self.firstFrameReported && !self.paused && self.state == SYCicadaLivePlayerStatePlaying) {
        if (position > self.lastProgressPosition + 0.5) {
            self.lastProgressPosition = position;
            self.stallSeconds = 0;
        } else if (++self.stallSeconds >= 15) {
            self.stallSeconds = 0;
            [self reportErrorWithCode:-1003 message:@"CicadaPlayer 缓冲超时" allowSoftwareRetry:NO];
        }
    } else {
        self.stallSeconds = 0;
        self.lastProgressPosition = position;
    }
}

- (void)handleCompletion {
    if (self.completedReported || self.destroyed) return;
    self.completedReported = YES;
    self.state = SYCicadaLivePlayerStateIdle;
    if ([self.delegate respondsToSelector:@selector(cicadaLivePlayerDidComplete:)]) {
        [self.delegate cicadaLivePlayerDidComplete:self];
    }
}

- (void)startPollTimer {
    [self.pollTimer invalidate];
    __weak typeof(self) weakSelf = self;
    NSUInteger generation = self.generation;
    self.pollTimer = [NSTimer scheduledTimerWithTimeInterval:SYCicadaLivePositionPollInterval repeats:YES block:^(NSTimer *timer) {
        SYCicadaLivePlayer *owner = weakSelf;
        if (!owner || generation != owner.generation || owner.destroyed || !owner.player) return;
        NSTimeInterval position = owner.currentPosition;
        // 首帧兜底：位置推进即视为画面已出（onFirstFrameShow 未到时也生效）。
        if (!owner.firstFrameReported && position > 0.5) [owner handleFirstFrame];
        if (owner.vodMode) [owner reportVODProgressWithPosition:position duration:owner.duration];
    }];
}

// ---------- 内部状态机（主线程） ----------

- (void)handlePrepared {
    if (self.preparedReported || self.destroyed) return;
    self.preparedReported = YES;
    [self.preparedFallbackTimer invalidate]; self.preparedFallbackTimer = nil;
    if (self.startRequested) [self start];
}

- (void)handleFirstFrame {
    if (self.firstFrameReported || self.destroyed) return;
    self.firstFrameReported = YES;
    [self.firstFrameWatchdog invalidate]; self.firstFrameWatchdog = nil;
    [self.preparedFallbackTimer invalidate]; self.preparedFallbackTimer = nil;
    // 点播要持续轮询进度/播完/卡顿，首帧后不停止轮询；直播仍按旧逻辑停掉。
    if (!self.vodMode) { [self.pollTimer invalidate]; self.pollTimer = nil; }
    if ([self.delegate respondsToSelector:@selector(cicadaLivePlayerDidShowFirstFrame:size:)]) {
        [self.delegate cicadaLivePlayerDidShowFirstFrame:self size:self.videoSize];
    }
}

- (void)reportErrorWithCode:(NSInteger)code message:(NSString *)message {
    [self reportErrorWithCode:code message:message allowSoftwareRetry:YES];
}

- (void)reportErrorWithCode:(NSInteger)code message:(NSString *)message allowSoftwareRetry:(BOOL)allowSoftwareRetry {
    if (self.destroyed || self.state == SYCicadaLivePlayerStateFailed) return;
    // 硬解失败时先重试一次软解（与 cctvhost 的软件解码重试一致）：
    // 拆掉当前播放器，用 setEnableHardwareDecoder:NO 重建。软解也失败
    // 或已重试过，才真正上报失败。
    if (allowSoftwareRetry && self.enableHardwareDecoder && !self.softwareRetryDone && self.player) {
        self.softwareRetryDone = YES;
        NSTimeInterval retryPosition = [self currentPosition];
        id player = self.player;
        self.player = nil;
        self.config = nil;
        [self.pollTimer invalidate]; self.pollTimer = nil;
        [self.firstFrameWatchdog invalidate]; self.firstFrameWatchdog = nil;
        [self.preparedFallbackTimer invalidate]; self.preparedFallbackTimer = nil;
        self.preparedReported = NO;
        self.firstFrameReported = NO;
        self.startRequested = YES;
        // 点播重试：从断点续播，而不是回到起播位置；直播保持 0，不 seek。
        if (self.vodMode) { self.startPosition = MAX(self.startPosition, retryPosition); self.startPositionApplied = NO; }
        if (player) {
            SYCicadaCallVoidObject(player, NSSelectorFromString(@"setDelegate:"), nil);
            SYCicadaCallVoid(player, NSSelectorFromString(@"stop"));
            SYCicadaCallVoid(player, NSSelectorFromString(@"destroy"));
        }
        self.state = SYCicadaLivePlayerStatePreparing;
        [self prepareWithHardwareDecoder:NO];
        return;
    }
    self.state = SYCicadaLivePlayerStateFailed;
    [self.firstFrameWatchdog invalidate]; self.firstFrameWatchdog = nil;
    NSError *error = [NSError errorWithDomain:SYCicadaLivePlayerErrorDomain
                                         code:code
                                     userInfo:@{NSLocalizedDescriptionKey: message ?: @"CicadaPlayer 播放失败",
                                                @"extension": self.url.pathExtension.lowercaseString ?: @""}];
    if ([self.delegate respondsToSelector:@selector(cicadaLivePlayer:didFailWithError:)]) {
        [self.delegate cicadaLivePlayer:self didFailWithError:error];
    }
}

// ---------- SDK Delegate 回调 ----------
//
// 以下 5 个 selector 在 CicadaPlayerSDK 二进制中以字符串形式确认；
// 其余只在 C++ 层或头文件中确认，拼写为 best-effort。
// SDK 可能在非主线程回调，一律先切主线程、再按 generation 过滤。
// 全部实现 CicadaDelegate 协议的方法，避免 SDK 无 respondsToSelector
// 守卫调用时因未实现而崩溃。

- (void)onPlayerEvent:(id)player eventType:(NSUInteger)eventType {
    // CicadaEventType（见 CicadaSDK.h）：0=PrepareDone、1=AutoPlayStart、
    // 2=FirstRenderedStart（首帧）、3=Completion、4=LoadingStart、
    // 5=LoadingEnd、6=SeekEnd、7=LoopingStart。
    if (eventType == 0) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!self.destroyed && (!player || !self.player || player == self.player)) [self handlePrepared];
        });
    } else if (eventType == 2) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!self.destroyed && (!player || !self.player || player == self.player)) [self handleFirstFrame];
        });
    } else if (eventType == 3) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!self.destroyed && (!player || !self.player || player == self.player)) [self handleCompletion];
        });
    }
}

- (void)onError:(id)player errorModel:(id)errorModel {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.destroyed || (player && self.player && player != self.player)) return;
        NSInteger code = SYCicadaLiveCodeFromModel(errorModel);
        NSString *message = SYCicadaLiveStringFromModel(errorModel, @[@"errorMsg", @"message", @"localizedDescription"]);
        [self reportErrorWithCode:code message:message ?: @"CicadaPlayer 播放失败"];
    });
}

- (void)onPlayerStatusChanged:(id)player oldStatus:(id)oldStatus newStatus:(id)newStatus {
    // 状态值未确认，不读参数；播放/暂停由调用方显式控制。这里只作代收点。
}

- (void)onCurrentPositionUpdate:(id)player position:(id)position {
    // 注意：position 参数的类型（NSNumber 还是原始 int64）无法从二进制确认；
    // 这里不读它，改走轮询读到的 currentPosition，避免类型猜错导致崩溃。
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.destroyed) return;
        NSTimeInterval seconds = self.currentPosition;
        if (!self.firstFrameReported && seconds > 0.5) [self handleFirstFrame];
    });
}

- (void)onBufferedPositionUpdate:(id)player position:(id)position {
    // 直播不关心缓冲位置，只作代收点，避免未实现回调。
}

- (void)onLoadingProgress:(id)player progress:(id)progress {
    // progress 参数类型未确认，不读它；直播不做缓冲 UI，只作代收点。
}

- (void)onCurrentDownLoadSpeed:(id)player progress:(float)speed {
    // 直播不做测速，只作代收点，避免未实现回调。
}

- (void)onVideoSizeChanged:(id)player width:(int)width height:(int)height rotation:(int)rotation {
    // 宽高/旋转按 CicadaSDK.h 声明的 int 读取；SDK 上报尺寸变化本身即证明有视频轨。
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.destroyed) return;
        _hasVideoTrack = YES;
        if (width > 0 && height > 0) self.videoSize = CGSizeMake(width, height);
        if (!self.firstFrameReported) [self handleFirstFrame];
    });
}

- (void)onVideoRendered:(id)player timeMs:(int64_t)timeMs pts:(int64_t)pts {
    // 首帧已渲染的又一信号；位置轮询已覆盖，这里只作代收点。
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.destroyed && !self.firstFrameReported && timeMs > 0) [self handleFirstFrame];
    });
}

// Best-effort 回调（selector 拼写未在二进制中直接确认，见文件头注释）。
- (void)onPrepared:(id)player {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.destroyed) [self handlePrepared];
    });
}

- (void)onFirstFrameShow:(id)player {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.destroyed) [self handleFirstFrame];
    });
}

- (void)onCompletion:(id)player {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.destroyed) [self handleCompletion];
    });
}

- (void)onLoadingStart:(id)player {
    // 直播不做缓冲 UI，只作代收点。
}

- (void)onLoadingEnd:(id)player {
    // 直播不做缓冲 UI，只作代收点。
}

- (void)onSeekEnd:(id)player {
    // 直播不 seek，只作代收点。
}

@end
