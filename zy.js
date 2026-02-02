# > 微信公众号
[rewrite_local]
# 公众号文章下方广告
^https?:\/\/mp\.weixin\.qq\.com\/mp\/getappmsgad url response-body advertisement response-body fmz200
# 微信公众号去除商品推广
^https?:\/\/mp\.weixin\.qq\.com\/mp\/cps_product_info\?action url reject-dict
[mitm]
hostname = mp.weixin.qq.com
