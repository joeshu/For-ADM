# DetailPlayerStabilityKit (iOS)

`PlaybackCommandGate`、`PlaybackSessionCoordinator`、`DetailPlayerContainerView` 和 `IOSHardwareSessionGuard` 已接入详情页原生播放运行时。

- `PlaybackCommandGate` 负责播放上下文、内核 attempt、事件序号、确认进度、seek 完成和自动恢复预算。
- `PlaybackRuntimeBridge` 把同一个 AVPlayer/Cicada 会话的状态、进度、首帧和 seek 结果交给 `PlaybackSessionCoordinator`。它使用代理 engine 转发播放、暂停和 seek，不创建第二个解码器；coordinator 的自动重试关闭，恢复仍由现有恢复预算控制。
- UIKit 详情页把当前 AVPlayer 或 Cicada 渲染视图挂到 `DetailPlayerContainerView.stageView`。海报保留到真实首帧出现；加载提示同时响应 Web 状态和 coordinator 的缓冲状态。详情页原生进度条仍由现有滚动内容承载，容器内的备用 slider 不显示。
- `IOSHardwareSessionGuard` 接收系统音频中断和耳机断开事件，保留用户播放意图、暂停当前内核、按系统恢复标志续播；它还管理播放时的屏幕常亮、内存警告下的媒体预载清理，以及带原站请求头的下一集 asset 预热。预载最多保留两个 asset。

## 构建

在 macOS/Xcode 环境运行 `bash tools/build-macos.sh`。脚本用 iPhoneOS SDK 编译 Swift 源码并生成 `SanyuanPlayback-Swift.h`，再与 Objective-C 播放器链接。`/usr/lib/swift/` 依赖由 iOS 系统提供；需要随应用分发的 Swift 运行库由 `swift-stdlib-tool` 收集，放入 App 的 `Frameworks` 和 IPA 的 `SwiftSupport/iphoneos`。校验器只要求应用依赖的运行库齐全，系统库无需重复嵌入。CI 还运行包内 Swift 状态机和中断回归测试。

Linux 下的 LLVM 源码构建已停用：它没有 iPhoneOS SDK，也不能生成本包的 Objective-C 桥接头。`tools/cross-build.py` 只接受 SDK 编译好的二进制及 `swift-stdlib-tool` 输出的运行时目录。

## 审计边界

包内 `AVPlayerEngine` 不用于当前 App：它会独立创建 AVPlayer，绕过现有 HLS 代理、请求头和 Cicada fallback。`PlayerFullscreenTransitionController` 也尚未接入详情页操作控件；本次接入覆盖会话、播放器容器、seek、硬件事件和下一集预热，不改变全屏交互。`PlaybackSessionCoordinator.onRefreshSignedURL` 由 Web 播放适配器的 URL 刷新流程负责，因此当前桥接不会调用它。

Linux 工作区没有 Xcode/iOS SDK，无法本地编译 Swift/UIKit 桥接或验证真实设备音频路由。发布验证仍要查看 GitHub macOS 构建和模拟器 smoke workflow；真实设备播放与耳机路由行为需要在 iPhone/iPad 上抽查。
