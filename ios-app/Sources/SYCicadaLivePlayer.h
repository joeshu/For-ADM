// SYCicadaLivePlayer.h
//
// CicadaPlayer 直播播放器：把 ffmpeg 内核的 CicadaPlayer 包装成直播可用的播放器。
// 用于 AVPlayer 解不出来的直播流（如咪咕 H.265 + MPEG-TS，AVPlayer 报 audioOnly）。
//
// 关键约束：本文件不 import、不链接 CicadaSDK 的任何符号（模拟器构建不链接
// CicadaPlayerSDK，且无 -Wl,-undefined,dynamic_lookup）。所有 SDK 交互都走
// NSClassFromString + respondsToSelector + objc_msgSend 运行时调用；
// SDK 不存在时 +isAvailable 返回 NO，绝不崩溃。
// 复用 cctvhost MediaPlaybackCicadaAdapter 的反射手法与关键映射，但只做直播：
// 起播、出首帧、持续播放、停止/释放。不做点播逻辑（seek/倍速/时长/进度/完成）。
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

- (void)prepare;
// 硬解开关：默认 YES（硬件优先）。硬解失败时内部自动重试一次软解。
- (void)prepareWithHardwareDecoder:(BOOL)enableHardwareDecoder;
- (void)start;
- (void)stop;
- (void)destroy;
// gravity 取 AVLayerVideoGravityResizeAspect / ResizeAspectFill / Resize；
// 映射到 CicadaPlayer scalingMode（0=SCALETOFILL、1=SCALEASPECTFIT、
// 2=SCALEASPECTFILL）。SDK 不支持时静默保留默认。
- (void)applyVideoGravity:(NSString *)gravity;

@end

NS_ASSUME_NONNULL_END
