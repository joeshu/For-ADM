# 按需 CryptoJS

来源：官方 crypto-js npm 4.2.0（https://registry.npmjs.org/crypto-js/-/crypto-js-4.2.0.tgz）。保留 core.js、cipher-core.js、aes.js 的 browser/global 构建分支，用于显式 key + IV 的 AES-CBC，不提供口令派生接口或其他算法。RSA 沿用 upstream 原库。

cryptojs-aes.json 记录版本、原模块 SHA-256、压缩器和产物 SHA-256；许可见 LICENSE.crypto-js。现有产物 10,862 字节，替代原约 60,821 字节 CryptoJS 综合库。

重新生成时下载上述固定版本，逐个核对原模块摘要，将三文件按 modules 顺序连接，用 terser@5.44.0 的 ecma:5、compress:true、mangle:true、format.comments:false 压缩，添加现有许可注释。同步摘要后运行 node scripts/check-ad-clean.mjs。正常构建和 CI 不下载 npm 包，也不需要安装压缩器。

生成脚本采用内容摘要作为缓存版本：瓜子仅随自己的源码、依赖及响应保护引擎变化；网站模块更新不会让瓜子脚本缓存一起失效。
