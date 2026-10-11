# 瓜子影视完整原规则

按用户要求完整保留 [ZenmoFeiShi/Qx 原文件](https://raw.githubusercontent.com/ZenmoFeiShi/Qx/refs/heads/main/TilingSales_ad_remove.snippet)（作者“怎么肥事”）。原文件按字节存档在 upstream/TilingSales_ad_remove.snippet。

统一配置和独立配置完整生成原文件的 23 条规则：17 条 reject-dict、6 条 script-response-body，保留原正则、上游脚本 URL、元信息及 13 个 MITM 主机。只增加 Quantumult X 配置段落，不筛选、不收窄域名、不修改路径。

6 条脚本保持引用上游 TilingSales_getNav.js，包含导航清理、3 个加密播放广告接口、影片详情、播放源详情；不经过本仓库统一响应引擎。脚本依赖上游，更新或不可达会影响实际效果。配套脚本中的 VIP 标记、播放源过滤/排序/改名保持原行为。原规则任意主机正则的范围也原样保留。

只完成原文件一致性和生成检查，未设备验证，不承诺会员权限或实际播放效果。
