# 瓜子影视 App 广告接口

参考来源：[ZenmoFeiShi/Qx TilingSales_ad_remove.snippet](https://raw.githubusercontent.com/ZenmoFeiShi/Qx/refs/heads/main/TilingSales_ad_remove.snippet)，作者“怎么肥事”，源文件标注更新 2026-08-11。

纳入统一配置：13 个明确 API 主机、17 个专用广告请求端点，使用 Quantumult X 原生 reject-dict。接口只匹配完整路径及可选查询串，不匹配相似接口、其他主机或整段 /App/ 路径。新域名需要核验后手动加入，不自动扩大。

来源的配套 TilingSales_getNav.js 使用 RSA 解出 AES 参数，再解密和回写 response_key。本次没有复制其加密库或密钥，也没有接入 barsPlayAdInfo、playAdInfo、vodAdvertisement 的加密响应改写。getNav 删除内容频道不等于去广告；showOne 修改 VIP 与来源列表、vurlDetail 改名和排序均未采用。播放、用户、会员及媒体流接口保持原样。

这是 App API 规则，不是通用网页广告清理。只完成来源源码核验与规则边界离线测试，尚未完成设备效果测试；无法承诺清除全部广告。首次测试请检查首页和播放功能。
