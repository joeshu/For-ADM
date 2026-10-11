# 瓜子影视统一适配

参考作者“怎么肥事”的 [ZenmoFeiShi/Qx 规则](https://raw.githubusercontent.com/ZenmoFeiShi/Qx/refs/heads/main/TilingSales_ad_remove.snippet)。原 snippet 和 TilingSales_getNav.js 完整快照在 upstream/ 保存，未修改。

17 条 reject-dict、6 条响应处理、13 个 MITM 主机及原匹配正则全部保留。6 条响应规则改为调用本仓库独立 guazi-app/ad-clean.js，RSA/AES 只在瓜子独立脚本中打包，运行时不再下载上游 JS。

保留能力：getNav 过滤 read/game/micro/music；barsPlayAdInfo 和 vodAdvertisement 返回加密空数组，playAdInfo 返回加密空对象；showOne 修改 VIP/展示字段、收藏默认字段和来源过滤；vurlDetail 清理名称、规范分辨率及降序排序。这些字段修改不能保证服务器授予会员权限。

统一订阅仍含全部规则，只在瓜子接口命中时加载加密脚本，其他网站的统一响应脚本不包含加密库。每个脚本按自身生成内容计算缓存版本，网站更新不再连带失效瓜子脚本；仍只需维护一份订阅。

优化：依赖放入局部作用域并按需初始化，不污染其他模块；统一引擎只调用一次真实 $done；HTTP 错误、鉴权错误、无效密钥/密文、未知解密结构原样放行。原文件完整快照便于追溯，上游脚本更新需审核后重新打包。

离线用 Node 原生 RSA/AES 生成加密样本，验证全部六类转换、密文回写、重复执行和播放字段保留。未完成手机效果测试；不处理 HLS。

## 本轮优化

CryptoJS 按需打包 AES 所需模块，RSA 保持原实现。瓜子脚本从 136,725 字节缩至约 87 KB，能力仍含六类响应处理。增加 Hex 分组长度、PKCS#7 全部填充字节及 key/IV 长度校验；错误响应原样放行。新增中文、大响应、错误密钥、错误填充、AES-128/192/256 和独立缓存版本测试。
