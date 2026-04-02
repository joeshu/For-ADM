/*************************************
项目名称：iTunes-系列解锁合集
更新日期：2026-02-18
脚本作者：@ddm1023
电报频道：https://t.me/ddm1023
使用声明：⚠️仅供参考，🈲转载与售卖！
使用说明：如果脚本无效，请先排除是否脚本冲突
特别说明：此脚本可能会导致App Store无法登录ID
解决方法：关[MITM][脚本][代理工具]方法选一即可
**************************************
[rewrite_local]
^https?:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/iTunes3.js
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/iTunes3.js
^https?:\/\/api\.adaptytech\.com\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/iTunes3.js

[mitm]
hostname = buy.itunes.apple.com,api.adapty.io,api.adaptytech.com

*************************************/


let ddm;
try {
  ddm = JSON.parse($response.body || "{}");
} catch (e) {
  ddm = {};
}

if (!ddm || typeof ddm !== "object") ddm = {};
if (!ddm.receipt || typeof ddm.receipt !== "object") ddm.receipt = {};

const reqHeaders = ($request && $request.headers) ? $request.headers : {};
const ua = reqHeaders["User-Agent"] || reqHeaders["user-agent"] || "";
const bundle_id = ddm.receipt["bundle_id"] || ddm.receipt["Bundle_Id"] || "unknown.bundle";
const yearid = `${bundle_id}.year`;
const yearlyid = `${bundle_id}.yearly`;
const yearlysubscription = `${bundle_id}.yearlysubscription`;
const lifetimeid = `${bundle_id}.lifetime`;

const list = {
  'MaiqiSun': { cm: 'timeb', hx: 'hxpda', id: "life_cn_68", latest: "ddm1023" }, //iSunning
  'CCRemote': { cm: 'timea', hx: 'hxpda', id: "ays.chromo.remote.yearly", latest: "ddm1023" }, //Chromo-Remote
  'PulseWatch': { cm: 'timeb', hx: 'hxpda', id: "relaxlife_ebp", latest: "ddm1023" }, //RelaxWatch:AI智能压力监测
  'PicCompress': { cm: 'timea', hx: 'hxpda', id: "pc_vip_new_1y", latest: "ddm1023" }, //图片压缩
  'XiangCePhoto': { cm: 'timeb', hx: 'hxpda', id: "ql128", latest: "ddm1023" }, //相册清理-删除重复照片
  'FileMaster': { cm: 'timeb', hx: 'hxpda', id: "FileMaster_ProVersion", latest: "ddm1023" },  //文件大师
  'Squeeze': { cm: 'timea', hx: 'hxpda', id: "uk.co.olsonapps.kegeltrainerlite.yearly", latest: "ddm1023" },  //凯格尔运动教练-盆底肌运动
  'Tuesday': { cm: 'timeb', hx: 'hxpda', id: "PIGLET_VIP_Forever", latest: "ddm1023" },  //Tuesday-纪念日
  'IPTV%20Flixana': { cm: 'timeb', hx: 'hxpda', id: "iptv_flixana_lifetime_sub", latest: "ddm1023" },  //IPTV Flixana
  'AdBlocker': { cm: 'timeb', hx: 'hxpda', id: "com.va.adBlocker.lifeTimefree", latest: "ddm1023" },  //AdBlocker
  'ECGPlus': { cm: 'timeb', hx: 'hxpda', id: "com.wms.hrv.pro", latest: "ddm1023" },  //ECG+心电房颤分析
  'PhotosPK': { cm: 'timeb', hx: 'hxpda', id: "indie.davidwang.PicPicks.membership.lifetime", latest: "ddm1023" },  //PicPicks-AI智能照片整理
  'WatchWallpaper': { cm: 'timea', hx: 'hxpda', id: "indie.davidwang.WatchWallpaper.yearsubscriptegold", latest: "ddm1023" },  //表盘专辑
  'com.beauty.MeiTui': { cm: 'timea', hx: 'hxpda', id: "vip_member_v3_365day", latest: "ddm1023" },  //AI美腿
  'ChmReader': { cm: 'timeb', hx: 'hxpda', id: "EpubReader_ProVersion", latest: "ddm1023" },  //Epub阅读器
  'MediaConvert': { cm: 'timeb', hx: 'hxpda', id: "MediaConverter_ProVersion", latest: "ddm1023" },  //格式转换
  'FDSunAlly': { cm: 'timeb', hx: 'hxpda', id: "com.freenotes.sunally.lifetime", latest: "ddm1023" },  //SunAlly-智能健康助力
  'Period': { cm: 'timeb', hx: 'hxpda', id: "com.hanchongzan.time.pro", latest: "ddm1023" },  //时光提醒
  'com.sixiaobo.MusCut': { cm: 'timeb', hx: 'hxpdb', id: "com.purecollage.pro" },  //无损拼图
  'FlashTransportMaster': { cm: 'timea', hx: 'hxpda', id: "com.flashtransport.fightenegery.yearly.base", latest: "ddm1023" },  //时光罐罐
  'com.ideack.ASR': { cm: 'timeb', hx: 'hxpda', id: "ASR_Permanent_Plan", latest: "ddm1023" },  //录音转文字
  'Presets': { cm: 'timea', hx: 'hxpda', id: "com.chromatech.chroma.yearlyAutoRenewable", latest: "ddm1023" },  //Presets:照片处理、图像编辑器
  'GoodTask': { cm: 'timeb', hx: 'hxpda', id: "com.hahainteractive.goodtask3.pro", latest: "ddm1023" },  //代办事项清单-GoodTask
  'com.hanchongzan.loverlist': { cm: 'timeb', hx: 'hxpda', id: "com.hanchongzan.loverlist.01", latest: "ddm1023" },  //恋人清单
  'com.hanchongzan.period': { cm: 'timeb', hx: 'hxpda', id: "com.hanchongzan.period.girl", latest: "ddm1023" },  //姨妈来咯
  'com.hanchongzan.book': { cm: 'timeb', hx: 'hxpda', id: "com.hanchongzan.book.vip", latest: "ddm1023" }, //闪电记账
  'SoundLab': { cm: 'timeb', hx: 'hxpda', id: "8001", latest: "ddm1023" },  //合声-音乐制作
  'ECGANALYZER': { cm: 'timea', hx: 'hxpda', id: "com.wms.hrv.yearlyfamilysharing", latest: "ddm1023" }, //ECG+
  'com.RuoG.Pixiu': { cm: 'timea', hx: 'hxpda', id: "com.RuoG.Pixiu.VIPYear", latest: "ddm1023" }, //貔貅记账
  'com.ideack.BusinessCard': { cm: 'timeb', hx: 'hxpda', id: "BusinessCardVipPerpetual", latest: "ddm1023" }, //名片夹
  'com.ideack.MagicAudio': { cm: 'timeb', hx: 'hxpdb', id: "MagicAudioPermanent", latest: "ddm1023" }, //音乐剪辑
  'DuChuangZhe': { cm: 'timea', hx: 'hxpda', id: "org.zrey.du.main", latest: "ddm1023" }, //独创者
  'PhotoWhite': { cm: 'timeb', hx: 'hxpda', id: "org.zrey.photowhite.flash_lifetime", latest: "ddm1023" },  //印白相册
  'FETreeVideoChange': { cm: 'timeb', hx: 'hxpda', id: "com.dj.videototext.forever", latest: "ddm1023" },  //视频转文字
  '%E5%B0%8F%E5%B0%8F%E7%9B%B8%E6%9C%BA%E5%A4%A7%E5%B8%88': { cm: 'timeb', hx: 'hxpda', id: "com.ai.merge.forever.vip", latest: "ddm1023" },  //乐颜
  'FoodIdentificationTool': { cm: 'timeb', hx: 'hxpda', id: "20002", latest: "ddm1023" },  //剂查查
  'com.qingcheng.seal.Seal': { cm: 'timeb', hx: 'hxpda', id: "com.qingcheng.seal.Seal.premium.forever", latest: "ddm1023" },  //印章制作
  'com.geekapp.VoiceTranslation': { cm: 'timeb', hx: 'hxpda', id: "VoiceTranslatorPerpetual", latest: "ddm1023" },  //出国翻译官
  'com.idealityapp.VideoEditing': { cm: 'timeb', hx: 'hxpda', id: "MagicVideo_Vip_Permanent", latest: "ddm1023" },  //魔影-视频剪辑
  'YinzhangMaster': { cm: 'timeb', hx: 'hxpda', id: "com.xiaoqi.seal.forever", latest: "ddm1023" },  //印章大师
  'com.cuilingshi.flipclock': { cm: 'timeb', hx: 'hxpda', id: "FlipClockProVersion", latest: "ddm1023" },  //翻页时钟
  'com.maine.aifill': { cm: 'timeb', hx: 'hxpda', id: "com.maine.aifill.unlimited", latest: "ddm1023" },  //AI FILL-智能填充.换衣/换背景
  'DeviceFinder': { cm: 'timeb', hx: 'hxpda', id: "com.wonderfind.lifetime", latest: "ddm1023" },  //Wonderfind-设备查找
  'Graphionica': { cm: 'timea', hx: 'hxpda', id: "premium_year", latest: "ddm1023" },  //Graphionica
  'AIAssistant': { cm: 'timea', hx: 'hxpda', id: "AIchat_1w_7.99_trial", latest: "ddm1023" },  //AIAssistant
  'MonitorPlus': { cm: 'timeb', hx: 'hxpda', id: "com.unhonin.MonitorPlus.proversion", latest: "ddm1023" },  //Monitor+
  'MessageHold': { cm: 'timeb', hx: 'hxpda', id: "com.messagehold.forever", latest: "ddm1023" },  //拦截盾
  'co.vulcanlabs': { cm: 'timea', hx: 'hxpda', id: lifetimeid, latest: "ddm1023" },  //vulcanlabs合集
  'Guitar%20Gravitas': { cm: 'timea', hx: 'hxpda', id: "GuitarGravitasChordsScalesArpeggiosLessons", latest: "ddm1023" },  //GuitarGravitas
  'com.eleven.chatgpt': { cm: 'timea', hx: 'hxpda', id: "com.chatgpt.yearly", latest: "ddm1023" },  //ChatAI
  'com.casttv.remotetv': { cm: 'timeb', hx: 'hxpda', id: "liftetime2", latest: "ddm1023" }, //TVRemote电视遥控器
  'WallpaperWidget': { cm: 'timea', hx: 'hxpda', id: "com.widget.theme.yearly.3dayfree", latest: "ddm1023" }, //壁纸主题(需试用)
  'ProREC': { cm: 'timea', hx: 'hxpda', id: "ProAudioCamera_Annual", latest: "ddm1023" }, //ProREC-相机
  'TypeOn%20Keyboard': { cm: 'timeb', hx: 'hxpda', id: "com.hanchongzan.book.vip", latest: "ddm1023" }, //TypeOn
  'PhotoCollagePro': { cm: 'timeb', hx: 'hxpda', id: "PHOTABLE_PREMIUM", latest: "ddm1023" }, //Photable-腹肌P图神器
  'com.alphamobiletech.bodyApp': { cm: 'timeb', hx: 'hxpda', id: "Bodyapp_Forever", latest: "ddm1023" }, //Bodyapp-身材修图软件
  'com.alphamobiletech.facey': { cm: 'timeb', hx: 'hxpda', id: "Facey_Forever", latest: "ddm1023" }, //Facey-专业彩妆P图神器
  'Packet': { cm: 'timeb', hx: 'hxpda', id: "com.aaaalab.nepacket.iap.full", latest: "ddm1023" }, //HTTPS抓包
  'AllMyBatteries': { cm: 'timeb', hx: 'hxpda', id: "AllMyBatteries_Ultimate", latest: "ddm1023" }, //AllMyBatteries-电池管家
  'VDIT': { cm: 'timeb', hx: 'hxpda', id: "me.imgbase.videoday.profeaturesLifetime", latest: "ddm1023" }, //VDIT-视频转换
  'CodeSnippet': { cm: 'timea', hx: 'hxpda', id: "it.beatcode.codesnippetpro.annualSubscription", latest: "ddm1023" }, //CodeSnippet
  'darkWeb': { cm: 'timea', hx: 'hxpda', id: "dforce_unlock_all_functions", latest: "ddm1023" }, //DForce-Safari扩展
  'BookReader': { cm: 'timea', hx: 'hxpda', id: "com.reader.1year", latest: "ddm1023" }, //阅读器-小说阅读器
  'BeatStation': { cm: 'timea', hx: 'hxpda', id: "BS_Pro_Yearly", latest: "ddm1023" }, //BeatStation-节奏工作站
  'FastPlayer': { cm: 'timea', hx: 'hxpda', id: "VideoPlayer_ProVersion", latest: "ddm1023" }, //万能播放器
  'SimpleNotation': { cm: 'timeb', hx: 'hxpda', id: "com.xinlin.notation.once", latest: "ddm1023" }, //简谱大师
  'ChordMaster': { cm: 'timeb', hx: 'hxpda', id: "com.chordMaster.once", latest: "ddm1023" }, //MusicTotor-识谱大师
  'Xfuse': { cm: 'timeb', hx: 'hxpda', id: "com.xfuse.ProVision", latest: "ddm1023" }, //磁力宅播放器
  'com.BertonYc.ScannerOCR': { cm: 'timeb', hx: 'hxpda', id: "Scanner_Subscibe_Permanent", latest: "ddm1023" }, //万能扫描王
  'HRV': { hx: 'hxpdc', id: "com.stress.test.record.yearly", latest: "ddm1023" },  //解压小橘子(需试用)
  'iVCam': { cm: 'timeb', hx: 'hxpda', id: "ivcam.full", latest: "ddm1023" },//iVCam-电脑摄像头
  'RBrowser': { cm: 'timea', hx: 'hxpda', id: "com.mm.RBroswer.product11", latest: "ddm1023" }, //R浏览器(需试用)
  'Filterra': { cm: 'timeb', hx: 'hxpda', id: "com.filterra.wtonetimepurchase", latest: "ddm1023" },//Filterra-照片编辑器
  'MOLDIV': { cm: 'timeb', hx: 'hxpda', id: "com.jellybus.Moldiv.IAP.PRO7999", latest: "ddm1023" },//MOLDIV-视频/照片编辑
  'PICSPLAY': { cm: 'timea', hx: 'hxpda', id: "com.jellybus.PicsPlay2.IAP.PRO5999", latest: "ddm1023" },//PICSPLAY-照片编辑
  'Rookie': { cm: 'timea', hx: 'hxpda', id: "com.jellybus.Rookie.IAP.PRO5999", latest: "ddm1023" },//RKCAM-照片编辑
  'MoneyWiz': { cm: 'timea', hx: 'hxpda', id: "com.moneywiz.personalfinance.1year", latest: "ddm1023" }, //MoneyWiz-个人财务
  'qxzs': { cm: 'timeb', hx: 'hxpda', id: "yongjiu", latest: "ddm1023" },//心率广播
  'Overdrop': { cm: 'timeb', hx: 'hxpda', id: "com.weather.overdrop.forever", latest: "ddm1023" }, //Overdrop-天气预报
  'Boom': { cm: 'timeb', hx: 'hxpda', id: "com.globaldelight.iBoom.LifetimeDiscountPack", latest: "ddm1023" }, //Boom-感受音乐
  'PDFReaderPro%20Free': { cm: 'timeb', hx: 'hxpda', id: "com.pdfreaderpro.free.member.all_access_pack_permanent_license.001", latest: "ddm1023" }, //PDFReaderProFree
  'VideoHelper': { cm: 'timeb', hx: 'hxpda', id: "vip_service", latest: "ddm1023" }, //媒关系
  'Digital%20Planner': { cm: 'timea', hx: 'hxpda', id: "com.softwings.DigitalPlanner.1year", latest: "ddm1023" }, //电子手帐
  'SuperMandarin': { cm: 'timea', hx: 'hxpda', id: "pth_vip_year", latest: "ddm1023" }, //普通话水平测试
  'SuperQuestion': { cm: 'timea', hx: 'hxpda', id: "qtzs_vip_year", latest: "ddm1023" }, //真题全刷
  'SuperElves': { cm: 'timeb', hx: 'hxpda', id: "com.SuperElves.Answer.Forever", latest: "ddm1023" }, //答案精灵
  'SuperDriving': { cm: 'timeb', hx: 'hxpda', id: "jiakao_vip_forever", latest: "ddm1023" }, //驾考学典
  'Pollykann': { cm: 'timeb', hx: 'hxpda', id: "vip.forever.pollykann", latest: "ddm1023" }, //小鹦看看
  'JCCalendar': { cm: 'timeb', hx: 'hxpda', id: "com.sjc.calendar.vip.lifelong", latest: "ddm1023" }, //简约日历
  'com.yanxia.ChsMedical': { cm: 'timeb', hx: 'hxpda', id: "VIPUser", latest: "ddm1023" }, //中医精华
  'SuperPointer': { cm: 'timeb', hx: 'hxpda', id: "com.SuperPointer.Location.Forever", latest: "ddm1023" }, //海拔指南针
  'SnakeReader': { cm: 'timeb', hx: 'hxpda', id: "com.lyran.snakescanner.premium18", latest: "ddm1023" }, //开卷阅读
  'FourthPPT': { cm: 'timeb', hx: 'hxpda', id: "com.FourthPPT.Mobile.Forever", latest: "ddm1023" }, //PPT制作软件
  'OneExtractor': { cm: 'timeb', hx: 'hxpda', id: "com.OneExtractor.Video.Forever", latest: "ddm1023" }, //视频提取器
  'com.Colin.Colors': { cm: 'timea', hx: 'hxpda', id: "com.colin.colors.annualVIP", latest: "ddm1023" }, //搜图
  'PhotosSorter': { cm: 'timeb', hx: 'hxpda', id: "sorter.pro.ipa", latest: "ddm1023" }, //Sorter-相册整理
  'intolive': { cm: 'timea', hx: 'hxpda', id: "me.imgbase.intolive.proSubYearly", latest: "ddm1023" }, //intolive-实况壁纸制作器
  'MyAlbum': { cm: 'timeb', hx: 'hxpda', id: "com.colin.myalbum.isUpgradeVip", latest: "ddm1023" }, //Cleaner-照片管理
  'VideoEditor': { cm: 'timeb', hx: 'hxpda', id: "com.god.videohand.alwaysowner", latest: "ddm1023" }, //VideoShot
  'PhotoMovie': { cm: 'timea', hx: 'hxpda', id: "com.mediaeditor.photomovie.year", latest: "ddm1023" }, //PhotoMovie-照片视频
  'ShotOn': { cm: 'timeb', hx: 'hxpda', id: "com.colin.shoton.forevervip", latest: "ddm1023" }, //ShotOn
  'PhimCiaj': { cm: 'timeb', hx: 'hxpda', id: "com.jiancent.calligraphymaster.lifetime", latest: "ddm1023" }, //练字大师
  'TimeCut': { cm: 'timea', hx: 'hxpda', id: "com.floatcamellia.hfrslowmotion.forevervip", latest: "ddm1023" },  //TimeCut
  'com.floatcamellia.motiok': { cm: 'timea', hx: 'hxpda', id: "com.floatcamellia.motiok.vipforever", latest: "ddm1023" },  //Hype_Text-AE特效片制作
  'POPOLockScreenWidgetable': { cm: 'timea', hx: 'hxpda', id: "com.widget.fightenegery.yearly", latest: "ddm1023" },  //多彩壁纸
  'GreetingScanner': { cm: 'timea', hx: 'hxpda', id: "com.alphaplus.greetingscaner.w.b", latest: "ddm1023" },  //扫描识别王
  'FancyCamPlus': { cm: 'timea', hx: 'hxpda', id: "com.alphaplus.fancycam.year.198", latest: "ddm1023" },  //悦颜相机
  'Again': { cm: 'timeb', hx: 'hxpda', id: "com.owen.again.profession", latest: "ddm1023" },  //Again-稍后阅读器
  'remotelg': { cm: 'timeb', hx: 'hxpda', id: "com.gqp.remotelg.lifetime", latest: "ddm1023" },  //UniversalRemoteTV+ 遥控器
  'Notebook': { cm: 'timea', hx: 'hxpda', id: "com.zoho.notebook.ios.personal.yearly", latest: "ddm1023" },  //Notebook
  'com.damon.dubbing': { cm: 'timea', hx: 'hxpda', id: "com.damon.dubbing.vip12", latest: "ddm1023" },  //有声英语绘本
  'ZHUBEN': { cm: 'timea', hx: 'hxpda', id: "com.xiaoyu.yue", latest: "ddm1023" },  //有声英语绘本
  'XIAOTangHomeParadise': { cm: 'timea', hx: 'hxpda', id: "com.yuee.mo2", latest: "ddm1023" },  //鸿海幼儿启蒙
  'film': { cm: 'timea', hx: 'hxpda', id: "pro_auto_subscribe_year_ovs", latest: "ddm1023" },  //胶卷相机
  'Muza': { cm: 'timea', hx: 'hxpda', id: "com.appmuza.premium_year", latest: "ddm1023" },  //Muza-修图APP
  'StandbyWidget': { cm: 'timed', hx: 'hxpda', id: "com.standby.idream.year.68", ids: "standbyus.nonconsume.missingyou", latest: "ddm1023" },  //StandBy_Us-情侣定位
  'Mango6Minute': { cm: 'timea', hx: 'hxpda', id: "576170870", latest: "ddm1023" },  //6分钟英语
  'Photo%20Cutout': { cm: 'timea', hx: 'hxpda', id: "com.icepine.allyear", latest: "ddm1023" },  //轻松扣图
  'cleanPhone': { cm: 'timea', hx: 'hxpda', id: "com.clean.year", latest: "ddm1023" },  //爱机清理
  'ppt': { cm: 'timea', hx: 'hxpda', id: "com.palmmob.pptios.yearly", latest: "ddm1023" },  //手机PPT制作
  'WasteCat': { cm: 'timeb', hx: 'hxpda', id: "dev.sanjin.WasteCat.PermanentVip", latest: "ddm1023" },  //垃圾贪吃猫
  'MeowTalk': { cm: 'timea', hx: 'hxpda', id: "meowtalk.month.basic.autorenewable.subscription", latest: "ddm1023" },  //喵说
  'habitdot': { cm: 'timeb', hx: 'hxpda', id: "habitdots_pro_forever", latest: "ddm1023" },  //习惯点点
  'stretchworkout': { cm: 'timea', hx: 'hxpda', id: "com.abishkking.premiumYearStretch", latest: "ddm1023" },  //拉伸运动
  'Planist': { cm: 'timed', hx: 'hxpda', id: "org.zrey.planist.main", ids: "org.zrey.planist.lifetime", latest: "ddm1023" },  //Planist-计划和清单
  'com.uzstudio.avenuecast.ios': { cm: 'timeb', hx: 'hxpda', id: "1001", latest: "ddm1023" },  //凡视知音
  'CongZhenBaZi': { cm: 'timeb', hx: 'hxpda', id: "vip_forever_78", latest: "ddm1023" },  //八字排盘-从真版
  'CongZhenQiMen': { cm: 'timea', hx: 'hxpda', id: "cn.congzhen.CongZhenQiMen.yearlyplan", latest: "ddm1023" },  //奇门遁甲
  'ProFit': { cm: 'timea', hx: 'hxpda', id: "com.maxty.gofitness.yearlyplan", latest: "ddm1023" },  //ProFit锻炼计划
  'FitnessBodybuildingVGFIT': { cm: 'timea', hx: 'hxpda', id: "com.vgfit.fitnessvip.yearly", latest: "ddm1023" },  //fitnessvip
  'Water%20Reminder': { cm: 'timea', hx: 'hxpda', id: "com.vgfit.premiumtracker.year", latest: "ddm1023" },  //WaterReminder水提醒
  '%E7%91%9C%E4%BC%BD': { cm: 'timea', hx: 'hxpda', id: "com.vgfit.yoga.yearly", latest: "ddm1023" },  //瑜伽
  'GPSMaker': { cm: 'timea', hx: 'hxpda', id: "theodolite_vip_year", latest: "ddm1023" },  //指南针定位
  'wrongbook': { cm: 'timea', hx: 'hxpda', id: "com.palmmob.wrongbookios.yearly", latest: "ddm1023" },  //错题宝
  'excel': { cm: 'timea', hx: 'hxpda', id: "com.gamawh.excelerios.yearly", latest: "ddm1023" },  //办公文档
  'Future%20Baby': { cm: 'timea', hx: 'hxpda', id: "com.nilu.faceseer.yearly", latest: "ddm1023" },  //宝宝长相预测
  'Smoke': { cm: 'timea', hx: 'hxpda', id: "smoke19870727", latest: "ddm1023" },  //今日香烟
  'AppAlarmIOS': { cm: 'timea', hx: 'hxpda', id: "alarm.me.vip.year.tier1", latest: "ddm1023" },  //Me+
  'Tinglee': { cm: 'timea', hx: 'hxpdb', id: "vip.forever.tinglee", latest: "ddm1023" },  //英语听听
  'NoteKeys': { cm: 'timea', hx: 'hxpda', id: "notekeys_access_weekly", latest: "ddm1023" },  //五线谱
  'SheetMusicPro': { cm: 'timea', hx: 'hxpda', id: "sheetmusicpro.yearwithtrial", latest: "ddm1023" },  //乐谱吧
  'ProtractorEdge': { cm: 'timea', hx: 'hxpda', id: "ProtracatorEdge.PremiumAccess", latest: "ddm1023" },  //量角器
  'Piano%20Plus': { cm: 'timea', hx: 'hxpda', id: "kn_access_weekly", latest: "ddm1023" },  //Piano Plus
  'Notation%20Pad': { cm: 'timea', hx: 'hxpda', id: "np_access_weekly", latest: "ddm1023" },  //Notation Pad
  'Guitar%20Notation': { cm: 'timea', hx: 'hxpda', id: "gn_access_weekly", latest: "ddm1023" },  //Guitar Notation
  'Piano%20Fantasy': { cm: 'timea', hx: 'hxpda', id: "com.lotuz.PianoFantasy.weekwithtrail", latest: "ddm1023" },  //钢琴幻想
  'Piano%20Rush': { cm: 'timea', hx: 'hxpda', id: "com.lotuz.PianoPro.weekwithtrail", latest: "ddm1023" },  //钢琴大师
  'com.richads.saucyart': { cm: 'timea', hx: 'hxpda', id: "com.richads.saucyart.sub.quarterly_29.99", latest: "ddm1023" },  //Perky
  'SurveyorPro': { cm: 'timea', hx: 'hxpda', id: "com.celiangyuan.SurveyorPro.OneYear", latest: "ddm1023" },  //测量员Pro
  'com.ydatong.dingdone': { cm: 'timeb', hx: 'hxpda', id: "com.ydatong.dingdone.vip.forever", latest: "ddm1023" },  //叮当代办
  'Dial': { cm: 'timea', hx: 'hxpda', id: "2104", latest: "ddm1023" },  //T9拨号
  'qxwp%20copy': { cm: 'timed', hx: 'hxpda', id: "com.chowjoe.wp2free.year.pro", ids: "com.chowjoe.wp2free.coin.70", latest: "ddm1023" },  //壁纸
  'LingLongShouZ': { cm: 'timea', hx: 'hxpda', id: "zhenwushouzhangQuarterlyPlus", latest: "ddm1023" },  //Cute手帐软件
  'MediaEditor': { cm: 'timeb', hx: 'hxpda', id: "alwaysowner", latest: "ddm1023" },  //剪影(需试用)
  'UniversTranslate': { cm: 'timea', hx: 'hxpda', id: "com.univers.translator.tool.year", latest: "ddm1023" },  //翻译官(需试用)
  'com.gostraight.smallAccountBook': { cm: 'timeb', hx: 'hxpda', id: "ForeverVIPPayment", latest: "ddm1023" },  //iCost记账(需要购买)
  'ZJTBiaoGe': { cm: 'timea', hx: 'hxpda', id: "zhangjt.biaoge.monthvip", latest: "ddm1023" },  //表格手机版
  'MiniMouse': { cm: 'timea', hx: 'hxpda', id: "minimouse_vip_1year", latest: "ddm1023" },  //MiniMouse
  'Paste%20Keyboard': { cm: 'timea', hx: 'hxpda', id: "com.keyboard.1yetr", latest: "ddm1023" },  //复制和粘贴键盘
  'EWA': { cm: 'timea', hx: 'hxpda', id: "com.ewa.renewable.subscription.year8", latest: "ddm1023" },  //EWA-学习外语
  'BuBuSZ': { cm: 'timea', hx: 'hxpda', id: "quaVersion", latest: "ddm1023" },  //BuBu手帐
  'CapyMood': { cm: 'timea', hx: 'hxpda', id: "com.paha.CapyMood.year", latest: "ddm1023" },  //CapyMood
  'xyz.iofree.lifenotes': { cm: 'timea', hx: 'hxpda', id: "xyz.iofree.lifelog.pro.yearly", latest: "ddm1023" },  //人生笔记(需试用)
  'com.icandiapps.nightsky': { cm: 'timea', hx: 'hxpda', id: "com.icandiapps.ns4.annual", latest: "ddm1023" },  //星空
  'Wallpapers': { cm: 'timea', hx: 'hxpda', id: "wallpaperworld.subscription.yearly.12.notrial", latest: "ddm1023" },  //Wallpaper Tree壁纸
  'com.yumiteam.Kuki.ID': { cm: 'timea', hx: 'hxpda', id: "com.yumiteam.Kuki.ID.2", latest: "ddm1023" },  //PicsLeap-美飞
  'com.quangtm193.picpro': { cm: 'timea', hx: 'hxpda', id: "com.quangtm193.picpro1year", latest: "ddm1023" },  //PicPro-人工智能照片编辑器
  'Storybeat': { cm: 'timea', hx: 'hxpda', id: "yearly_1", latest: "ddm1023" },  //Storybeat
  'SmartGym': { cm: 'timea', hx: 'hxpda', id: "com.smartgymapp.smartgym.premiumuserworkoutsyearly", latest: "ddm1023" },  //SmartGym
  'Ptime': { cm: 'timea', hx: 'hxpda', id: "com.subscribe.pro.year", latest: "ddm1023" },  //Ptime-拼图(需试用)
  'Prookie': { cm: 'timea', hx: 'hxpda', id: "prookie.month.withtrial.0615", latest: "ddm1023" },  //AI灵绘
  'BodyTune': { cm: 'timea', hx: 'hxpda', id: "Bodypro1", latest: "ddm1023" },  //BodyTune-瘦身相机
  'killer.sudoku.free.brain.puzzle': { cm: 'timea', hx: 'hxpda', id: "ks.i.iap.premium", latest: "ddm1023" },  //杀手数独
  'sudoku.puzzle.free.game.brain': { cm: 'timea', hx: 'hxpda', id: "sudoku.i.sub.vvip.p1y", latest: "ddm1023" },  //数独
  'One%20Markdown': { cm: 'timeb', hx: 'hxpda', id: "10012", latest: "ddm1023" },  //One Markdown
  'MWeb%20iOS': { cm: 'timeb', hx: 'hxpda', id: "10001", latest: "ddm1023" },  //MWeb-编辑器/笔记/发布
  'NYMF': { cm: 'timea', hx: 'hxpda', id: "com.nymf.app.premium_year", latest: "ddm1023" },  //Nymf艺术照片
  'com.lockwidt.cn': { cm: 'timea', hx: 'hxpda', id: "com.lockwidt.cn.member", latest: "ddm1023" },  //壁纸16
  'Utsuki': { cm: 'timea', hx: 'hxpda', id: "KameePro", latest: "ddm1023" },  //梦见账本
  'Processing': { cm: 'timeb', hx: 'hxpda', id: "wtf.riedel.processing.lifetime", latest: "ddm1023" },  //Processing-软件开发工具
  'one%20sec': { cm: 'timea', hx: 'hxpda', id: "wtf.riedel.one_sec.pro.annual.individual", latest: "ddm1023" },  //one sec-番茄钟
  'com.skysoft.pencilsketch': { cm: 'timea', hx: 'hxpda', id: "com.skysoft.pencilsketch.subscription.yearly", latest: "ddm1023" },  //铅笔画(需试用)
  'com.instagridpost.rsigp': { cm: 'timea', hx: 'hxpda', id: "com.GridPost.oneyearplus", latest: "ddm1023" },  //九宫格切图
  'com.skysoft.picsqueen': { cm: 'timea', hx: 'hxpda', id: "com.skysoft.picsqueen.subscription.yearly", latest: "ddm1023" },  //PicsQueen-AI绘图
  'com.skysoft.removalfree': { cm: 'timea', hx: 'hxpda', id: "com.skysoft.removalfree.discount.unlimitedaccess", latest: "ddm1023" },  //神奇消除笔-图片消除
  'com.skysoft.facecartoon': { cm: 'timea', hx: 'hxpda', id: "com.skysoft.facecartoon.subscription.yearly", latest: "ddm1023" },  //卡通头像
  'Jennie%20AI': { cm: 'timea', hx: 'hxpda', id: "com.skysoft.text2img.vip.yearly", latest: "ddm1023" },  //Jennie AI制作图片
  'MGhostLens': { cm: 'timea', hx: 'hxpda', id: "com.ghostlens.premium1month", latest: "ddm1023" },  //魔鬼相机
  'Luminous': { cm: 'timea', hx: 'hxpda', id: "com.spacemushrooms.weekly", latest: "ddm1023" },  //光影修图
  'RitmoVideo': { cm: 'timea', hx: 'hxpda', id: "com.zhk.hidebox.yearly", latest: "ddm1023" },  //RitmoVideo
  'PerfectImage': { cm: 'timea', hx: 'hxpda', id: "Perfect_Image_VIP_Yearly", latest: "ddm1023" },  //完美影像(需试用)
  'moment': { cm: 'timea', hx: 'hxpda', id: "PYJMoment2", latest: "ddm1023" },  //片羽集(需试用)
  'Planner%20Plus': { cm: 'timea', hx: 'hxpda', id: "com.btgs.plannerfree.yearly", latest: "ddm1023" },  //PlannerPro-日程安排
  'HiddenBox': { cm: 'timec', hx: 'hxpdb', version: "1" },//我的书橱
  'Synthesizer': { cm: 'timea', hx: 'hxpda', id: "com.qingxiu.synthesizer.mon", latest: "ddm1023" },  //语音合成
  'ContractMaster': { cm: 'timea', hx: 'hxpda', id: "com.qingxiu.contracts.monthly", latest: "ddm1023" },  //印象全能王
  'MyDiary': { cm: 'timea', hx: 'hxpda', id: "diary.yearly.vip.1029", latest: "ddm1023" },  //我的日记
  'Translator': { cm: 'timea', hx: 'hxpda', id: "trans_sub_week", latest: "ddm1023" },  //翻译家
  'ToDoList': { cm: 'timea', hx: 'hxpda', id: "todolist.subscription.yearly", latest: "ddm1023" },  //ToDoList(需试用)
  'Idea': { cm: 'timea', hx: 'hxpda', id: "top.ideaapp.ideaiOS.membership.oneyear", latest: "ddm1023" },  //灵感(需试用)
  'ZeroTuImg': { cm: 'timea', hx: 'hxpda', id: "ZeroTuImgPlus", latest: "ddm1023" },  //Zero壁纸
  'com.traveltao.ExchangeAssistant': { cm: 'timea', hx: 'hxpda', id: "lxbyplus", latest: "ddm1023" },  //极简汇率(需试用)
  'ServerKit': { cm: 'timea', hx: 'hxpda', id: "com.serverkit.subscription.year.a", latest: "ddm1023" },  //服务器助手
  'RawPlus': { cm: 'timea', hx: 'hxpda', id: "com.dynamicappdesign.rawplus.yearlysubscription", latest: "ddm1023" },  //Raw相机
  'OrderGenerator': { cm: 'timeb', hx: 'hxpda', id: "oder_pay_forever", latest: "ddm1023" },  //订单生成
  'GenerateAllOrdersTool': { cm: 'timea', hx: 'hxpda', id: "Order_Vip_010", latest: "ddm1023" },  //订单生成器(需试用)
  'MoMoShouZhang': { cm: 'timea', hx: 'hxpda', id: "shunchangshouzhangQuarterlyPlus", latest: "ddm1023" },  //卡卡手账(需试用)
  'Mindkit': { cm: 'timeb', hx: 'hxpda', id: "mindkit_permanently", latest: "ddm1023" },  //Mindkit
  'DailySpending': { cm: 'timea', hx: 'hxpda', id: "com.xxtstudio.dailyspending.year", latest: "ddm1023" },  //Daily记账
  'Miary': { cm: 'timeb', hx: 'hxpda', id: "lifetime_sub", latest: "ddm1023" },  //Miary-记录日记
  'Noted': { cm: 'timeb', hx: 'hxpda', id: "com.digitalworkroom.noted.plus.lifetime", latest: "ddm1023" },  //Noted-录音笔记软件
  'BingQiTools': { cm: 'timea', hx: 'hxpda', id: "bingqi_e2", latest: "ddm1023" },  //猫狗翻译
  'AnyDown': { cm: 'timeb', hx: 'hxpda', id: "com.xiaoqi.down.forever", latest: "ddm1023" },  //AnyDown-下载神器
  'Reader': { cm: 'timeb', hx: 'hxpda', id: "com.xiaoqi.reader.forever", latest: "ddm1023" },  //爱阅读-TXT阅读器
  'com.bestmusicvideo.formmaster': { cm: 'timea', hx: 'hxpda', id: "com.form.1yearvip", latest: "ddm1023" },  //表格大师
  'ExcelSpreadSheetsWPS': { cm: 'timea', hx: 'hxpda', id: "com.turbocms.SimpleSpreadSheet.viponeyear", latest: "ddm1023" },  //简易表格(需试用)
  'XinQingRiJi': { cm: 'timea', hx: 'hxpda', id: "zhiwenshouzhangQuarterlyPlus", latest: "ddm1023" },  //猫咪手帐(需试用)
  'Nutrilio': { cm: 'timea', hx: 'hxpda', id: "net.nutrilio.one_year_plus", latest: "ddm1023" },  //Nutrilio
  'AIHeader': { cm: 'timea', hx: 'hxpda', id: "com.ai.avatar.maker.month.3dayfree", latest: "ddm1023" },  //AI头像馆
  'MoodTracker': { cm: 'timeb', hx: 'hxpda', id: "co.vulcanlabs.moodtracker.lifetime2", latest: "ddm1023" },  //ChatSmith(美区)
  'com.dandelion.Routine': { cm: 'timeb', hx: 'hxpda', id: "membership", latest: "ddm1023" },  //小日常
  'YSBrowser': { cm: 'timeb', hx: 'hxpda', id: "com.ys.pro", latest: "ddm1023" },  //亚瑟浏览器
  'org.zrey.metion': { cm: 'timed', hx: 'hxpda', id: "org.zrey.metion.pro", ids: "org.zrey.metion.main", latest: "ddm1023" },  //Metion-基础+Pro
  'ZenJournal': { cm: 'timea', hx: 'hxpda', id: "zen_pro", latest: "ddm1023" },  //禅记
  '%E5%80%92%E6%94%BE%E6%8C%91%E6%88%98': { cm: 'timea', hx: 'hxpda', id: "com.abighead.ReverseChallenge.iap.pro.year", latest: "ddm1023" },  //倒放挑战
  'com.visualmidi.app.perfectpiano.Perfect-Piano': { cm: 'timea', hx: 'hxpda', id: "auto_renew_monthly_subscription", latest: "ddm1023" },  //完美钢琴
  'Straw': { cm: 'timea', hx: 'hxpda', id: "com.1year.eyedropper", latest: "ddm1023" },  //吸管Pro-取色
  'vibee': { cm: 'timea', hx: 'hxpda', id: "com.vibee.year.bigchampagne", latest: "ddm1023" },  //vibee-氛围歌单小组件
  'Lister': { cm: 'timea', hx: 'hxpda', id: "com.productlab.lister.yearly", latest: "ddm1023" },  //Lister-计划清单
  'DrumPads': { cm: 'timeb', hx: 'hxpda', id: "com.gismart.drumpads.pro_lifetime_30", latest: "ddm1023" },  //BeatMakerGo-打碟机/打击垫/DJ鼓机
  'com.photoslab.ai.writerassistant': { cm: 'timea', hx: 'hxpda', id: "com.photoslab.ai.writerassistant.year", latest: "ddm1023" },  //Smart AI
  'WaterMaskCamera': { cm: 'timea', hx: 'hxpda', id: "com.camera.watermark.yearly.3dayfree", latest: "ddm1023" },  //徕卡水印相机
  'ColorPaint': { cm: 'timea', hx: 'hxpda', id: "coloring.app.singingfish.year", latest: "ddm1023" },  //涂色
  'SymbolKeyboard': { cm: 'timeb', hx: 'hxpda', id: "fronts.keyboard.singingfish.one", latest: "ddm1023" },  //Fonts花样字体
  'com.SingingFish.SudokuGame': { cm: 'timea', hx: 'hxpda', id: "com.singingfish.sudokugame.year", latest: "ddm1023" },  //数独
  'com.kuaijiezhilingdashi.appname': { cm: 'timea', hx: 'hxpda', id: "com.othermaster.yearlyvip", latest: "ddm1023" },  //快捷指令库
  'LogInput': { cm: 'timea', hx: 'hxpda', id: "com.logcg.loginput", latest: "ddm1023" },  //落格输入法
  'HandNote': { cm: 'timeb', hx: 'hxpda', id: "permanent_membership", latest: "ddm1023" },  //千本笔记
  'Kilonotes': { cm: 'timea', hx: 'hxpda', id: "kipa_kilonotes_quarter_subscription", latest: "ddm1023" },  //千本笔记
  'YiJianKouTu': { cm: 'timea', hx: 'hxpda', id: "XiChaoYiJianKouTuPlus", latest: "ddm1023" },  //一键抠图
  'FileArtifact': { cm: 'timeb', hx: 'hxpda', id: "com.shengzhou.fileartifact.permanent", latest: "ddm1023" },  //文晓生
  'Wext': { cm: 'timeb', hx: 'hxpda', id: "com.lmf.wext.life", latest: "ddm1023" },  //万源阅读
  'ColorCapture': { cm: 'timeb', hx: 'hxpda', id: "10001", latest: "ddm1023" },  //色采
  'xTerminal': { cm: 'timea', hx: 'hxpda', id: "xterminal.pro2", latest: "ddm1023" },  //xTerminal
  'Fotoz': { cm: 'timeb', hx: 'hxpda', id: "com.kiddy.fotoz.ipa.pro", latest: "ddm1023" },  //Fotoz - 图片一键下载
  'TheLastFilm': { cm: 'timea', hx: 'hxpda', id: "Filmroll_Pro_1Year", latest: "ddm1023" },  //最后一卷胶片(需订阅一次)
  'Motivation': { cm: 'timea', hx: 'hxpda', id: "com.monkeytaps.motivation.premium.year3", latest: "ddm1023" },  //Motivation
  'io.sumi.GridDiary2': { cm: 'timea', hx: 'hxpda', id: "io.sumi.GridDiary.pro.annually", latest: "ddm1023" },  //格志
  'Subscriptions': { cm: 'timea', hx: 'hxpda', id: "com.touchbits.subscriptions.iap.pro.yearly", latest: "ddm1023" },  //订阅通
  'com.leapfitness.fasting': { cm: 'timea', hx: 'hxpda', id: "com.leapfitness.fasting.oneyear1", latest: "ddm1023" },  //168轻断食
  'WidgetBox': { cm: 'timeb', hx: 'hxpda', id: "widgetlab001", latest: "ddm1023" },  //小组件盒子
  'LifeTracker': { cm: 'timea', hx: 'hxpda', id: "com.dk.lifetracker.yearplan", latest: "ddm1023" },  //Becord生活记录
  'imgplay': { cm: 'timea', hx: 'hxpda', id: "me.imgbase.imgplay.subscriptionYearly", latest: "ddm1023" },  //imgPlay
  'WaterMinder': { cm: 'timea', hx: 'hxpda', id: "waterminder.premiumYearly", latest: "ddm1023" },  //WaterMinder喝水APP
  'HashPhotos': { cm: 'timeb', hx: 'hxpda', id: "com.kobaltlab.HashPhotos.iap.allinone.free", latest: "ddm1023" },  //HashPhotos
  'FileBrowser': { cm: 'timea', hx: 'hxpda', id: "com.qingcheng.filex.pro.yearly", latest: "ddm1023" },  //松鼠下载
  'SilProject': { cm: 'timea', hx: 'hxpda', id: "com.sm.Alina.Pro", latest: "ddm1023" },  //Alina米克锁屏—
  'com.chenxi.shanniankapian': { cm: 'timea', hx: 'hxpda', id: "com.chenxi.shannian.superNian", latest: "ddm1023" },  //闪念
  'com.risingcabbage.pro.camera': { cm: 'timea', hx: 'hxpda', id: "com.risingcabbage.pro.camera.yearlysubscription", latest: "ddm1023" },  //ReLens相机
  'co.bazaart.patternator': { cm: 'timea', hx: 'hxpda', id: "Patternator_Lock_Screen_Monthly", latest: "ddm1023" },  //拍特内头
  '%E5%BD%95%E9%9F%B3%E4%B8%93%E4%B8%9A%E7%89%88': { cm: 'timea', hx: 'hxpda', id: "com.winat.recording.pro.yearly", latest: "ddm1023" },  //录音专业版
  'cn.linfei.SimpleRecorder': { cm: 'timea', hx: 'hxpda', id: "cn.linfei.SimpleRecorder.Plus", latest: "ddm1023" },  //录音机
  'com.maliquankai.appdesign': { cm: 'timec', hx: 'hxpdb', version: "1.5.8" },  //PutApp-应用收集
  'PictureScanner': { cm: 'timea', hx: 'hxpda', id: "om.picturescanner.tool.year", latest: "ddm1023" },  //扫描王
  'BestColor': { cm: 'timea', hx: 'hxpda', id: "com.bestColor.tool.month", latest: "ddm1023" },  //小红图
  'com.decibel.tool': { cm: 'timea', hx: 'hxpda', id: "decibel98free3", latest: "ddm1023" },  //分贝测试仪
  'MeasurementTools': { cm: 'timea', hx: 'hxpda', id: "mesurementyearvip", latest: "ddm1023" },  //测量工具
  'TinyPNGTool': { cm: 'timea', hx: 'hxpda', id: "com.tinypngtool.tool.weekvip", latest: "ddm1023" },  //TinyPNG
  'IconChange': { cm: 'timea', hx: 'hxpda', id: "iconeryearvip", latest: "ddm1023" },  //iconser图标更换
  'life.journal.diary': { cm: 'timeb', hx: 'hxpda', id: "life.journal.diary.lifetime", latest: "ddm1023" },  //Today日记
  'com.floatcamellia.motionninja': { cm: 'timea', hx: 'hxpda', id: "com.floatcamellia.motionninja.yearlyvip", latest: "ddm1023" },  //MotionNinja
  'com.iuuapp.audiomaker': { cm: 'timed', hx: 'hxpda', id: "com.iuuapp.audiomaker.cloud.year", ids: "com.iuuapp.audiomaker.removeads", latest: "ddm1023" },  //音频剪辑
  'com.biggerlens.photoretouch': { cm: 'timeb', hx: 'hxpda', id: "com.photoretouch.SVIP", latest: "ddm1023" },  //PhotoRetouch消除笔P图
  'com.macpaw.iosgemini': { cm: 'timea', hx: 'hxpda', id: "com.macpaw.iosgemini.month.trial", latest: "ddm1023" },  //GeminiPhotos
  'com.mematom.ios': { cm: 'timea', hx: 'hxpda', id: "MMYear", latest: "ddm1023" },  //年轮3
  'com.LuoWei.aDiary': { cm: 'timea', hx: 'hxpda', id: "com.LuoWei.aDiary.yearly0", latest: "ddm1023" },  //aDiary-待办日记本
  'com.zerone.hidesktop': { cm: 'timeb', hx: 'hxpda', id: "com.zerone.hidesktop.forever", latest: "ddm1023" },  //iScreen-桌面小组件主题美化
  'MagicWidget': { cm: 'timeb', hx: 'hxpda', id: "cf__forever_0_4.7.1", latest: "ddm1023" },  //ColorfulWidget—小组件
  'com.tasmanic.capture': { cm: 'timea', hx: 'hxpda', id: "CTPCAPTUREYEARLY", latest: "ddm1023" },  //3DScanner-绘制/测量平面图
  'com.readdle.CalendarsLite': { cm: 'timea', hx: 'hxpda', id: "com.readdle.CalendarsLite.subscription.year20trial7", latest: "ddm1023" },  //Calendars-日历/计划
  'com.readdle.ReaddleDocsIPad': { cm: 'timea', hx: 'hxpda', id: "com.readdle.ReaddleDocsIPad.subscription.month10_allusers", latest: "ddm1023" },  //Documents
  'com.1ps.lovetalk': { cm: 'timea', hx: 'hxpda', id: "com.1ps.lovetalk.normal.weekly", latest: "ddm1023" },  //高级恋爱话术
  'tech.miidii.MDClock': { cm: 'timeb', hx: 'hxpda', id: "tech.miidii.MDClock.pro", latest: "ddm1023" },  //谜底时钟
  'com.floatcamellia.prettyup': { cm: 'timeb', hx: 'hxpda', id: "com.floatcamellia.prettyup.onetimepurchase", latest: "ddm1023" },  //PrettyUp视频P图
  'com.zijayrate.analogcam': { cm: 'timea', hx: 'hxpda', id: "com.zijayrate.analogcam.vipforever10", latest: "ddm1023" },  //oldroll复古相机
  'WeeklyNote': { cm: 'timeb', hx: 'hxpda', id: "org.zrey.weeklynote.lifetime", latest: "ddm1023" },  //WeeklyNote-周周记
  'DoMemo': { cm: 'timea', hx: 'hxpda', id: "org.zrey.fastnote.lifetime", latest: "ddm1023" },  //DoMemo-笔记和备忘录
  'CostMemo': { cm: 'timea', hx: 'hxpda', id: "org.zrey.money.lifetime", latest: "ddm1023" },  //CostMemo-生活记账本
  'iTimely': { cm: 'timeb', hx: 'hxpda', id: "org.zrey.iTimely.lifetime", latest: "ddm1023" },  //iTimely-记录
  'net.daylio.Daylio': { cm: 'timea', hx: 'hxpda', id: "net.daylio.one_year_pro.offer_initial", latest: "ddm1023" },  //Daylio-日记
  'com.yengshine.webrecorder': { cm: 'timea', hx: 'hxpda', id: "com.yengshine.webrecorder.yearly", latest: "ddm1023" },  //VlogStar-视频编辑器
  'org.skydomain.foodcamera': { cm: 'timea', hx: 'hxpda', id: "org.skydomain.foodcamera.yearly", latest: "ddm1023" },  //Koloro-滤镜君
  'com.yengshine.proccd': { cm: 'timea', hx: 'hxpda', id: "com.yengshine.proccd.yearly", latest: "ddm1023" },  //ProCCD相机
  'com.palmmob.pdfios': { cm: 'timea', hx: 'hxpda', id: "com.palmmob.pdfios.168", latest: "ddm1023" },  //图片PDF转换器
  'com.palmmob.scanner2ios': { cm: 'timea', hx: 'hxpda', id: "com.palmmob.scanner2ios.396", latest: "ddm1023" },  //文字扫描
  'com.palmmob.officeios': { cm: 'timea', hx: 'hxpda', id: "com.palmmob.officeios.188", latest: "ddm1023" },  //文档表格编辑
  'com.palmmob.recorder': { cm: 'timea', hx: 'hxpda', id: "com.palmmob.recorder.198", latest: "ddm1023" },  //录音转文字
  'com.7color.newclean': { cm: 'timea', hx: 'hxpda', id: "com.cleaner.salesyear", latest: "ddm1023" },  //手机清理
  'Habbit': { cm: 'timea', hx: 'hxpda', id: "HabitUpYearly", latest: "ddm1023" },  //习惯清单
  'com.dbmeterpro.dB-Meter-Free': { cm: 'timea', hx: 'hxpda', id: "com.dbmeterpro.premiumModeSubscriptionWithTrial", latest: "ddm1023" },  //dBMeter-分贝仪(专业版)
  'com.vstudio.newpuzzle': { cm: 'timea', hx: 'hxpda', id: "com.vstudio.newpuzzle.yearlyVipFreetrail.15_99", latest: "ddm1023" },  //拼图酱
  'com.jianili.Booka': { cm: 'timea', hx: 'hxpda', id: "com.jianili.Booka.pro.yearly", latest: "ddm1023" },  //Booka-极简书房
  'com.ziheng.OneBox': { cm: 'timeb', hx: 'hxpda', id: "com.ziheng.OneBox", latest: "ddm1023" },  //Pandora管理订阅
  'ChickAlarmClock': { cm: 'timea', hx: 'hxpda', id: "com.ChickFocus.ChickFocus.yearly_2023_promo", latest: "ddm1023" },  //小鸡专注
  'MyWorks': { cm: 'timea', hx: 'hxpda', id: "com.MyWorks.Handwritten.Year", latest: "ddm1023" },  //仿手写
  'Instant%20Saver': { cm: 'timea', hx: 'hxpda', id: "com.pocket.compress.yearly", latest: "ddm1023" },  //InstantSocialSaver(ins下载)
  'SaveTik': { cm: 'timea', hx: 'hxpda', id: "com.pocket.compress.yearly", latest: "ddm1023" },  //SaveTik
  '%E6%96%87%E4%BB%B6%E7%AE%A1%E7%90%86%E5%99%A8': { cm: 'timea', hx: 'hxpda', id: "com.mobislet.files.yearly", latest: "ddm1023" },  //文件管理器
  'ZIP%E5%8E%8B%E7%BC%A9%E8%A7%A3%E5%8E%8B%E7%BC%A9%E5%B7%A5%E5%85%B7': { cm: 'timea', hx: 'hxpda', id: "com.mobislet.zipfile.yearly", latest: "ddm1023" },  //ZIP压缩解压
  'TPTeleprompter': { cm: 'timea', hx: 'hxpda', id: "com.pocket.compress.yearly", latest: "ddm1023" },  //爱提词
  'com.pocket.photo': { cm: 'timea', hx: 'hxpda', id: "com.pocket.photo.yearly", latest: "ddm1023" },  //一寸证件照
  'com.pocket.watermark': { cm: 'timea', hx: 'hxpda', id: "com.pocket.watermark.yearly", latest: "ddm1023" },  //一键水印
  'com.pocket.compress': { cm: 'timea', hx: 'hxpda', id: "com.pocket.compress.yearly", latest: "ddm1023" },  //压缩软件
  'com.pocket.format': { cm: 'timea', hx: 'hxpda', id: "com.pocket.format.yearly", latest: "ddm1023" },  //格式转换
  'com.CalculatorForiPad.InternetRocks': { cm: 'timea', hx: 'hxpda', id: "co.airapps.calculator.year", latest: "ddm1023" },  //计算器Air
  'solutions.wzp': { cm: 'timea', hx: 'hxpda', id: yearlysubscription, latest: "ddm1023" },  //airapps
  'co.airapps': { cm: 'timea', hx: 'hxpda', id: yearid, latest: "ddm1023" },  //airapps
  'com.internet-rocks': { cm: 'timea', hx: 'hxpda', id: yearid, latest: "ddm1023" },  //airapps
  'SuperWidget': { cm: 'timea', hx: 'hxpda', id: "com.focoslive", latest: "ddm1023" },  //PandaWidget小组件
  'Picsew': { cm: 'timeb', hx: 'hxpdb', id: "com.sugarmo.ScrollClip.pro"},  //Picsew截长图3.9.4版本(最新版无效)
  'vpn': { cm: 'timea', hx: 'hxpda', id: "yearautorenew", latest: "ddm1023" },  //VPN-unlimited
  'TT': { cm: 'timea', hx: 'hxpda', id: "com.55panda.hicalculator.year_sub", latest: "ddm1023" },  //TT_私密相册管家
  'Focos': { cm: 'timea', hx: 'hxpda', id: "com.focos.1w_t4_1w", latest: "ddm1023" },  //Focos
  'ProKnockOut': { cm: 'timeb', hx: 'hxpda', id: "com.knockout.SVIP.50off", latest: "ddm1023" },  //ProKnockOut
  'com.teadoku.flashnote': { cm: 'timea', hx: 'hxpda', id: "pro_ios_ipad_mac", latest: "ddm1023" },  //AnkiNote
  'com.tapuniverse.texteditor': { cm: 'timea', hx: 'hxpda', id: "com.tapuniverse.texteditor.w", latest: "ddm1023" }  //TextEditor
};



const receipt = {
  "quantity": "1",
  "purchase_date_ms": "1694250549000",
  "is_in_intro_offer_period": "false",
  "transaction_id": "490001314520000",
  "is_trial_period": "false",
  "original_transaction_id": "490001314520000",
  "purchase_date": "2023-09-09 09:09:09 Etc/GMT",
  "product_id": yearlyid,
  "original_purchase_date_pst": "2023-09-09 02:09:10 America/Los_Angeles",
  "in_app_ownership_type": "PURCHASED",
  "original_purchase_date_ms": "1694250550000",
  "web_order_line_item_id": "490000123456789",
  "purchase_date_pst": "2023-09-09 02:09:09 America/Los_Angeles",
  "original_purchase_date": "2023-09-09 09:09:10 Etc/GMT"
};

const expirestime = {
  "expires_date": "2099-09-09 09:09:09 Etc/GMT",
  "expires_date_pst": "2099-09-09 06:06:06 America/Los_Angeles",
  "expires_date_ms": "4092599349000"
};

let anchor = false;
let data;

for (const i in list) {
  const regex = new RegExp(`^${i}`, `i`);
  if (regex.test(ua) || regex.test(bundle_id)) {
    const { cm, hx, id, ids, latest, version } = list[i];
    const receiptdata = Object.assign({}, receipt, { "product_id": id });

    switch (cm) {
      case 'timea':
        data = [Object.assign({}, receiptdata, expirestime)];
        break;
      case 'timeb':
        data = [receiptdata];
        break;
      case 'timec':
        data = [];
        break;
      case 'timed':
        data = [
          Object.assign({}, receiptdata, expirestime, { "product_id": ids }),
          Object.assign({}, receiptdata, expirestime, { "product_id": id })
        ];
        break;
    }

    if (hx.includes('hxpda')) {
      ddm["receipt"]["in_app"] = data;
      ddm["latest_receipt_info"] = data;
      ddm["pending_renewal_info"] = [{
        "product_id": id,
        "original_transaction_id": "490001314520000",
        "auto_renew_product_id": id,
        "auto_renew_status": "1"
      }];
      ddm["latest_receipt"] = latest;
    } else if (hx.includes('hxpdb')) {
      ddm["receipt"]["in_app"] = data;
    } else if (hx.includes('hxpdc')) {
      const xreceipt = {
        "expires_date_formatted": "2099-09-09 09:09:09 Etc/GMT",
        "expires_date": "4092599349000",
        "expires_date_formatted_pst": "2099-09-09 06:06:06 America/Los_Angeles",
        "product_id": id
      };
      ddm["receipt"] = Object.assign({}, ddm["receipt"], xreceipt);
      ddm["latest_receipt_info"] = Object.assign({}, ddm["receipt"], xreceipt);
      ddm["status"] = 0;
      ddm["auto_renew_status"] = 1;
      ddm["auto_renew_product_id"] = id;
      delete ddm["latest_expired_receipt_info"];
      delete ddm["expiration_intent"];
    }

    if (version && version.trim() !== '') {
      ddm["receipt"]["original_application_version"] = version;
    }

    anchor = true;
    console.log('恭喜您，已操作成功🎉🎉🎉\n叮当猫の分享频道: https://t.me/ddm1023');
    break;
  }
}

if (!anchor) {
  data = [Object.assign({}, receipt, expirestime)];
  ddm["receipt"]["in_app"] = data;
  ddm["latest_receipt_info"] = data;
  ddm["pending_renewal_info"] = [{
    "product_id": yearlyid,
    "original_transaction_id": "490001314520000",
    "auto_renew_product_id": yearlyid,
    "auto_renew_status": "1"
  }];
  ddm["latest_receipt"] = "ddm1023";
  console.log('很遗憾未能识别出UA或bundle_id\n但已使用备用方案操作成功🎉🎉🎉\n叮当猫の分享频道: https://t.me/ddm1023');
}

ddm["Telegram"] = "https://t.me/ddm1023";
ddm["warning"] = "仅供学习，禁止转载或售卖";

$done({ body: JSON.stringify(ddm) });
