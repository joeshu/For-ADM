#import "RuntimeSDK.h"
#import "HLSProxy.h"
@class SYController;
@interface SYController (LiveActions)
- (void)sendLiveActionScript:(NSString*)script;
@end
static char SYPlaybackStatus;
@interface SYPlayerViewController:AVPlayerViewController<AVPlayerViewControllerDelegate>
@property(nonatomic,copy) void(^onClose)(void);
@property(nonatomic,copy) void(^onRestore)(void(^)(BOOL));
@property(nonatomic) BOOL pictureInPicture;
@property(nonatomic) BOOL playerVisible;
@property(nonatomic) BOOL fullScreen;
@end
@implementation SYPlayerViewController
- (void)viewDidAppear:(BOOL)animated {[super viewDidAppear:animated];self.playerVisible=YES;}
- (void)viewDidDisappear:(BOOL)animated {[super viewDidDisappear:animated];self.playerVisible=NO;if(!self.parentViewController&&!self.pictureInPicture){[self.player pause];if(self.onClose)self.onClose();}}
- (void)playerViewController:(AVPlayerViewController*)controller willBeginFullScreenPresentationWithAnimationCoordinator:(id)coordinator {self.fullScreen=YES;}
- (void)playerViewController:(AVPlayerViewController*)controller willEndFullScreenPresentationWithAnimationCoordinator:(id)coordinator {self.fullScreen=NO;}
- (void)playerViewControllerWillStartPictureInPicture:(AVPlayerViewController*)controller {self.pictureInPicture=YES;}
- (void)playerViewController:(AVPlayerViewController*)controller failedToStartPictureInPictureWithError:(NSError*)error {self.pictureInPicture=NO;if(!self.playerVisible&&self.onRestore)self.onRestore(^(BOOL restored){if(!restored){[self.player pause];if(self.onClose)self.onClose();}});}
- (void)playerViewControllerDidStopPictureInPicture:(AVPlayerViewController*)controller {self.pictureInPicture=NO;if(!self.playerVisible&&!self.parentViewController){[self.player pause];if(self.onClose)self.onClose();}}
- (BOOL)playerViewControllerShouldAutomaticallyDismissAtPictureInPictureStart:(AVPlayerViewController*)controller {return NO;}
- (void)playerViewController:(AVPlayerViewController*)controller restoreUserInterfaceForPictureInPictureStopWithCompletionHandler:(void(^)(BOOL))handler {if(self.onRestore)self.onRestore(handler);else handler(NO);}
@end
@interface SYBridge:NSObject<WKScriptMessageHandler>
@property(nonatomic,weak) SYController*owner;
@end
@interface SYLiveActionButton:UIButton
@property(nonatomic,copy) NSString*action;
@property(nonatomic,copy) NSString*value;
@end
@interface SYLiveScreenController:UIViewController
@property(nonatomic,weak) SYController*owner;
@property(nonatomic,strong) UIView*playerHost;
@property(nonatomic,strong) UIScrollView*content;
@property(nonatomic,strong) UITextField*urlField;
@property(nonatomic,strong) UITextField*searchField;
@property(nonatomic,strong) NSDictionary*state;
- (void)applyState:(NSDictionary*)state;
@end
@interface SYController:UIViewController<WKNavigationDelegate>
@property(nonatomic,strong) WKWebView*web;
@property(nonatomic,strong) SYHLSProxy*hlsProxy;
@property(nonatomic,strong) SYBridge*bridge;
@property(nonatomic,strong) NSURLSession*session;
@property(nonatomic,strong) NSMutableDictionary*tasks;
@property(nonatomic,strong) SYPlayerViewController*nativePlayer;
@property(nonatomic,strong) SYLiveScreenController*liveScreen;
@property(nonatomic,strong) NSDictionary*liveSnapshot;
@property(nonatomic,strong) AVRoutePickerView*airplayPicker;
@property(nonatomic,strong) AVPlayerItem*nativeItem;
@property(nonatomic,strong) id timeObserver;
@property(nonatomic,strong) id endObserver;
@property(nonatomic,strong) id stalledObserver;
@property(nonatomic,strong) id failedObserver;
@property(nonatomic,copy) NSString*playContext;
@property(nonatomic) BOOL detailStatusStyle;
#if defined(SY_SIMULATOR_SMOKE)
@property(nonatomic) NSInteger smokeAttempts;
@property(nonatomic) BOOL smokePlayerReady;
@property(nonatomic) BOOL smokeProxyActive;
#endif
- (void)receive:(WKScriptMessage*)message;
@end
@implementation SYBridge
- (void)userContentController:(id)controller didReceiveScriptMessage:(WKScriptMessage*)message { [self.owner receive:message]; }
@end
@implementation SYLiveScreenController
- (UIStatusBarStyle)preferredStatusBarStyle {return 1;}
- (UILabel*)label:(NSString*)text size:(CGFloat)size bold:(BOOL)bold {
  UILabel*label=[[UILabel alloc]initWithFrame:CGRectMake(16,0,340,30)];label.text=text;label.textColor=UIColor.whiteColor;label.font=bold?[UIFont boldSystemFontOfSize:size]:[UIFont systemFontOfSize:size];return label;
}
- (SYLiveActionButton*)button:(NSString*)title action:(NSString*)action value:(NSString*)value frame:(CGRect)frame {
  SYLiveActionButton*button=[[SYLiveActionButton alloc]initWithFrame:frame];button.action=action;button.value=value?:@"";button.backgroundColor=[UIColor colorWithRed:0.10 green:0.17 blue:0.18 alpha:1];[button setTitle:title forState:UIControlStateNormal];[button setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];button.titleLabel.font=[UIFont systemFontOfSize:14];[button addTarget:self action:@selector(actionPressed:) forControlEvents:UIControlEventTouchUpInside];return button;
}
- (void)viewDidLoad {
 [super viewDidLoad];self.view.backgroundColor=[UIColor colorWithRed:0.035 green:0.065 blue:0.075 alpha:1];
 UIButton*back=[UIButton buttonWithType:0];back.frame=CGRectMake(14,43,48,42);[back setTitle:@"‹" forState:UIControlStateNormal];[back setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];back.titleLabel.font=[UIFont systemFontOfSize:34];[back addTarget:self action:@selector(goBack) forControlEvents:UIControlEventTouchUpInside];[self.view addSubview:back];
 UILabel*title=[self label:@"直播" size:18 bold:YES];title.frame=CGRectMake(74,46,220,36);title.textAlignment=1;[self.view addSubview:title];
 self.playerHost=[[UIView alloc]initWithFrame:CGRectMake(0,0,0,0)];self.playerHost.backgroundColor=UIColor.blackColor;self.playerHost.clipsToBounds=YES;[self.view addSubview:self.playerHost];
 self.content=[[UIScrollView alloc]initWithFrame:CGRectMake(0,0,0,0)];self.content.backgroundColor=self.view.backgroundColor;self.content.alwaysBounceVertical=YES;self.content.showsVerticalScrollIndicator=YES;[self.view addSubview:self.content];
 [self applyState:self.state?:@{}];
}
- (void)viewDidLayoutSubviews {
 [super viewDidLayoutSubviews];CGFloat width=self.view.bounds.size.width;CGFloat top=88;CGFloat playerHeight=width*9.0/16.0;
 self.playerHost.frame=CGRectMake(0,top,width,playerHeight);self.content.frame=CGRectMake(0,top+playerHeight,width,self.view.bounds.size.height-top-playerHeight);
}
- (void)actionPressed:(SYLiveActionButton*)sender {
 if([sender.action isEqualToString:@"live-import"]){[self sendAction:sender.action value:self.urlField.text?:@""];return;}
 if([sender.action isEqualToString:@"live-search"]){[self sendAction:sender.action value:self.searchField.text?:@""];return;}
 [self sendAction:sender.action value:sender.value];
}
- (void)goBack {[self sendAction:@"live-back" value:@""];}
- (void)sendAction:(NSString*)action value:(NSString*)value {
 SYController*owner=self.owner;if(!owner||!action)return;NSArray*args=@[action,value?:@""];NSData*data=[NSJSONSerialization dataWithJSONObject:args options:0 error:NULL];NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
 [owner sendLiveActionScript:[NSString stringWithFormat:@"window.NativeLiveAction&&window.NativeLiveAction.apply(null,%@)",json]];
}
- (void)addAction:(NSString*)title action:(NSString*)action value:(NSString*)value y:(CGFloat)y width:(CGFloat)width {
 CGFloat available=[action isEqualToString:@"live-channel"]?width-58:width;SYLiveActionButton*button=[self button:title action:action value:value frame:CGRectMake(12,y,available,42)];[self.content addSubview:button];
}
- (void)applyState:(NSDictionary*)state {
 self.state=[state isKindOfClass:NSDictionary.class]?state:@{};
 for(UIView*view in self.content.subviews)[view removeFromSuperview];CGFloat width=self.view.bounds.size.width,inner=width-24,y=12;
 UILabel*status=[self label:self.state[@"title"]?:@"直播" size:17 bold:YES];status.frame=CGRectMake(16,y,inner,27);[self.content addSubview:status];y+=31;
 NSString*subtitle=[NSString stringWithFormat:@"%@ · %@",self.state[@"group"]?:@"请选择频道",self.state[@"status"]?:@""];
 UILabel*info=[self label:subtitle size:12 bold:NO];info.textColor=[UIColor colorWithRed:.68 green:.76 blue:.76 alpha:1];info.frame=CGRectMake(16,y,inner,23);[self.content addSubview:info];y+=30;
 self.urlField=[[UITextField alloc]initWithFrame:CGRectMake(12,y,inner-100,42)];self.urlField.text=self.state[@"url"]?:@"";self.urlField.placeholder=@"M3U / M3U8 HTTPS 地址";self.urlField.font=[UIFont systemFontOfSize:13];self.urlField.textColor=UIColor.whiteColor;self.urlField.backgroundColor=[UIColor colorWithRed:.10 green:.14 blue:.15 alpha:1];self.urlField.clearButtonMode=1;[self.content addSubview:self.urlField];
 SYLiveActionButton*import=[self button:[self.state[@"loading"] boolValue]?@"导入中…":@"导入 / 更新" action:@"live-import" value:@"" frame:CGRectMake(width-102,y,90,42)];[self.content addSubview:import];y+=52;
 NSArray*tabs=@[@[@"频道",@"channels"],@[@"分类",@"categories"],@[@"节目",@"programs"],@[@"线路",@"routes"]];CGFloat tabW=inner/4;for(NSUInteger i=0;i<tabs.count;i++){NSArray*tab=tabs[i];SYLiveActionButton*b=[self button:tab[0] action:@"live-panel" value:tab[1] frame:CGRectMake(12+i*tabW,y,tabW-4,38)];if([self.state[@"panel"] isEqualToString:tab[1]])b.backgroundColor=[UIColor systemBlueColor];[self.content addSubview:b];}y+=48;
 NSString*panel=self.state[@"panel"]?:@"channels";NSArray*items=@[];NSString*action=@"";
 if([panel isEqualToString:@"categories"]){items=self.state[@"groups"]?:@[];action=@"live-category";}
 else if([panel isEqualToString:@"routes"]){items=self.state[@"routes"]?:@[];}
 else if([panel isEqualToString:@"programs"]){
  NSArray*days=self.state[@"days"]?:@[];NSUInteger shown=days.count<6?days.count:6;CGFloat dayWidth=inner/(shown?shown:1);
  for(NSUInteger i=0;i<shown;i++){NSString*day=days[i];NSString*titleText=day.length>=10?[day substringFromIndex:5]:day;SYLiveActionButton*date=[self button:titleText action:@"live-date" value:day frame:CGRectMake(12+i*dayWidth,y,dayWidth-4,36)];if([day isEqualToString:self.state[@"selectedDate"]])date.backgroundColor=[UIColor systemBlueColor];[self.content addSubview:date];}y+=42;
  [self addAction:[self.state[@"epgLoading"] boolValue]?@"正在刷新节目单…":@"刷新节目单" action:@"live-epg-refresh" value:@"" y:y width:inner];y+=48;items=self.state[@"programs"]?:@[];
 }
 else {
  self.searchField=[[UITextField alloc]initWithFrame:CGRectMake(12,y,inner-82,40)];self.searchField.placeholder=@"搜索频道名称、分组";self.searchField.text=self.state[@"search"]?:@"";self.searchField.font=[UIFont systemFontOfSize:14];self.searchField.textColor=UIColor.whiteColor;self.searchField.backgroundColor=[UIColor colorWithRed:.10 green:.14 blue:.15 alpha:1];[self.content addSubview:self.searchField];
  [self.content addSubview:[self button:@"搜索" action:@"live-search" value:@"" frame:CGRectMake(width-94,y,82,40)]];y+=48;items=self.state[@"channels"]?:@[];
 }
 for(id object in items){NSString*titleText=@"";NSString*itemAction=action;NSString*value=@"";
  if([object isKindOfClass:NSDictionary.class]){
   if([panel isEqualToString:@"channels"]){
    NSString*channelTitle=[NSString stringWithFormat:@"%@  %@ · %@%@",[object[@"active"] boolValue]?@"▶":@"",object[@"name"]?:@"频道",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"":@" · HTTP 已停用"];
    NSString*channelIndex=[object[@"index"] stringValue];[self addAction:channelTitle action:@"live-channel" value:channelIndex y:y width:inner];
    SYLiveActionButton*favorite=[self button:[object[@"favorite"] boolValue]?@"♥":@"♡" action:@"live-favorite" value:channelIndex frame:CGRectMake(width-65,y,50,42)];[self.content addSubview:favorite];y+=48;continue;
   }
   if([panel isEqualToString:@"routes"]){titleText=[NSString stringWithFormat:@"%@%@ · %@",[object[@"active"] boolValue]?@"✓ ":@"",object[@"name"]?:@"线路",object[@"group"]?:@""];itemAction=@"live-native-route";value=[object[@"index"] stringValue];}
   else if([panel isEqualToString:@"programs"]){titleText=[NSString stringWithFormat:@"%@  %@",object[@"start"]?:@"",object[@"title"]?:@"节目"];itemAction=@"live-program";value=[object[@"index"] stringValue];}
   else {titleText=[NSString stringWithFormat:@"%@  %@ · %@%@",[object[@"active"] boolValue]?@"▶":@"",object[@"name"]?:@"频道",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"":@" · HTTP 已停用"];itemAction=@"live-channel";value=[object[@"index"] stringValue];}
  }else {titleText=[NSString stringWithFormat:@"%@  ·  %@ 个频道",object[@"name"]?:@"分类",object[@"count"]?:@0];value=object[@"name"]?:@"";}
  if(itemAction.length)[self addAction:titleText action:itemAction value:value y:y width:inner];else {UILabel*label=[self label:titleText size:14 bold:NO];label.frame=CGRectMake(16,y+8,inner,26);[self.content addSubview:label];}
  y+=48;
 }
 if([self.state[@"hasMore"] boolValue]){[self addAction:@"加载更多频道" action:@"live-more" value:@"" y:y width:inner];y+=48;}
 self.content.contentSize=CGSizeMake(width,y+20);
}
@end
@implementation SYController
- (void)viewDidLoad {
  [super viewDidLoad];
  self.view.backgroundColor=[UIColor colorWithRed:0.035 green:0.055 blue:0.09 alpha:1];
  self.tasks=[NSMutableDictionary dictionary];self.hlsProxy=[SYHLSProxy new];
  NSURLSessionConfiguration*sessionConfig=[NSURLSessionConfiguration ephemeralSessionConfiguration];
  sessionConfig.timeoutIntervalForRequest=18;sessionConfig.HTTPMaximumConnectionsPerHost=4;
  self.session=[NSURLSession sessionWithConfiguration:sessionConfig];
  self.bridge=[SYBridge new];self.bridge.owner=self;
  WKWebViewConfiguration*config=[WKWebViewConfiguration new];
  config.allowsInlineMediaPlayback=YES;config.mediaTypesRequiringUserActionForPlayback=0;
  [config.userContentController addScriptMessageHandler:self.bridge name:@"native"];
  self.web=[[WKWebView alloc]initWithFrame:self.view.bounds configuration:config];
  self.web.autoresizingMask=18;self.web.navigationDelegate=self;
  self.web.backgroundColor=self.view.backgroundColor;[self.view addSubview:self.web];
  NSString*root=[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Web"];
  [self.web loadFileURL:[NSURL fileURLWithPath:[root stringByAppendingPathComponent:@"index.html"] isDirectory:NO]
    allowingReadAccessToURL:[NSURL fileURLWithPath:root isDirectory:YES]];
#if defined(SY_SIMULATOR_SMOKE)
  [self performSelector:@selector(runSmokeCheck) withObject:nil afterDelay:2];
#endif
}
#if defined(SY_SIMULATOR_SMOKE)
// Compiled only into the simulator test executable, never into the delivered IPA.
- (void)runSmokeCheck {
  self.smokeAttempts++;
  [self.web evaluateJavaScript:@"({interfaceLoaded:!!document.querySelector('.sources'),transportReady:!!window.NativeTransport&&window.NativeTransport.native(),homeLoaded:!!document.querySelector('.hero'),posterImages:Array.from(document.images).filter(i=>i.complete&&i.naturalWidth>0).length})" completionHandler:^(id result,NSError*error){
    if([result isKindOfClass:NSDictionary.class]&&[result[@"interfaceLoaded"] boolValue]&&[result[@"transportReady"] boolValue]&&[result[@"homeLoaded"] boolValue]&&[result[@"posterImages"] integerValue]>0){
      NSData*data=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:NULL];
      NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-smoke.json"];
      [data writeToFile:path atomically:YES];
      [self performSelector:@selector(runPlaybackSmoke) withObject:nil afterDelay:2];return;
    }
    if(self.smokeAttempts<30)[self performSelector:@selector(runSmokeCheck) withObject:nil afterDelay:2];
  }];
 }
- (void)runPlaybackSmoke {
  [self.web evaluateJavaScript:@"(()=>{const hero=document.querySelector('.hero [data-act=detail]');if(hero){hero.click();return;}const episode=document.querySelector('[data-act=episode]');if(episode&&!window.__sanyuanSmokePlaying){window.__sanyuanSmokePlaying=true;episode.click();}})()" completionHandler:nil];
  if(!self.smokePlayerReady&&self.smokeAttempts++<70)[self performSelector:@selector(runPlaybackSmoke) withObject:nil afterDelay:2];
}
#endif
- (void)viewDidLayoutSubviews {[super viewDidLayoutSubviews];self.web.frame=self.view.bounds;}
- (void)layoutPlayer:(NSDictionary*)frame {
  if(!self.nativePlayer||self.nativePlayer.fullScreen)return;
  if([self.playContext hasPrefix:@"live:"]&&self.liveScreen){self.nativePlayer.view.frame=self.liveScreen.playerHost.bounds;return;}
  if(![frame[@"visible"] boolValue]){
    if(!self.nativePlayer.pictureInPicture)[self stopNativePlayback];
    return;
  }
  double width=[frame[@"width"] doubleValue],height=[frame[@"height"] doubleValue];
  double x=[frame[@"x"] doubleValue],y=[frame[@"y"] doubleValue];
  double viewport=[frame[@"viewportWidth"] doubleValue];
  if(!__builtin_isfinite(width)||!__builtin_isfinite(height)||!__builtin_isfinite(x)||!__builtin_isfinite(y)||!__builtin_isfinite(viewport)||width<=0||height<=0||viewport<=0)return;
  double scale=self.web.bounds.size.width/viewport;
  CGRect rect={{x*scale,y*scale},{width*scale,height*scale}};
  if([self.playContext hasPrefix:@"live:"]&&self.liveScreen){self.nativePlayer.view.frame=self.liveScreen.playerHost.bounds;}
  else if([self.playContext hasPrefix:@"live:"])self.nativePlayer.view.frame=[self.web convertRect:rect toView:self.view];
  else self.nativePlayer.view.frame=[self.web convertRect:rect toView:self.web.scrollView];
}
- (void)sendLiveActionScript:(NSString*)script {dispatch_async(SYMainQueue(),^{[self.web evaluateJavaScript:script completionHandler:nil];});}
- (void)openLiveScreen {
 if(self.liveScreen){[self.liveScreen applyState:self.liveSnapshot?:@{}];return;}
 SYLiveScreenController*screen=[SYLiveScreenController new];screen.owner=self;screen.modalPresentationStyle=0;self.liveScreen=screen;
 [self presentViewController:screen animated:YES completion:^{[screen applyState:self.liveSnapshot?:@{}];}];
}
- (void)closeLiveScreen {
 if([self.playContext hasPrefix:@"live:"])[self stopNativePlayback];SYLiveScreenController*screen=self.liveScreen;self.liveScreen=nil;
 if(screen.presentedViewController==nil&&self.presentedViewController==screen)[screen dismissViewControllerAnimated:YES completion:nil];
}
- (UIStatusBarStyle)preferredStatusBarStyle {return self.detailStatusStyle?1:0;}
- (void)deliver:(NSDictionary*)result {
  NSData*data=[NSJSONSerialization dataWithJSONObject:result options:0 error:NULL];
  if(!data)return;
  NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
  dispatch_async(SYMainQueue(),^{[self.web evaluateJavaScript:[NSString stringWithFormat:@"window.NativeTransport&&window.NativeTransport.deliver(%@)",json] completionHandler:nil];});
}
- (void)sendPlayback:(NSDictionary*)event {
#if defined(SY_SIMULATOR_SMOKE)
  if([event[@"status"] isEqualToString:@"ready"])self.smokePlayerReady=YES;
  if([event[@"status"] isEqualToString:@"progress"]&&self.smokePlayerReady&&[event[@"time"] doubleValue]>1){
    NSDictionary*result=@{@"nativePlayerReady":@YES,@"hlsProxyActive":@(self.smokeProxyActive),@"removedAdSegments":@(self.hlsProxy.removed),@"inlinePlayback":@(self.nativePlayer.parentViewController==self&&self.presentedViewController==nil&&self.nativePlayer.view.frame.size.height>0&&self.nativePlayer.view.frame.size.height<self.view.bounds.size.height*0.8),@"playbackTime":event[@"time"],@"devicePlaybackTested":@NO};
    NSData*report=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:NULL];
    [report writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-playback-smoke.json"] atomically:YES];
    [self.nativePlayer.player pause];
  }
  if([event[@"status"] isEqualToString:@"failed"]){
    NSData*report=[NSJSONSerialization dataWithJSONObject:event options:NSJSONWritingPrettyPrinted error:NULL];
    [report writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-playback-error.json"] atomically:YES];
  }
#endif
  NSData*data=[NSJSONSerialization dataWithJSONObject:event options:0 error:NULL];if(!data)return;
  NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
  dispatch_async(SYMainQueue(),^{[self.web evaluateJavaScript:[NSString stringWithFormat:@"window.NativeTransport&&window.NativeTransport.onPlaybackEvent&&window.NativeTransport.onPlaybackEvent(%@)",json] completionHandler:nil];});
}
- (void)stopNativePlayback {
  if(self.nativeItem){[self.nativeItem removeObserver:self forKeyPath:@"status" context:&SYPlaybackStatus];self.nativeItem=nil;}
  if(self.stalledObserver){[NSNotificationCenter.defaultCenter removeObserver:self.stalledObserver];self.stalledObserver=nil;}
  if(self.failedObserver){[NSNotificationCenter.defaultCenter removeObserver:self.failedObserver];self.failedObserver=nil;}
  if(self.timeObserver){[self.nativePlayer.player removeTimeObserver:self.timeObserver];self.timeObserver=nil;}
  if(self.endObserver){[NSNotificationCenter.defaultCenter removeObserver:self.endObserver];self.endObserver=nil;}
  [self.nativePlayer.player pause];self.nativePlayer.player=nil;[self.nativePlayer willMoveToParentViewController:nil];[self.nativePlayer.view removeFromSuperview];[self.nativePlayer removeFromParentViewController];self.nativePlayer=nil;
  [AVAudioSession.sharedInstance setActive:NO withOptions:1 error:NULL];
}
- (void)observeValueForKeyPath:(NSString*)path ofObject:(id)object change:(NSDictionary*)change context:(void*)context {
  if(context!=&SYPlaybackStatus){[super observeValueForKeyPath:path ofObject:object change:change context:context];return;}
  dispatch_async(SYMainQueue(),^{
    if(object!=self.nativeItem)return;
    if(self.nativeItem.status==1)[self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"ready"}];
    else if(self.nativeItem.status==2){
      BOOL live=[self.playContext hasPrefix:@"live:"];
      [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"failed",@"error":self.nativeItem.error.localizedDescription?:@"视频解码失败，请切换线路"}];
      if(!live)[self stopNativePlayback];
    }
  });
}
- (void)receive:(WKScriptMessage*)message {
  // Only the bundled local main frame can call the network/player bridge.
  NSString*trustedRoot=[[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Web"] stringByAppendingPathComponent:@""];
  NSString*trustedPrefix=[NSString stringWithFormat:@"%@/",[trustedRoot stringByStandardizingPath]];
  if(!message.frameInfo.isMainFrame||!message.frameInfo.request.URL.isFileURL||![[message.frameInfo.request.URL.path stringByStandardizingPath] hasPrefix:trustedPrefix]||![message.body isKindOfClass:NSDictionary.class])return;
  NSDictionary*body=message.body;NSString*identifier=body[@"id"],*type=body[@"type"];
  if(![identifier isKindOfClass:NSString.class]||identifier.length>100)return;
  if([type isEqualToString:@"statusStyle"]){self.detailStatusStyle=[body[@"dark"] boolValue];[self setNeedsStatusBarAppearanceUpdate];return;}
  if([type isEqualToString:@"liveOpen"]){[self openLiveScreen];return;}
  if([type isEqualToString:@"liveClose"]){[self closeLiveScreen];return;}
  if([type isEqualToString:@"liveState"]){if([body[@"state"] isKindOfClass:NSDictionary.class]){self.liveSnapshot=body[@"state"];[self.liveScreen applyState:self.liveSnapshot];}return;}
  if([type isEqualToString:@"stopLive"]){if([self.playContext hasPrefix:@"live:"])[self stopNativePlayback];return;}
  if([type isEqualToString:@"cancel"]){[self.tasks[identifier] cancel];[self.tasks removeObjectForKey:identifier];return;}
  if([type hasPrefix:@"vault"]){
    NSString*key=body[@"key"];
    if(![key isEqualToString:@"kkapp"]&&![key isEqualToString:@"ncat"]&&![key isEqualToString:@"happ"])return;
    NSMutableDictionary*query=[NSMutableDictionary dictionary];
    query[(__bridge id)kSecClass]=(__bridge id)kSecClassGenericPassword;
    query[(__bridge id)kSecAttrService]=@"com.joeshu.sanyuan.session";query[(__bridge id)kSecAttrAccount]=key;
    if([type isEqualToString:@"vaultGet"]){
      query[(__bridge id)kSecReturnData]=@YES;CFTypeRef result=NULL;
      int status=SecItemCopyMatching((__bridge CFDictionaryRef)query,&result);
      NSData*data=(__bridge_transfer NSData*)result;
      NSString*value=status==0?[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding]:@"";
      [self deliver:@{@"id":identifier,@"value":value?:@""}];return;
    }
    if(![type isEqualToString:@"vaultPut"]&&![type isEqualToString:@"vaultDelete"])return;
    SecItemDelete((__bridge CFDictionaryRef)query);
    int status=0;
    if([type isEqualToString:@"vaultPut"]){
      NSString*value=body[@"value"];if(![value isKindOfClass:NSString.class]||value.length>65536)return;
      query[(__bridge id)kSecValueData]=[value dataUsingEncoding:NSUTF8StringEncoding];
      query[(__bridge id)kSecAttrAccessible]=(__bridge id)kSecAttrAccessibleWhenUnlockedThisDeviceOnly;
      status=SecItemAdd((__bridge CFDictionaryRef)query,NULL);
    }
    [self deliver:status==0?@{@"id":identifier,@"ok":@YES}:@{@"id":identifier,@"error":@"无法保存登录会话"}];return;
  }
  if([type isEqualToString:@"playerLayout"]){
    if([body[@"context"] isEqualToString:self.playContext]&&[body[@"frame"] isKindOfClass:NSDictionary.class])[self layoutPlayer:body[@"frame"]];
    return;
  }
  if([type isEqualToString:@"airplay"]){
    NSDictionary*frame=[body[@"frame"] isKindOfClass:NSDictionary.class]?body[@"frame"]:@{};
    double width=[frame[@"width"] doubleValue],height=[frame[@"height"] doubleValue],viewport=[frame[@"viewportWidth"] doubleValue];
    if(width<=0||height<=0||viewport<=0)return;
    double scale=self.web.bounds.size.width/viewport;
    CGRect rect=CGRectMake([frame[@"x"] doubleValue]*scale,[frame[@"y"] doubleValue]*scale,width*scale,height*scale);
    rect=[self.web convertRect:rect toView:self.view];
    [self.airplayPicker removeFromSuperview];AVRoutePickerView*picker=[[AVRoutePickerView alloc]initWithFrame:rect];picker.alpha=0.02;picker.backgroundColor=UIColor.clearColor;self.airplayPicker=picker;[self.view addSubview:picker];
    for(UIView*child in picker.subviews)if([child isKindOfClass:UIControl.class])[(UIControl*)child sendActionsForControlEvents:UIControlEventTouchUpInside];
    __weak SYController*weakSelf=self;dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(2*NSEC_PER_SEC)),dispatch_get_main_queue(),^{if(weakSelf.airplayPicker==picker){[picker removeFromSuperview];weakSelf.airplayPicker=nil;}});return;
  }
  if([type isEqualToString:@"copyText"]){NSString*text=[body[@"text"] isKindOfClass:NSString.class]?body[@"text"]:@"";if(!text.length||text.length>4096){[self deliver:@{@"id":identifier,@"error":@"无法复制此内容"}];return;}UIPasteboard.generalPasteboard.string=text;[self deliver:@{@"id":identifier,@"ok":@YES}];return;}
  if([type isEqualToString:@"openExternal"]){NSURL*stream=[NSURL URLWithString:[body[@"url"] isKindOfClass:NSString.class]?body[@"url"]:@""];if(![stream.scheme.lowercaseString isEqualToString:@"https"]||!stream.host.length){[self deliver:@{@"id":identifier,@"error":@"仅支持安全 HTTPS 播放地址"}];return;}NSURLComponents*target=[NSURLComponents new];target.scheme=@"vlc-x-callback";target.host=@"x-callback-url";target.path=@"/stream";target.queryItems=@[[NSURLQueryItem queryItemWithName:@"url" value:stream.absoluteString]];NSURL*external=target.URL;if(!external||![UIApplication.sharedApplication canOpenURL:external]){[self deliver:@{@"id":identifier,@"error":@"未检测到 VLC，请先安装 VLC"}];return;}[UIApplication.sharedApplication openURL:external options:@{} completionHandler:^(BOOL success){[self deliver:success?@{@"id":identifier,@"ok":@YES}:@{@"id":identifier,@"error":@"无法打开 VLC"}];}];return;}
  if(![body[@"url"] isKindOfClass:NSString.class])return;
  NSURL*url=[NSURL URLWithString:body[@"url"]];
  if(![url.scheme.lowercaseString isEqualToString:@"https"]||!url.host.length){[self deliver:@{@"id":identifier,@"error":@"仅支持有效 HTTPS 地址"}];return;}
  if([type isEqualToString:@"play"]){
    NSDictionary*headers=[body[@"headers"] isKindOfClass:NSDictionary.class]?body[@"headers"]:@{};
    NSURL*playURL=[self.hlsProxy prepare:url headers:headers enabled:body[@"cleanHLS"]==nil||[body[@"cleanHLS"] boolValue]];
    #if defined(SY_SIMULATOR_SMOKE)
    self.smokeProxyActive=[playURL.scheme isEqualToString:@"http"];
#endif
    AVURLAsset*asset=[AVURLAsset URLAssetWithURL:playURL options:@{@"AVURLAssetHTTPHeaderFieldsKey":headers}];
    AVPlayerItem*item=[AVPlayerItem playerItemWithAsset:asset];item.preferredForwardBufferDuration=6;item.audioTimePitchAlgorithm=AVAudioTimePitchAlgorithmTimeDomain;
    NSString*requestedContext=[body[@"context"] isKindOfClass:NSString.class]?body[@"context"]:identifier;
    // Keep one live AVPlayerViewController across channel and mirror changes.
    // Swapping only the item avoids a view teardown and black flash.
    if([requestedContext hasPrefix:@"live:"]&&[self.playContext hasPrefix:@"live:"]&&self.nativePlayer&&self.nativePlayer.player){
      AVPlayerItem*old=self.nativeItem;if(old){@try{[old removeObserver:self forKeyPath:@"status" context:&SYPlaybackStatus];}@catch(NSException*exception){}}
      if(self.stalledObserver){[NSNotificationCenter.defaultCenter removeObserver:self.stalledObserver];self.stalledObserver=nil;}
      if(self.failedObserver){[NSNotificationCenter.defaultCenter removeObserver:self.failedObserver];self.failedObserver=nil;}
      if(self.endObserver){[NSNotificationCenter.defaultCenter removeObserver:self.endObserver];self.endObserver=nil;}
      self.nativeItem=item;self.playContext=requestedContext;
      if([body[@"title"] isKindOfClass:NSString.class]){AVMutableMetadataItem*metadata=[AVMutableMetadataItem metadataItem];metadata.identifier=AVMetadataCommonIdentifierTitle;metadata.value=body[@"title"];item.externalMetadata=@[metadata];}
      [item addObserver:self forKeyPath:@"status" options:5 context:&SYPlaybackStatus];
      __weak SYController*weakOwner=self;__weak AVPlayerItem*weakItem=item;NSString*liveContext=requestedContext;
      self.stalledObserver=[NSNotificationCenter.defaultCenter addObserverForName:AVPlayerItemPlaybackStalledNotification object:item queue:nil usingBlock:^(NSNotification*note){dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;[owner sendPlayback:@{@"context":liveContext,@"status":@"failed",@"error":@"视频数据读取中断，请切换备用线路"}];});}];
      self.failedObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemFailedToPlayToEndTimeNotification" object:item queue:nil usingBlock:^(NSNotification*note){NSError*error=note.userInfo[@"AVPlayerItemFailedToPlayToEndTimeErrorKey"];dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;[owner sendPlayback:@{@"context":liveContext,@"status":@"failed",@"error":error.localizedDescription?:@"视频播放中断，请切换备用线路"}];});}];
      self.endObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemDidPlayToEndTimeNotification" object:item queue:nil usingBlock:^(NSNotification*note){dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(owner.nativeItem==weakItem)[owner sendPlayback:@{@"context":liveContext,@"status":@"ended"}];});}];
      [self.nativePlayer.player replaceCurrentItemWithPlayerItem:item];[self.nativePlayer.player play];
      [self deliver:@{@"id":identifier,@"ok":@YES}];return;
    }
    [self stopNativePlayback];
    [AVAudioSession.sharedInstance setCategory:AVAudioSessionCategoryPlayback error:NULL];
    [AVAudioSession.sharedInstance setActive:YES error:NULL];
    SYPlayerViewController*player=[SYPlayerViewController new];self.nativePlayer=player;
    player.entersFullScreenWhenPlaybackBegins=NO;player.exitsFullScreenWhenPlaybackEnds=NO;player.delegate=player;player.updatesNowPlayingInfoCenter=YES;player.allowsPictureInPicturePlayback=YES;player.canStartPictureInPictureAutomaticallyFromInline=YES;player.videoGravity=AVLayerVideoGravityResizeAspect;
    self.nativeItem=item;
    __weak SYController*weakOwner=self;__weak AVPlayerItem*weakItem=item;
    self.stalledObserver=[NSNotificationCenter.defaultCenter addObserverForName:AVPlayerItemPlaybackStalledNotification object:item queue:nil usingBlock:^(NSNotification*note){dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;BOOL live=[owner.playContext hasPrefix:@"live:"];[owner sendPlayback:@{@"context":owner.playContext?:@"",@"status":@"failed",@"error":@"视频数据读取中断，请切换备用线路"}];if(!live)[owner stopNativePlayback];});}];
    self.failedObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemFailedToPlayToEndTimeNotification" object:item queue:nil usingBlock:^(NSNotification*note){NSError*error=note.userInfo[@"AVPlayerItemFailedToPlayToEndTimeErrorKey"];dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;BOOL live=[owner.playContext hasPrefix:@"live:"];[owner sendPlayback:@{@"context":owner.playContext?:@"",@"status":@"failed",@"error":error.localizedDescription?:@"视频播放中断，请切换备用线路"}];if(!live)[owner stopNativePlayback];});}];
    if([body[@"title"] isKindOfClass:NSString.class]){AVMutableMetadataItem*metadata=[AVMutableMetadataItem metadataItem];metadata.identifier=AVMetadataCommonIdentifierTitle;metadata.value=body[@"title"];item.externalMetadata=@[metadata];}
    self.playContext=[body[@"context"] isKindOfClass:NSString.class]?body[@"context"]:identifier;
    player.player=[AVPlayer playerWithPlayerItem:item];[item addObserver:self forKeyPath:@"status" options:5 context:&SYPlaybackStatus];
    __weak SYController*owner=self;__weak SYPlayerViewController*weakPlayer=player;
    NSString*playContext=self.playContext;
    player.onClose=^{SYController*strongOwner=owner;if(strongOwner.nativePlayer==weakPlayer)[strongOwner stopNativePlayback];};
    player.onRestore=^(void(^handler)(BOOL)){SYController*strongOwner=owner;if(!strongOwner||!weakPlayer){handler(NO);return;}handler(weakPlayer.parentViewController==strongOwner||weakPlayer.parentViewController==strongOwner.liveScreen);};
    if(![playContext hasPrefix:@"live:"])self.timeObserver=[player.player addPeriodicTimeObserverForInterval:CMTimeMakeWithSeconds(5,600) queue:SYMainQueue() usingBlock:^(CMTime time){
      SYController*strongOwner=owner;if(!strongOwner||strongOwner.nativePlayer!=weakPlayer)return;
      double seconds=CMTimeGetSeconds(time);if(!__builtin_isfinite(seconds)||seconds<0)return;
      [strongOwner sendPlayback:@{@"context":playContext,@"status":@"progress",@"time":@(seconds)}];
    }];
    self.endObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemDidPlayToEndTimeNotification" object:item queue:nil usingBlock:^(id notification){
      dispatch_async(SYMainQueue(),^{SYController*strongOwner=owner;if(strongOwner.nativePlayer!=weakPlayer)return;[strongOwner sendPlayback:@{@"context":playContext,@"status":@"ended"}];});
    }];
    double start=[body[@"startAt"] doubleValue];if(__builtin_isfinite(start)&&start>0)[player.player seekToTime:CMTimeMakeWithSeconds(start,600)];
    double requestedRate=[body[@"rate"] doubleValue];float rate=(requestedRate>=0.5&&requestedRate<=2)?(float)requestedRate:1;
    UIViewController*playerOwner=[self.playContext hasPrefix:@"live:"]&&self.liveScreen?self.liveScreen:self;
    [playerOwner addChildViewController:player];
    player.view.frame=(CGRect){{0,0},{0,0}};
    if([self.playContext hasPrefix:@"live:"]&&self.liveScreen) [self.liveScreen.playerHost addSubview:player.view];
    else if([self.playContext hasPrefix:@"live:"]) [self.view addSubview:player.view];
    else [self.web.scrollView addSubview:player.view];
    [player didMoveToParentViewController:playerOwner];
    if([body[@"frame"] isKindOfClass:NSDictionary.class])[self layoutPlayer:body[@"frame"]];
    [player.player play];player.player.rate=rate;
    [self deliver:@{@"id":identifier,@"ok":@YES}];return;
  }
  if(![type isEqualToString:@"request"])return;
  NSString*method=body[@"method"]?:@"GET";
  if(![method isEqualToString:@"GET"]&&![method isEqualToString:@"POST"]&&![method isEqualToString:@"HEAD"]){[self deliver:@{@"id":identifier,@"error":@"不支持的请求方法"}];return;}
  NSMutableURLRequest*request=[NSMutableURLRequest requestWithURL:url];request.HTTPMethod=method;request.timeoutInterval=18;
  if([body[@"headers"] isKindOfClass:NSDictionary.class])request.allHTTPHeaderFields=body[@"headers"];
  if([body[@"body"] isKindOfClass:NSString.class])request.HTTPBody=[body[@"body"] dataUsingEncoding:NSUTF8StringEncoding];
  __weak SYController*weakSelf=self;
  NSURLSessionDataTask*task=[self.session dataTaskWithRequest:request completionHandler:^(NSData*data,NSURLResponse*response,NSError*error){
    SYController*owner=weakSelf;if(!owner)return;
    dispatch_async(SYMainQueue(),^{[owner.tasks removeObjectForKey:identifier];});
    if(error){[owner deliver:@{@"id":identifier,@"error":error.localizedDescription?:@"网络错误",@"errorCode":@(error.code)}];return;}
    if(data.length>12*1024*1024){[owner deliver:@{@"id":identifier,@"error":@"响应过大"}];return;}
    NSHTTPURLResponse*http=(NSHTTPURLResponse*)response;
    [owner deliver:@{@"id":identifier,@"status":@(http.statusCode),@"url":http.URL.absoluteString?:@"",@"headers":http.allHeaderFields?:@{},@"bodyBase64":[data base64EncodedStringWithOptions:0]?:@""}];
  }];
  self.tasks[identifier]=task;[task resume];
}
- (void)webView:(WKWebView*)webView decidePolicyForNavigationAction:(WKNavigationAction*)action decisionHandler:(void(^)(WKNavigationActionPolicy))handler {
  handler(action.request.URL.isFileURL?1:0);
}
@end
@interface SYSceneDelegate:NSObject<UIWindowSceneDelegate>
@property(nonatomic,strong) UIWindow*window;
@end
@implementation SYSceneDelegate
- (void)scene:(UIScene*)scene willConnectToSession:(UISceneSession*)session options:(UISceneConnectionOptions*)options {
  if(![scene isKindOfClass:UIWindowScene.class])return;
  self.window=[[UIWindow alloc]initWithWindowScene:(UIWindowScene*)scene];
  self.window.rootViewController=[SYController new];
  [self.window makeKeyAndVisible];
}
@end
@interface SYAppDelegate:NSObject<UIApplicationDelegate>
@end
@implementation SYAppDelegate
- (BOOL)application:(UIApplication*)application didFinishLaunchingWithOptions:(NSDictionary*)options {return YES;}
@end
int main(int argc,char**argv){@autoreleasepool{return UIApplicationMain(argc,argv,nil,NSStringFromClass(SYAppDelegate.class));}}
