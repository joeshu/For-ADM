/*************************************

项目名称：Revenuecat 系列解锁合集（优化版）
下载地址：https://too.st/CollectionsAPP
更新日期：2026-3-15
脚本作者：chxm1023
优化者：MiniMax Agent
电报频道：https://t.me/chxm1023
使用声明：⚠️仅供参考，🈲转载与售卖！

**************************************

[rewrite_local]
^https:\/\/api\.(revenuecat|rc-backup)\.com\/.+\/(receipts$|subscribers\/?(.*?)*$) url script-response-body https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/recat.js
^https:\/\/api\.(revenuecat|rc-backup)\.com\/.+\/(receipts$|subscribers\/?(.*?)*$) url script-request-header https://raw.githubusercontent.com/joeshu/For-ADM/refs/heads/master/recat.js

[mitm]
hostname = api.revenuecat.com, api.rc-backup.com

*************************************/

// 初始化响应对象
const chxm1024 = {};

// 获取请求头信息
const headers = $request.headers;

// 安全解析JSON响应
let chxm1023 = null;
try {
  if (typeof $response !== "undefined" && $response.body) {
    chxm1023 = JSON.parse($response.body);
  }
} catch (e) {
  console.log("JSON解析错误: " + e.message);
  chxm1023 = null;
}

// 获取User-Agent和Bundle ID
const ua = headers['User-Agent'] || headers['user-agent'] || '';
const bundle_id = headers['X-Client-Bundle-ID'] || headers['x-client-bundle-id'] || '';

// 排除已禁止MITM的APP
const forbiddenApps = ['PicSeedClient', 'ReflixiOS', 'Pomodoro', 'MyHabit', 'Rond', 'Filebar', 'Fileball', 'APTV'];

const isForbiddenApp = forbiddenApps.some(app => {
  const uaMatch = ua && ua.includes(app);
  const bodyMatch = $request.body && $request.body.includes(app);
  return uaMatch || bodyMatch;
});

if (isForbiddenApp) {
  console.log("⛔️检测到禁止 MITM 的 APP，脚本停止运行！");
  $done({});
}

// 识别bundle_id映射表
const bundle = {
  'com.flexicalc.app': { name: 'pro', id: 'pro_product', cm: 'sja' },
  'com.trainfitness.Train': { name: 'Pro', id: 'TrainAnnualSubscription', cm: 'sja' },
  'com.OfflineMusic.www': { name: 'premium', id: 'com.OfflineMusic.www.lifetime298', cm: 'sjb' },
  'com.ausoco.umai': { name: 'umai_pro', id: 'umai_pro_yearly', cm: 'sja' },
  'camp.user.penbook': { name: 'pro', id: 'penbook.lifetime01', cm: 'sjb' },
  'design.yugen.Flow': { name: 'pro', id: 'design.yugen.Flow.Lifetime', cm: 'sja' },
  'com.runbuddy.prod': { name: 'premium', id: 'rb_9999_1y_1y7999', cm: 'sja' },
  'TeleprompterX': { name: 'Pro Upgrade', id: 'TPXOTP', cm: 'sjb' },
  'com.exoplanet.chatme': { name: 'premium', id: 'chatme_premium_year_trial', cm: 'sja' },
  'com.reku.Counter': { name: 'plus', id: 'com.reku.counter.plus.lifetime', cm: 'sjb' },
  'moonbox.co.il.grow': { name: 'pro', id: 'moonbox.co.il.grow.lifetime.offer', cm: 'sjb' },
  'tech.miidii.MDClock': { name: 'Entitlement.Pro', id: 'tech.miidii.MDClock.pro', cm: 'sjb' },
  'com.voicedream.Voic': { name: 'standard', id: 'vd_annual_79_3daytrial', cm: 'sja' },
  'com.laser-focused.focus-ios': { name: 'subscribed', id: 'iap.io.masterbuilders.focus.pro_one_year', cm: 'sja' },
  'com.roehl': { name: 'Pro', id: 'habitkit_3499_lt', cm: 'sjb' },
  'net.tengl.powertimer': { name: 'plus', id: 'powertimer.plus', cm: 'sjb' },
  'com.reader.book': { name: 'pro', id: 'reader.lifetimeFamily.pro', cm: 'sja' },
  'app.imone.OneWidget': { name: 'pro', id: 'app.imone.OneWidget.Lifetime', cm: 'sjb' },
  'io.innerpeace.yiye': { name: 'Premium', id: 'io.innerpeace.yiye.lifetime.forYearly', cm: 'sja' },
  'com.valo.reader': { name: 'com.valo.reader.vip1.forever', id: 'com.valo.reader.vip1.forever', nameb: 'com.valo.reader.vip2.forever', idb: 'com.valo.reader.vip2.forever', cm: 'sjb' },
  'com.skysoft.removalfree': { name: 'Pro', id: 'com.skysoft.removalfree.subscription.newyearly', cm: 'sja' }
};

// 识别UA映射表
const list = {
  'TheGreatMe': { name: 'The Great Me Pro', id: 'thegreatme.forever', cm: 'sjc' },
  'Leica%20LUX': { name: 'pro', id: 'annual_subscribers_first_cohort', cm: 'sja' },
  'ai_music_generator': { name: 'music_generation_yearly_79_99', id: 'music_generation_yearly_79_99', cm: 'sja' },
  'Loopsie': { name: 'pro-iOS', id: 'com.gamelounge.loopsie.ios.one_time_l', cm: 'sjb' },
  'Percento': { name: 'premium', id: 'app.percento.premium.168.lifetime', cm: 'sjb' },
  'ShouChong': { name: 'lulemevip', id: 'lulemeYears', cm: 'sja' },
  'BeetleADB': { name: 'beetle_pro', id: 'beetle_lifetime_pro', cm: 'sjc' },
  'adbTools': { name: 'pro_lifetime', id: 'com.jy.adbTools.pro_1', cm: 'sjb' },
  'Habitor': { name: 'premium', id: 'habitor_lifetime', cm: 'sjb' },
  'knowme-storage': { name: 'pro', id: 'pro', cm: 'sjb' },
  'GrowthPath': { name: 'Premium', id: 'GrowthPath_IAP_Lifetime', cm: 'sjb' },
  'Awake': { name: 'awake_pro', id: 'io.unorderly.awake.pro.lifetime_v1', cm: 'sjb' },
  'ContextApp': { name: 'plus', id: 'context_1y', cm: 'sjc' },
  'Watchly': { name: 'lifetime', id: 'watchface.lifetime', cm: 'sjb' },
  'Yummi': { name: 'Pro', id: 'ym_lifetime_4.99', cm: 'sjb' },
  'StayOff': { name: 'Plus', id: 'so_lt_1299', cm: 'sjb' },
  'Lito': { name: 'LitoPlus', id: 'ml_lifetime_0499', cm: 'sjc' },
  'nbcamera': { name: 'patron', id: 'com.andyworks.camera.yearlyPatron', cm: 'sja' },
  'CollageMaker': { name: 'pro', id: 'com.livintis.collagemakerplus.yearly.1', cm: 'sja' },
  'LaunchTrans': { name: 'PicChat.Subscribe.Start', id: 'Yearly.PicChat', cm: 'sja' },
  'Dotly': { name: 'premium', id: 'dotly_premium_1_yearly', cm: 'sja' },
  'MuCase': { id: 'mc_7200_lifetime_v1', cm: 'sjc' },
  'WallShift': { name: 'pro', id: 'com.roadesign.WallShift.Lifetime', cm: 'sja' },
  'SnapWords': { name: 'Pro access', id: 'com.happyplan.snapwords.premium.subscription.yearly', cm: 'sja' },
  'stopwatch': { name: 'remove_ads', id: 'hasen_stopwatch_remove_ads', cm: 'sja' },
  'fengling': { name: 'Pro', id: 'com.nocmt.fengling.NewLifetime', cm: 'sjb' },
  'Dailyart': { name: 'lifeTime', id: 'artLifeTime', cm: 'sjc' },
  'Lightune': { name: 'pro', id: 'Lightune_Pro_Year', cm: 'sja' },
  'ArchiveList': { name: 'pro_life', id: 'com.jy.ArchiveBox.pro_1', cm: 'sjb' },
  'smscat': { name: 'pro', id: 'smscat_vip_lifetime', cm: 'sjb' },
  'Saifs%20Ai': { name: 'lifetime', id: 'ai_clothes_changer_lifetime_offer', cm: 'sjb' },
  'AppBox': { name: 'appbookmark_vip', id: 'GAB_Lifetime_VIP', cm: 'sja' },
  'StockPlus': { name: 'Premium', id: 'stocks_lifetime_premium', cm: 'sjb' },
  'StudyAI': { name: 'premium_access', id: 'Lifetime_PRO', cm: 'sjb' },
  'PhotoVault': { name: 'lifetime', id: 'photovault.lifetime', cm: 'sjc' },
  'CountdownWidget': { name: 'pro', id: 'cd_lifetime', cm: 'sjb' },
  'DarkLooker': { name: 'Pro', id: 'com.boleStudio.safaridarkmode.permanent', cm: 'sjb' },
  'Sunlitt': { name: 'sunlitt.pro', id: 'pro.lifetime', cm: 'sjb' },
  'Moonlitt': { name: 'moonlitt.pro', id: 'moonlitt.pro.lifetime', cm: 'sjb' },
  'A%20Widget': { name: 'all_widgets', id: 'all_widgets', cm: 'sjb' },
  'AccuFind': { name: 'accufind_payments', id: 'accufind_lifetime', cm: 'sjb' },
  'alistTools': { name: 'pro_lifetime', id: 'com.jy.alistTools.pro_lifetime', cm: 'sjb' },
  'FocusFour': { name: 'pro', id: 'focusfour_lifetime', cm: 'sjb' },
  'remoteMouse': { name: 'pro', id: 'Subscribe__RemoteMouse_Yearly', cm: 'sja' },
  'IPCams': { name: 'pro', id: 'ipcams_pro_lifetime', nameb: 'pro_plus', idb: 'ipcams_pro_plus_lifetime', cm: 'sjb' },
  'Kylin': { name: 'pro', id: 'pro_life', cm: 'sjb' },
  'WidgetSmith': { name: 'Premium', id: 'PremiumMonthlyWidgetsmith', cm: 'sja' },
  'ArtStage': { name: 'FullAccess', id: 'com.nicdeane.artstage.YearlySubscription', cm: 'sja' },
  'CodeScanner': { name: 'pro', id: 'pro_forever_399', cm: 'sjb' },
  'Infltr': { name: 'com.Yooshr.infltr.subscriptionPremium', id: 'com.Yooshr.infltr.everythingForever', cm: 'sjb' },
  'My%20Diary': { name: 'Pro', id: 'com.simpleinnovation.diary.premium.forever.base', cm: 'sjb' },
  'AICalculator': { name: 'Premium', id: 'com.simpleinnovation.calculator.ai.premium.yearly.base', cm: 'sja' },
  'Vinyls': { name: 'AllPro', id: 'com.shi.Vin.lifetime', cm: 'sjb' },
  'Accountit': { name: 'spenditPlus', id: 'DesignTech.SIA.Spendit.Plus.Lifetime', cm: 'sjb' },
  'Phtoto%20Swiper': { name: 'pro', id: 'rc_499_life', cm: 'sjb' },
  'ShellBean': { name: 'pro', id: 'com.ningle.shellbean.iap.forever', cm: 'sjb' },
  'Wishy': { name: 'Wishy Subscription', id: 'wishy_lifetime_subscription', cm: 'sjc' },
  'Fontsify': { name: 'pro', id: 'media.upstate.fontify.lifetime', cm: 'sjb' },
  'com.dison.diary': { name: 'vip', id: 'lifetime', cm: 'sjb' },
  'Food-Diary': { name: 'Premium', id: 'fd_lifetime', cm: 'sjb' },
  'Meal%20Planner': { name: 'premium', id: 'mp_1999_lifetime', cm: 'sjc' },
  'Medication%20List': { name: 'Premium', id: 'ml_lifetime', cm: 'sjc' },
  'Shared%20Family%20Shopping%20List': { name: 'premium', id: 'ls_1299_lifetime', cm: 'sjc' },
  'Pantry%20Check': { name: 'Premium', id: 'pc_lifetime', cm: 'sjc' },
  'becoming': { name: 'Strength Pro', id: 'strength_membership_lifetime', cm: 'sjb' },
  'SCRL': { name: 'com.dopedevelopment.Panels.subscription.Pro_Dynamic_Pricing', id: 'strength_membership_lifetime', cm: 'sja' },
  'Morphose': { name: 'ProStandard', id: 'com.pixery.morphose.yearly', cm: 'sja' },
  'ClevCalc': { name: 'Premium', id: 'com.dencreak.dlcalculator.iap.dlc_no_ads_permanent', cm: 'sjb' },
  'Unfold': { name: 'REDUCED_PRO_YEARLY', id: 'UNFOLD_PRO_YEARLY', cm: 'sja' },
  'Tracepad-iOS': { name: 'unlock', id: 'tracepad_unlock_all_gesture_5', cm: 'sjb' },
  'photography': { name: 'premium', id: 'photography_sub_yearly_1', cm: 'sja' },
  'Binsoo': { name: 'vibe', id: 'annual', cm: 'sja' },
  '%E8%90%8C%E5%AE%A2AI%E7%BB%98%E7%94%BB': { name: 'AISticker_VIP', id: 'LifetimeSubscription_Sticker', cm: 'sjb' },
  'Storage%20Cleaner': { name: 'Premium', id: 'storagecleaner_standalone_lifetime_free', cm: 'sjb' },
  'Language%20Learning': { name: 'premium', id: 'language_sub_lifetime', cm: 'sjb' },
  'OneTap': { name: 'pro', id: 'DiscountedProLifetime', cm: 'sjb' },
  'ChatPub': { name: 'Unlimited Access', id: 'conversationai.annual', cm: 'sja' },
  'Jellycuts': { name: 'pro', id: 'premium', cm: 'sja' },
  'quitnow': { name: 'pro_features', id: 'com.eaginsoftware.QuitNow.unlock_all_pro_features', cm: 'sjb' },
  'Ricoh%20Recipes': { name: 'Patron', id: 'Ricoh_Patron', cm: 'sja' },
  'PixImagine': { id: 'com.efsoft.piximagine_nc_lifetime', cm: 'sjc' },
  'PicLoom': { id: 'com.efsoft.picloom_nc_lifetime', cm: 'sjc' },
  'Translate%20-%20Talk%20Translator': { name: 'Premium', id: 'premiumAnnually', cm: 'sja' },
  'Authenticator': { name: 'premium', id: '2fa_standalone_lifetime', cm: 'sja' },
  'ChatBot': { name: 'chatbot_annual', id: 'chatbot_annual', cm: 'sja' },
  'Mockview': { name: 'Pro', id: 'kavsoft.dev.yearly', cm: 'sja' },
  'ChatLLM': { name: 'Pro', id: 'com.curiouscreatorsco.ChatLLM.pro.lifetime.notrial.150_00', cm: 'sjb' },
  'Photoooo': { name: 'lifetime', id: 'canoe_28_rnb_forever', cm: 'sjb' },
  'VibeCamera': { name: 'forever', id: 'vibe_pro_forever', cm: 'sjb' },
  'No%20Fusion': { name: 'LivePhoto', id: 'com.grey.nofusion.livephoto', cm: 'sjb' },
  'Themy': { name: 'fonts_premium', id: 'lifetime', cm: 'sjb' },
  'BabyCare': { name: 'pro', id: 'KiddoKeeper_38_LifeTime', cm: 'sjb' },
  'ElonAI': { name: 'premium', id: 'elongpt.yearly_1', cm: 'sja' },
  'Dumb%20Phone': { name: 'Pro', id: 'dp.lifetime_19.99', cm: 'sjb' },
  'maple_mobile': { name: 'premium', id: 'mc_3000_12m', cm: 'sja' },
  'FujiLifeStyle': { name: 'FUJIStyle Pro(Year)', id: 'FujiStyle2024003', cm: 'sja' },
  'Gentler': { name: 'premium', id: 'app.gentler.activity.nonconsumable.onetime1', cm: 'sjb' },
  'TuneTally': { name: 'Pro', id: 'tunetally_pro', cm: 'sjb' },
  'Readle': { name: 'Premium', id: 'com.hello.german.yearly', cm: 'sja' },
  'Utiful': { name: 'All Access', id: 'All_Access_YR_12M_Free', cm: 'sja' },
  'CharingCrossRoad': { name: 'ready_pro', id: 'ready_pro_50_1y', cm: 'sja' },
  'ig-bookmarker': { name: 'entitlement', id: 'lifetimeID', cm: 'sjb' },
  'PhotoMapper': { name: 'premium', id: 'photomapper_lifetime_1.99', cm: 'sjb' },
  'CallAnnie': { name: 'ai.animato.callannie.entitlement.pro0', id: 'ai.animato.callannie.proyearly1', cm: 'sja' },
  'Liftbear': { name: 'Pro', id: 'liftbear_2399_1y', cm: 'sja' },
  'OneMockup': { name: 'pro', id: 'online.ohwe.onescreen.Lifetime', cm: 'sja' },
  'DataCalc': { name: 'datacalc.pro', id: 'datacalc.yearly.12', cm: 'sja' },
  'moss-ios': { name: 'prouser', id: 'dpbox_yearly_68', cm: 'sja' },
  'Law': { name: 'vip', id: 'LawVIPOneYear', cm: 'sja' },
  'SleepSounds': { name: 'vip', id: 'VIPOneMonth', cm: 'sja' },
  'multitimer_app': { name: 'premium', id: 'timus_lt_base', cm: 'sjb' },
  'pdfai_app': { name: 'premium', id: 'special_lifetime', cm: 'sjb' },
  'Linearity%20Curve': { name: 'pro', id: 'linearity_curve_pro_yearly_free_trial', cm: 'sja' },
  'TQBrowser': { name: 'pro_lt', id: 'com.tk.client.lifetime', cm: 'sjb' },
  'AI%C2%A0Chat': { name: 'AI Plus', id: 'ai_plus_gpt_yearly', cm: 'sja' },
  'Yosum': { name: 'Premium', id: 'yosum_999_1year', cm: 'sja' },
  '%E8%B5%84%E6%BA%90%E6%90%AC%E8%BF%90%E5%A4%A7%E5%B8%88': { name: 'SaveTikYoutu_common', id: 'LifetimeSubscription', cm: 'sjb' },
  'DHWaterMarkManager': { name: 'WaterManager_common', id: 'lifetimeVIP_001', cm: 'sjb' },
  'iplayTV': { name: 'com.ll.btplayer.12', id: 'com.ll.btplayer.12', cm: 'sjb' },
  'MaxWallpaper': { name: 'maxwallpaper_common', id: 'super_forever_vip', cm: 'sjb' },
  'intervalFlow': { name: 'All Access', id: 'wodtimer_lf', cm: 'sjb' },
  'BORD': { name: 'pro_membership', id: 'bord_plus_2499_lifetime', cm: 'sjb' },
  'FRMD': { name: 'all_access', id: 'frmd_plus_999_lifetime', cm: 'sjb' },
  'HRZN': { name: 'pro', id: 'plus_999_lifetime', cm: 'sjb' },
  'Assembly': { name: 'premium_access', id: 'com.pixite.assembly.1yearlyq', cm: 'sja' },
  'Flourish': { name: 'Pro', id: 'flourish_9800_1yr_1m0', cm: 'sja' },
  'metaslip': { name: 'Pro', id: 'ms_lifetime', cm: 'sjb' },
  'Pins': { name: 'customer', id: 'do.anh.Pins.Unlock.Standard', cm: 'sja' },
  'Loora': { name: 'Yearly', id: 'yearly_free_ref_10usd_off', cm: 'sja' },
  'PwDrawingPad': { name: 'pro', id: 'com.s132.app.supaintexchange.year', cm: 'sja' },
  'OneGrow': { name: 'pro', id: 'com.onenicetech.OneGrow.Lifetime', cm: 'sjb' },
  '%E6%97%B6%E9%97%B4%E8%AE%B0%E5%BD%95': { name: 'pro', id: 'com.bapaws.Hours.lifetime', cm: 'sjb' },
  'PianoTrainer': { name: 'pro_subscription', id: 'pianotrainer.sub.yearly.pro', cm: 'sja' },
  'FretTrainer': { name: 'pro_subscription', id: 'frettrainer.sub.yearly.pro', cm: 'sja' },
  'Currency': { name: 'plus', id: 'com.jeffreygrossman.currencyapp.iap.plus', cm: 'sja' },
  'TripMemo': { name: 'pro', id: 'com.ningle.dailytracker.lifetime', cm: 'sjb' },
  'ShellBean': { name: 'pro', id: 'com.ningle.shellbean.iap.forever', cm: 'sjb' },
  'nPtt': { name: 'vip.yearly', id: 'app.nextptt.vip1.yearly', cm: 'sja' },
  'MagicTiles3': { name: 'VIP', id: 'com.pianoidols.vipsub.year.06', cm: 'sja' },
  'Airmail': { name: 'Airmail Premium', id: 'Airmail_iOS_Yearly_P', cm: 'sja' },
  'ScreenRecordCase': { name: 'Premium', id: 'me.fandong.ScreenRecordCase.Ultra', cm: 'sjb' },
  'opusvpn': { name: 'pro', id: 'yearly_discount', cm: 'sja' },
  'ip_tv_react_native': { name: 'Single', id: 'opus.lifetime', cm: 'sjb' },
  'Atomic': { name: 'pro', id: 'ht_lifetime1', cm: 'sjb' },
  'QingLong': { name: 'Premium', id: 'qinglong_premium', cm: 'sjb' },
  'timetrack.io': { name: 'atimelogger-premium-plus', id: 'ttio_premium_plus', cm: 'sjb' },
  'Video%20Teleprompter': { name: 'videoPremium', id: 'com.joeallenpro.videoteleprompter.upgrade.yearly_a', cm: 'sja' },
  'FoJiCam': { name: 'ProVersionLifeTime', id: 'com.uzero.cn.fojicam.life2', cm: 'sjb' },
  'FruitMinder': { name: 'Premium', id: 'com.bartozo.FruitMinder.lifetime', cm: 'sjb' },
  'PDF_convertor': { name: 'VIP', id: 'com.pdf.convertor.forever', cm: 'sjb' },
  'rewritingText': { name: 'AIGrammercheckerProAccess', id: 'sv.aigrammerchecker.com.lifetime', cm: 'sjb' },
  'ShellBoxKit': { name: 'ssh_pro', id: 'ShellBoxKit.Year', cm: 'sja' },
  'IDM': { name: 'premium', id: 'sub_yearly_idm', cm: 'sja' },
  'Whisper': { name: 'all_features', id: 'whisperai_80_y', cm: 'sja' },
  'Shapy': { name: 'premium', id: 'com.blake.femalefitness.subscription.yearly', cm: 'sja' },
  'Carbon-iOS': { name: 'pro', id: 'carbon.unlockall', cm: 'sjb' },
  '%E6%89%8B%E6%8C%81%E5%BC%B9%E5%B9%95': { name: 'Pro access', id: 'com.tech.LedScreen.VIPALL', cm: 'sjb' },
  '%E8%AF%AD%E9%9F%B3%E8%AE%A1%E7%AE%97%E5%99%A8': { name: 'Pro access', id: 'com.tech.counter.All', cm: 'sjb' },
  '%E7%BE%8E%E5%A6%86%E6%97%A5%E5%8E%86': { name: 'Pro access', id: 'com.tech.Aula.VIPALL', cm: 'sjb' },
  'LiveWallpaper': { name: 'Pro access', id: 'com.tech.LiveWallpaper.ALL', cm: 'sjb' },
  'Chat%E7%BB%83%E5%8F%A3%E8%AF%AD': { name: 'Pro access', id: 'com.tech.AiSpeak.All', cm: 'sjb' },
  'Calflow': { name: 'pro', id: 'kike.calflow.pro.lifetime', cm: 'sjb' },
  'dtdvibe': { name: 'pro', id: 'com.dtd.aroundu.life', cm: 'sjb' },
  'Clipboard': { name: 'Premium', id: 'Premium_0_99_1M_1MFree', cm: 'sja' },
  'Hi%E8%AE%BA%E5%9D%9B/69': { name: 'plus', id: 'plus_yearly', cm: 'sja' },
  'AnimeArt': { name: 'AnimeArt.Gold', id: 'WaifuArt.Lifetime', cm: 'sjb' },
  'LiveCaption': { name: 'Plus', id: 'rc_0400_1m', cm: 'sja' },
  'EraseIt': { name: 'ProVersionLifeTime', id: 'com.uzero.cn.eraseit.premium1.fromyear', cm: 'sjb' },
  'MusicPutty': { name: 'pro_version', id: 'mp_3599_1y', cm: 'sja' },
  'SleepDown': { name: 'Pro', id: 'pro_student_0926', cm: 'sjb' },
  'PhotoRoom': { name: 'pro', id: 'com.background.pro.yearly', cm: 'sja' },
  'Bg%20Remover': { name: 'Premium', id: 'net.kaleidoscope.cutout.premium1', cm: 'sja' },
  'Sex%20Actions': { name: 'Premium Plus', id: 'ru.sexactions.subscriptionPromo1', cm: 'sja' },
  'StarFocus': { name: 'pro', id: 'com.gsdyx.StarFocus.nonConsumable.forever', cm: 'sjb' },
  'StarDiary': { name: 'pro', id: 'com.gsdyx.StarDiary.nonConsumable.forever', cm: 'sjb' },
  'CountDuck': { name: 'premium', id: 'Lifetime', cm: 'sjb' },
  'wordswag': { name: 'pro', id: 'Pro_Launch_Monthly', cm: 'sja' },
  'LockFlow': { name: 'unlimited_access', id: 'lf_00.00_lifetime', cm: 'sjb' },
  'TextMask': { name: 'pro', id: 'tm_lifetime', cm: 'sjb' },
  '%E5%96%B5%E7%BB%84%E4%BB%B6': { name: 'MiaoWidgetPro', id: 'MiaoLifeTime', cm: 'sjb' },
  'Chatty': { name: 'pro', id: 'chatty.yearly.1', cm: 'sja' },
  'ImagineAI': { name: 'plus', id: 'artistai.lifetime.1', cm: 'sjb' },
  'Langster': { name: 'Premium', id: 'com.langster.universal.lifetime', cm: 'sjb' },
  'VoiceAI': { name: 'Special Offer', id: 'voiceannualspecial', cm: 'sjb' },
  'Rootd': { name: 'pro', id: 'subscription_lifetime', cm: 'sjb' },
  'MusicMate': { name: 'premium', id: 'mm_lifetime_68_premium', cm: 'sjb' },
  'AIKeyboard': { name: 'plus_keyboard', id: 'aiplus_keyboard_yearly', cm: 'sja' },
  'SmartAIChat': { name: 'Premium', id: 'sc_3999_1y', cm: 'sja' },
  'AIChat': { name: 'AI Plus', id: 'ai_plus_yearly', cm: 'sja' },
  'LazyReply': { name: 'lazyReplyYearlySubscription', id: 'com.bokhary.lazyreply.yearlyprosubscription', cm: 'sja' },
  'LazyBoard': { name: 'lazyboardPro', id: 'com.bokhary.magicboard.magicboardpro', cm: 'sjb' },
  'PDF%20Viewer': { name: 'sub.pro', id: 'com.pspdfkit.viewer.sub.pro.yearly', cm: 'sja' },
  'Joy': { name: 'pro', id: 'com.indiegoodies.Agile.lifetime2', cm: 'sjb' },
  'AnkiPro': { name: 'Premium', id: 'com.ankipro.app.lifetime', cm: 'sjb' },
  'SharkSMS': { name: 'VIP', id: 'com.gaapp.sms.permanently', cm: 'sjb' },
  'EncryptNote': { name: 'Pro', id: 'com.gaapp.2019note.noAds', cm: 'sjb' },
  'One4WallSwiftUI': { name: 'lifetime', id: 'lifetime_key', cm: 'sjb' },
  'Pigment': { name: 'pro', id: 'com.pixite.pigment.1yearS', cm: 'sja' },
  'GradientMusic': { name: 'Pro', id: 'com.gradient.vision.new.music.one.time.79', cm: 'sjb' },
  'iBody': { name: 'Pro', id: 'com.tickettothemoon.bodyfilter.one.time.purchase', cm: 'sjb' },
  'Persona': { name: 'unlimited', id: 'com.tickettothemoon.video.persona.one.time.purchase', cm: 'sjb' },
  'easy_chart': { name: 'unlock all', id: 'qgnjs_lifetime', cm: 'sjb' },
  'Snipd': { name: 'premium', id: 'snipd_premium_1y_7199_trial_2w_v2', cm: 'sja' },
  'Tide%20Guide': { name: 'Tides+', id: 'TideGuidePro_Lifetime_Family_149.99', cm: 'sjb' },
  'Gear': { name: 'subscription', id: 'com.gear.app.yearly', cm: 'sja' },
  'Aisten': { name: 'pro', id: 'aisten_pro', cm: 'sjb' },
  'ASKAI': { name: 'pro', id: 'askai_pro', nameb: 'pro_plan', idb: 'token_pro_plan', cm: 'sjb' },
  'Subtrack': { name: 'pro', id: 'com.mohitnandwani.subtrack.subtrackpro.family', cm: 'sjb' },
  'shipian-ios': { name: 'vipOffering', id: 'shipian_25_forever', cm: 'sjb' },
  'My%20Time': { name: 'Pro', id: 'ninja.fxc.mytime.pro.lifetime', cm: 'sjb' },
  'LUTCamera': { name: 'ProVersionLifeTime', id: 'com.uzero.funforcam.lifetimepurchase', cm: 'sjb' },
  'Heal%20Clock': { name: 'pro', id: 'com.mad.HealClock.pro', cm: 'sjb' },
  'tiimo': { name: 'full_access', id: 'lifetime.iap', cm: 'sjb' },
  'IPTVUltra': { name: 'premium', id: 'com.ddm1023.lifetime', cm: 'sjb' },
  'Wozi': { name: 'wozi_pro_2023', id: 'wozi_pro_2023', cm: 'sjb' },
  'Color%20Widgets': { name: 'pro', id: 'cw_1999_1y_3d0', cm: 'sja' },
  'server_bee': { name: 'Pro', id: 'pro_45_lifetime', cm: 'sjb' },
  'MyPianist': { name: 'pro', id: 'com.collaparte.mypianist.pro.yearly', cm: 'sja' },
  'ProCam': { name: 'pro', id: 'pro_lifetime', cm: 'sjb' },
  'Drops': { name: 'premium', id: 'forever_unlimited_time_discounted_80_int', cm: 'sjb' },
  'transmission_ui': { name: 'Premium', id: '200002', cm: 'sja' },
  'fastdiet': { name: 'premium', id: 'com.happy.fastdiet.forever', cm: 'sjb' },
  'money_manager': { name: 'premium', id: 'com.happy.money.forever', cm: 'sjb' },
  'Overdue': { name: 'Pro', id: '1', cm: 'sjb' },
  'Ledger': { name: 'Pro', id: 'com.lifetimeFamily.pro', cm: 'sjb' },
  'WeNote': { name: 'pro', id: 'Yearly', cm: 'sja' },
  'Scelta': { name: 'pro', id: 'SceltaProLifetime', cm: 'sjb' },
  '%E5%87%B9%E5%87%B8%E5%95%A6%E6%9F%A5%E5%A6%86': { name: 'Pro access', id: 'com.smartitfarmer.MakeUpAssistant.UNLIMITED', cm: 'sjb' },
  'PM4': { name: 'pro', id: 'pm4_pro_1y_2w0', cm: 'sja' },
  'Project%20Delta': { name: 'rc_entitlement_obscura_ultra', id: 'com.benricemccarthy.obscura4.obscura_ultra_lifetime', cm: 'sjb' },
  'Zettelbox': { name: 'Power Pack', id: 'powerpack_permanent_1', cm: 'sjb' },
  'Packr': { name: 'Pro', id: 'com.jeremieleroy.packr.premiumyearly', cm: 'sja' },
  'muoyu': { name: 'pro', id: 'com.metaorder.muoyu.prolifetime.12', cm: 'sjb' },
  '%E7%BF%BB%E9%A1%B5%E6%97%B6%E9%92%9F': { name: 'Pro access', id: 'com.douwan.aiclock.ALL', cm: 'sjb' },
  '%E7%A7%A9%E5%BA%8F%E6%97%B6%E9%92%9F': { name: 'lifetime', id: 'com.metaorder.orderclocko.lifetime', cm: 'sjb' },
  '%E7%A7%A9%E5%BA%8F%E7%9B%AE%E6%A0%87': { name: 'pro', id: 'com.metaorder.OKRTomato.vip.supremacy', cm: 'sjb' },
  '%E4%BA%BA%E7%94%9F%E6%B8%85%E5%8D%95': { name: 'premium', id: 'com.metaorder.lifelist.premium', cm: 'sjb' },
  'Vision': { name: 'promo_3.0', id: 'vis_lifetime_3.0_promo', cm: 'sja' },
  'TruthOrDare': { name: 'premium', id: 'truth_or_dare_premium_monthly', cm: 'sja' },
  'HurtYou': { name: 'premium', id: 'hurtyou_199_1y', cm: 'sja' },
  '%E4%BF%A1%E6%81%AF%E8%AE%A1%E7%AE%97': { name: 'pro', id: 'informaticcalculations.pro.lifetime', cm: 'sjb' },
  'Context_iOS': { name: 'Context Pro', id: 'ctx_sub_1y_sspai_preorder_angel', cm: 'sja' },
  'Structured': { name: 'pro', id: 'today.structured.pro', cm: 'sjb' },
  'HTTPBot': { name: 'pro', id: 'com.behindtechlines.HTTPBot.prounlock', cm: 'sjb' },
  'MinimalDiary': { name: 'pro', id: 'com.mad.MinimalDiary.lifetime', cm: 'sjb' },
  'Zen%20Flip%20Clock': { name: 'pro', id: 'com.mad.zenflipclock.iap.buymeacoffee', cm: 'sjb' },
  'Transfer': { name: 'pro', id: 'transfer_ios_premium_year_2022_1', cm: 'sja' },
  'Collect': { name: 'pro', id: 'com.revenuecat.product.yearly.ios', cm: 'sja' },
  'Paper': { name: 'pro', id: 'com.fiftythree.paper.credit', cm: 'sjb' },
  'Ape': { name: 'pro-iOS', id: 'ape.lifetime', cm: 'sjb' },
  'Boar': { name: 'pro-iOS', id: 'boar.yearly', cm: 'sja' },
  'MySticker': { name: 'mysticker premium', id: 'com.miiiao.MySticker.lifetime', cm: 'sjb' },
  'Rec': { name: 'rec.paid', id: 'rec.paid.onetime', cm: 'sjb' },
  'Photon': { name: 'photon.paid', id: 'photon.paid.onetime', cm: 'sjb' },
  'OneTodo': { name: 'pro', id: 'onetodo_lifetime', cm: 'sjb' },
  'OneFlag': { name: 'pro', id: 'oneflag_lifetime', cm: 'sjb' },
  'OneClear': { name: 'pro', id: 'app.imone.OneClear.Lifetime', cm: 'sjb' },
  'OneScreen': { name: 'pro', id: 'onescreen_lifetime', cm: 'sjb' },
  'Photomator': { name: 'pixelmator_photo_pro_access', id: 'pixelmator_photo_lifetime_v1', cm: 'sjb' },
  'Endel': { name: 'pro', id: 'Lifetime', cm: 'sjb' },
  'Drowsy': { name: 'Pro', id: 'Drowsy_Life', cm: 'sjb' },
  'Thiro': { name: 'pro', id: 'atelerix_pro_lifetime', cm: 'sjb' },
  'Stress': { name: 'StressWatch Pro', id: 'stress_membership_lifetime', cm: 'sjb' },
  'Worrydolls': { name: 'magicmode', id: 'magicmode', cm: 'sjb' },
  'Echo': { name: 'PLUS', id: 'com.LEMO.LemoFm.plus.lifetime.l3', cm: 'sjb' },
  'Falendar': { name: 'Falendar+', id: 'falendar_68_life', cm: 'sjb' },
  '%E8%BD%A6%E7%A5%A8%E7%A5%A8': { name: 'vip+watch_vip', id: 'eticket_with_watch_life_a', cm: 'sjb' },
  'iRead': { name: 'vip', id: 'com.vip.forever_1', cm: 'sjb' },
  'MOZE': { name: 'MOZE_PREMIUM_SUBSCRIPTION', id: 'MOZE_PRO_SUBSCRIPTION_YEARLY_BASIC', cm: 'sja' },
  'app/112': { name: 'Pro', id: 'com.wengqianshan.friends.pro', cm: 'sjb' },
  'app/38': { name: 'Pro', id: 'com.wengqianshan.diet.pro', cm: 'sjb' },
  'MatrixClock': { name: 'Premium', id: 'com.lishaohui.matrixclock.lifetimesharing', cm: 'sjb' },
  'SalesCat': { name: 'Premium', id: 'com.lishaohui.salescat.lifetime', cm: 'sjb' },
  'MoneyThings': { name: 'Premium', id: 'com.lishaohui.cashflow.lifetime', cm: 'sjb' },
  'ChatGPTApp': { name: 'Advanced', id: 'com.palligroup.gpt3.yearlyyy', cm: 'sja' },
  'Journal_iOS': { name: 'PRO', id: 'com.pureformstudio.diary.yearly_2022_promo', cm: 'sja' },
  'LemonKeepAccounts': { name: 'VIP', id: 'lm_1_1month', cm: 'sja' },
  'mizframa': { name: 'premium', id: 'mf_20_lifetime2', cm: 'sjb' },
  'EasyClicker': { name: 'pro', id: 'easyclicker.premium.discount2', cm: 'sjb' },
  'ImageX': { name: 'imagex.pro.ios', id: 'imagex.pro.ios.lifetime', cm: 'sjb' },
  'image_upscaler': { name: 'pro', id: 'yearly_sub_pro', cm: 'sja' },
  'DayPoem': { name: 'Pro Access', id: 'com.uzero.poem.month1', cm: 'sja' },
  'Personal%20Best': { name: 'pro', id: 'PersonalBestPro_Yearly', cm: 'sja' },
  'Darkroom': { name: 'iapkit_darkroomplus', id: 'co.bergen.Darkroom.product.forever.everything', cm: 'sjb' },
  'CardPhoto': { name: 'allaccess', id: 'CardPhoto_Pro', cm: 'sjb' },
  'OneWidget': { name: 'allaccess', id: 'com.onewidget.vip', cm: 'sjb' },
  'PinPaper': { name: 'allaccess', id: 'Paper_Lifetime', cm: 'sjb' },
  'Cookie': { name: 'allaccess', id: 'app.ft.Bookkeeping.lifetime', cm: 'sjb' },
  'MyThings': { name: 'pro', id: 'xyz.jiaolong.MyThings.pro.infinity', cm: 'sjb' },
  '%E4%BA%8B%E7%BA%BF': { name: 'pro', id: 'xyz.jiaolong.eventline.pro.lifetime', cm: 'sjb' },
  'PipDoc': { name: 'pro', id: 'pipdoc_pro_lifetime', cm: 'sjb' },
  'Facebook': { name: 'pro', id: 'fb_pro_lifetime', cm: 'sjb' },
  'Free': { name: 'pro', id: 'appspree_pro_lifetime', cm: 'sjb' },
  'Startodo': { name: 'pro', id: 'pro_lifetime', cm: 'sjb' },
  'Browser': { name: 'pro', id: 'pro_zoomable', cm: 'sjb' },
  'YubePiP': { name: 'pro', id: 'piptube_pro_lifetime', cm: 'sjb' },
  'PrivateBrowser': { name: 'pro', id: 'private_pro_lifetime', cm: 'sjb' },
  'Photo%20Cleaner': { name: 'premium', id: 'com.monocraft.photocleaner.lifetime.3', cm: 'sjb' },
  'bluredit': { name: 'Premium', id: 'net.kaleidoscope.bluredit.premium1', cm: 'sja' },
  'TouchRetouchBasic': { name: 'premium', id: 'tr5_yearlysubsc_15dlrs_2', cm: 'sja' },
  'TimeFinder': { name: 'pro', id: 'com.lukememet.TimeFinder.Premium', cm: 'sjb' },
  'Alpenglow': { name: 'newPro', id: 'ProLifetime', cm: 'sja' },
  'Decision': { name: 'com.nixwang.decision.entitlements.pro', id: 'com.nixwang.decision.pro.annual', cm: 'sja' },
  'ElementNote': { name: 'pro', id: 'com.soysaucelab.element.note.lifetime', cm: 'sjb' },
  'Noto%20%E7%AC%94%E8%AE%B0': { name: 'pro', id: 'com.lkzhao.editor.full', cm: 'sja' },
  'Tangerine': { name: 'Premium', id: 'PremiumMonthly', cm: 'sja' },
  'Email%20Me': { name: 'premium', id: 'ventura.media.EmailMe.premium.lifetime', cm: 'sjb' },
  'Brass': { name: 'pro', id: 'brass.pro.annual', cm: 'sja' },
  'Happy%3ADays': { name: 'pro', id: 'happy_999_lifetime', cm: 'sjb' },
  'Aphrodite': { name: 'all', id: 'com.ziheng.aphrodite.onetime', cm: 'sjb' },
  'apollo': { name: 'all', id: 'com.ziheng.apollo.onetime', cm: 'sjb' },
  'widget_art': { name: 'all', id: 'com.ziheng.widgetart.onetime', cm: 'sjb' },
  'audiomack-iphone': { name: 'Premium1', id: 'com.audiomack.premium.2022', cm: 'sja' },
  'MallocVPN': { name: 'IOS_PRO', id: 'malloc_yearly_vpn', cm: 'sja' },
  'WhiteCloud': { name: 'allaccess', id: 'wc_pro_1y', cm: 'sja' },
  'Spark': { name: 'premium', id: 'spark_6999_1y_1w0', nameb: 'premium', idb: 'spark_openai_tokens_4xt', cm: 'sja' },
  'NotePlan': { name: 'premium', id: 'co.noteplan.subscription.personal.annual', cm: 'sja' },
  'vibes': { name: 'patron', id: 'com.andyworks.vibes.yearlyPatron', cm: 'sja' },
  'simple-weather': { name: 'patron', id: 'com.andyworks.weather.yearlyPatron', cm: 'sja' },
  'streaks': { name: 'patron', id: 'com.andyworks.weather.yearlyPatron', cm: 'sja' },
  'andyworks-calculator': { name: 'patron', id: 'com.andyworks.weather.yearlyPatron', cm: 'sja' },
  'simple-timer': { name: 'patron', id: 'com.andyworks.weather.yearlyPatron', cm: 'sja' },
  'Harukong': { name: 'premium', id: 'com.bluesignum.harukong.lifetime.premium', cm: 'sjb' },
  'UTC': { name: 'Entitlement.Pro', id: 'tech.miidii.MDClock.subscription.month', cm: 'sja' },
  'OffScreen': { name: 'Entitlement.Pro', id: 'tech.miidii.offscreen.pro', cm: 'sjb' },
  '%E8%B0%9C%E5%BA%95%E9%BB%91%E8%83%B6': { name: 'Entitlement.Pro', id: 'tech.miidii.MDVinyl.lifetime', cm: 'sja' },
  '%E8%B0%9C%E5%BA%95%E6%97%B6%E9%92%9F': { name: 'Entitlement.Pro', id: 'tech.miidii.MDClock.pro', cm: 'sjb' },
  '%E7%9B%AE%E6%A0%87%E5%9C%B0%E5%9B%BE': { name: 'pro', id: 'com.happydogteam.relax.lifetimePro', cm: 'sjb' },
  'APTV': { name: 'Pro', id: 'com.kimen.aptvpro.lifetime', cm: 'sjb' },
  'Seamless': { name: 'Seamless.Pro', id: 'net.shinystone.Seamless.Pro', cm: 'sjb' },
  'Anybox': { name: 'pro', id: 'cc.anybox.Anybox.annual', cm: 'sja' },
  'ScannerPro': { name: 'plus', id: 'com.ddm1024.premium.yearly', cm: 'sja' },
  'Pillow': { name: 'premium', id: 'com.neybox.pillow.premium.year.v2', cm: 'sja' },
  'Taio': { name: 'full-version', id: 'taio_1651_1y_2w0_std_v2', cm: 'sja' },
  'CPUMonitor': { name: 'Pro', id: 'com.mars.cpumonitor_removeAd', cm: 'sjb' },
  'totowallet': { name: 'all', id: 'com.ziheng.totowallet.onetimepurchase', cm: 'sjb' },
  '1Blocker': { name: 'premium', id: 'blocker.ios.iap.lifetime', cm: 'sjb' },
  'VSCO': { name: 'pro', id: 'vscopro_global_5999_annual_7D_free', cm: 'sja' }
};

// 判断是否为请求头处理（无响应体）
if (typeof $response === "undefined") {
  // 删除RevenueCat的ETag头，避免缓存问题
  delete headers["x-revenuecat-etag"];
  delete headers["X-RevenueCat-ETag"];
  chxm1024.headers = headers;
} else if (chxm1023 && chxm1023.subscriber) {
  // 确保subscriptions和entitlements对象存在
  chxm1023.subscriber.subscriptions = chxm1023.subscriber.subscriptions || {};
  chxm1023.subscriber.entitlements = chxm1023.subscriber.entitlements || {};

  // 初始化变量
  let name = null;
  let nameb = null;
  let ids = null;
  let idb = null;
  let data = null;

  // 遍历映射表进行匹配
  for (const src of [list, bundle]) {
    for (const i in src) {
      if (!src.hasOwnProperty(i)) continue;

      const test = src === list ? ua : bundle_id;
      if (!test) continue;

      try {
        if (new RegExp(`^${i}`, 'i').test(test)) {
          // 根据cm参数确定数据格式
          if (src[i].cm.indexOf('sja') !== -1) {
            data = {
              "purchase_date": "2023-09-09T09:09:09Z",
              "expires_date": "2099-09-09T09:09:09Z"
            };
          } else if (src[i].cm.indexOf('sjb') !== -1) {
            data = { "purchase_date": "2023-09-09T09:09:09Z" };
          }

          ids = src[i].id || null;
          name = src[i].name || null;
          idb = src[i].idb || null;
          nameb = src[i].nameb || null;
          break;
        }
      } catch (e) {
        console.log("正则匹配错误: " + e.message);
      }
    }

    if (name && ids) break;
  }

  // 如果没有匹配到任何APP，使用默认配置
  if (!name || !ids) {
    data = {
      "purchase_date": "2023-09-09T09:09:09Z",
      "expires_date": "2099-09-09T09:09:09Z"
    };
    name = 'pro';
    ids = 'com.chxm1023.pro';
  }

  // 设置entitlements
  if (name && ids) {
    chxm1023.subscriber.entitlements[name] = Object.assign({}, data, { product_identifier: ids });

    // 如果有第二个entitlement
    if (typeof nameb !== 'undefined' && nameb !== null && idb) {
      chxm1023.subscriber.entitlements[nameb] = Object.assign({}, data, { product_identifier: idb });
    }
  }

  // 构建订阅数据
  const subData = Object.assign({}, data, {
    "Author": "chxm1023",
    "Telegram": "https://t.me/chxm1023",
    "warning": "仅供学习，禁止转载或售卖",
    "original_purchase_date": "2023-09-09T09:09:09Z",
    "store": "app_store",
    "ownership_type": "PURCHASED"
  });

  // 设置subscriptions
  if (ids) {
    chxm1023.subscriber.subscriptions[ids] = subData;

    // 如果有第二个subscription
    if (typeof idb !== 'undefined' && idb !== null) {
      chxm1023.subscriber.subscriptions[idb] = subData;
    }
  }

  // 序列化并输出
  chxm1024.body = JSON.stringify(chxm1023);
  console.log('已操作成功🎉🎉🎉\n叮当猫の分享频道: https://t.me/chxm1023');
}

// 完成请求处理
$done(chxm1024);
