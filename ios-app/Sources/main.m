#import "RuntimeSDK.h"
#import "HLSProxy.h"
@class SYController;
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
@property(nonatomic,copy) NSString*baseTitle;
@end
@implementation SYLiveActionButton
@end
@interface SYLiveScreenController:UIViewController
@property(nonatomic,weak) SYController*owner;
@property(nonatomic,strong) UIView*playerHost;
@property(nonatomic,strong) AVRoutePickerView*routePicker;
@property(nonatomic,strong) UIScrollView*content;
@property(nonatomic,strong) UITextField*urlField;
@property(nonatomic,strong) UITextField*searchField;
@property(nonatomic,strong) UILabel*liveTitleLabel;
@property(nonatomic,strong) UILabel*liveStatusLabel;
@property(nonatomic,strong) UILabel*liveInfoLabel;
@property(nonatomic,strong) NSDictionary*state;
- (void)applyState:(NSDictionary*)state;
- (void)applyFastState:(NSDictionary*)state;
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
@property(nonatomic) NSInteger smokeLiveAttempts;
@property(nonatomic) BOOL smokeLiveStarted;
@property(nonatomic) NSUInteger smokeLiveSubviewsBeforeFast;
@property(nonatomic) BOOL smokeLiveFastStateApplied;
#endif
- (void)receive:(WKScriptMessage*)message;
- (void)sendLiveActionScript:(NSString*)script;
@end
@implementation SYBridge
- (void)userContentController:(id)controller didReceiveScriptMessage:(WKScriptMessage*)message { [self.owner receive:message]; }
@end
@implementation SYLiveScreenController
- (UIStatusBarStyle)preferredStatusBarStyle {return 0;}
- (UILabel*)label:(NSString*)text size:(CGFloat)size bold:(BOOL)bold {
  UILabel*label=[[UILabel alloc]initWithFrame:CGRectMake(16,0,340,30)];label.text=text;label.textColor=[UIColor colorWithRed:.12 green:.14 blue:.19 alpha:1];label.font=bold?[UIFont boldSystemFontOfSize:size]:[UIFont systemFontOfSize:size];return label;
}
- (SYLiveActionButton*)button:(NSString*)title action:(NSString*)action value:(NSString*)value frame:(CGRect)frame {
  SYLiveActionButton*button=[[SYLiveActionButton alloc]initWithFrame:frame];button.action=action;button.value=value?:@"";button.baseTitle=title;button.backgroundColor=UIColor.whiteColor;button.layer.cornerRadius=12;button.layer.borderWidth=.5;button.layer.borderColor=[UIColor colorWithRed:.07 green:.09 blue:.13 alpha:.08].CGColor;[button setTitle:title forState:UIControlStateNormal];[button setTitleColor:[UIColor colorWithRed:.15 green:.18 blue:.24 alpha:1] forState:UIControlStateNormal];button.titleLabel.font=[UIFont systemFontOfSize:13 weight:UIFontWeightMedium];button.titleLabel.lineBreakMode=NSLineBreakByTruncatingTail;button.contentEdgeInsets=UIEdgeInsetsMake(0,9,0,9);[button addTarget:self action:@selector(actionPressed:) forControlEvents:UIControlEventTouchUpInside];return button;
}
- (void)viewDidLoad {
 [super viewDidLoad];self.view.backgroundColor=[UIColor colorWithRed:.953 green:.957 blue:.973 alpha:1];
 UIButton*back=[UIButton buttonWithType:0];back.frame=CGRectMake(14,43,42,38);[back setTitle:@"‹" forState:UIControlStateNormal];[back setTitleColor:[UIColor colorWithRed:.15 green:.18 blue:.24 alpha:1] forState:UIControlStateNormal];back.titleLabel.font=[UIFont systemFontOfSize:32 weight:UIFontWeightRegular];[self.view addSubview:back];back.backgroundColor=UIColor.whiteColor;back.layer.cornerRadius=13;back.layer.borderWidth=.5;back.layer.borderColor=[UIColor colorWithRed:.07 green:.09 blue:.13 alpha:.08].CGColor;[back addTarget:self action:@selector(goBack) forControlEvents:UIControlEventTouchUpInside];
 self.liveTitleLabel=[self label:@"直播" size:17 bold:YES];self.liveTitleLabel.frame=CGRectMake(66,45,250,32);self.liveTitleLabel.textAlignment=1;[self.view addSubview:self.liveTitleLabel];
 self.playerHost=[[UIView alloc]initWithFrame:CGRectMake(0,0,0,0)];self.playerHost.backgroundColor=UIColor.blackColor;self.playerHost.clipsToBounds=YES;self.playerHost.layer.cornerRadius=15;[self.view addSubview:self.playerHost];
 self.routePicker=[[AVRoutePickerView alloc]initWithFrame:CGRectMake(0,0,48,44)];self.routePicker.tintColor=UIColor.whiteColor;self.routePicker.activeTintColor=[UIColor systemBlueColor];[self.playerHost addSubview:self.routePicker];
 self.content=[[UIScrollView alloc]initWithFrame:CGRectMake(0,0,0,0)];self.content.backgroundColor=self.view.backgroundColor;self.content.alwaysBounceVertical=YES;self.content.showsVerticalScrollIndicator=YES;[self.view addSubview:self.content];
 [self applyState:self.state?:@{}];
}
- (void)viewDidLayoutSubviews {
 [super viewDidLayoutSubviews];CGFloat width=self.view.bounds.size.width;CGFloat top=MAX(76,self.view.safeAreaInsets.top+29);CGFloat headerTop=top-45;self.liveTitleLabel.frame=CGRectMake(66,headerTop+2,width-132,34);CGFloat playerHeight=width*9.0/16.0;
 self.playerHost.frame=CGRectMake(0,top,width,playerHeight);self.content.frame=CGRectMake(0,top+playerHeight,width,self.view.bounds.size.height-top-playerHeight);
 self.routePicker.frame=CGRectMake(width-58,8,48,44);[self.playerHost bringSubviewToFront:self.routePicker];
}
- (void)actionPressed:(SYLiveActionButton*)sender {
 if([sender.action isEqualToString:@"live-import"]){[self sendAction:sender.action value:self.urlField.text?:@""];return;}
 if([sender.action isEqualToString:@"live-search"]){[self sendAction:sender.action value:self.searchField.text?:@""];return;}
 [self sendAction:sender.action value:sender.value];
}
- (void)goBack {[self sendAction:@"live-back" value:@""];}
- (void)styleButton:(SYLiveActionButton*)button selected:(BOOL)selected {
 UIColor*blue=[UIColor colorWithRed:.157 green:.471 blue:.941 alpha:1];
 button.backgroundColor=selected?[UIColor colorWithRed:.91 green:.947 blue:1 alpha:1]:UIColor.whiteColor;
 button.layer.borderColor=(selected?[blue colorWithAlphaComponent:.25]:[UIColor colorWithRed:.07 green:.09 blue:.13 alpha:.08]).CGColor;
 [button setTitleColor:selected?blue:[UIColor colorWithRed:.15 green:.18 blue:.24 alpha:1] forState:UIControlStateNormal];
}
- (void)sendAction:(NSString*)action value:(NSString*)value {
 SYController*owner=self.owner;if(!owner||!action)return;NSArray*args=@[action,value?:@""];NSData*data=[NSJSONSerialization dataWithJSONObject:args options:0 error:NULL];NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
 [owner sendLiveActionScript:[NSString stringWithFormat:@"window.NativeLiveAction&&window.NativeLiveAction.apply(null,%@)",json]];
}
- (SYLiveActionButton*)addAction:(NSString*)title action:(NSString*)action value:(NSString*)value y:(CGFloat)y width:(CGFloat)width {
 CGFloat available=[action isEqualToString:@"live-channel"]?width-58:width;SYLiveActionButton*button=[self button:title action:action value:value frame:CGRectMake(12,y,available,42)];[self.content addSubview:button];return button;
}
- (void)applyState:(NSDictionary*)state {
 self.state=[state isKindOfClass:NSDictionary.class]?state:@{};
 for(UIView*view in self.content.subviews)[view removeFromSuperview];CGFloat width=self.view.bounds.size.width,inner=width-24,y=12;
 UILabel*status=[self label:self.state[@"title"]?:@"直播" size:17 bold:YES];status.frame=CGRectMake(16,y,inner,27);self.liveStatusLabel=status;[self.content addSubview:status];y+=31;
 NSString*subtitle=[NSString stringWithFormat:@"%@ · %@",self.state[@"group"]?:@"请选择频道",self.state[@"status"]?:@""];
 UILabel*info=[self label:subtitle size:12 bold:NO];info.textColor=[UIColor colorWithRed:.45 green:.48 blue:.55 alpha:1];info.frame=CGRectMake(16,y,inner,23);self.liveInfoLabel=info;[self.content addSubview:info];y+=30;
 SYLiveActionButton*favorite=[self button:[self.state[@"favoriteCurrent"] boolValue]?@"♥ 已收藏":@"♡ 收藏当前频道" action:@"live-favorite-current" value:@"" frame:CGRectMake(12,y,inner*.48,38)];[self.content addSubview:favorite];
 [self.content addSubview:[self button:@"频道信息" action:@"live-channel-info" value:@"" frame:CGRectMake(20+inner*.48,y,inner*.48,38)]];y+=46;
 self.urlField=[[UITextField alloc]initWithFrame:CGRectMake(12,y,inner-100,42)];self.urlField.text=self.state[@"url"]?:@"";self.urlField.placeholder=@"HTTP / HTTPS M3U 地址";self.urlField.font=[UIFont systemFontOfSize:13];self.urlField.textColor=[UIColor colorWithRed:.15 green:.18 blue:.24 alpha:1];self.urlField.backgroundColor=UIColor.whiteColor;self.urlField.borderStyle=3;self.urlField.layer.cornerRadius=11;self.urlField.clipsToBounds=YES;self.urlField.clearButtonMode=1;[self.content addSubview:self.urlField];
 NSString*importTitle=[self.state[@"loading"] boolValue]?@"导入中…":([self.state[@"channelCount"] integerValue]>0?@"手动更新":@"导入 M3U");SYLiveActionButton*import=[self button:importTitle action:@"live-import" value:@"" frame:CGRectMake(width-102,y,90,42)];[self.content addSubview:import];y+=46;
 UILabel*hint=[self label:@"导入后保存到本机；手动更新才重新下载。HTTP 未加密，建议优先使用 HTTPS。" size:11 bold:NO];hint.textColor=[UIColor colorWithRed:.46 green:.49 blue:.56 alpha:1];hint.frame=CGRectMake(16,y,inner,32);hint.numberOfLines=2;[self.content addSubview:hint];y+=36;
 NSArray*tabs=@[@[@"频道",@"channels"],@[@"分类",@"categories"],@[@"节目",@"programs"],@[@"线路",@"routes"]];CGFloat tabW=inner/4;for(NSUInteger i=0;i<tabs.count;i++){NSArray*tab=tabs[i];SYLiveActionButton*b=[self button:tab[0] action:@"live-panel" value:tab[1] frame:CGRectMake(12+i*tabW,y,tabW-4,38)];[self styleButton:b selected:[self.state[@"panel"] isEqualToString:tab[1]]];[self.content addSubview:b];}y+=48;
 NSString*panel=self.state[@"panel"]?:@"channels";NSArray*items=@[];NSString*action=@"";
 if([panel isEqualToString:@"categories"]){items=self.state[@"groups"]?:@[];action=@"live-category";}
 else if([panel isEqualToString:@"routes"]){items=self.state[@"routes"]?:@[];}
 else if([panel isEqualToString:@"programs"]){
  if(![self.state[@"hasEPG"] boolValue]){UILabel*empty=[self label:@"此播放列表没有提供节目单地址。" size:14 bold:NO];empty.frame=CGRectMake(16,y,inner,34);[self.content addSubview:empty];y+=40;}
  else {
  NSArray*days=self.state[@"days"]?:@[];NSUInteger shown=days.count<6?days.count:6;CGFloat dayWidth=inner/(shown?shown:1);
  for(NSUInteger i=0;i<shown;i++){NSString*day=days[i];NSString*titleText=day.length>=10?[day substringFromIndex:5]:day;SYLiveActionButton*date=[self button:titleText action:@"live-date" value:day frame:CGRectMake(12+i*dayWidth,y,dayWidth-4,36)];if([day isEqualToString:self.state[@"selectedDate"]])date.backgroundColor=[UIColor systemBlueColor];[self.content addSubview:date];}y+=42;
  [self addAction:[self.state[@"epgLoading"] boolValue]?@"正在刷新节目单…":@"刷新节目单" action:@"live-epg-refresh" value:@"" y:y width:inner];y+=48;
  if([self.state[@"hasEPG"] boolValue]){[self addAction:@"节目单来源与匹配详情" action:@"live-epg-info" value:@"" y:y width:inner];y+=48;}
  items=self.state[@"programs"]?:@[];
  }
 } else {
  self.searchField=[[UITextField alloc]initWithFrame:CGRectMake(12,y,inner-82,40)];self.searchField.placeholder=@"搜索频道名称、分组";self.searchField.text=self.state[@"search"]?:@"";self.searchField.font=[UIFont systemFontOfSize:14];self.searchField.textColor=[UIColor colorWithRed:.15 green:.18 blue:.24 alpha:1];self.searchField.backgroundColor=UIColor.whiteColor;self.searchField.borderStyle=3;[self.content addSubview:self.searchField];
  [self.content addSubview:[self button:@"搜索" action:@"live-search" value:@"" frame:CGRectMake(width-94,y,82,40)]];y+=48;items=self.state[@"channels"]?:@[];
 }
 if(items.count==0&&![panel isEqualToString:@"programs"]){NSString*emptyText=[panel isEqualToString:@"categories"]?@"暂无频道分类。导入 M3U 播放列表后即可浏览。":([panel isEqualToString:@"routes"]?@"当前频道没有其他可用备用线路。":([self.state[@"loading"] boolValue]?@"正在加载频道…":@"尚无频道，请先导入 M3U 播放列表。"));UILabel*empty=[self label:emptyText size:14 bold:NO];empty.frame=CGRectMake(16,y,inner,48);empty.numberOfLines=2;[self.content addSubview:empty];y+=54;}
 for(id object in items){NSString*titleText=@"";NSString*itemAction=action;NSString*value=@"";
  if([object isKindOfClass:NSDictionary.class]){
   if([panel isEqualToString:@"channels"]){
    NSString*channelTitle=[NSString stringWithFormat:@"%@  %@ · %@%@",[object[@"active"] boolValue]?@"▶":@"",object[@"name"]?:@"频道",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"":@" · HTTP 未加密"];
    NSString*channelIndex=[object[@"index"] stringValue];SYLiveActionButton*channelButton=[self addAction:channelTitle action:@"live-channel" value:channelIndex y:y width:inner];[self styleButton:channelButton selected:[object[@"active"] boolValue]];
    SYLiveActionButton*favorite=[self button:[object[@"favorite"] boolValue]?@"♥":@"♡" action:@"live-favorite" value:channelIndex frame:CGRectMake(width-65,y,50,42)];[self.content addSubview:favorite];y+=48;continue;
   }
   if([panel isEqualToString:@"routes"]){titleText=[NSString stringWithFormat:@"%@%@ · %@ · %@",[object[@"active"] boolValue]?@"✓ ":@"",object[@"name"]?:@"线路",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"HTTPS":@"HTTP 未加密"];itemAction=@"live-route";value=[object[@"index"] stringValue];}
   else if([panel isEqualToString:@"programs"]){titleText=[NSString stringWithFormat:@"%@  %@",object[@"start"]?:@"",object[@"title"]?:@"节目"];itemAction=@"live-program";value=[object[@"index"] stringValue];}
   else {titleText=[NSString stringWithFormat:@"%@  %@ · %@%@",[object[@"active"] boolValue]?@"▶":@"",object[@"name"]?:@"频道",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"":@" · HTTP 未加密"];itemAction=@"live-channel";value=[object[@"index"] stringValue];}
  }else {titleText=[NSString stringWithFormat:@"%@  ·  %@ 个频道",object[@"name"]?:@"分类",object[@"count"]?:@0];value=object[@"value"]?:object[@"name"]?:@"";}
   if(itemAction.length){SYLiveActionButton*itemButton=[self addAction:titleText action:itemAction value:value y:y width:inner];if([itemAction isEqualToString:@"live-route"])[self styleButton:itemButton selected:[object[@"active"] boolValue]];}else {UILabel*label=[self label:titleText size:14 bold:NO];label.frame=CGRectMake(16,y+8,inner,26);[self.content addSubview:label];}
  y+=48;
 }
 NSDictionary*selectedProgram=self.state[@"selectedProgram"];
 if([panel isEqualToString:@"programs"]&&[selectedProgram isKindOfClass:NSDictionary.class]){UILabel*detail=[self label:[NSString stringWithFormat:@"%@ · %@–%@\n%@",selectedProgram[@"title"]?:@"",selectedProgram[@"start"]?:@"",selectedProgram[@"stop"]?:@"",selectedProgram[@"description"]?:selectedProgram[@"subtitle"]?:@""] size:14 bold:YES];detail.frame=CGRectMake(16,y+4,inner,80);detail.numberOfLines=3;[self.content addSubview:detail];y+=88;}
 NSString*sheet=self.state[@"sheet"]?:@"";
 if([sheet isEqualToString:@"channel"]){NSDictionary*detail=self.state[@"channelInfo"]?:@{};NSString*text=[NSString stringWithFormat:@"频道信息 · %@\nID %@ · 分组 %@\nEPG %@\n%@",detail[@"name"]?:@"",detail[@"tvgId"]?:@"",detail[@"group"]?:@"",detail[@"epgUrl"]?:@"",detail[@"url"]?:@""];UILabel*label=[self label:text size:12 bold:NO];label.frame=CGRectMake(16,y,inner,100);label.numberOfLines=4;[self.content addSubview:label];y+=104;[self addAction:@"关闭频道信息" action:@"live-sheet-dismiss" value:@"" y:y width:inner];y+=48;}
 else if([sheet isEqualToString:@"guide"]){[self addAction:[NSString stringWithFormat:@"节目单 %@ · 当前频道 %@",self.state[@"epgUrl"]?:@"未提供",self.state[@"title"]?:@"" ] action:@"live-sheet-dismiss" value:@"" y:y width:inner];y+=48;}
 else if([sheet isEqualToString:@"program"]&&[selectedProgram isKindOfClass:NSDictionary.class]){[self addAction:[NSString stringWithFormat:@"%@ · %@–%@",selectedProgram[@"title"]?:@"节目",selectedProgram[@"start"]?:@"",selectedProgram[@"stop"]?:@""] action:@"live-program-dismiss" value:@"" y:y width:inner];y+=48;}
 else if([sheet isEqualToString:@"route"]&&[self.state[@"selectedRoute"] isKindOfClass:NSDictionary.class]){NSDictionary*route=self.state[@"selectedRoute"];NSString*routeKind=[route[@"secure"] boolValue]?@"HTTPS":@"HTTP 未加密";[self addAction:[NSString stringWithFormat:@"切换到 %@ · %@ · %@",route[@"name"]?:@"线路",route[@"group"]?:@"",routeKind] action:@"live-route-system" value:@"" y:y width:inner];y+=48;[self addAction:@"在 VLC 播放" action:@"live-route-vlc" value:@"" y:y width:inner];y+=48;[self addAction:@"复制线路地址" action:@"live-route-copy" value:@"" y:y width:inner];y+=48;[self addAction:@"关闭线路菜单" action:@"live-sheet-dismiss" value:@"" y:y width:inner];y+=48;}
 if([self.state[@"hasMore"] boolValue]){[self addAction:@"加载更多频道" action:@"live-more" value:@"" y:y width:inner];y+=48;}
 self.content.contentSize=CGSizeMake(width,y+20);
}
- (void)applyFastState:(NSDictionary*)state {
 self.state=[state isKindOfClass:NSDictionary.class]?state:@{};
 NSString*title=self.state[@"title"]?:@"直播";NSString*group=self.state[@"group"]?:@"请选择频道";NSString*status=self.state[@"status"]?:@"";
 self.liveTitleLabel.text=title;self.liveStatusLabel.text=title;self.liveInfoLabel.text=[NSString stringWithFormat:@"%@ · %@",group,status];
 NSString*channelIndex=[self.state[@"channelIndex"] stringValue];
 for(UIView*view in self.content.subviews){if(![view isKindOfClass:SYLiveActionButton.class])continue;SYLiveActionButton*button=(SYLiveActionButton*)view;
  if([button.action isEqualToString:@"live-panel"]){[self styleButton:button selected:[button.value isEqualToString:self.state[@"panel"]]];continue;}
  if([button.action isEqualToString:@"live-favorite-current"]){[button setTitle:[self.state[@"favoriteCurrent"] boolValue]?@"♥ 已收藏":@"♡ 收藏当前频道" forState:UIControlStateNormal];continue;}
  if([button.action isEqualToString:@"live-channel"]){NSDictionary*channel=nil;for(NSDictionary*item in self.state[@"channels"])if([[item[@"index"] stringValue] isEqualToString:button.value]){channel=item;break;}if(!channel)continue;BOOL selected=[button.value isEqualToString:channelIndex];NSString*name=channel[@"name"]?:@"频道",*groupName=channel[@"group"]?:@"",*security=[channel[@"secure"] boolValue]?@"":@" · HTTP 未加密";NSString*rowTitle=[NSString stringWithFormat:@"%@%@ · %@%@",selected?@"▶  ":@"  ",name,groupName,security];button.baseTitle=rowTitle;[button setTitle:rowTitle forState:UIControlStateNormal];[self styleButton:button selected:selected];continue;}
  if([button.action isEqualToString:@"live-route"]){NSDictionary*route=nil;for(NSDictionary*item in self.state[@"routes"])if([[item[@"index"] stringValue] isEqualToString:button.value]){route=item;break;}if(!route)continue;BOOL selected=[route[@"active"] boolValue];NSString*rowTitle=[NSString stringWithFormat:@"%@%@ · %@ · %@",selected?@"✓  ":@"",route[@"name"]?:@"线路",route[@"group"]?:@"",[route[@"secure"] boolValue]?@"HTTPS":@"HTTP 未加密"];button.baseTitle=rowTitle;[button setTitle:rowTitle forState:UIControlStateNormal];[self styleButton:button selected:selected];continue;}
  if([button.action isEqualToString:@"live-date"])[self styleButton:button selected:[button.value isEqualToString:self.state[@"selectedDate"]]];
 }
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
  if([self.playContext hasPrefix:@"live:"]&&self.liveScreen){self.nativePlayer.view.frame=self.liveScreen.playerHost.bounds;[self.liveScreen.playerHost bringSubviewToFront:self.liveScreen.routePicker];return;}
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
  if([self.playContext hasPrefix:@"live:"]&&self.liveScreen){self.nativePlayer.view.frame=self.liveScreen.playerHost.bounds;[self.liveScreen.playerHost bringSubviewToFront:self.liveScreen.routePicker];}
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
  if([event[@"status"] isEqualToString:@"progress"]&&self.smokePlayerReady&&[event[@"time"] doubleValue]>1&&!self.smokeLiveStarted){
    self.smokeLiveStarted=YES;
    NSDictionary*result=@{@"nativePlayerReady":@YES,@"hlsProxyActive":@(self.smokeProxyActive),@"removedAdSegments":@(self.hlsProxy.removed),@"inlinePlayback":@(self.nativePlayer.parentViewController==self&&self.presentedViewController==nil&&self.nativePlayer.view.frame.size.height>0&&self.nativePlayer.view.frame.size.height<self.view.bounds.size.height*0.8),@"playbackTime":event[@"time"],@"devicePlaybackTested":@NO};
    NSData*report=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:NULL];
    [report writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-playback-smoke.json"] atomically:YES];
    [self.nativePlayer.player pause];
    [self.web evaluateJavaScript:@"window.NativeLiveAction&&window.NativeLiveAction('page','live')" completionHandler:nil];
    [self performSelector:@selector(runLiveScreenSmoke) withObject:nil afterDelay:2];
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
#if defined(SY_SIMULATOR_SMOKE)
- (void)runLiveScreenSmoke {
  self.smokeLiveAttempts++;
  if(!self.liveScreen&&self.smokeLiveAttempts<20){[self performSelector:@selector(runLiveScreenSmoke) withObject:nil afterDelay:1];return;}
  if(!self.liveScreen)return;
  [self.web evaluateJavaScript:@"window.NativeLiveAction&&window.NativeLiveAction('live-panel','categories')" completionHandler:nil];
  [self performSelector:@selector(runFastLiveScreenSmoke) withObject:nil afterDelay:1];
}
- (void)runFastLiveScreenSmoke {
  if(!self.liveScreen)return;
  self.smokeLiveSubviewsBeforeFast=self.liveScreen.content.subviews.count;
  [self.web evaluateJavaScript:@"(()=>{const s=window.NativeLiveSnapshot();s.title='切台响应测试';s.status='正在连接…';window.NativeTransport.syncLive(s,{fast:true});})()" completionHandler:^(id result,NSError*error){
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(0.35*NSEC_PER_SEC)),dispatch_get_main_queue(),^{[self finishLiveScreenSmoke];});
  }];
}
- (void)finishLiveScreenSmoke {
  BOOL ready=self.liveScreen&&self.liveScreen.playerHost&&self.liveScreen.content.subviews.count>=8&&[self.liveSnapshot[@"panel"] isEqualToString:@"categories"];
  self.smokeLiveFastStateApplied=self.liveScreen.content.subviews.count==self.smokeLiveSubviewsBeforeFast&&[self.liveScreen.liveTitleLabel.text isEqualToString:@"切台响应测试"];
  NSDictionary*report=@{@"nativeLiveScreen":@(ready),@"pinnedPlayerHost":@(self.liveScreen.playerHost!=nil),@"airplayRoutePicker":@(self.liveScreen.routePicker!=nil),@"visibleNativeControls":@(self.liveScreen.content.subviews.count),@"categoryActionReachedBridge":([(self.liveSnapshot[@"panel"]?:@"") isEqualToString:@"categories"]?@YES:@NO),@"fastSwitchUpdatesWithoutRebuild":@(self.smokeLiveFastStateApplied)};
  NSData*data=[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:NULL];
  [data writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-live-smoke.json"] atomically:YES];
}
#endif
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
  if([type isEqualToString:@"liveState"]||[type isEqualToString:@"liveStateFast"]){if([body[@"state"] isKindOfClass:NSDictionary.class]){self.liveSnapshot=body[@"state"];if([type isEqualToString:@"liveStateFast"])[self.liveScreen applyFastState:self.liveSnapshot];else [self.liveScreen applyState:self.liveSnapshot];}return;}
  if([type isEqualToString:@"stopLive"]){if([self.playContext hasPrefix:@"live:"])[self stopNativePlayback];return;}
  if([type isEqualToString:@"cancel"]){[self.tasks[identifier] cancel];[self.tasks removeObjectForKey:identifier];return;}
  if([type isEqualToString:@"liveCacheGet"]){NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Documents/sanyuan-live-cache.json"];NSData*data=[NSData dataWithContentsOfFile:path];id cached=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:NULL]:nil;[self deliver:@{@"id":identifier,@"cache":[cached isKindOfClass:NSDictionary.class]?cached:@{}}];return;}
  if([type isEqualToString:@"liveCachePut"]){NSString*urlText=[body[@"url"] isKindOfClass:NSString.class]?body[@"url"]:@"",*playlist=[body[@"text"] isKindOfClass:NSString.class]?body[@"text"]:@"";NSURL*playlistURL=[NSURL URLWithString:urlText];BOOL allowedURL=([playlistURL.scheme.lowercaseString isEqualToString:@"https"]||[playlistURL.scheme.lowercaseString isEqualToString:@"http"])&&playlistURL.host.length;NSData*data=playlist.length?[NSJSONSerialization dataWithJSONObject:@{@"url":urlText,@"text":playlist} options:0 error:NULL]:nil;if(!allowedURL||!data||data.length>14*1024*1024){[self deliver:@{@"id":identifier,@"error":@"播放列表过大或地址无效，无法保存在本机"}];return;}NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Documents/sanyuan-live-cache.json"];BOOL saved=[data writeToFile:path atomically:YES];[self deliver:saved?@{@"id":identifier,@"ok":@YES}:@{@"id":identifier,@"error":@"无法将播放列表写入本机存储"}];return;}
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
  if([type isEqualToString:@"openExternal"]){NSURL*stream=[NSURL URLWithString:[body[@"url"] isKindOfClass:NSString.class]?body[@"url"]:@""];BOOL secure=[stream.scheme.lowercaseString isEqualToString:@"https"],liveHTTP=[body[@"live"] boolValue]&&[stream.scheme.lowercaseString isEqualToString:@"http"];if((!secure&&!liveHTTP)||!stream.host.length){[self deliver:@{@"id":identifier,@"error":@"普通外部播放需使用 HTTPS；直播线路允许 HTTP"}];return;}NSURLComponents*target=[NSURLComponents new];target.scheme=@"vlc-x-callback";target.host=@"x-callback-url";target.path=@"/stream";target.queryItems=@[[NSURLQueryItem queryItemWithName:@"url" value:stream.absoluteString]];NSURL*external=target.URL;if(!external||![UIApplication.sharedApplication canOpenURL:external]){[self deliver:@{@"id":identifier,@"error":@"未检测到 VLC，请先安装 VLC"}];return;}[UIApplication.sharedApplication openURL:external options:@{} completionHandler:^(BOOL success){[self deliver:success?@{@"id":identifier,@"ok":@YES}:@{@"id":identifier,@"error":@"无法打开 VLC"}];}];return;}
  if(![body[@"url"] isKindOfClass:NSString.class])return;
  NSURL*url=[NSURL URLWithString:body[@"url"]];
  BOOL https=[url.scheme.lowercaseString isEqualToString:@"https"];
  BOOL liveHTTPRequest=[type isEqualToString:@"request"]&&[body[@"method"] isEqualToString:@"GET"]&&([body[@"livePlaylist"] boolValue]||[body[@"liveGuide"] boolValue])&&[url.scheme.lowercaseString isEqualToString:@"http"];
  BOOL liveHTTPPlayback=[type isEqualToString:@"play"]&&[body[@"context"] isKindOfClass:NSString.class]&&[body[@"context"] hasPrefix:@"live:"]&&[url.scheme.lowercaseString isEqualToString:@"http"];
  if((!https&&!liveHTTPRequest&&!liveHTTPPlayback)||!url.host.length){[self deliver:@{@"id":identifier,@"error":@"普通数据请求需使用 HTTPS；HTTP 仅用于直播列表、节目单和直播流"}];return;}
  if([type isEqualToString:@"play"]){
    NSDictionary*headers=[body[@"headers"] isKindOfClass:NSDictionary.class]?body[@"headers"]:@{};
    NSString*requestedContext=[body[@"context"] isKindOfClass:NSString.class]?body[@"context"]:identifier;
    BOOL livePlayback=[requestedContext hasPrefix:@"live:"];
    NSURL*playURL=livePlayback?url:[self.hlsProxy prepare:url headers:headers enabled:body[@"cleanHLS"]==nil||[body[@"cleanHLS"] boolValue]];
    #if defined(SY_SIMULATOR_SMOKE)
    self.smokeProxyActive=[playURL.scheme isEqualToString:@"http"];
#endif
    AVURLAsset*asset=[AVURLAsset URLAssetWithURL:playURL options:@{@"AVURLAssetHTTPHeaderFieldsKey":headers}];
    AVPlayerItem*item=[AVPlayerItem playerItemWithAsset:asset];item.preferredForwardBufferDuration=livePlayback?1:6;item.audioTimePitchAlgorithm=AVAudioTimePitchAlgorithmTimeDomain;
    // Keep one live AVPlayerViewController across channel and mirror changes.
    // Swapping only the item avoids a view teardown and black flash.
    if([requestedContext hasPrefix:@"live:"]&&[self.playContext hasPrefix:@"live:"]&&self.nativePlayer&&self.nativePlayer.player){
      self.nativePlayer.player.automaticallyWaitsToMinimizeStalling=NO;
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
    player.player=[AVPlayer playerWithPlayerItem:item];player.player.automaticallyWaitsToMinimizeStalling=livePlayback?NO:YES;[item addObserver:self forKeyPath:@"status" options:5 context:&SYPlaybackStatus];
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
