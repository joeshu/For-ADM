# 直播 Cicada 软解回退

## 触发条件

直播时 AVPlayer 报 `audioOnly`（视频轨道数为 0，有声音没画面，典型如咪咕 H.265
流），Native 在同一条代理地址上换 Cicada 软解，**不换源、不换线**。`videoTrackUnknown`
（轨道检查本身出错）不触发回退。

## 流程

```
audioOnly → cicadaFallback（正在尝试软解播放，当前线路保持不变…）
  → 首帧 cicadaVideoReady（正在用软解播放 · 宽×高 hevc）
  → Cicada 也失败 → 回落 audioOnly（恢复 AVPlayer 声音，不换线）
```

- 硬解优先：先走 AVPlayer，只有 `audioOnly` 才尝试 Cicada。
- 硬解失败自动重试一次软解：Cicada 内部硬解失败后自动用软解再试一次；同一条
  线路只尝试一次 Cicada 回退（`cicadaFallbackAttempted`），切台/切线后重置。
- 首帧看门狗 20 秒：Cicada 20 秒内不出首帧即判失败，回落 `audioOnly`。
- Cicada 激活期间 Native 不发 `progress` 事件，Web 侧 18 秒停滞看门狗不会误触发；
  `cicadaFallback` / `cicadaVideoReady` / 回落的 `audioOnly` 都会复位看门狗基线。

## 生命周期

切台、切线、新开播、退出直播、停止播放时都释放 Cicada 播放器
（`destroyCicadaPlayer`）。AVPlayer 与 Cicada 不同时跑：回退时 AVPlayer 暂停，
Cicada 失败后 AVPlayer 恢复声音。

## 限制

- 框架为 arm64 真机 thin 包，`Frameworks/CicadaPlayerSDK.framework` 与
  `Frameworks/alivcffmpeg.framework` 只在真机构建链接并嵌入 `.app/Frameworks`；
  模拟器构建不链接 Cicada，`isAvailable` 为 NO，回退不可用。
- 未编译、无真机验证：HEVC-TS 解码依赖 Cicada 自带 ffmpeg 构建，首帧耗时与
  码率表现未经真机确认。
- Web 侧 `cicadaVideoReady` 的 `hevc` 是展示用标签（回退专为 AVPlayer 拒解的
  HEVC 流），不是从流里解析出的编解码器名。
