/* * *
脚本功能：喜马拉雅
*******************************
[rewrite_local]
# > 去广告
^https?://passport\.ximalaya\.com/friendship-mobile/v1/findFriendsBanner/show/ url reject
^https?://xdcs-collector\.ximalaya\.com/api/v1/realtime url reject
^https?://adse\.wsa\.ximalaya\.com url reject
^https?://adse\.ximalaya\.com url reject
^https?://ad\.ximalaya\.com url reject
^https?://ulogs\.umeng\.com\/unify_logs url reject
^https?://.+ximalaya\.com/x-web-activity/signIn/getHomePageSignInInfo/ url reject-200
^https?://.+ximalaya\.com/product/promotion/v1/album/price url reject-200
#底部弹出会员购买页面
^https?://mobile\.ximalaya\.com/business-sale-promotion-guide-mobile-web/popup/info/ url reject
[mitm]
hostname = mobwsa.ximalaya.com,mobile.ximalaya.com, apisg.himalaya.com,adse.ximalaya.com,*.ximalaya.com,*.xmcdn.com,ulogs.umeng.com,*.mysteel.*,*xima*,*xmcdn*,*.ximalaya.com,*.xmcdn.com,51*.com,ulogs.umeng.com,passport.ximalaya.com,m.ximalaya.com
***/
