# 聚爷爷网页广告

统一规则：<https://raw.githubusercontent.com/joeshu/For-ADM/master/universal/quantumult-x-snippet.conf>

独立规则：<https://raw.githubusercontent.com/joeshu/For-ADM/master/juyeye/quantumult-x-snippet.conf>

默认关闭日志，不处理 HLS；统一版与独立版择一启用。

## 已确认的广告核心

用户提供的 2026-10-11 手机详情页响应包含一段内嵌字符替换混淆 JS。它位于 HTML 底部，并不通过独立 script/src 文件加载。离线提取替换表及 payload 的 substr(10)，没有执行广告代码。

解码内容确认：广告标识 eyypzysx、编号 7505；touchend 捕获底部触摸并跳转动态 3vvjqio.com:8004/cc/7505 地址；注入 4×10 透明固定网格；延迟加载 /d/7505 与 /sc/7505 广告脚本；设置 body 底部留白；特定浏览器通过 WebSocket 获取并执行广告内容。

因此从 HTML 移除这段入口即可阻止后续加载和底部点击层，无需新增动态广告域名 MITM。

## 精确修改

只登记 www.juyeye.cc。首页、index.html 和 voddetail/vodplay/vodtype/vodshow/vodsearch 的 HTML 页面使用相同处理，实际确认的源码为 `/voddetail/96188.html`。其他路径、发布页 www.juyeye.vip、裸域和未来镜像不自动加入。

HTML 先要求 mxtheme/home.js、maccms 及 www.juyeye.cc 标记同时存在，再只删除无 src 的 script，其正文必须同时包含：字符替换包装、new Function(b)()、substr(10) 包装、编码后的广告标识 YTTJ4TLR 和编号 1n0n。任一特征变化即保留原文，不按所有 new Function 或所有内嵌脚本删除。

复用共享 removeInlineScripts 操作，仅扫描真实 script 标签；注释、样式、外链脚本中的相似内容保留。home.js、script.js、jQuery、轮播、弹层库、皮肤切换、平台判断变量、验证码和公告保留；不修改播放器地址、鉴权或线路。

## 验证及限制

真实抓包详情页：17 段 script 中恰好删除 1 段广告，其余 16 段逐字保留；所有选集链接、站长公告保留；随后按用户要求精确取消电脑 404 跳转，重复执行结果不变。仓库仅提交最小合成保护样本，不提交抓包 Cookie、会话标识或完整原始请求。

播放页同类广告可在满足相同五个指纹时处理；当前尚未取得真实播放页响应，播放器和下一集保护使用模拟样本，不能宣称已完成手机播放实测。后续可提供播放页响应核对是否有另一段广告或不同编号。视频中的广告和 HLS 不处理。

规则不绕过系统安全验证。正常页面的电脑 404 跳转已按用户要求取消；服务端直接返回 404/验证页面时仍保持原文。更新后刷新 Quantumult X 远程规则与脚本缓存。

## 取消正常页面的电脑 404 跳转

只在上述站点 HTML 指纹成立时定位无 src 的内嵌 script，并要求 system 初始化、navigator.platform、system.ispc 赋值、完整手机 UA 判断及完整条件判断同时存在。支持 system.ispc 赋值与 UA 判断之间换行（包括用户提供的两行格式）。只将唯一的 `window.location.href = "../404.html";` 替换为注释。原变量、平台判断、if 结构及其他导航均保留；必要指纹变化或语句重复时不修改。

共享 replaceInlineScripts 操作复用精确次数成组替换，不匹配注释、样式或外链脚本。实际抓包验证：1 段广告移除、1 段平台判断只改跳转行，其余 15 段 script 逐字保留。Windows/Mac/Linux/iPhone 条件样本确认不再执行这行跳转；未进行真实电脑浏览器端访问成功验证，因为服务器可能直接返回错误或验证页。
