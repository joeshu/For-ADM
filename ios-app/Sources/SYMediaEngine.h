// SYMediaEngine.h
// 统一播放引擎协议：抹平 AVPlayer 与 CicadaPlayer 在启停、跳转、倍速、
// 静音、画面比例及进度读取上的接口差异，便于调度层统一控制。
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@protocol SYMediaEngine <NSObject>
@property (nonatomic, readonly) UIView *playerView;
- (void)pause;
- (void)resume;
- (void)stop;
- (void)seekToTime:(NSTimeInterval)seconds;
- (void)setRate:(float)rate;
- (void)setMuted:(BOOL)muted;
- (void)applyVideoGravity:(NSString *)gravity;
- (NSTimeInterval)currentPosition;
- (NSTimeInterval)duration;
@end
