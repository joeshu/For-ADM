/******************
# 移除球竞弹窗推广
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/(8|11)(\?.*)?$ response-body-json-jq 'if (.data|type)=="array" then .data=[] else . end'

# 移除球竞轮播广告
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v3\/index\/all\?.*position=2.*$ response-body-json-jq 'if (.data|type)=="object" and (.data.banners|type)=="array" then .data.banners=[] else . end'
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/6(\?.*)?$ response-body-json-jq 'if (.data|type)=="array" then .data=[] else . end'

# 移除球竞我的页面推广
^https?:\/\/gateway-api\.yizhilive\.com\/api\/v2\/index\/carouses\/3(\?.*)?$ response-body-json-jq 'if (.data|type)=="array" then .data=[] else . end'

hostname= gateway-api.yizhilive.com
***************************/
