// SYCicadaLivePlayer.h
//
// CicadaPlayer 直播播放器：把 ffmpeg 内核的 CicadaPlayer 包装成直播可用的播放器。
// 用于 AVPlayer 解不出来的直播流（如咪咕 H.265 + MPEG-TS，AVPlayer 报 audioOnly）。
//
// 关键约束：本文件不 import、不链接 CicadaSDK 的任何符号（模拟器构建不链接
// CicadaPlayerSDK，且无 -Wl,-undefined,dynamic_lookup）。所有 SDK 交互都走
// NSClassFromString + respondsToSelector + objc_msgSend 运行时调用；
// SDK 不存在时 +isAvailable 返回 NO，绝不崩溃。
// 复用 cctvhost MediaPlaybackCicadaAdapter 的反射手法与关键映射，直播裁剪；
// 点播模式（vodMode）另做 seek/倍速/时长/进度/完成/卡顿超时：AVPlayer 点播
// 卡顿时同线同清晰度换 Cicada 解，不切线、不降质。
//
// 直播注意：
//   - networkTimeout 公开 API 按秒收，prepare 里 ×1000 再传 SDK（毫秒单位）。
//   - scalingMode 按 CicadaScalingMode 枚举（0=SCALETOFILL、1=SCALEASPECTFIT、
//     2=SCALEASPECTFILL，见 CicadaSDK.h）。
//   - 首帧信号：onPlayerEvent(CicadaEventFirstRenderedStart=2) /
//     onFirstFrameShow / onVideoSizeChanged / 位置轮询兜底（position > 0.5）。
//   - 硬解失败时自动重试一次软解（setEnableHardwareDecoder:NO），
//     与 cctvhost 的软件解码重试一致。
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, SYCicadaLivePlayerState) {
    SYCicadaLivePlayerStateIdle = 0,
    SYCicadaLivePlayerStatePreparing,
    SYCicadaLivePlayerStatePlaying,
    SYCicadaLivePlayerStateFailed,
};

@protocol SYCicadaLivePlayerDelegate <NSObject>
@optional
// 首帧已出（size 为视频尺寸，未知时为 CGSizeZero）。
- (void)cicadaLivePlayerDidShowFirstFrame:(id)player size:(CGSize)size;
- (void)cicadaLivePlayer:(id)player didFailWithError:(NSError *)error;
// 点播用（vodMode 开启时）：位置/时长进度（约 1 秒一次）、播完。
- (void)cicadaLivePlayer:(id)player didUpdatePosition:(NSTimeInterval)position duration:(NSTimeInterval)duration;
- (void)cicadaLivePlayerDidComplete:(id)player;
@end

@interface SYCicadaLivePlayer : NSObject

// SDK 类是否存在（NSClassFromString(@"CicadaPlayer")）。模拟器构建里为 NO。
+ (BOOL)isAvailable;

- (instancetype)initWithURL:(NSURL *)url
                    headers:(nullable NSDictionary<NSString *, NSString *> *)headers
             networkTimeout:(NSTimeInterval)timeoutSeconds NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

@property (nonatomic, weak, nullable) id<SYCicadaLivePlayerDelegate> delegate;
// 播放器渲染面：调用方把它加进直播 playerHost（满屏约束），不要直接改它的 frame。
@property (nonatomic, readonly) UIView *playerView;
@property (nonatomic, readonly) SYCicadaLivePlayerState state;
@property (nonatomic, readonly) BOOL hasVideoTrack;
// 点播模式：开启后位置轮询持续上报进度、检测播完与卡顿超时，首帧后不停止轮询。
@property (nonatomic) BOOL vodMode;
// 起播位置（秒）：prepare 后首次 start 时先 seek 到这里再播放；直播保持 0。
@property (nonatomic) NSTimeInterval startPosition;
// 首帧看门狗（秒），默认 20。
@property (nonatomic) NSTimeInterval firstFrameTimeout;

- (void)prepare;
// 硬解开关：默认 YES（硬件优先）。硬解失败时内部自动重试一次软解。
- (void)prepareWithHardwareDecoder:(BOOL)enableHardwareDecoder;
- (void)start;
- (void)pause;
- (void)resume;
- (void)stop;
- (void)destroy;
// 点播控制：seek 用 CICADA_SEEKMODE_ACCURATE（0x01，cctvhost 适配器已确认）；
// rate 钳制在 0.5–3.0，内部在 start 时应用。
- (void)seekToTime:(NSTimeInterval)seconds;
- (void)setRate:(float)rate;
- (NSTimeInterval)currentPosition;
- (NSTimeInterval)duration;
// gravity 取 AVLayerVideoGravityResizeAspect / ResizeAspectFill / Resize；
// 映射到 CicadaPlayer scalingMode（0=SCALETOFILL、1=SCALEASPECTFIT、
// 2=SCALEASPECTFILL）。SDK 不支持时静默保留默认。
- (void)applyVideoGravity:(NSString *)gravity;
- (void)setMuted:(BOOL)muted;
- (void)setVolume:(float)volume;

@end

NS_ASSUME_NONNULL_END
