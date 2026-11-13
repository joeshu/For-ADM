# DetailPlayerStabilityKit (iOS)

> 收录说明（2026-11-13）：本目录原样收录用户上传的 `DetailPlayerStabilityKit-Complete-Bundle.zip`（v1.2.0）中的 Swift 包，未改动源码。
> **当前状态：仅收录，未接入 App。** `ios-app/tools/build-macos.sh` 只编译 `Sources/main.m` 与 `Sources/SYCicadaLivePlayer.m`，没有 Swift 编译步骤，也没有桥接头或 main.m 接线，因此这套代码目前不会进 IPA。
> 随包附带的 `.github/workflows/ios-player-ci-release.yml` 与 `push_and_release.sh` **有意未收入**：前者会在每次 push 到 master 时自动发一个 `v1.2.<run_number>` Release，且要求 `Package.swift` 在仓库根目录；后者会 `git init` 并向 master 推送全新历史，均与本仓库的发布流程冲突。
> 在 Mac 上验证本包：`cd ios-app/DetailPlayerStabilityKit && swift test`（12 项单元测试）。

详情页播放器全链路防跳动与 iOS 真机优化套件（面向 `https://github.com/joeshu/For-ADM/tree/master/ios-app`）。

## 目录结构
- `Sources/DetailPlayerStabilityKit/PlayerEngineProtocol.swift`: 统一 `AVPlayer` / `CicadaPlayer` / `SFPlayer` 内核协议与状态机
- `Sources/DetailPlayerStabilityKit/PlaybackSessionCoordinator.swift`: `SessionID` 防串台、`Seek` 防回弹锁、`300ms` 缓冲防抖、指数退避与 `HTTP 403` 自动换签
- `Sources/DetailPlayerStabilityKit/DetailPlayerContainerView.swift`: 固定 `16:9` 纵横比防重排、iOS 16+ `requestGeometryUpdate` 无损全屏迁移、侧滑手势互斥与底部 Home Bar 防误触
- `Sources/DetailPlayerStabilityKit/IOSHardwareSessionGuard.swift`: 来电中断自动恢复、AirPods 断开静默暂停、75% 进度下一集预热与内存警告清理
- `Tests/DetailPlayerStabilityKitTests/PlaybackCoordinatorTests.swift`: 12 项核心稳定性单元测试
- `.github/workflows/ios-player-ci-release.yml`: GitHub Actions 自动编译、跑测与 IPA Release 发布流水线
- `push_and_release.sh`: 一键推送至 GitHub 触发构建与发布脚本
