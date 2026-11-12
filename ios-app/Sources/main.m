#import "RuntimeSDK.h"
#import "HLSProxy.h"
#import "SYCicadaLivePlayer.h"
#import <zlib.h>
#import <CommonCrypto/CommonCryptor.h>
#import <objc/runtime.h>
#if defined(SY_SIMULATOR_SMOKE)
#import <CoreFoundation/CFByteOrder.h>
#endif
@class SYController;
static char SYPlaybackStatus;
static char SYVideoPresentationSize;
static char SYLiveRendererDisplayReady;
static char SYPosterAssetKeys;
static NSMutableDictionary *SYPosterImageCache;
static NSMutableDictionary *SYPosterRequests;
static NSMutableArray *SYPosterImageOrder;
static NSOperationQueue *SYPosterLoadQueue;
// Keep ordinary JPEG/PNG decoding fast; encrypted poster mirrors use their configured AES-CBC asset key.
static UIImage *SYPosterImage(NSData*data,NSArray*assetKeys,NSUInteger preferredIndex){
 if(!data.length||data.length>12582912)return nil;
 UIImage*image=[UIImage imageWithData:data];if(image)return image;
 if(data.length<16||data.length%kCCBlockSizeAES128)return nil;
 NSArray*entries=[assetKeys isKindOfClass:NSArray.class]?assetKeys:@[];
 NSArray*ordered=[entries sortedArrayUsingComparator:^NSComparisonResult(NSDictionary*a,NSDictionary*b){BOOL aPreferred=[a[@"index"] unsignedIntegerValue]==preferredIndex,bPreferred=[b[@"index"] unsignedIntegerValue]==preferredIndex;if(aPreferred!=bPreferred)return aPreferred?NSOrderedAscending:NSOrderedDescending;return [a[@"index"] compare:b[@"index"]];}];
 for(NSDictionary*entry in ordered){
  NSString*keyText=[entry[@"key"] isKindOfClass:NSString.class]?entry[@"key"]:@"",*ivText=[entry[@"iv"] isKindOfClass:NSString.class]?entry[@"iv"]:@"";
  NSData*key=[keyText dataUsingEncoding:NSUTF8StringEncoding],*iv=[ivText dataUsingEncoding:NSUTF8StringEncoding];
  if(key.length!=kCCKeySizeAES256||iv.length!=kCCBlockSizeAES128)continue;
  NSMutableData*plain=[NSMutableData dataWithLength:data.length+kCCBlockSizeAES128];size_t moved=0;
  CCCryptorStatus status=CCCrypt(kCCDecrypt,kCCAlgorithmAES,kCCOptionPKCS7Padding,key.bytes,key.length,iv.bytes,data.bytes,data.length,plain.mutableBytes,plain.length,&moved);
  if(status!=kCCSuccess||!moved)continue;plain.length=moved;
  image=[UIImage imageWithData:plain];if(image)return image;
 }
 return nil;
}
static NSData *SYGunzipEPG(NSData*input){
 if(input.length<2)return input;
 const uint8_t*bytes=input.bytes;if(bytes[0]!=0x1f||bytes[1]!=0x8b)return input;
 z_stream stream={0};stream.next_in=(Bytef*)input.bytes;stream.avail_in=(uInt)input.length;
 if(inflateInit2(&stream,15+32)!=Z_OK)return nil;
 NSMutableData*output=[NSMutableData data];uint8_t buffer[65536];int result=Z_OK;NSUInteger maximum=48*1024*1024;
 while(result==Z_OK){stream.next_out=buffer;stream.avail_out=(uInt)sizeof(buffer);result=inflate(&stream,Z_NO_FLUSH);NSUInteger produced=sizeof(buffer)-stream.avail_out;if(produced){if(output.length+produced>maximum){inflateEnd(&stream);return nil;}[output appendBytes:buffer length:produced];}}
 inflateEnd(&stream);return result==Z_STREAM_END?output:nil;
}
static AVPlayerLayer *SYFindPlayerLayer(CALayer*root,AVPlayer*player){if([root isKindOfClass:AVPlayerLayer.class]&&((AVPlayerLayer*)root).player==player)return (AVPlayerLayer*)root;for(CALayer*child in root.sublayers){AVPlayerLayer*found=SYFindPlayerLayer(child,player);if(found)return found;}return nil;}
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
@property(nonatomic,strong) NSDictionary*payload;
@end
@implementation SYLiveActionButton
@end
@interface SYLiveScreenController:UIViewController
@property(nonatomic,weak) SYController*owner;
@property(nonatomic,strong) UIView*playerHost;
@property(nonatomic,strong) AVRoutePickerView*routePicker;
@property(nonatomic,strong) AVPlayerLayer*liveRendererLayer;
@property(nonatomic,strong) UIScrollView*content;
@property(nonatomic,strong) UITextField*urlField;
@property(nonatomic,strong) UITextField*searchField;
@property(nonatomic,strong) UITextField*accountField;
@property(nonatomic,strong) UITextField*passwordField;
@property(nonatomic,strong) UILabel*liveTitleLabel;
@property(nonatomic,strong) UILabel*liveStatusLabel;
@property(nonatomic,strong) UILabel*liveInfoLabel;
@property(nonatomic,strong) NSDictionary*state;
@property(nonatomic) BOOL integratedMode;
@property(nonatomic,copy) NSString*renderedContentKey;
- (void)applyState:(NSDictionary*)state;
- (void)applyFastState:(NSDictionary*)state;
- (void)layoutEmbeddedPlayer;
@end
@interface SYAppScreenController:UIViewController<UIScrollViewDelegate>
@property(nonatomic,weak) SYController*owner;
@property(nonatomic,strong) NSDictionary*state;
@property(nonatomic,strong) UIScrollView*content;
@property(nonatomic,strong) UIView*playerHost;
@property(nonatomic,strong) UIView*topBar;
@property(nonatomic,strong) UIView*bottomBar;
@property(nonatomic,strong) UILabel*titleLabel;
@property(nonatomic,strong) SYLiveActionButton*heroCard;
@property(nonatomic,strong) UIImageView*heroPoster;
@property(nonatomic,strong) UILabel*heroTitleLabel;
@property(nonatomic,strong) UILabel*heroSubtitleLabel;
@property(nonatomic,strong) UILabel*heroBadgeLabel;
@property(nonatomic,strong) NSArray*heroPickerButtons;
@property(nonatomic,strong) UITextField*searchField;
@property(nonatomic,strong) UITextField*accountField;
@property(nonatomic,strong) UITextField*passwordField;
@property(nonatomic,copy) NSString*renderedPageKey;
- (NSString*)renderKeyForState:(NSDictionary*)state;
- (void)applyState:(NSDictionary*)state;
- (BOOL)applyHeroCarouselState:(NSDictionary*)state;
- (void)loadPosters:(NSArray*)addresses into:(UIImageView*)imageView;
- (void)setPosterAssetKeys:(UIImageView*)imageView forMovie:(NSDictionary*)movie;
- (void)loadVisiblePostersInShelf:(UIScrollView*)shelf;
- (CGFloat)addShelf:(NSArray*)items title:(NSString*)title y:(CGFloat)y;
- (SYLiveActionButton*)shelfCardForMovie:(NSDictionary*)movie frame:(CGRect)frame cardWidth:(CGFloat)cardWidth posterHeight:(CGFloat)posterHeight;
- (NSUInteger)shelfColumnCount;
@end
@interface SYController:UIViewController<WKNavigationDelegate,SYCicadaLivePlayerDelegate>
@property(nonatomic,strong) WKWebView*web;
@property(nonatomic,strong) SYHLSProxy*hlsProxy;
@property(nonatomic,strong) SYBridge*bridge;
@property(nonatomic,strong) NSURLSession*session;
@property(nonatomic,strong) NSMutableDictionary*tasks;
@property(nonatomic,strong) SYPlayerViewController*nativePlayer;
@property(nonatomic,strong) SYLiveScreenController*liveScreen;
@property(nonatomic,strong) SYAppScreenController*appScreen;
@property(nonatomic,strong) NSDictionary*pageSnapshot;
@property(nonatomic,strong) NSDictionary*liveSnapshot;
@property(nonatomic,strong) AVRoutePickerView*airplayPicker;
@property(nonatomic,strong) AVPlayerItem*nativeItem;
@property(nonatomic,strong) AVPlayerItem*liveTrackInspectionItem;
@property(nonatomic,strong) id timeObserver;
@property(nonatomic,strong) id endObserver;
@property(nonatomic,strong) id stalledObserver;
@property(nonatomic,strong) id failedObserver;
@property(nonatomic) BOOL vodStallWatchdogActive;
@property(nonatomic) double vodStallTime;
@property(nonatomic) NSInteger vodStallChecks;
@property(nonatomic,copy) NSString*playContext;
@property(nonatomic,copy) NSString*preferredVideoGravity;
@property(nonatomic) BOOL detailStatusStyle;
@property(nonatomic) BOOL nativeVideoReady;
@property(nonatomic) BOOL liveRendererAttached;
@property(nonatomic) NSUInteger liveRendererAttachAttempts;
@property(nonatomic,strong,nullable) SYCicadaLivePlayer*cicadaLivePlayer;
@property(nonatomic) BOOL cicadaFallbackActive;
@property(nonatomic) BOOL cicadaFallbackAttempted;
@property(nonatomic,strong,nullable) NSDictionary*livePlaybackHeaders;
// 点播 Cicada 回退：AVPlayer 卡顿时同线同清晰度换 Cicada 解。vodCicadaURL 为
// 最高清晰度分变体直连地址（JS 传 cicadaURL），没有时退回原站直连地址，
// 再没有时退回代理地址；headers 与 AVPlayer 用同一份。
@property(nonatomic,strong,nullable) NSURL*vodDirectURL;
@property(nonatomic,strong,nullable) NSURL*vodCicadaURL;
@property(nonatomic,strong,nullable) NSDictionary*vodCicadaHeaders;
@property(nonatomic) BOOL cicadaVODFallbackAttempted;
#if defined(SY_SIMULATOR_SMOKE)
@property(nonatomic) NSInteger smokeAttempts;
@property(nonatomic) BOOL smokePlayerReady;
@property(nonatomic) BOOL smokePlaybackStarted;
@property(nonatomic) BOOL smokeProxyActive;
@property(nonatomic,strong) NSMutableDictionary*smokePlaybackDebug;
@property(nonatomic,strong) NSMutableDictionary*smokeNavigationDebug;
@property(nonatomic) NSInteger smokeLiveAttempts;
@property(nonatomic) BOOL smokeLiveStarted;
@property(nonatomic) NSUInteger smokeLiveSubviewsBeforeFast;
@property(nonatomic) BOOL smokeLiveFastStateApplied;
@property(nonatomic) BOOL smokeLiveCategoryLinked;
@property(nonatomic) BOOL smokeLiveScrollReset;
@property(nonatomic) BOOL smokeLiveVideoStarted;
#endif
- (void)receive:(WKScriptMessage*)message;
- (void)inspectLiveVideoTracksForItem:(AVPlayerItem*)item;
- (void)attachLiveLayerRendererForItem:(AVPlayerItem*)item;
- (BOOL)tryCicadaFallbackForItem:(AVPlayerItem*)item;
- (BOOL)tryCicadaVODFallbackForItem:(AVPlayerItem*)item;
- (void)destroyCicadaPlayer;
- (void)sendLiveActionScript:(NSString*)script;
- (void)sendPageAction:(NSString*)action payload:(NSDictionary*)payload;
@end
@implementation SYBridge
- (void)userContentController:(id)controller didReceiveScriptMessage:(WKScriptMessage*)message { [self.owner receive:message]; }
@end
@implementation SYLiveScreenController
- (BOOL)isDarkTheme {return [self.state[@"theme"] isEqualToString:@"black"]; }
- (UIColor*)liveInk {return [self isDarkTheme]?[UIColor colorWithRed:.93 green:.96 blue:.95 alpha:1]:[UIColor colorWithRed:.12 green:.14 blue:.19 alpha:1];}
- (UIColor*)liveMuted {return [self isDarkTheme]?[UIColor colorWithRed:.65 green:.72 blue:.70 alpha:1]:[UIColor colorWithRed:.45 green:.48 blue:.55 alpha:1];}
- (UIColor*)liveSurface {return [self isDarkTheme]?[UIColor colorWithRed:.075 green:.12 blue:.115 alpha:1]:UIColor.whiteColor;}
- (UIStatusBarStyle)preferredStatusBarStyle {return [self isDarkTheme]?1:0;}
- (UILabel*)label:(NSString*)text size:(CGFloat)size bold:(BOOL)bold {
  UILabel*label=[[UILabel alloc]initWithFrame:CGRectMake(16,0,340,30)];label.text=text;label.textColor=[self liveInk];label.font=bold?[UIFont boldSystemFontOfSize:size]:[UIFont systemFontOfSize:size];return label;
}
- (SYLiveActionButton*)button:(NSString*)title action:(NSString*)action value:(NSString*)value frame:(CGRect)frame {
  SYLiveActionButton*button=[[SYLiveActionButton alloc]initWithFrame:frame];button.action=action;button.value=value?:@"";button.baseTitle=title;button.backgroundColor=[self liveSurface];button.layer.cornerRadius=12;button.layer.borderWidth=.5;button.layer.borderColor=[UIColor colorWithRed:.55 green:.68 blue:.63 alpha:[self isDarkTheme]?.22:.09].CGColor;[button setTitle:title forState:UIControlStateNormal];[button setTitleColor:[self liveInk] forState:UIControlStateNormal];button.titleLabel.font=[UIFont systemFontOfSize:13 weight:UIFontWeightMedium];button.titleLabel.lineBreakMode=NSLineBreakByTruncatingTail;button.contentEdgeInsets=UIEdgeInsetsMake(0,9,0,9);[button addTarget:self action:@selector(actionPressed:) forControlEvents:UIControlEventTouchUpInside];return button;
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
 [super viewDidLayoutSubviews];CGFloat width=self.view.bounds.size.width;CGFloat top=self.integratedMode?0:MAX(76,self.view.safeAreaInsets.top+29);CGFloat headerTop=top-45;self.liveTitleLabel.hidden=self.integratedMode;self.liveTitleLabel.frame=CGRectMake(66,headerTop+2,width-132,34);for(UIView*view in self.view.subviews)if([view isKindOfClass:UIButton.class])view.hidden=self.integratedMode;CGFloat playerHeight=width*9.0/16.0;
 self.playerHost.frame=CGRectMake(0,top,width,playerHeight);self.content.frame=CGRectMake(0,top+playerHeight,width,self.view.bounds.size.height-top-playerHeight);
 [self layoutEmbeddedPlayer];
 self.routePicker.frame=CGRectMake(width-58,8,48,44);[self.playerHost bringSubviewToFront:self.routePicker];
}
- (void)layoutEmbeddedPlayer {
 SYController*owner=self.owner;SYPlayerViewController*player=owner.nativePlayer;
 if(!player||player.fullScreen||player.pictureInPicture||![owner.playContext hasPrefix:@"live:"])return;
 NSString*gravity=owner.preferredVideoGravity.length?owner.preferredVideoGravity:AVLayerVideoGravityResizeAspect;
 if(owner.cicadaFallbackActive&&owner.cicadaLivePlayer){UIView*cicadaView=owner.cicadaLivePlayer.playerView;if(cicadaView.superview!=self.playerHost){[cicadaView removeFromSuperview];[self.playerHost addSubview:cicadaView];}[owner.cicadaLivePlayer applyVideoGravity:gravity];cicadaView.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;cicadaView.hidden=NO;cicadaView.frame=self.playerHost.bounds;[self.playerHost bringSubviewToFront:cicadaView];[self.playerHost bringSubviewToFront:self.routePicker];return;}
 if(player.view.superview!=self.playerHost){[player.view removeFromSuperview];[self.playerHost addSubview:player.view];}
 player.showsPlaybackControls=NO;player.videoGravity=gravity;if(self.liveRendererLayer)self.liveRendererLayer.videoGravity=gravity;player.view.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;player.view.hidden=NO;player.view.alpha=1;player.view.frame=self.playerHost.bounds;
 [self.playerHost bringSubviewToFront:self.routePicker];
}
- (void)actionPressed:(SYLiveActionButton*)sender {
 if([sender.action isEqualToString:@"live-import"]){[self sendAction:sender.action value:self.urlField.text?:@""];return;}
 if([sender.action isEqualToString:@"live-search"]){[self sendAction:sender.action value:self.searchField.text?:@""];return;}
 [self sendAction:sender.action value:sender.value];
}
- (void)goBack {[self sendAction:@"live-back" value:@""];}
- (void)styleButton:(SYLiveActionButton*)button selected:(BOOL)selected {
 UIColor*blue=[self isDarkTheme]?[UIColor colorWithRed:.53 green:.88 blue:.80 alpha:1]:[UIColor colorWithRed:.157 green:.471 blue:.941 alpha:1];
 button.backgroundColor=selected?[blue colorWithAlphaComponent:[self isDarkTheme]?.16:.09]:[self liveSurface];
 button.layer.borderColor=(selected?[blue colorWithAlphaComponent:.35]:[UIColor colorWithRed:.55 green:.68 blue:.63 alpha:[self isDarkTheme]?.22:.09]).CGColor;
 [button setTitleColor:selected?blue:[self liveInk] forState:UIControlStateNormal];
}
- (void)sendAction:(NSString*)action value:(NSString*)value {
 SYController*owner=self.owner;if(!owner||!action)return;NSArray*args=@[action,value?:@""];NSData*data=[NSJSONSerialization dataWithJSONObject:args options:0 error:NULL];NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
 [owner sendLiveActionScript:[NSString stringWithFormat:@"window.NativeLiveAction&&window.NativeLiveAction.apply(null,%@)",json]];
}
- (SYLiveActionButton*)addAction:(NSString*)title action:(NSString*)action value:(NSString*)value y:(CGFloat)y width:(CGFloat)width {
 CGFloat available=[action isEqualToString:@"live-channel"]?width-58:width;SYLiveActionButton*button=[self button:title action:action value:value frame:CGRectMake(12,y,available,42)];[self.content addSubview:button];return button;
}
- (void)applyState:(NSDictionary*)state {
 CGPoint previousOffset=self.content.contentOffset;self.state=[state isKindOfClass:NSDictionary.class]?state:@{};NSString*panel=self.state[@"panel"]?:@"channels";NSString*channelKey=@"";if([panel isEqualToString:@"programs"]||[panel isEqualToString:@"routes"])channelKey=[self.state[@"channelIndex"] description]?:@"";NSString*contentKey=[NSString stringWithFormat:@"%@|%@|%@|%@|%@",panel,self.state[@"category"]?:@"",self.state[@"search"]?:@"",self.state[@"selectedDate"]?:@"",channelKey];BOOL resetOffset=self.renderedContentKey&&! [self.renderedContentKey isEqualToString:contentKey];self.renderedContentKey=contentKey;UIColor*background=[self isDarkTheme]?[UIColor colorWithRed:.035 green:.065 blue:.06 alpha:1]:[UIColor colorWithRed:.953 green:.957 blue:.973 alpha:1];self.view.backgroundColor=background;self.content.backgroundColor=background;self.liveTitleLabel.textColor=[self liveInk];self.routePicker.tintColor=[self liveInk];[self setNeedsStatusBarAppearanceUpdate];for(UIView*headerItem in self.view.subviews)if([headerItem isKindOfClass:UIButton.class]){UIButton*back=(UIButton*)headerItem;[back setTitleColor:[self liveInk] forState:UIControlStateNormal];back.backgroundColor=[self liveSurface];}
 for(UIView*view in self.content.subviews)[view removeFromSuperview];CGFloat width=self.view.bounds.size.width,inner=width-24,y=12;self.content.contentSize=CGSizeMake(width,0);
 UILabel*status=[self label:self.state[@"title"]?:@"直播" size:17 bold:YES];status.frame=CGRectMake(16,y,inner,27);self.liveStatusLabel=status;[self.content addSubview:status];y+=31;
 NSString*subtitle=[NSString stringWithFormat:@"%@ · %@",self.state[@"group"]?:@"请选择频道",self.state[@"status"]?:@""];
 UILabel*info=[self label:subtitle size:12 bold:NO];info.textColor=[self liveMuted];info.frame=CGRectMake(16,y,inner,23);self.liveInfoLabel=info;[self.content addSubview:info];y+=28;
 CGFloat third=(inner-12)/3.0;
 [self.content addSubview:[self button:@"⏮ 上一台" action:@"live-step" value:@"-1" frame:CGRectMake(12,y,third,36)]];
 [self.content addSubview:[self button:@"⏭ 下一台" action:@"live-step" value:@"1" frame:CGRectMake(18+third,y,third,36)]];
 [self.content addSubview:[self button:@"⛶ 画面比例" action:@"player-aspect" value:@"" frame:CGRectMake(24+third*2,y,third,36)]];y+=42;
 SYLiveActionButton*favorite=[self button:[self.state[@"favoriteCurrent"] boolValue]?@"♥ 已收藏":@"♡ 收藏当前频道" action:@"live-favorite-current" value:@"" frame:CGRectMake(12,y,inner*.48,38)];[self.content addSubview:favorite];
 [self.content addSubview:[self button:@"频道信息" action:@"live-channel-info" value:@"" frame:CGRectMake(20+inner*.48,y,inner*.48,38)]];y+=46;
 // Render active sheet right below the control bar so it is immediately visible without scrolling past all channels.
 NSString*sheet=self.state[@"sheet"]?:@"";
 NSDictionary*selectedProgram=self.state[@"selectedProgram"];
 if([sheet isEqualToString:@"channel"]){NSDictionary*detail=self.state[@"channelInfo"]?:@{};NSString*text=[NSString stringWithFormat:@"频道信息 · %@\nID %@ · 分组 %@\nEPG %@\n%@",detail[@"name"]?:@"",detail[@"tvgId"]?:@"",detail[@"group"]?:@"",detail[@"epgUrl"]?:@"",detail[@"url"]?:@""];UILabel*label=[self label:text size:12 bold:NO];label.frame=CGRectMake(16,y,inner,92);label.numberOfLines=4;[self.content addSubview:label];y+=96;[self addAction:@"关闭频道信息" action:@"live-sheet-dismiss" value:@"" y:y width:inner];y+=48;}
 else if([sheet isEqualToString:@"guide"]){[self addAction:[NSString stringWithFormat:@"节目单 %@ · 当前频道 %@",self.state[@"epgUrl"]?:@"未提供",self.state[@"title"]?:@"" ] action:@"live-sheet-dismiss" value:@"" y:y width:inner];y+=48;}
 else if([sheet isEqualToString:@"program"]&&[selectedProgram isKindOfClass:NSDictionary.class]){[self addAction:[NSString stringWithFormat:@"%@ · %@–%@",selectedProgram[@"title"]?:@"节目",selectedProgram[@"start"]?:@"",selectedProgram[@"stop"]?:@""] action:@"live-program-dismiss" value:@"" y:y width:inner];y+=48;}
 else if([sheet isEqualToString:@"route"]&&[self.state[@"selectedRoute"] isKindOfClass:NSDictionary.class]){NSDictionary*route=self.state[@"selectedRoute"];NSString*routeKind=[route[@"secure"] boolValue]?@"HTTPS":@"HTTP 未加密";[self addAction:[NSString stringWithFormat:@"切换到 %@ · %@ · %@",route[@"name"]?:@"线路",route[@"group"]?:@"",routeKind] action:@"live-route-system" value:@"" y:y width:inner];y+=48;[self addAction:@"在 VLC 播放" action:@"live-route-vlc" value:@"" y:y width:inner];y+=48;[self addAction:@"复制线路地址" action:@"live-route-copy" value:@"" y:y width:inner];y+=48;[self addAction:@"关闭线路菜单" action:@"live-sheet-dismiss" value:@"" y:y width:inner];y+=48;}
 self.urlField=[[UITextField alloc]initWithFrame:CGRectMake(12,y,inner-100,42)];self.urlField.text=self.state[@"url"]?:@"";self.urlField.placeholder=@"HTTP / HTTPS M3U 地址";self.urlField.font=[UIFont systemFontOfSize:13];self.urlField.textColor=[self liveInk];self.urlField.backgroundColor=[self liveSurface];self.urlField.borderStyle=3;self.urlField.layer.cornerRadius=11;self.urlField.clipsToBounds=YES;self.urlField.clearButtonMode=1;[self.content addSubview:self.urlField];
 NSString*importTitle=[self.state[@"loading"] boolValue]?@"导入中…":([self.state[@"channelCount"] integerValue]>0?@"手动更新":@"导入 M3U");SYLiveActionButton*import=[self button:importTitle action:@"live-import" value:@"" frame:CGRectMake(width-102,y,90,42)];[self.content addSubview:import];y+=46;
 UILabel*hint=[self label:@"导入后保存到本机；手动更新才重新下载。HTTP 未加密，建议优先使用 HTTPS。" size:11 bold:NO];hint.textColor=[self liveMuted];hint.frame=CGRectMake(16,y,inner,32);hint.numberOfLines=2;[self.content addSubview:hint];y+=36;
 NSArray*tabs=@[@[@"频道",@"channels"],@[@"分类",@"categories"],@[@"节目",@"programs"],@[@"线路",@"routes"]];CGFloat tabW=inner/4;for(NSUInteger i=0;i<tabs.count;i++){NSArray*tab=tabs[i];SYLiveActionButton*b=[self button:tab[0] action:@"live-panel" value:tab[1] frame:CGRectMake(12+i*tabW,y,tabW-4,38)];[self styleButton:b selected:[self.state[@"panel"] isEqualToString:tab[1]]];[self.content addSubview:b];}y+=48;
 panel=self.state[@"panel"]?:@"channels";NSArray*items=@[];NSString*action=@"";
 if([panel isEqualToString:@"categories"]){items=self.state[@"groups"]?:@[];action=@"live-category";}
 else if([panel isEqualToString:@"routes"]){items=self.state[@"routes"]?:@[];}
 else if([panel isEqualToString:@"programs"]){
  if(![self.state[@"hasEPG"] boolValue]){UILabel*empty=[self label:@"此播放列表没有提供节目单地址。" size:14 bold:NO];empty.frame=CGRectMake(16,y,inner,34);[self.content addSubview:empty];y+=40;}
  else {
  NSArray*days=self.state[@"days"]?:@[];NSUInteger shown=days.count<6?days.count:6;CGFloat dayWidth=inner/(shown?shown:1);
  for(NSUInteger i=0;i<shown;i++){NSString*day=days[i];NSString*titleText=day.length>=10?[day substringFromIndex:5]:day;SYLiveActionButton*date=[self button:titleText action:@"live-date" value:day frame:CGRectMake(12+i*dayWidth,y,dayWidth-4,36)];if([day isEqualToString:self.state[@"selectedDate"]]){UIColor*selectedColor=[self isDarkTheme]?[UIColor colorWithRed:.53 green:.88 blue:.80 alpha:1]:[UIColor systemBlueColor];date.backgroundColor=selectedColor;[date setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];}[self.content addSubview:date];}y+=42;
  [self addAction:[self.state[@"epgLoading"] boolValue]?@"正在刷新节目单…":@"刷新节目单" action:@"live-epg-refresh" value:@"" y:y width:inner];y+=48;
  if([self.state[@"hasEPG"] boolValue]){[self addAction:@"节目单来源与匹配详情" action:@"live-epg-info" value:@"" y:y width:inner];y+=48;}
  items=self.state[@"programs"]?:@[];
  }
 } else {
  if([panel isEqualToString:@"channels"]&&[self.state[@"channelCount"] integerValue]>0){NSString*category=self.state[@"categoryName"]?:@"全部频道";NSString*count=[NSString stringWithFormat:@"%ld 个频道",(long)[self.state[@"filteredChannelCount"] integerValue]];UILabel*heading=[self label:[NSString stringWithFormat:@"%@ · %@",category,count] size:14 bold:YES];heading.frame=CGRectMake(16,y,inner,24);[self.content addSubview:heading];y+=30;}
  self.searchField=[[UITextField alloc]initWithFrame:CGRectMake(12,y,inner-82,40)];self.searchField.placeholder=@"搜索频道名称、分组";self.searchField.text=self.state[@"search"]?:@"";self.searchField.font=[UIFont systemFontOfSize:14];self.searchField.textColor=[self liveInk];self.searchField.backgroundColor=[self liveSurface];self.searchField.borderStyle=3;[self.content addSubview:self.searchField];
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
   if([panel isEqualToString:@"categories"]){titleText=[NSString stringWithFormat:@"%@  ·  %@ 个频道",object[@"name"]?:@"分类",object[@"count"]?:@0];itemAction=@"live-category";value=object[@"value"]?:object[@"name"]?:@"";}
   else if([panel isEqualToString:@"routes"]){titleText=[NSString stringWithFormat:@"%@%@ · %@ · %@",[object[@"active"] boolValue]?@"✓ ":@"",object[@"name"]?:@"线路",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"HTTPS":@"HTTP 未加密"];itemAction=@"live-route";value=[object[@"index"] stringValue];}
   else if([panel isEqualToString:@"programs"]){titleText=[NSString stringWithFormat:@"%@  %@",object[@"start"]?:@"",object[@"title"]?:@"节目"];itemAction=@"live-program";value=[object[@"index"] stringValue];}
   else {titleText=[NSString stringWithFormat:@"%@  %@ · %@%@",[object[@"active"] boolValue]?@"▶":@"",object[@"name"]?:@"频道",object[@"group"]?:@"",[object[@"secure"] boolValue]?@"":@" · HTTP 未加密"];itemAction=@"live-channel";value=[object[@"index"] stringValue];}
  }else {titleText=[NSString stringWithFormat:@"%@  ·  %@ 个频道",object[@"name"]?:@"分类",object[@"count"]?:@0];value=object[@"value"]?:object[@"name"]?:@"";}
   if(itemAction.length){SYLiveActionButton*itemButton=[self addAction:titleText action:itemAction value:value y:y width:inner];if([itemAction isEqualToString:@"live-route"]||[itemAction isEqualToString:@"live-category"])[self styleButton:itemButton selected:[object[@"active"] boolValue]];}else {UILabel*label=[self label:titleText size:14 bold:NO];label.frame=CGRectMake(16,y+8,inner,26);[self.content addSubview:label];}
  y+=48;
 }
 if([panel isEqualToString:@"programs"]&&[selectedProgram isKindOfClass:NSDictionary.class]){UILabel*detail=[self label:[NSString stringWithFormat:@"%@ · %@–%@\n%@",selectedProgram[@"title"]?:@"",selectedProgram[@"start"]?:@"",selectedProgram[@"stop"]?:@"",selectedProgram[@"description"]?:selectedProgram[@"subtitle"]?:@""] size:14 bold:YES];detail.frame=CGRectMake(16,y+4,inner,80);detail.numberOfLines=3;[self.content addSubview:detail];y+=88;}
 if([self.state[@"hasMore"] boolValue]){[self addAction:@"加载更多频道" action:@"live-more" value:@"" y:y width:inner];y+=48;}
 CGFloat contentHeight=MAX(y+28,self.content.bounds.size.height+1);self.content.contentSize=CGSizeMake(width,contentHeight);CGFloat maxOffset=MAX(0,contentHeight-self.content.bounds.size.height);CGFloat offsetY=resetOffset?0:MIN(previousOffset.y,maxOffset);[self.content setContentOffset:CGPointMake(0,offsetY) animated:NO];
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
@implementation SYAppScreenController
- (NSString*)renderKeyForState:(NSDictionary*)state {
 NSString*page=state[@"page"]?:@"home",*key=[NSString stringWithFormat:@"%@:%@",page,state[@"site"]?:@""];
 if([page isEqualToString:@"me"])key=[key stringByAppendingFormat:@":%@",state[@"meTab"]?:@"favorites"];
 else if([page isEqualToString:@"saved"])key=[key stringByAppendingFormat:@":%@",state[@"savedTab"]?:@"favorites"];
 else if([page isEqualToString:@"browse"])key=[key stringByAppendingFormat:@":%@:%@",state[@"title"]?:@"",state[@"selectedFilters"]?:@{}];
 else if([page isEqualToString:@"search"])key=[key stringByAppendingFormat:@":%@",state[@"query"]?:@""];
 else if([page isEqualToString:@"discover"])key=[key stringByAppendingFormat:@":%@:%@:%@",state[@"discoverTab"]?:@0,state[@"discoverYear"]?:@0,state[@"discoverMonth"]?:@0];
 else if([page isEqualToString:@"collection"])key=[key stringByAppendingFormat:@":%@:%@",state[@"title"]?:@"",state[@"stackDepth"]?:@0];
 else if([page isEqualToString:@"detail"])key=[key stringByAppendingFormat:@":%@",state[@"movie"][@"id"]?:@""];
 return key;
}
- (BOOL)isAppDarkTheme {return [self.state[@"theme"] isEqualToString:@"black"]; }
- (UIColor*)ink {return [self isAppDarkTheme]?[UIColor colorWithRed:.95 green:.97 blue:.96 alpha:1]:[UIColor colorWithRed:.09 green:.12 blue:.18 alpha:1];}
- (UIColor*)muted {return [self isAppDarkTheme]?[UIColor colorWithRed:.65 green:.73 blue:.71 alpha:1]:[UIColor colorWithRed:.42 green:.46 blue:.54 alpha:1];}
- (UIColor*)accent {return [self isAppDarkTheme]?[UIColor colorWithRed:.45 green:.90 blue:.79 alpha:1]:[UIColor colorWithRed:.15 green:.45 blue:.94 alpha:1];}
- (UIColor*)surface {return [self isAppDarkTheme]?[UIColor colorWithRed:.07 green:.11 blue:.14 alpha:1]:UIColor.whiteColor;}
- (UILabel*)label:(NSString*)text size:(CGFloat)size bold:(BOOL)bold color:(UIColor*)color {UILabel*l=[UILabel new];l.text=text?:@"";l.textColor=color?:[self ink];l.font=bold?[UIFont boldSystemFontOfSize:size]:[UIFont systemFontOfSize:size];l.numberOfLines=0;return l;}
- (SYLiveActionButton*)button:(NSString*)title action:(NSString*)action payload:(NSDictionary*)payload {SYLiveActionButton*b=[SYLiveActionButton buttonWithType:UIButtonTypeSystem];b.action=action;b.payload=payload?:@{};b.backgroundColor=[self surface];b.layer.cornerRadius=16;b.layer.borderWidth=.5;b.layer.borderColor=[UIColor colorWithRed:.55 green:.68 blue:.63 alpha:[self isAppDarkTheme]?.22:.09].CGColor;b.contentEdgeInsets=UIEdgeInsetsMake(8,12,8,12);b.titleLabel.font=[UIFont systemFontOfSize:14 weight:UIFontWeightMedium];b.titleLabel.lineBreakMode=NSLineBreakByTruncatingTail;[b setTitle:title forState:UIControlStateNormal];[b setTitleColor:[self ink] forState:UIControlStateNormal];[b addTarget:self action:@selector(actionPressed:) forControlEvents:UIControlEventTouchUpInside];return b;}
- (void)actionPressed:(SYLiveActionButton*)sender {if([sender.action isEqualToString:@"search-submit"]){[self.owner sendPageAction:sender.action payload:@{@"query":self.searchField.text?:@""}];return;}if([sender.action isEqualToString:@"login-submit"]){[self.owner sendPageAction:sender.action payload:@{@"account":self.accountField.text?:@"",@"password":self.passwordField.text?:@""}];return;}[self.owner sendPageAction:sender.action payload:sender.payload?:@{}];}
- (void)viewDidLoad {[super viewDidLoad];self.view.backgroundColor=[UIColor colorWithRed:.953 green:.961 blue:.980 alpha:1];self.topBar=[UIView new];self.topBar.backgroundColor=self.view.backgroundColor;[self.view addSubview:self.topBar];self.titleLabel=[self label:@"三源影视" size:20 bold:YES color:[self ink]];[self.topBar addSubview:self.titleLabel];self.content=[UIScrollView new];self.content.delegate=self;self.content.alwaysBounceVertical=YES;self.content.showsVerticalScrollIndicator=NO;self.content.backgroundColor=self.view.backgroundColor;[self.view addSubview:self.content];self.playerHost=[UIView new];self.playerHost.backgroundColor=UIColor.blackColor;self.playerHost.clipsToBounds=YES;self.playerHost.layer.cornerRadius=14;self.playerHost.hidden=YES;[self.view addSubview:self.playerHost];self.bottomBar=[UIView new];self.bottomBar.backgroundColor=UIColor.whiteColor;self.bottomBar.layer.cornerRadius=32;self.bottomBar.layer.borderWidth=.5;self.bottomBar.layer.shadowColor=[UIColor colorWithRed:.08 green:.14 blue:.24 alpha:1].CGColor;self.bottomBar.layer.shadowOpacity=.14;self.bottomBar.layer.shadowRadius=20;self.bottomBar.layer.shadowOffset=CGSizeMake(0,6);[self.view addSubview:self.bottomBar];}
- (void)viewDidLayoutSubviews {[super viewDidLayoutSubviews];CGFloat w=self.view.bounds.size.width,h=self.view.bounds.size.height,top=self.view.safeAreaInsets.top;self.topBar.frame=CGRectMake(0,top,w,54);self.titleLabel.frame=CGRectMake(20,5,w-40,35);BOOL detail=[self.state[@"page"] isEqualToString:@"detail"],live=[self.state[@"page"] isEqualToString:@"live"],playing=[self.state[@"playURLs"] count]>0||self.owner.nativePlayer!=nil;self.playerHost.hidden=!(detail&&playing);CGFloat pH=MIN(w*9.0/16.0,245),pY=top+54;if(!self.playerHost.hidden)self.playerHost.frame=CGRectMake(0,pY,w,pH);CGFloat navH=68,navY=h-self.view.safeAreaInsets.bottom-navH-8;self.bottomBar.hidden=detail||[self.state[@"page"] isEqualToString:@"collection"];self.bottomBar.frame=CGRectMake(14,navY,w-28,navH);CGFloat cY=self.playerHost.hidden?top+54:pY+pH,contentBottom=h-self.view.safeAreaInsets.bottom;self.content.frame=CGRectMake(0,cY,w,MAX(0,contentBottom-cY));self.content.contentInset=UIEdgeInsetsMake(0,0,self.bottomBar.hidden?20:(navH+18),0);self.content.hidden=live;if(live&&self.owner.liveScreen){UIView*liveView=self.owner.liveScreen.view;liveView.frame=CGRectMake(0,top+54,w,MAX(0,navY-top-54));[liveView setNeedsLayout];[liveView layoutIfNeeded];[self.view bringSubviewToFront:liveView];}[self.view bringSubviewToFront:self.topBar];[self.view bringSubviewToFront:self.playerHost];[self.view bringSubviewToFront:self.bottomBar];if(!self.content.hidden)for(UIView*view in self.content.subviews)if([view isKindOfClass:UIScrollView.class]&&view.tag==9301)[self loadVisiblePostersInShelf:(UIScrollView*)view];}
- (UIButton*)addButton:(NSString*)title action:(NSString*)action data:(NSDictionary*)data y:(CGFloat)y height:(CGFloat)height {CGFloat w=self.view.bounds.size.width;SYLiveActionButton*b=[self button:title action:action payload:data];b.frame=CGRectMake(16,y,w-32,height);[self.content addSubview:b];return b;}
- (void)addHeading:(NSString*)title y:(CGFloat)y {UILabel*l=[self label:title size:19 bold:YES color:[self ink]];l.frame=CGRectMake(18,y,self.view.bounds.size.width-36,28);[self.content addSubview:l];}
- (void)addMoreRoute:(NSDictionary*)route title:(NSString*)title y:(CGFloat)y {if(![route isKindOfClass:NSDictionary.class]||![route[@"url"] isKindOfClass:NSString.class])return;CGFloat w=self.view.bounds.size.width;SYLiveActionButton*b=[self button:@"更多 ›" action:@"collection-link" payload:@{@"route":route[@"url"],@"title":title?:@"专题"}];b.frame=CGRectMake(w-86,y,72,30);b.backgroundColor=UIColor.clearColor;b.layer.borderWidth=0;b.titleLabel.font=[UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];[b setTitleColor:[self accent] forState:UIControlStateNormal];[self.content addSubview:b];}
- (CGFloat)addDataLinesAtY:(CGFloat)y {id config=self.state[@"config"];NSDictionary*urls=[config isKindOfClass:NSDictionary.class]?config[@"urls"]:nil;NSDictionary*preferred=[self.state[@"preferred"] isKindOfClass:NSDictionary.class]?self.state[@"preferred"]:@{};NSArray*healthList=[self.state[@"health"] isKindOfClass:NSArray.class]?self.state[@"health"]:@[];[self addButton:@"⚡ 一键检测节点延迟" action:@"probe-lines" data:@{} y:y height:40];y+=48;for(NSString*kind in @[@"cache",@"logic"]){NSArray*list=urls[kind];if(![list isKindOfClass:NSArray.class])continue;[self addHeading:[kind isEqualToString:@"cache"]?@"片库数据线路":@"搜索与账户线路" y:y];y+=32;NSUInteger count=0;for(NSString*address in list){NSURL*u=[NSURL URLWithString:address];if(![u.scheme.lowercaseString isEqualToString:@"https"]||!u.host.length||count>=5)continue;BOOL isPref=[preferred[kind] isKindOfClass:NSString.class]&&[preferred[kind] isEqualToString:address];NSDictionary*healthEntry=nil;for(NSDictionary*h in healthList)if([h isKindOfClass:NSDictionary.class]&&[h[@"url"] isEqualToString:address]&&[h[@"kind"] isEqualToString:kind]){healthEntry=h;break;}NSString*statusText=isPref?@"★ 优先 · ":(healthEntry?([healthEntry[@"ok"] boolValue]?[NSString stringWithFormat:@"● %@ms · ",healthEntry[@"ms"]?:@0]:@"✕ 不可用 · "):@"");SYLiveActionButton*b=[self button:[NSString stringWithFormat:@"%@%@",statusText,u.host] action:@"prefer-line" payload:@{@"kind":kind,@"url":address}];b.frame=CGRectMake(16,y,self.view.bounds.size.width-32,38);[self.content addSubview:b];y+=44;count++;}}return y;}
- (void)loadPosters:(NSArray*)addresses into:(UIImageView*)imageView {
 if(!imageView)return;
 NSMutableArray*valid=[NSMutableArray array];for(id value in [addresses isKindOfClass:NSArray.class]?addresses:@[]){if(![value isKindOfClass:NSString.class])continue;NSURL*url=[NSURL URLWithString:value];if([url.scheme.lowercaseString isEqualToString:@"https"]&&url.host.length&&![valid containsObject:value])[valid addObject:value];if(valid.count>=12)break;}
 NSString*urlKey=[valid componentsJoinedByString:@"\n"];NSString*referer=[imageView.accessibilityHint isKindOfClass:NSString.class]&&imageView.accessibilityHint.length?imageView.accessibilityHint:([self.state[@"posterReferer"] isKindOfClass:NSString.class]?self.state[@"posterReferer"]:@"");NSString*key=[NSString stringWithFormat:@"%@\n%@",referer,urlKey];imageView.accessibilityIdentifier=urlKey;
 if(!urlKey.length){imageView.image=nil;return;}
 if(!SYPosterImageCache)SYPosterImageCache=[NSMutableDictionary dictionary];
 if(!SYPosterRequests)SYPosterRequests=[NSMutableDictionary dictionary];
 if(!SYPosterImageOrder)SYPosterImageOrder=[NSMutableArray array];
 UIImage*cached=SYPosterImageCache[key];if(cached){[SYPosterImageOrder removeObject:key];[SYPosterImageOrder addObject:key];imageView.image=cached;return;}
 NSMutableArray*subscribers=SYPosterRequests[key];if(subscribers){if(![subscribers containsObject:imageView])[subscribers addObject:imageView];return;}subscribers=[NSMutableArray array];[subscribers addObject:imageView];SYPosterRequests[key]=subscribers;
 NSArray*assetKeys=objc_getAssociatedObject(imageView,&SYPosterAssetKeys);if(![assetKeys isKindOfClass:NSArray.class])assetKeys=@[];
 if(!SYPosterLoadQueue){SYPosterLoadQueue=[NSOperationQueue new];SYPosterLoadQueue.name=@"com.joeshu.sanyuan.poster-load";SYPosterLoadQueue.maxConcurrentOperationCount=4;SYPosterLoadQueue.qualityOfService=NSQualityOfServiceUserInitiated;}
 NSArray*urls=[valid copy],*keys=[assetKeys copy];
 [SYPosterLoadQueue addOperationWithBlock:^{
  __block UIImage*poster=nil;
  for(NSUInteger start=0;start<urls.count&&!poster;start+=3){NSUInteger end=MIN(start+3,urls.count);dispatch_group_t group=dispatch_group_create();dispatch_semaphore_t done=dispatch_semaphore_create(0);NSLock*lock=[NSLock new];__block UIImage*roundPoster=nil;NSMutableArray<NSURLSessionDataTask*>*tasks=[NSMutableArray array];
   for(NSUInteger index=start;index<end;index++){NSURL*url=[NSURL URLWithString:urls[index]];NSMutableURLRequest*request=[NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:8];[request setValue:@"image/webp,image/apng,image/png,image/jpeg,image/*,*/*;q=0.8" forHTTPHeaderField:@"Accept"];[request setValue:@"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" forHTTPHeaderField:@"User-Agent"];if(referer.length)[request setValue:referer forHTTPHeaderField:@"Referer"];NSUInteger preferredIndex=index+1;dispatch_group_enter(group);NSURLSessionDataTask*task=[self.owner.session dataTaskWithRequest:request completionHandler:^(NSData*data,NSURLResponse*response,NSError*error){NSInteger status=[response isKindOfClass:NSHTTPURLResponse.class]?((NSHTTPURLResponse*)response).statusCode:0;UIImage*candidate=nil;if(!error&&status>=200&&status<300)candidate=SYPosterImage(data,keys,preferredIndex);[lock lock];if(candidate&&!roundPoster){roundPoster=candidate;dispatch_semaphore_signal(done);}[lock unlock];dispatch_group_leave(group);}];[tasks addObject:task];[task resume];}
   dispatch_group_notify(group,dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{dispatch_semaphore_signal(done);});dispatch_semaphore_wait(done,dispatch_time(DISPATCH_TIME_NOW,(int64_t)(9*NSEC_PER_SEC)));[lock lock];poster=roundPoster;[lock unlock];for(NSURLSessionDataTask*task in tasks)if(task.state==NSURLSessionTaskStateRunning)[task cancel];
  }
  if(poster&&(poster.size.width>540||poster.size.height>720)){CGFloat scale=MIN(540.0/poster.size.width,720.0/poster.size.height);CGSize size=CGSizeMake(poster.size.width*scale,poster.size.height*scale);UIGraphicsBeginImageContextWithOptions(size,NO,1);[poster drawInRect:CGRectMake(0,0,size.width,size.height)];UIImage*thumbnail=UIGraphicsGetImageFromCurrentImageContext();UIGraphicsEndImageContext();if(thumbnail)poster=thumbnail;}
  dispatch_async(SYMainQueue(),^{NSArray*waiting=SYPosterRequests[key];[SYPosterRequests removeObjectForKey:key];if(poster){while(SYPosterImageCache.count>=64&&SYPosterImageOrder.count){NSString*oldest=SYPosterImageOrder.firstObject;[SYPosterImageOrder removeObjectAtIndex:0];[SYPosterImageCache removeObjectForKey:oldest];}SYPosterImageCache[key]=poster;[SYPosterImageOrder removeObject:key];[SYPosterImageOrder addObject:key];for(UIImageView*target in waiting)if([[target.accessibilityHint stringByAppendingFormat:@"\n%@",target.accessibilityIdentifier] isEqualToString:key]||(!target.accessibilityHint.length&&[[self.state[@"posterReferer"] stringByAppendingFormat:@"\n%@",target.accessibilityIdentifier] isEqualToString:key]))target.image=poster;}});
 }];
}
- (void)setPosterAssetKeys:(UIImageView*)imageView forMovie:(NSDictionary*)movie {
 if(!imageView)return;NSString*source=[movie[@"source"] isKindOfClass:NSString.class]?movie[@"source"]:self.state[@"site"];
 NSDictionary*keyMap=[self.state[@"posterKeysBySite"] isKindOfClass:NSDictionary.class]?self.state[@"posterKeysBySite"]:@{};NSArray*keys=[keyMap[source] isKindOfClass:NSArray.class]?keyMap[source]:@[];
 objc_setAssociatedObject(imageView,&SYPosterAssetKeys,keys,OBJC_ASSOCIATION_COPY_NONATOMIC);
}
- (void)loadVisiblePostersInShelf:(UIScrollView*)shelf {
 if(!shelf||shelf.tag!=9301)return;
 CGRect shelfRect=[shelf convertRect:shelf.bounds toView:self.content];CGFloat top=self.content.contentOffset.y,bottom=top+self.content.bounds.size.height;
 if(shelfRect.origin.y+shelfRect.size.height<top||shelfRect.origin.y>bottom)return;
 CGFloat left=MAX(0,shelf.contentOffset.x-124),right=shelf.contentOffset.x+shelf.bounds.size.width+124;
 for(UIView*card in shelf.subviews){CGRect cardRect=[card convertRect:card.bounds toView:self.content];if(CGRectGetMaxY(cardRect)<top-180||CGRectGetMinY(cardRect)>bottom+180||CGRectGetMaxX(card.frame)<left||CGRectGetMinX(card.frame)>right)continue;for(UIView*child in card.subviews)if([child isKindOfClass:UIImageView.class]){UIImageView*poster=(UIImageView*)child;if(!poster.image&&poster.accessibilityIdentifier.length)[self loadPosters:[poster.accessibilityIdentifier componentsSeparatedByString:@"\n"] into:poster];}}
}
- (void)scrollViewDidScroll:(UIScrollView*)scrollView {if(scrollView.tag==9301)[self loadVisiblePostersInShelf:scrollView];else if(scrollView==self.content)for(UIView*view in self.content.subviews)if([view isKindOfClass:UIScrollView.class]&&view.tag==9301)[self loadVisiblePostersInShelf:(UIScrollView*)view];}
- (CGFloat)addHeroPickerAtY:(CGFloat)y {
 NSArray*picks=[self.state[@"picks"] isKindOfClass:NSArray.class]?self.state[@"picks"]:@[];if(picks.count<2)return 0;
 CGFloat w=self.view.bounds.size.width,buttonWidth=30,gap=6,total=picks.count*buttonWidth+(picks.count-1)*gap,x=MAX(16,(w-total)/2);
 NSUInteger selected=[self.state[@"heroIndex"] respondsToSelector:@selector(unsignedIntegerValue)]?[self.state[@"heroIndex"] unsignedIntegerValue]%picks.count:0;
 NSMutableArray*buttons=[NSMutableArray arrayWithCapacity:picks.count];
 for(NSUInteger index=0;index<picks.count;index++){
  NSDictionary*item=[picks[index] isKindOfClass:NSDictionary.class]?picks[index]:@{};NSString*title=item[@"title"]?:[NSString stringWithFormat:@"推荐%lu",(unsigned long)index+1];
  SYLiveActionButton*b=[self button:index==selected?@"●":@"○" action:@"hero-pick" payload:@{@"id":@(index)}];b.frame=CGRectMake(x+index*(buttonWidth+gap),y,buttonWidth,32);b.backgroundColor=UIColor.clearColor;b.layer.borderWidth=0;b.titleLabel.font=[UIFont systemFontOfSize:index==selected?13:11 weight:UIFontWeightSemibold];[b setTitleColor:index==selected?[self accent]:[self muted] forState:UIControlStateNormal];b.accessibilityLabel=[NSString stringWithFormat:@"推荐%lu：%@",(unsigned long)index+1,title];if(index==selected)b.accessibilityTraits|=UIAccessibilityTraitSelected;[self.content addSubview:b];[buttons addObject:b];
 }
 self.heroPickerButtons=buttons;
 return 38;
}
- (void)addHeroCard:(NSDictionary*)movie y:(CGFloat)y {
 CGFloat width=self.view.bounds.size.width-32;NSDictionary*payload=@{@"id":movie[@"id"]?:@"",@"source":movie[@"source"]?:self.state[@"site"]?:@""};SYLiveActionButton*card=[self button:@"" action:@"detail" payload:payload];card.frame=CGRectMake(16,y,width,208);card.layer.cornerRadius=22;card.clipsToBounds=YES;card.backgroundColor=[UIColor colorWithRed:.12 green:.18 blue:.26 alpha:1];[self.content addSubview:card];
 self.heroCard=card;
 UIImageView*poster=[[UIImageView alloc]initWithFrame:card.bounds];poster.contentMode=UIViewContentModeScaleAspectFill;poster.clipsToBounds=YES;poster.userInteractionEnabled=NO;poster.accessibilityHint=movie[@"imageReferer"]?:@"";[self setPosterAssetKeys:poster forMovie:movie];[card addSubview:poster];[card sendSubviewToBack:poster];self.heroPoster=poster;NSArray*urls=movie[@"imageURLs"];[self loadPosters:urls into:poster];
 UIView*shade=[[UIView alloc]initWithFrame:CGRectMake(0,118,width,90)];shade.backgroundColor=[UIColor colorWithRed:.03 green:.06 blue:.10 alpha:.76];shade.userInteractionEnabled=NO;[card addSubview:shade];
 UILabel*kicker=[self label:[NSString stringWithFormat:@"✦ 今日精选 · %@",self.state[@"siteName"]?:@"三源"] size:10 bold:YES color:[UIColor colorWithRed:.55 green:.92 blue:.82 alpha:1]];kicker.frame=CGRectMake(16,124,width-32,16);kicker.userInteractionEnabled=NO;[card addSubview:kicker];
 UILabel*title=[self label:[NSString stringWithFormat:@"▶  %@",movie[@"title"]?:@"今日精选"] size:20 bold:YES color:UIColor.whiteColor];title.frame=CGRectMake(16,142,width-32,28);title.adjustsFontSizeToFitWidth=YES;title.minimumScaleFactor=.76;title.lineBreakMode=NSLineBreakByTruncatingTail;title.userInteractionEnabled=NO;[card addSubview:title];self.heroTitleLabel=title;
 UILabel*subtitle=[self label:movie[@"subtitle"]?:movie[@"metadata"]?:@"立即查看选集与高清线路" size:12 bold:NO color:[UIColor colorWithRed:.88 green:.92 blue:.96 alpha:1]];subtitle.frame=CGRectMake(16,172,width-32,20);subtitle.adjustsFontSizeToFitWidth=YES;subtitle.minimumScaleFactor=.72;subtitle.lineBreakMode=NSLineBreakByTruncatingTail;subtitle.userInteractionEnabled=NO;[card addSubview:subtitle];self.heroSubtitleLabel=subtitle;
 NSString*badgeText=[movie[@"badge"] isKindOfClass:NSString.class]?movie[@"badge"]:@"";UILabel*badge=[self label:badgeText size:11 bold:YES color:[UIColor colorWithRed:.97 green:.82 blue:.54 alpha:1]];badge.frame=CGRectMake(width-82,14,68,24);badge.textAlignment=NSTextAlignmentCenter;badge.backgroundColor=[UIColor colorWithRed:.05 green:.09 blue:.14 alpha:.78];badge.layer.cornerRadius=8;badge.clipsToBounds=YES;badge.hidden=!badgeText.length;badge.userInteractionEnabled=NO;[card addSubview:badge];self.heroBadgeLabel=badge;
}
- (void)addFeaturePoster:(NSDictionary*)movie y:(CGFloat)y {CGFloat w=self.view.bounds.size.width-32;UIView*box=[[UIView alloc]initWithFrame:CGRectMake(16,y,w,256)];box.backgroundColor=[UIColor colorWithRed:.11 green:.18 blue:.22 alpha:1];box.layer.cornerRadius=22;box.clipsToBounds=YES;[self.content addSubview:box];UIImageView*image=[[UIImageView alloc]initWithFrame:box.bounds];image.contentMode=UIViewContentModeScaleAspectFill;image.clipsToBounds=YES;image.accessibilityHint=movie[@"imageReferer"]?:@"";[self setPosterAssetKeys:image forMovie:movie];[box addSubview:image];NSArray*urls=[movie[@"imageURLs"] isKindOfClass:NSArray.class]?movie[@"imageURLs"]:@[];[self loadPosters:urls into:image];UIView*shade=[[UIView alloc]initWithFrame:CGRectMake(0,148,w,108)];shade.backgroundColor=[UIColor colorWithRed:.03 green:.06 blue:.08 alpha:.76];[box addSubview:shade];UILabel*name=[self label:movie[@"title"]?:@"影片" size:24 bold:YES color:UIColor.whiteColor];name.frame=CGRectMake(16,162,w-32,34);name.shadowColor=[UIColor blackColor];name.shadowOffset=CGSizeMake(0,1);[box addSubview:name];UILabel*meta=[self label:movie[@"metadata"]?:@"" size:12 bold:NO color:[UIColor colorWithRed:.85 green:.91 blue:.90 alpha:1]];meta.frame=CGRectMake(16,198,w-32,20);[box addSubview:meta];if([movie[@"badge"] length]){UILabel*badge=[self label:movie[@"badge"] size:11 bold:YES color:[UIColor colorWithRed:.55 green:.92 blue:.82 alpha:1]];badge.frame=CGRectMake(16,222,w-32,18);[box addSubview:badge];}}
- (NSUInteger)shelfColumnCount {NSUInteger columns=[self.state[@"columns"] respondsToSelector:@selector(integerValue)]?[self.state[@"columns"] integerValue]:3;return MIN(6,MAX(3,columns));}
- (SYLiveActionButton*)shelfCardForMovie:(NSDictionary*)movie frame:(CGRect)frame cardWidth:(CGFloat)cardWidth posterHeight:(CGFloat)posterHeight {
 id routeValue=movie[@"route"];NSDictionary*route=[routeValue isKindOfClass:NSDictionary.class]?routeValue:nil;NSString*routeURL=route?[route[@"url"] isKindOfClass:NSString.class]?route[@"url"]:@"":@"";
 NSDictionary*p=@{@"id":movie[@"id"]?:@"",@"source":movie[@"source"]?:self.state[@"site"]?:@"",@"title":movie[@"title"]?:@"",@"route":routeURL};
 SYLiveActionButton*b=[self button:@"" action:route?@"collection-link":@"detail" payload:p];b.frame=frame;b.clipsToBounds=YES;b.layer.cornerRadius=12;b.backgroundColor=[self surface];
 UIImageView*poster=[[UIImageView alloc]initWithFrame:CGRectMake(0,0,cardWidth,posterHeight)];poster.backgroundColor=[self isAppDarkTheme]?[UIColor colorWithRed:.12 green:.18 blue:.22 alpha:1]:[UIColor colorWithRed:.88 green:.91 blue:.95 alpha:1];poster.contentMode=UIViewContentModeScaleAspectFill;poster.clipsToBounds=YES;poster.accessibilityHint=movie[@"imageReferer"]?:@"";[self setPosterAssetKeys:poster forMovie:movie];NSArray*urls=[movie[@"imageURLs"] isKindOfClass:NSArray.class]?movie[@"imageURLs"]:@[];poster.accessibilityIdentifier=[urls componentsJoinedByString:@"\n"];[b addSubview:poster];
 NSString*badgeText=[movie[@"badge"] isKindOfClass:NSString.class]?movie[@"badge"]:@"";if(badgeText.length){UILabel*badge=[self label:badgeText size:9 bold:YES color:[UIColor colorWithRed:.97 green:.82 blue:.54 alpha:1]];CGFloat bw=MIN(cardWidth-10,MAX(32,badgeText.length*9+10));badge.frame=CGRectMake(cardWidth-bw-5,5,bw,18);badge.textAlignment=NSTextAlignmentCenter;badge.backgroundColor=[UIColor colorWithRed:.05 green:.09 blue:.14 alpha:.78];badge.layer.cornerRadius=5;badge.clipsToBounds=YES;[b addSubview:badge];}
 CGFloat titleFont=MIN(12,MAX(8,cardWidth*.105)),subtitleFont=MIN(10,MAX(7,cardWidth*.085));UILabel*n=[self label:movie[@"title"]?:@"影片" size:titleFont bold:YES color:[self ink]];n.frame=CGRectMake(6,posterHeight+4,cardWidth-12,17);n.numberOfLines=1;n.lineBreakMode=NSLineBreakByTruncatingTail;[b addSubview:n];
 UILabel*s=[self label:movie[@"subtitle"]?:@"" size:subtitleFont bold:NO color:[self muted]];s.frame=CGRectMake(6,posterHeight+22,cardWidth-12,14);s.numberOfLines=1;s.lineBreakMode=NSLineBreakByTruncatingTail;[b addSubview:s];
 return b;
}
- (CGFloat)addShelf:(NSArray*)items title:(NSString*)title y:(CGFloat)y {
 if(![items isKindOfClass:NSArray.class]||!items.count)return 0;
 CGFloat w=self.view.bounds.size.width;NSUInteger columns=[self shelfColumnCount];CGFloat gap=10,cardWidth=(w-32-gap*(columns-1))/columns,posterHeight=cardWidth*1.43,cardHeight=posterHeight+40,rowGap=14;NSUInteger rows=(items.count+columns-1)/columns;CGFloat gridHeight=rows*cardHeight+(rows-1)*rowGap;
 NSString*heading=[NSString stringWithFormat:@"%@ · %lu部",title,(unsigned long)items.count];[self addHeading:heading y:y];CGFloat gridY=y+36;
 UIScrollView*grid=[[UIScrollView alloc]initWithFrame:CGRectMake(0,gridY,w,gridHeight)];grid.tag=9301;grid.delegate=self;grid.scrollEnabled=NO;grid.bounces=NO;grid.clipsToBounds=YES;grid.showsHorizontalScrollIndicator=NO;[self.content addSubview:grid];
 for(NSUInteger index=0;index<items.count;index++){
  NSDictionary*m=items[index];NSUInteger column=index%columns,rowIndex=index/columns;CGFloat x=16+column*(cardWidth+gap),cardY=rowIndex*(cardHeight+rowGap);
  SYLiveActionButton*b=[self shelfCardForMovie:m frame:CGRectMake(x,cardY,cardWidth,cardHeight) cardWidth:cardWidth posterHeight:posterHeight];[grid addSubview:b];
 }
 grid.contentSize=CGSizeMake(w,gridHeight);self.content.contentSize=CGSizeMake(w,MAX(self.content.contentSize.height,gridY+gridHeight));[self loadVisiblePostersInShelf:grid];return 36+gridHeight;
}
- (void)addChips:(NSArray*)items action:(NSString*)action key:(NSString*)key selected:(NSString*)selected y:(CGFloat)y {if(![items isKindOfClass:NSArray.class]||!items.count)return;CGFloat w=self.view.bounds.size.width;UIScrollView*row=[[UIScrollView alloc]initWithFrame:CGRectMake(0,y,w,44)];row.showsHorizontalScrollIndicator=NO;row.showsVerticalScrollIndicator=NO;row.bounces=NO;row.clipsToBounds=YES;row.directionalLockEnabled=YES;[self.content addSubview:row];CGFloat x=15;for(id item in items){NSDictionary*o=[item isKindOfClass:NSDictionary.class]?item:@{@"id":item?:@"",@"name":[item isKindOfClass:NSString.class]?item:([item description]?:@"")};NSString*t=[o[@"name"] isKindOfClass:NSString.class]?o[@"name"]:@"";id raw=o[@"id"]?:o[@"index"]?:@"";NSString*v=[raw respondsToSelector:@selector(stringValue)]?[raw stringValue]:[raw description];NSMutableDictionary*d=[NSMutableDictionary dictionaryWithObject:v?:@"" forKey:@"id"];if([action isEqualToString:@"filter-option"])d[@"key"]=[o[@"key"] isKindOfClass:NSString.class]?o[@"key"]:@"";SYLiveActionButton*b=[self button:t action:action payload:d];CGFloat bw=[action isEqualToString:@"source"]?MAX(92,t.length*16+38):MAX(84,t.length*16+28);b.frame=CGRectMake(x,3,bw,36);b.layer.cornerRadius=19;if([v isEqualToString:selected]){b.backgroundColor=[[self accent] colorWithAlphaComponent:.15];[b setTitleColor:[self accent] forState:UIControlStateNormal];}[row addSubview:b];x+=bw+6;}row.contentSize=CGSizeMake(x,w);}
- (BOOL)appendMoviePageFromState:(NSDictionary*)oldState toState:(NSDictionary*)nextState {
 NSString*page=nextState[@"page"];BOOL listPage=[@[@"browse",@"search"] containsObject:page],singleCollection=[page isEqualToString:@"collection"]&&[oldState[@"stackDepth"] isEqual:nextState[@"stackDepth"]]&&[oldState[@"groups"] count]==1&&[nextState[@"groups"] count]==1;if((!listPage&&!singleCollection)||![oldState[@"page"] isEqualToString:page]||![oldState[@"site"] isEqual:nextState[@"site"]]||![oldState[@"title"] isEqual:nextState[@"title"]]||![oldState[@"query"] isEqual:nextState[@"query"]]||![oldState[@"selectedFilters"] isEqual:nextState[@"selectedFilters"]]||![oldState[@"columns"] isEqual:nextState[@"columns"]]||![oldState[@"next"] length]||[nextState[@"loading"] boolValue]||[nextState[@"error"] length])return NO;
 NSArray*oldItems=oldState[@"items"],*newItems=nextState[@"items"];if(![oldItems isKindOfClass:NSArray.class]||![newItems isKindOfClass:NSArray.class]||newItems.count<=oldItems.count)return NO;
 for(NSUInteger i=0;i<oldItems.count;i++)if(![oldItems[i][@"id"] isEqual:newItems[i][@"id"]])return NO;
 UIScrollView*grid=nil;for(UIView*view in self.content.subviews)if([view isKindOfClass:UIScrollView.class]&&view.tag==9301){grid=(UIScrollView*)view;break;}if(!grid)return NO;
 self.state=nextState;CGFloat w=self.view.bounds.size.width;NSUInteger columns=[self shelfColumnCount];CGFloat gap=10,cardWidth=(w-32-gap*(columns-1))/columns,posterHeight=cardWidth*1.43,cardHeight=posterHeight+40,rowGap=14;NSUInteger newRows=(newItems.count+columns-1)/columns;CGFloat oldHeight=grid.frame.size.height,newHeight=newRows*cardHeight+(newRows?((newRows-1)*rowGap):0),delta=MAX(0,newHeight-oldHeight);
 for(NSUInteger index=oldItems.count;index<newItems.count;index++){
  NSDictionary*m=newItems[index];NSUInteger column=index%columns,rowIndex=index/columns;CGFloat x=16+column*(cardWidth+gap),cardY=rowIndex*(cardHeight+rowGap);SYLiveActionButton*b=[self shelfCardForMovie:m frame:CGRectMake(x,cardY,cardWidth,cardHeight) cardWidth:cardWidth posterHeight:posterHeight];[grid addSubview:b];
 }
 grid.frame=CGRectMake(grid.frame.origin.x,grid.frame.origin.y,w,newHeight);grid.contentSize=CGSizeMake(w,newHeight);if(delta>0)for(UIView*view in self.content.subviews)if(view!=grid&&CGRectGetMinY(view.frame)>=CGRectGetMaxY(grid.frame)-delta-1)view.frame=CGRectOffset(view.frame,0,delta);
 for(UIView*view in self.content.subviews)if([view isKindOfClass:UILabel.class]){UILabel*label=(UILabel*)view;if(CGRectGetMaxY(label.frame)<=CGRectGetMinY(grid.frame)&&[label.text containsString:@"部"]){NSString*title=label.text;NSRange range=[title rangeOfString:@" · "];if(range.location!=NSNotFound)label.text=[NSString stringWithFormat:@"%@ · %lu部",[title substringToIndex:range.location],(unsigned long)newItems.count];}}
 SYLiveActionButton*more=nil;for(UIView*view in self.content.subviews)if([view isKindOfClass:SYLiveActionButton.class]&&[((SYLiveActionButton*)view).action isEqualToString:@"more"]){more=(SYLiveActionButton*)view;break;}
 if(![nextState[@"next"] isKindOfClass:NSString.class]||![nextState[@"next"] length])[more removeFromSuperview];self.content.contentSize=CGSizeMake(w,MAX(self.content.contentSize.height,CGRectGetMaxY(grid.frame)+(more.superview?more.frame.size.height+20:20)));[self loadVisiblePostersInShelf:grid];return YES;
}
- (BOOL)applyHeroCarouselState:(NSDictionary*)next {
 if(![self.state[@"page"] isEqualToString:@"home"]||![next[@"page"] isEqualToString:@"home"]||!self.heroCard||!self.heroPoster||!self.heroTitleLabel||!self.heroSubtitleLabel)return NO;
 NSMutableDictionary*previous=[self.state mutableCopy],*updated=[next mutableCopy];[previous removeObjectForKey:@"heroIndex"];[updated removeObjectForKey:@"heroIndex"];[previous removeObjectForKey:@"hero"];[updated removeObjectForKey:@"hero"];if(![previous isEqual:updated])return NO;
 NSArray*picks=[next[@"picks"] isKindOfClass:NSArray.class]?next[@"picks"]:@[];NSDictionary*movie=[next[@"hero"] isKindOfClass:NSDictionary.class]?next[@"hero"]:nil;if(picks.count<2||picks.count!=self.heroPickerButtons.count||!movie)return NO;
 NSUInteger selected=[next[@"heroIndex"] respondsToSelector:@selector(unsignedIntegerValue)]?[next[@"heroIndex"] unsignedIntegerValue]%picks.count:0;self.state=next;self.heroCard.payload=@{@"id":movie[@"id"]?:@"",@"source":movie[@"source"]?:next[@"site"]?:@""};self.heroTitleLabel.text=[NSString stringWithFormat:@"▶  %@",movie[@"title"]?:@"今日精选"];self.heroSubtitleLabel.text=movie[@"subtitle"]?:movie[@"metadata"]?:@"查看选集";if(self.heroBadgeLabel){NSString*bt=[movie[@"badge"] isKindOfClass:NSString.class]?movie[@"badge"]:@"";self.heroBadgeLabel.text=bt;self.heroBadgeLabel.hidden=!bt.length;}
 self.heroPoster.image=nil;self.heroPoster.accessibilityHint=movie[@"imageReferer"]?:@"";[self setPosterAssetKeys:self.heroPoster forMovie:movie];NSArray*urls=[movie[@"imageURLs"] isKindOfClass:NSArray.class]?movie[@"imageURLs"]:@[];[self loadPosters:urls into:self.heroPoster];for(NSUInteger index=0;index<picks.count;index++){NSDictionary*item=[picks[index] isKindOfClass:NSDictionary.class]?picks[index]:@{};SYLiveActionButton*button=self.heroPickerButtons[index];BOOL active=index==selected;[button setTitle:active?@"●":@"○" forState:UIControlStateNormal];button.titleLabel.font=[UIFont systemFontOfSize:active?13:11 weight:UIFontWeightSemibold];[button setTitleColor:active?[self accent]:[self muted] forState:UIControlStateNormal];button.accessibilityLabel=[NSString stringWithFormat:@"推荐%lu：%@",(unsigned long)index+1,item[@"title"]?:@"推荐"];button.accessibilityTraits=UIAccessibilityTraitButton|(active?UIAccessibilityTraitSelected:0);}
 return YES;
}
- (void)applyState:(NSDictionary*)state {NSDictionary*next=[state isKindOfClass:NSDictionary.class]?state:@{};if(self.state&&[self.state isEqual:next])return;if(self.state&&[self applyHeroCarouselState:next])return;if(self.state&&[self appendMoviePageFromState:self.state toState:next])return;CGPoint previousOffset=self.content.contentOffset;self.state=next;BOOL dark=[self isAppDarkTheme];UIColor*background=dark?[UIColor colorWithRed:.035 green:.055 blue:.08 alpha:1]:[UIColor colorWithRed:.953 green:.961 blue:.980 alpha:1];self.view.backgroundColor=background;self.content.backgroundColor=background;self.topBar.backgroundColor=[background colorWithAlphaComponent:.96];self.bottomBar.backgroundColor=dark?[UIColor colorWithRed:.07 green:.11 blue:.15 alpha:.96]:[UIColor colorWithRed:1 green:1 blue:1 alpha:.96];NSString*page=self.state[@"page"]?:@"home";NSString*pageKey=[self renderKeyForState:self.state];BOOL resetOffset=!self.renderedPageKey||![self.renderedPageKey isEqualToString:pageKey];self.renderedPageKey=pageKey;NSString*title=self.state[@"title"]?:self.state[@"siteName"]?:@"三源影视";NSDictionary*m=self.state[@"movie"];if([page isEqualToString:@"live"])title=@"直播";if([page isEqualToString:@"detail"])title=m[@"title"]?:@"影片详情";self.titleLabel.text=title;self.titleLabel.textColor=[self ink];self.heroCard=nil;self.heroPoster=nil;self.heroTitleLabel=nil;self.heroSubtitleLabel=nil;self.heroBadgeLabel=nil;self.heroPickerButtons=nil;for(UIView*v in self.content.subviews)[v removeFromSuperview];for(UIView*v in self.bottomBar.subviews)[v removeFromSuperview];for(UIView*v in self.topBar.subviews)if(v!=self.titleLabel)[v removeFromSuperview];if([page isEqualToString:@"detail"]||[page isEqualToString:@"collection"]){SYLiveActionButton*b=[self button:@"‹" action:[page isEqualToString:@"detail"]?@"back":@"collection-back" payload:@{}];b.frame=CGRectMake(12,4,44,42);b.titleLabel.font=[UIFont systemFontOfSize:28];[self.topBar addSubview:b];self.titleLabel.frame=CGRectMake(62,5,self.view.bounds.size.width-124,36);self.titleLabel.textAlignment=NSTextAlignmentCenter;}else{self.titleLabel.frame=CGRectMake(18,5,self.view.bounds.size.width-124,36);self.titleLabel.textAlignment=NSTextAlignmentLeft;SYLiveActionButton*themeBtn=[self button:@"◐" action:@"theme" payload:@{@"id":dark?@"white":@"black"}];themeBtn.frame=CGRectMake(self.view.bounds.size.width-98,6,38,38);themeBtn.layer.cornerRadius=19;[self.topBar addSubview:themeBtn];SYLiveActionButton*refreshBtn=[self button:@"↻" action:@"refresh" payload:@{}];refreshBtn.frame=CGRectMake(self.view.bounds.size.width-54,6,38,38);refreshBtn.layer.cornerRadius=19;[self.topBar addSubview:refreshBtn];}CGFloat w=self.view.bounds.size.width,y=12;self.content.contentSize=CGSizeMake(w,0);if([self.state[@"loading"] boolValue]||[self.state[@"error"] length]){NSString*message=[self.state[@"error"] length]?self.state[@"error"]:@"正在加载内容…";[self addButton:message action:[self.state[@"error"] length]?@"refresh":@"" data:@{} y:y height:42];y+=50;}
 if([page isEqualToString:@"home"]){[self addChips:self.state[@"sites"] action:@"source" key:@"id" selected:self.state[@"site"] y:y];y+=48;NSDictionary*h=self.state[@"hero"];if([h isKindOfClass:NSDictionary.class]){[self addHeroCard:h y:y];y+=216;y+=[self addHeroPickerAtY:y];}[self addChips:self.state[@"categories"] action:@"category" key:@"id" selected:@"" y:y];y+=48;NSArray*recent=[self.state[@"recent"] isKindOfClass:NSArray.class]?self.state[@"recent"]:@[];if(recent.count)y+=MAX(242,[self addShelf:recent title:@"继续观看" y:y]);NSArray*sections=[self.state[@"sections"] isKindOfClass:NSArray.class]?self.state[@"sections"]:@[];NSUInteger visibleSections=0;for(NSDictionary*s in sections){NSArray*items=[s[@"items"] isKindOfClass:NSArray.class]?s[@"items"]:@[];if(!items.count)continue;visibleSections++;CGFloat shelfHeight=[self addShelf:items title:s[@"title"]?:@"精选" y:y];[self addMoreRoute:s[@"route"] title:s[@"title"] y:y];y+=MAX(242,shelfHeight);}if(!h&&!recent.count&&!visibleSections&&!([self.state[@"loading"] boolValue])&&!([self.state[@"error"] length])){[self addButton:@"首页暂时没有影片，点击重新加载" action:@"refresh" data:@{} y:y height:52];y+=60;}}
 else if([page isEqualToString:@"browse"]||[page isEqualToString:@"search"]){[self addChips:self.state[@"sites"] action:@"source" key:@"id" selected:self.state[@"site"] y:y];y+=48;self.searchField=[[UITextField alloc]initWithFrame:CGRectMake(16,y,w-102,42)];self.searchField.text=self.state[@"query"]?:@"";self.searchField.placeholder=@"搜索影片、演员、导演";self.searchField.backgroundColor=[self surface];self.searchField.textColor=[self ink];self.searchField.borderStyle=UITextBorderStyleRoundedRect;self.searchField.clearButtonMode=1;[self.content addSubview:self.searchField];SYLiveActionButton*searchBtn=[self button:@"搜索" action:@"search-submit" payload:@{}];searchBtn.frame=CGRectMake(w-80,y,64,42);searchBtn.backgroundColor=[self accent];[searchBtn setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];[self.content addSubview:searchBtn];y+=50;[self addChips:self.state[@"categories"] action:@"category" key:@"id" selected:@"" y:y];y+=48;NSArray*allFilters=[self.state[@"filters"] isKindOfClass:NSArray.class]?self.state[@"filters"]:@[];BOOL filtersExpanded=[self.state[@"filtersExpanded"] boolValue];NSArray*shownFilters=(filtersExpanded||allFilters.count<=2)?allFilters:[allFilters subarrayWithRange:NSMakeRange(0,2)];for(NSDictionary*f in shownFilters){[self addHeading:f[@"name"]?:@"筛选" y:y];y+=30;NSMutableArray*opts=[NSMutableArray array];for(NSDictionary*o in f[@"options"])[opts addObject:@{@"id":o[@"id"]?:@"",@"name":o[@"name"]?:@"",@"key":f[@"query"]?:@""}];[self addChips:opts action:@"filter-option" key:@"key" selected:f[@"selected"] y:y];y+=46;}if(allFilters.count>2){[self addButton:filtersExpanded?@"收起更多筛选 ⌃":@"展开更多筛选条件 ＋" action:@"filters-expanded" data:@{} y:y height:38];y+=44;}CGFloat shelfHeight=[self addShelf:self.state[@"items"] title:self.state[@"title"]?:@"影片" y:y];if([self.state[@"items"] count])y+=MAX(240,shelfHeight);if([self.state[@"next"] isKindOfClass:NSString.class]&&[(NSString*)self.state[@"next"] length])[self addButton:@"加载更多" action:@"more" data:@{} y:y height:44];}
 else if([page isEqualToString:@"discover"]){[self addChips:self.state[@"sites"] action:@"source" key:@"id" selected:self.state[@"site"] y:y];y+=48;NSArray*tabs=[self.state[@"discoverTabs"] isKindOfClass:NSArray.class]?self.state[@"discoverTabs"]:@[@{@"id":@"0",@"name":@"上映表"},@{@"id":@"1",@"name":@"Netflix"},@{@"id":@"2",@"name":@"专题"},@{@"id":@"3",@"name":@"排行榜"}];[self addChips:tabs action:@"discover-tab" key:@"id" selected:[self.state[@"discoverTab"] stringValue] y:y];y+=48;if((!self.state[@"discoverTimeline"]||[self.state[@"discoverTimeline"] boolValue])&&[self.state[@"discoverTab"] integerValue]==0){[self addChips:self.state[@"years"] action:@"discover-year" key:@"id" selected:[self.state[@"discoverYear"] stringValue] y:y];y+=48;NSMutableArray*months=[NSMutableArray array];for(NSUInteger month=1;month<=12;month++)[months addObject:@{@"id":[NSString stringWithFormat:@"%lu",(unsigned long)month],@"name":[NSString stringWithFormat:@"%lu月",(unsigned long)month]}];[self addChips:months action:@"discover-month" key:@"id" selected:[self.state[@"discoverMonth"] stringValue] y:y];y+=48;}NSArray*items=[self.state[@"items"] isKindOfClass:NSArray.class]?self.state[@"items"]:@[];if(items.count)y+=[self addShelf:items title:@"发现" y:y]+14;for(NSDictionary*g in self.state[@"groups"]){NSArray*groupItems=[g[@"items"] isKindOfClass:NSArray.class]?g[@"items"]:@[];if(groupItems.count)y+=[self addShelf:groupItems title:g[@"title"]?:@"近期更新" y:y]+14;}for(NSDictionary*s in self.state[@"sections"]){NSArray*sectionItems=[s[@"items"] isKindOfClass:NSArray.class]?s[@"items"]:@[];if(!sectionItems.count)continue;CGFloat shelfHeight=[self addShelf:sectionItems title:s[@"title"]?:@"精选" y:y];[self addMoreRoute:s[@"route"] title:s[@"title"] y:y];y+=shelfHeight+14;}if([self.state[@"next"] isKindOfClass:NSString.class]&&[(NSString*)self.state[@"next"] length])[self addButton:@"加载更多" action:@"discover-more" data:@{} y:y height:44];}
 else if([page isEqualToString:@"collection"]){[self addButton:@"‹ 返回" action:@"collection-back" data:@{} y:y height:42];y+=50;for(NSDictionary*g in self.state[@"groups"]){y+=MAX(240,[self addShelf:g[@"items"] title:g[@"title"]?:@"专题" y:y]);}if([self.state[@"next"] isKindOfClass:NSString.class]&&[(NSString*)self.state[@"next"] length])[self addButton:@"加载更多" action:@"more" data:@{} y:y height:44];}
 else if([page isEqualToString:@"detail"]){
  if([self.state[@"playURLs"] count]>0){
   CGFloat fourth=(w-50)/4.0;
   SYLiveActionButton*rw=[self button:@"↺ -15s" action:@"player-seek" payload:@{@"id":@"-15"}];rw.frame=CGRectMake(16,y,fourth,38);rw.titleLabel.adjustsFontSizeToFitWidth=YES;rw.titleLabel.minimumScaleFactor=0.8;[self.content addSubview:rw];
   SYLiveActionButton*skip=[self button:@"跳过片头" action:@"player-skip-intro" payload:@{}];skip.frame=CGRectMake(22+fourth,y,fourth,38);skip.titleLabel.adjustsFontSizeToFitWidth=YES;skip.titleLabel.minimumScaleFactor=0.8;[self.content addSubview:skip];
   SYLiveActionButton*ff=[self button:@"↻ +15s" action:@"player-seek" payload:@{@"id":@"15"}];ff.frame=CGRectMake(28+fourth*2,y,fourth,38);ff.titleLabel.adjustsFontSizeToFitWidth=YES;ff.titleLabel.minimumScaleFactor=0.8;[self.content addSubview:ff];
   SYLiveActionButton*asp=[self button:@"画面比例" action:@"player-aspect" payload:@{}];asp.frame=CGRectMake(34+fourth*3,y,fourth,38);asp.titleLabel.adjustsFontSizeToFitWidth=YES;asp.titleLabel.minimumScaleFactor=0.8;[self.content addSubview:asp];
   y+=44;
   CGFloat half=(w-40)/2.0;
   SYLiveActionButton*muteBtn=[self button:[self.state[@"playerMuted"] boolValue]?@"🔇 已静音":@"🔊 声音" action:@"player-mute" payload:@{}];muteBtn.frame=CGRectMake(16,y,half,38);[self.content addSubview:muteBtn];
   NSString*sleepMode=[self.state[@"sleepTimerMode"] isKindOfClass:NSString.class]?self.state[@"sleepTimerMode"]:@"off";
   NSString*sleepTitle=[sleepMode isEqualToString:@"episode"]?@"🌙 播完本集":[sleepMode isEqualToString:@"15"]?@"🌙 15分钟":[sleepMode isEqualToString:@"30"]?@"🌙 30分钟":[sleepMode isEqualToString:@"60"]?@"🌙 60分钟":@"🌙 定时";
   SYLiveActionButton*sleepBtn=[self button:sleepTitle action:@"player-sleep-timer" payload:@{}];sleepBtn.frame=CGRectMake(24+half,y,half,38);if(![sleepMode isEqualToString:@"off"]){sleepBtn.backgroundColor=[[self accent] colorWithAlphaComponent:.15];[sleepBtn setTitleColor:[self accent] forState:UIControlStateNormal];}[self.content addSubview:sleepBtn];
   y+=44;
   CGFloat fifth=(w-56)/5.0;NSString*selectedRate=[self.state[@"playbackRate"] stringValue]?:@"1";
   NSArray*rateItems=@[@{@"name":@"0.75×",@"id":@"0.75"},@{@"name":@"1×",@"id":@"1"},@{@"name":@"1.25×",@"id":@"1.25"},@{@"name":@"1.5×",@"id":@"1.5"},@{@"name":@"2×",@"id":@"2"}];
   for(NSUInteger ri=0;ri<rateItems.count;ri++){NSDictionary*rateItem=rateItems[ri];SYLiveActionButton*rateBtn=[self button:rateItem[@"name"] action:@"playback-rate" payload:@{@"id":rateItem[@"id"]}];rateBtn.frame=CGRectMake(16+ri*(fifth+6),y,fifth,38);rateBtn.layer.cornerRadius=19;rateBtn.titleLabel.adjustsFontSizeToFitWidth=YES;rateBtn.titleLabel.minimumScaleFactor=0.8;if([rateItem[@"id"] isEqualToString:selectedRate]){rateBtn.backgroundColor=[[self accent] colorWithAlphaComponent:.15];[rateBtn setTitleColor:[self accent] forState:UIControlStateNormal];}[self.content addSubview:rateBtn];}
   y+=48;
  }
  [self addFeaturePoster:m y:y];y+=266;[self addHeading:m[@"title"]?:@"影片详情" y:y];y+=34;
  NSArray*actorList=[m[@"actors"] isKindOfClass:NSArray.class]?m[@"actors"]:@[];if(actorList.count){[self addChips:actorList action:@"actor-search" key:@"id" selected:@"" y:y];y+=46;}NSString*actorsText=@"";
  UILabel*l=[self label:[NSString stringWithFormat:@"%@%@",actorsText,m[@"summary"]?:@"暂无简介"] size:14 bold:NO color:[self muted]];l.frame=CGRectMake(18,y,w-36,120);[l sizeToFit];CGFloat summaryH=MAX(54,MIN(260,l.frame.size.height));l.frame=CGRectMake(18,y,w-36,summaryH);[self.content addSubview:l];y+=summaryH+12;
  NSString*playError=[self.state[@"playError"] isKindOfClass:NSString.class]?self.state[@"playError"]:@"";if(playError.length){UILabel*errorLabel=[self label:playError size:13 bold:NO color:[self muted]];errorLabel.frame=CGRectMake(18,y,w-36,48);errorLabel.numberOfLines=0;[self.content addSubview:errorLabel];y+=52;[self addButton:@"重新播放" action:@"retry-play" data:@{} y:y height:44];y+=50;}
  CGFloat half=(w-40)/2.0;
  SYLiveActionButton*playBtn=[self button:[self.state[@"previewPlayback"] boolValue]?@"▶  播放试看":@"▶  立即播放" action:@"play-first" payload:@{}];playBtn.frame=CGRectMake(16,y,half,46);playBtn.backgroundColor=[self accent];[playBtn setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];[self.content addSubview:playBtn];
  SYLiveActionButton*favBtn=[self button:[self.state[@"saved"] boolValue]?@"★ 已收藏":@"☆ 加入片单" action:@"favorite-detail" payload:@{}];favBtn.frame=CGRectMake(24+half,y,half,46);[self.content addSubview:favBtn];y+=56;
  NSArray*seasons=[self.state[@"seasons"] isKindOfClass:NSArray.class]?self.state[@"seasons"]:@[];if(seasons.count>1){[self addHeading:@"季度与版本" y:y];y+=34;NSString*selectedSeason=[m[@"id"] description]?:@"";for(NSDictionary*season in seasons)if([season[@"selected"] boolValue]){selectedSeason=[season[@"id"] description]?:selectedSeason;break;}[self addChips:seasons action:@"season" key:@"id" selected:selectedSeason y:y];y+=48;}[self addHeading:@"播放线路" y:y];y+=34;NSArray*lines=self.state[@"playSources"];[self addChips:lines action:@"play-source" key:@"id" selected:[self.state[@"line"] stringValue] y:y];y+=48;if([self.state[@"playURLs"] count]>1){[self addHeading:@"备用播放地址" y:y];y+=30;NSMutableArray*addresses=[NSMutableArray array];NSUInteger addressIndex=0;for(NSDictionary*address in self.state[@"playURLs"]){[addresses addObject:@{@"id":[NSString stringWithFormat:@"%lu",(unsigned long)addressIndex],@"name":[address[@"name"] length]?address[@"name"]:[NSString stringWithFormat:@"地址 %lu",(unsigned long)addressIndex+1]}];addressIndex++;}[self addChips:addresses action:@"play-line" key:@"id" selected:[self.state[@"playIndex"] stringValue] y:y];y+=48;}for(NSDictionary*line in lines)if([line[@"selected"] boolValue]){NSArray*all=line[@"episodes"]?:@[];NSUInteger pageSize=20,pageCount=MAX(1,(all.count+pageSize-1)/pageSize),page=MIN([self.state[@"episodePage"] unsignedIntegerValue],pageCount-1),start=page*pageSize,end=MIN(start+pageSize,all.count);[self addHeading:[NSString stringWithFormat:@"选集 · %@ 集",line[@"total"]?:@(all.count)] y:y];SYLiveActionButton*orderBtn=[self button:[self.state[@"episodeDesc"] boolValue]?@"↓ 倒序":@"↑ 正序" action:@"episode-order" payload:@{}];orderBtn.frame=CGRectMake(w-92,y-2,76,32);[self.content addSubview:orderBtn];y+=36;if(pageCount>1){NSMutableArray*pageOptions=[NSMutableArray arrayWithCapacity:pageCount];for(NSUInteger pageIndex=0;pageIndex<pageCount;pageIndex++)[pageOptions addObject:@{@"id":[NSString stringWithFormat:@"%lu",(unsigned long)pageIndex],@"name":[NSString stringWithFormat:@"%lu",(unsigned long)pageIndex+1]}];[self addChips:pageOptions action:@"episode-page" key:@"id" selected:[NSString stringWithFormat:@"%lu",(unsigned long)page] y:y];y+=46;}UILabel*pageLabel=[self label:[NSString stringWithFormat:@"第 %lu / %lu 页  ·  第 %lu–%lu 集",(unsigned long)page+1,(unsigned long)pageCount,(unsigned long)start+1,(unsigned long)end] size:12 bold:YES color:[self muted]];pageLabel.frame=CGRectMake(18,y,w-36,24);[self.content addSubview:pageLabel];y+=28;NSUInteger i=start;for(;i<end;i++){NSDictionary*ep=all[i];CGFloat col=(i-start)%4,row=(i-start)/4;NSString*t=ep[@"title"]?:[NSString stringWithFormat:@"第%lu集",(unsigned long)i+1];NSString*epIndex=ep[@"index"]?[ep[@"index"] stringValue]:[NSString stringWithFormat:@"%lu",(unsigned long)i];SYLiveActionButton*b=[self button:t action:@"episode" payload:@{@"id":epIndex}];CGFloat cw=(w-50)/4;b.frame=CGRectMake(16+col*(cw+6),y+row*46,cw,40);if([ep[@"selected"] boolValue]){b.backgroundColor=[[self accent] colorWithAlphaComponent:.16];[b setTitleColor:[self accent] forState:UIControlStateNormal];}[self.content addSubview:b];}y+=((end-start+3)/4)*46+8;break;}}
 else if([page isEqualToString:@"saved"]||[page isEqualToString:@"me"]){if([page isEqualToString:@"me"]){[self addChips:@[@{@"name":@"收藏",@"id":@"favorites"},@{@"name":@"观看记录",@"id":@"history"},@{@"name":@"设置",@"id":@"settings"}] action:@"me-tab" key:@"id" selected:self.state[@"meTab"]?:@"favorites" y:y];y+=50;}if([page isEqualToString:@"me"]&&[self.state[@"meTab"] isEqualToString:@"settings"]){[self addHeading:@"全局主题" y:y];y+=34;[self addChips:@[@{@"name":@"白色主题",@"id":@"white"},@{@"name":@"黑色主题",@"id":@"black"}] action:@"theme" key:@"id" selected:self.state[@"theme"]?:@"white" y:y];y+=48;[self addHeading:@"片库显示" y:y];y+=36;[self addButton:[self.state[@"adultEnabled"] boolValue]?@"关闭 18+ 分类":@"我已满 18 岁，启用 18+ 分类" action:@"adult-toggle" data:@{} y:y height:46];y+=54;if([self.state[@"showAgeGate"] boolValue]){[self addButton:@"我已年满 18 周岁，继续" action:@"age-confirm" data:@{} y:y height:44];y+=50;[self addButton:@"返回" action:@"age-cancel" data:@{} y:y height:42];y+=48;}[self addChips:@[@{@"name":@"3 列",@"id":@"3"},@{@"name":@"4 列",@"id":@"4"},@{@"name":@"5 列",@"id":@"5"},@{@"name":@"6 列",@"id":@"6"}] action:@"columns" key:@"id" selected:self.state[@"columns"] y:y];y+=52;[self addHeading:@"播放设置" y:y];y+=34;[self addButton:[self.state[@"cleanHLS"] boolValue]?@"✓ 过滤播放清单广告（开）":@"过滤播放清单广告（关）" action:@"toggle-clean-hls" data:@{} y:y height:44];y+=50;[self addButton:[self.state[@"autoNext"] boolValue]?@"✓ 自动连播下一集（开）":@"自动连播下一集（关）" action:@"toggle-auto-next" data:@{} y:y height:44];y+=50;[self addChips:@[@{@"name":@"片头 60s",@"id":@"60"},@{@"name":@"片头 90s",@"id":@"90"},@{@"name":@"片头 120s",@"id":@"120"}] action:@"skip-intro-setting" key:@"id" selected:[self.state[@"skipIntroSeconds"] stringValue]?:@"90" y:y];y+=48;[self addChips:@[@{@"name":@"片尾关",@"id":@"0"},@{@"name":@"片尾 60s",@"id":@"60"},@{@"name":@"片尾 90s",@"id":@"90"},@{@"name":@"片尾 120s",@"id":@"120"}] action:@"skip-outro-setting" key:@"id" selected:[self.state[@"skipOutroSeconds"] stringValue]?:@"0" y:y];y+=48;[self addChips:@[@{@"name":@"画面适应",@"id":@"fit"},@{@"name":@"画面铺满",@"id":@"fill"},@{@"name":@"画面拉伸",@"id":@"stretch"}] action:@"aspect-setting" key:@"id" selected:self.state[@"aspectMode"]?:@"fit" y:y];y+=48;[self addChips:@[@{@"name":@"0.5×",@"id":@"0.5"},@{@"name":@"0.75×",@"id":@"0.75"},@{@"name":@"1×",@"id":@"1"},@{@"name":@"1.25×",@"id":@"1.25"},@{@"name":@"1.5×",@"id":@"1.5"},@{@"name":@"2×",@"id":@"2"}] action:@"playback-rate" key:@"id" selected:[self.state[@"playbackRate"] stringValue] y:y];y+=48;[self addChips:@[@{@"name":@"定时关",@"id":@"off"},@{@"name":@"播完本集",@"id":@"episode"},@{@"name":@"15分钟",@"id":@"15"},@{@"name":@"30分钟",@"id":@"30"},@{@"name":@"60分钟",@"id":@"60"}] action:@"sleep-timer-setting" key:@"id" selected:self.state[@"sleepTimerMode"]?:@"off" y:y];y+=52;[self addHeading:@"全网片源连通性监测" y:y];y+=34;[self addButton:@"⚡ 一键检测全部 8 大片源延迟" action:@"probe-all-sites" data:@{} y:y height:42];y+=48;NSDictionary*siteHealth=[self.state[@"siteHealth"] isKindOfClass:NSDictionary.class]?self.state[@"siteHealth"]:@{};NSArray*sitesList=[self.state[@"sites"] isKindOfClass:NSArray.class]?self.state[@"sites"]:@[];for(NSDictionary*s in sitesList){NSString*sid=s[@"id"]?:@"",*sname=s[@"name"]?:sid;BOOL isCurrent=[sid isEqualToString:self.state[@"site"]];NSDictionary*h=siteHealth[sid];NSString*statusText=@"○ 未测试";if(h&&[h isKindOfClass:NSDictionary.class]){if([h[@"ok"] boolValue])statusText=[NSString stringWithFormat:@"● %@ms · 极速",h[@"ms"]?:@0];else statusText=@"✕ 离线/异常";}NSString*cardTitle=[NSString stringWithFormat:@"%@%@  ·  %@",isCurrent?@"★ 当前主源 · ":@"",sname,statusText];SYLiveActionButton*sb=[self button:cardTitle action:isCurrent?@"probe-site":@"source" payload:@{@"id":sid}];sb.frame=CGRectMake(16,y,w-32,38);if(isCurrent){sb.backgroundColor=[[self accent] colorWithAlphaComponent:dark?.18:.12];[sb setTitleColor:[self accent] forState:UIControlStateNormal];}[self.content addSubview:sb];y+=44;}[self addHeading:@"当前片源节点监测" y:y];y+=34;y=[self addDataLinesAtY:y];[self addButton:@"恢复默认播放设置" action:@"reset-playback-prefs" data:@{} y:y height:42];y+=48;[self addButton:@"清理内存与页面缓存" action:@"clear-runtime-cache" data:@{} y:y height:42];y+=48;[self addButton:@"同步站点配置" action:@"refresh-config" data:@{} y:y height:44];y+=50;if([((NSDictionary*)([self.state[@"config"] isKindOfClass:NSDictionary.class]?self.state[@"config"]:@{}))[@"supportsAccount"] isEqual:@NO]){[self addHeading:@"此来源使用公开片库" y:y];y+=34;}else if(![self.state[@"user"] isKindOfClass:NSDictionary.class]){self.accountField=[[UITextField alloc]initWithFrame:CGRectMake(16,y,self.view.bounds.size.width-32,42)];self.accountField.placeholder=@"原站账号";self.accountField.backgroundColor=[self surface];self.accountField.textColor=[self ink];self.accountField.borderStyle=UITextBorderStyleRoundedRect;[self.content addSubview:self.accountField];y+=48;self.passwordField=[[UITextField alloc]initWithFrame:CGRectMake(16,y,self.view.bounds.size.width-32,42)];self.passwordField.placeholder=@"原站密码";self.passwordField.secureTextEntry=YES;self.passwordField.backgroundColor=[self surface];self.passwordField.textColor=[self ink];self.passwordField.borderStyle=UITextBorderStyleRoundedRect;[self.content addSubview:self.passwordField];y+=48;[self addButton:@"登录本站" action:@"login-submit" data:@{} y:y height:44];}else{[self addButton:@"退出本站会话" action:@"logout" data:@{} y:y height:44];}}else{if([page isEqualToString:@"saved"]){[self addChips:@[@{@"name":@"收藏",@"id":@"favorites"},@{@"name":@"观看记录",@"id":@"history"}] action:@"saved-tab" key:@"id" selected:self.state[@"savedTab"]?:@"favorites" y:y];y+=48;}BOOL history=[page isEqualToString:@"saved"]?[self.state[@"savedTab"] isEqualToString:@"history"]:[self.state[@"meTab"] isEqualToString:@"history"];[self addHeading:history?@"观看记录":@"我的收藏" y:y];y+=34;NSArray*sourceFilters=[self.state[@"sourceFilters"] isKindOfClass:NSArray.class]?self.state[@"sourceFilters"]:@[];if(sourceFilters.count>1){[self addChips:sourceFilters action:@"saved-source-filter" key:@"id" selected:self.state[@"savedSourceFilter"]?:@"all" y:y];y+=48;}NSArray*savedItems=[self.state[@"items"] isKindOfClass:NSArray.class]?self.state[@"items"]:@[];if(savedItems.count){y+=MAX(240,[self addShelf:savedItems title:history?@"观看记录":@"我的收藏" y:y]);[self addButton:[self.state[@"clearConfirm"] boolValue]?@"再次点击确认清空":(history?@"清空观看记录":@"清空收藏") action:@"clear-saved" data:@{} y:y height:42];}else{[self addButton:history?@"还没有观看记录，播放过的影片会显示在这里":@"还没有收藏影片，去首页挑选喜欢的内容吧" action:@"page" data:@{@"id":@"home"} y:y height:54];}}}
 else if([page isEqualToString:@"settings"]){[self addHeading:@"全局主题" y:y];y+=34;[self addChips:@[@{@"name":@"白色主题",@"id":@"white"},@{@"name":@"黑色主题",@"id":@"black"}] action:@"theme" key:@"id" selected:self.state[@"theme"]?:@"white" y:y];y+=48;[self addHeading:@"我的放映室" y:y];y+=36;[self addButton:[self.state[@"adultEnabled"] boolValue]?@"关闭 18+ 分类":@"我已满 18 岁，启用 18+ 分类" action:@"adult-toggle" data:@{} y:y height:46];y+=56;[self addChips:@[@{@"name":@"3 列",@"id":@"3"},@{@"name":@"4 列",@"id":@"4"},@{@"name":@"5 列",@"id":@"5"},@{@"name":@"6 列",@"id":@"6"}] action:@"columns" key:@"id" selected:self.state[@"columns"] y:y];y+=54;[self addButton:[self.state[@"cleanHLS"] boolValue]?@"✓ 过滤播放清单广告":@"过滤播放清单广告（关闭）" action:@"toggle-clean-hls" data:@{} y:y height:44];y+=54;[self addButton:@"检测数据线路" action:@"probe-lines" data:@{} y:y height:44];y+=50;y=[self addDataLinesAtY:y];}
 else if(![page isEqualToString:@"live"]){[self addHeading:@"游戏频道暂未接入" y:y];}
 NSArray*nav=@[@[@"⌂",@"首页",@"home"],@[@"✦",@"发现",@"discover"],@[@"◉",@"看啥片",@"browse"],@[@"◔",@"直播",@"live"],@[@"●",@"我的",@"me"]];CGFloat barWidth=w-28,nw=barWidth/nav.count;for(NSUInteger i=0;i<nav.count;i++){NSArray*n=nav[i];BOOL selected=[n[2] isEqualToString:page]||([n[2] isEqualToString:@"me"]&&([page isEqualToString:@"saved"]||[page isEqualToString:@"settings"]));UIColor*color=selected?[self accent]:[self muted];SYLiveActionButton*b=[self button:@"" action:@"page" payload:@{@"id":n[2]}];b.frame=CGRectMake(i*nw+3,4,nw-6,60);b.backgroundColor=selected?[[self accent] colorWithAlphaComponent:dark?.15:.11]:UIColor.clearColor;b.layer.cornerRadius=24;b.layer.borderWidth=0;UILabel*glyph=[self label:n[0] size:21 bold:YES color:color];glyph.frame=CGRectMake(0,6,nw-6,25);glyph.textAlignment=NSTextAlignmentCenter;glyph.userInteractionEnabled=NO;UILabel*caption=[self label:n[1] size:10 bold:selected color:color];caption.frame=CGRectMake(0,33,nw-6,17);caption.textAlignment=NSTextAlignmentCenter;caption.userInteractionEnabled=NO;[b addSubview:glyph];[b addSubview:caption];[self.bottomBar addSubview:b];}CGFloat contentHeight=MAX(y+48,self.content.contentSize.height);self.content.contentSize=CGSizeMake(w,contentHeight);CGFloat maxOffset=MAX(0,contentHeight-self.content.bounds.size.height);[self.content setContentOffset:CGPointMake(0,resetOffset?0:MIN(previousOffset.y,maxOffset)) animated:NO];[self.view setNeedsLayout];}
@end
@implementation SYController
- (void)viewDidLoad {
  [super viewDidLoad];
  self.view.backgroundColor=[UIColor colorWithRed:.953 green:.961 blue:.980 alpha:1];
  self.preferredVideoGravity=AVLayerVideoGravityResizeAspect;
  self.tasks=[NSMutableDictionary dictionary];self.hlsProxy=[SYHLSProxy new];
  NSURLSessionConfiguration*sessionConfig=[NSURLSessionConfiguration ephemeralSessionConfiguration];
  sessionConfig.timeoutIntervalForRequest=18;sessionConfig.HTTPMaximumConnectionsPerHost=6;
  self.session=[NSURLSession sessionWithConfiguration:sessionConfig];
  self.bridge=[SYBridge new];self.bridge.owner=self;
  WKWebViewConfiguration*config=[WKWebViewConfiguration new];
  config.allowsInlineMediaPlayback=YES;config.mediaTypesRequiringUserActionForPlayback=0;
  [config.userContentController addScriptMessageHandler:self.bridge name:@"native"];
  self.web=[[WKWebView alloc]initWithFrame:self.view.bounds configuration:config];
  self.web.autoresizingMask=18;self.web.navigationDelegate=self;
  self.web.backgroundColor=self.view.backgroundColor;[self.view addSubview:self.web];
  self.appScreen=[SYAppScreenController new];self.appScreen.owner=self;[self addChildViewController:self.appScreen];self.appScreen.view.frame=self.view.bounds;self.appScreen.view.autoresizingMask=18;[self.view addSubview:self.appScreen.view];[self.view sendSubviewToBack:self.web];[self.appScreen didMoveToParentViewController:self];[self.appScreen applyState:@{@"page":@"home"}];
#if defined(SY_SIMULATOR_SMOKE)
  NSString*liveFixturePath=[NSHomeDirectory() stringByAppendingPathComponent:@"Documents/sanyuan-live-cache.json"];
  NSString*liveFixture=@"#EXTM3U\n#EXTINF:-1 tvg-id=\"SMOKE1\" group-title=\"模拟器频道\",检查频道一\nhttps://smoke.invalid/live/one.m3u8\n#EXTINF:-1 tvg-id=\"SMOKE2\" group-title=\"备用频道\",检查频道二\nhttps://smoke.invalid/live/two.m3u8\n";
  NSData*liveFixtureData=[NSJSONSerialization dataWithJSONObject:@{@"url":@"https://smoke.invalid/interface.m3u",@"text":liveFixture} options:0 error:NULL];
  if(liveFixtureData)[liveFixtureData writeToFile:liveFixturePath atomically:YES];
#endif
  NSString*root=[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Web"];
  [self.web loadFileURL:[NSURL fileURLWithPath:[root stringByAppendingPathComponent:@"index.html"] isDirectory:NO]
    allowingReadAccessToURL:[NSURL fileURLWithPath:root isDirectory:YES]];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(handleAppLifecycle:) name:@"UIApplicationDidReceiveMemoryWarningNotification" object:nil];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(handleAppLifecycle:) name:@"UIApplicationDidEnterBackgroundNotification" object:nil];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(handleAppLifecycle:) name:@"UIApplicationWillEnterForegroundNotification" object:nil];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(handleAudioInterruption:) name:@"AVAudioSessionInterruptionNotification" object:nil];
#if defined(SY_SIMULATOR_SMOKE)
  [self performSelector:@selector(runSmokeCheck) withObject:nil afterDelay:2];
#endif
}
#if defined(SY_SIMULATOR_SMOKE)
// Compiled only into the simulator test executable, never into the delivered IPA.
- (void)runSmokeCheck {
  self.smokeAttempts++;
  // Native mode intentionally avoids loading a second set of poster images in
  // the hidden WKWebView. Validate the native screen and bridge instead of
  // requiring DOM images that should not be fetched in this mode.
  [self.web evaluateJavaScript:@"({interfaceLoaded:!!window.NativePageAction,transportReady:!!window.NativeTransport&&window.NativeTransport.native(),rootReady:!!document.querySelector('#app'),nativeFastRender:document.querySelector('#app-page')?.children.length===0})" completionHandler:^(id result,NSError*error){
    BOOL nativeHome=[self.appScreen.state[@"page"] isEqualToString:@"home"]&&self.appScreen.content.subviews.count>0;
    NSData*encryptedPoster=[[NSData alloc]initWithBase64EncodedString:@"UirodFy8rJdy9weMp3zV14Brkzd6m4YHITwrBjbPlEnQsqs6HMV6se8qQrDJ0JwbjezFVF4kyuXLEx9X1k5smLh5ODdMK+FdiKr7l0Edsus=" options:0];NSArray*posterKeys=self.appScreen.state[@"posterKeysBySite"][@"kkapp"];UIImage*decodedPoster=SYPosterImage(encryptedPoster,posterKeys,1);BOOL posterDecoder=decodedPoster&&decodedPoster.size.width==2&&decodedPoster.size.height==2;
    if([result isKindOfClass:NSDictionary.class]&&[result[@"interfaceLoaded"] boolValue]&&[result[@"transportReady"] boolValue]&&[result[@"rootReady"] boolValue]&&[result[@"nativeFastRender"] boolValue]&&nativeHome&&self.appScreen.bottomBar.subviews.count>=5&&posterDecoder){
      NSMutableDictionary*smoke=[result mutableCopy];smoke[@"encryptedPosterDecoder"]=@YES;NSData*data=[NSJSONSerialization dataWithJSONObject:smoke options:NSJSONWritingPrettyPrinted error:NULL];
      NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-smoke.json"];
      [data writeToFile:path atomically:YES];
      self.smokeNavigationDebug=[@{@"phase":@"home-smoke-passed"} mutableCopy];[self writeSmokeNavigationDebug];
      [self sendPageAction:@"page" payload:@{@"id":@"discover"}];
      self.smokeNavigationDebug[@"phase"]=@"discover-action-sent";[self writeSmokeNavigationDebug];
      [self performSelector:@selector(runDiscoverSmoke) withObject:nil afterDelay:3];return;
    }
    if(self.smokeAttempts<30)[self performSelector:@selector(runSmokeCheck) withObject:nil afterDelay:2];
  }];
 }
- (void)runDiscoverSmoke {
  NSDictionary*pageState=self.appScreen.state?:@{};
  BOOL nativeDiscover=[pageState[@"page"] isEqualToString:@"discover"]&&self.appScreen.bottomBar.subviews.count>=5&&self.appScreen.content.subviews.count>=4;
  id cursor=pageState[@"next"];
  BOOL cursorIsString=!cursor||cursor==NSNull.null||[cursor isKindOfClass:NSString.class];
  NSDictionary*result=@{@"nativeDiscoverPage":@(nativeDiscover),@"bottomNavigationItems":@(self.appScreen.bottomBar.subviews.count),@"nativeControls":@(self.appScreen.content.subviews.count),@"paginationCursorIsString":@(cursorIsString)};
  NSData*data=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:NULL];
  [data writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-discover-smoke.json"] atomically:YES];
  [self sendPageAction:@"page" payload:@{@"id":@"home"}];
  [self performSelector:@selector(runPlaybackSmoke) withObject:nil afterDelay:2];
}
- (void)runPlaybackSmoke {
  if(!self.hlsProxy.port){if(self.smokeAttempts++<70)[self performSelector:@selector(runPlaybackSmoke) withObject:nil afterDelay:1];return;}
  if(!self.smokePlaybackStarted){self.smokePlaybackStarted=YES;self.smokePlaybackDebug=[@{@"phase":@"evaluate-started",@"proxyPort":@(self.hlsProxy.port)} mutableCopy];[self writeSmokePlaybackDebug];[self.web evaluateJavaScript:@"(()=>{if(!window.NativeTransport)return {error:'NativeTransport missing'};window.NativeTransport.syncPage({page:'detail',theme:'white',site:'smoke',siteName:'模拟器检查',movie:{id:'1',title:'原生播放器检查',metadata:'本地测试媒体',actors:[],summary:'',imageURLs:[]},playSources:[],line:0,episode:{title:'静音测试',index:0},playURLs:[{url:'https://smoke.invalid/silence.m3u8'}],playIndex:0,loading:false});return window.NativeTransport.play('https://smoke.invalid/silence.m3u8',{}, {context:'smoke:playback',cleanHLS:true,frame:{visible:true,x:0,y:360,width:390,height:220,viewportWidth:390},title:'原生播放器检查'});})()" completionHandler:^(id result,NSError*error){self.smokePlaybackDebug[@"phase"]=@"evaluate-completed";if(result)self.smokePlaybackDebug[@"javascriptResult"]=[result description]?:@"";if(error)self.smokePlaybackDebug[@"javascriptError"]=error.localizedDescription?:@"unknown";[self writeSmokePlaybackDebug];}];}
  if(!self.smokePlayerReady&&self.smokeAttempts++<70)[self performSelector:@selector(runPlaybackSmoke) withObject:nil afterDelay:2];
}
- (void)writeSmokePlaybackDebug {if(!self.smokePlaybackDebug)return;NSData*data=[NSJSONSerialization dataWithJSONObject:self.smokePlaybackDebug options:NSJSONWritingPrettyPrinted error:NULL];if(data)[data writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-playback-smoke-debug.json"] atomically:YES];}
- (void)writeSmokeNavigationDebug {if(!self.smokeNavigationDebug)return;NSData*data=[NSJSONSerialization dataWithJSONObject:self.smokeNavigationDebug options:NSJSONWritingPrettyPrinted error:NULL];if(data)[data writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-navigation-smoke-debug.json"] atomically:YES];}

#endif
- (void)viewDidLayoutSubviews {[super viewDidLayoutSubviews];self.web.frame=self.view.bounds;self.appScreen.view.frame=self.view.bounds;if(self.liveScreen)self.liveScreen.view.frame=self.view.bounds;}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}
- (void)didReceiveMemoryWarning {
  [super didReceiveMemoryWarning];
  if(SYPosterImageCache)[SYPosterImageCache removeAllObjects];
  if(SYPosterImageOrder)[SYPosterImageOrder removeAllObjects];
  if(SYPosterLoadQueue)[SYPosterLoadQueue cancelAllOperations];
  if(self.hlsProxy&&self.hlsProxy.playlistCache)[self.hlsProxy.playlistCache removeAllObjects];
  [self.web evaluateJavaScript:@"window.NativePageAction?.('clear-runtime-cache')" completionHandler:nil];
}
- (void)handleAudioInterruption:(NSNotification*)note {
  NSDictionary*info=note.userInfo;
  NSUInteger type=[info[@"AVAudioSessionInterruptionTypeKey"] unsignedIntegerValue];
  if(type==1){
    if(self.nativePlayer.player&&self.nativePlayer.player.timeControlStatus==AVPlayerTimeControlStatusPlaying)[self.nativePlayer.player pause];
  }else if(type==0){
    NSUInteger options=[info[@"AVAudioSessionInterruptionOptionKey"] unsignedIntegerValue];
    if((options&1)&&self.nativePlayer.player)[self.nativePlayer.player play];
  }
}
- (void)handleAppLifecycle:(NSNotification*)note {
  if([note.name isEqualToString:@"UIApplicationDidReceiveMemoryWarningNotification"]){
    [self didReceiveMemoryWarning];
  }else if([note.name isEqualToString:@"UIApplicationDidEnterBackgroundNotification"]){
    if(self.nativePlayer.player&&![self.playContext hasPrefix:@"live:"]){
      double cur=CMTimeGetSeconds(self.nativePlayer.player.currentTime),dur=self.nativeItem?CMTimeGetSeconds(self.nativeItem.duration):0;
      if(__builtin_isfinite(cur)&&cur>0)[self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"progress",@"time":@(cur),@"duration":@(__builtin_isfinite(dur)&&dur>0?dur:0)}];
    }
  }else if([note.name isEqualToString:@"UIApplicationWillEnterForegroundNotification"]){
    if(self.liveScreen&&self.liveScreen.liveRendererLayer&&self.nativePlayer.player){
      self.liveScreen.liveRendererLayer.player=self.nativePlayer.player;
    }
  }
}

- (void)layoutPlayer:(NSDictionary*)frame {
  if(!self.nativePlayer||self.nativePlayer.fullScreen)return;
  if([self.playContext hasPrefix:@"live:"]&&self.liveScreen){[self.liveScreen.view setNeedsLayout];[self.liveScreen.view layoutIfNeeded];[self.liveScreen layoutEmbeddedPlayer];return;}
  if(self.appScreen&&[self.appScreen.state[@"page"] isEqualToString:@"detail"]){[self.appScreen.view setNeedsLayout];[self.appScreen.view layoutIfNeeded];self.nativePlayer.view.frame=self.appScreen.playerHost.bounds;[self.appScreen.playerHost addSubview:self.nativePlayer.view];if(self.cicadaFallbackActive&&self.cicadaLivePlayer){UIView*cicadaView=self.cicadaLivePlayer.playerView;cicadaView.frame=self.appScreen.playerHost.bounds;cicadaView.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;[self.appScreen.playerHost addSubview:cicadaView];[self.appScreen.playerHost bringSubviewToFront:cicadaView];}return;}
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
  if(self.cicadaFallbackActive&&self.cicadaLivePlayer&&![self.playContext hasPrefix:@"live:"]&&self.nativePlayer.view.superview){UIView*cicadaView=self.cicadaLivePlayer.playerView;cicadaView.frame=self.nativePlayer.view.frame;cicadaView.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;[self.nativePlayer.view.superview addSubview:cicadaView];[self.nativePlayer.view.superview bringSubviewToFront:cicadaView];}
}
- (void)sendLiveActionScript:(NSString*)script {dispatch_async(SYMainQueue(),^{[self.web evaluateJavaScript:script completionHandler:nil];});}
- (void)sendPageAction:(NSString*)action payload:(NSDictionary*)payload {if(!action.length)return;NSArray*args=@[action,payload?:@{}];NSData*data=[NSJSONSerialization dataWithJSONObject:args options:0 error:NULL];NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];[self sendLiveActionScript:[NSString stringWithFormat:@"window.NativePageAction&&window.NativePageAction.apply(null,%@)",json]];}
- (void)openLiveScreen {
 if(self.liveScreen){self.liveScreen.integratedMode=YES;[self.liveScreen applyState:self.liveSnapshot?:@{}];[self.appScreen.view setNeedsLayout];[self.appScreen.view layoutIfNeeded];return;}
 SYLiveScreenController*screen=[SYLiveScreenController new];screen.owner=self;screen.integratedMode=YES;self.liveScreen=screen;self.appScreen.view.hidden=NO;
 [self.appScreen addChildViewController:screen];screen.view.frame=CGRectZero;screen.view.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;[self.appScreen.view addSubview:screen.view];[screen didMoveToParentViewController:self.appScreen];[screen applyState:self.liveSnapshot?:@{}];[self.appScreen.view setNeedsLayout];[self.appScreen.view layoutIfNeeded];screen.view.alpha=0;[UIView animateWithDuration:.18 animations:^{screen.view.alpha=1;}];[self setNeedsStatusBarAppearanceUpdate];
}
- (void)closeLiveScreen {
 if([self.playContext hasPrefix:@"live:"])[self stopNativePlayback];SYLiveScreenController*screen=self.liveScreen;self.liveScreen=nil;
 if(screen){[screen willMoveToParentViewController:nil];[screen.view removeFromSuperview];[screen removeFromParentViewController];}self.appScreen.content.hidden=NO;self.appScreen.view.hidden=NO;[self.appScreen.view setNeedsLayout];[self setNeedsStatusBarAppearanceUpdate];
}
- (UIStatusBarStyle)preferredStatusBarStyle {if(self.liveScreen)return [self.liveSnapshot[@"theme"] isEqualToString:@"black"]?1:0;return self.detailStatusStyle||[self.pageSnapshot[@"theme"] isEqualToString:@"black"]?1:0;}
#if defined(SY_SIMULATOR_SMOKE)
- (NSURL*)smokeAudioFixtureURL {
  const uint32_t sampleRate=8000,seconds=12,channels=1,bitsPerSample=16,dataBytes=sampleRate*seconds*channels*(bitsPerSample/8);
  NSMutableData*wav=[NSMutableData data];uint32_t riffSize=CFSwapInt32HostToLittle(36+dataBytes),rate=CFSwapInt32HostToLittle(sampleRate),byteRate=CFSwapInt32HostToLittle(sampleRate*channels*(bitsPerSample/8)),payloadSize=CFSwapInt32HostToLittle(dataBytes);uint16_t format=CFSwapInt16HostToLittle(1),channelCount=CFSwapInt16HostToLittle(channels),alignment=CFSwapInt16HostToLittle(channels*(bitsPerSample/8)),sampleBits=CFSwapInt16HostToLittle(bitsPerSample);
  [wav appendBytes:"RIFF" length:4];[wav appendBytes:&riffSize length:4];[wav appendBytes:"WAVEfmt " length:8];uint32_t formatSize=CFSwapInt32HostToLittle(16);[wav appendBytes:&formatSize length:4];[wav appendBytes:&format length:2];[wav appendBytes:&channelCount length:2];[wav appendBytes:&rate length:4];[wav appendBytes:&byteRate length:4];[wav appendBytes:&alignment length:2];[wav appendBytes:&sampleBits length:2];[wav appendBytes:"data" length:4];[wav appendBytes:&payloadSize length:4];[wav appendData:[NSMutableData dataWithLength:dataBytes]];
  NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-smoke-silence.wav"];if(![wav writeToFile:path atomically:YES])return nil;return [NSURL fileURLWithPath:path];
}
#endif
- (void)deliver:(NSDictionary*)result {
  NSData*data=[NSJSONSerialization dataWithJSONObject:result options:0 error:NULL];
  if(!data)return;
  NSString*json=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
  dispatch_async(SYMainQueue(),^{[self.web evaluateJavaScript:[NSString stringWithFormat:@"window.NativeTransport&&window.NativeTransport.deliver(%@)",json] completionHandler:nil];});
}
- (void)sendPlayback:(NSDictionary*)event {
#if defined(SY_SIMULATOR_SMOKE)
  if([event[@"context"] isEqualToString:@"smoke:playback"]){self.smokePlaybackDebug[@"phase"]=[event[@"status"] isKindOfClass:NSString.class]?event[@"status"]:@"playback-event";if(event[@"error"])self.smokePlaybackDebug[@"playbackError"]=event[@"error"];if(event[@"time"])self.smokePlaybackDebug[@"playbackTime"]=event[@"time"];[self writeSmokePlaybackDebug];}
  if([event[@"context"] isEqualToString:@"live:smoke-cctv2"]){NSString*livePath=[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-live-video-smoke.json"];NSDictionary*old=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfFile:livePath]?:[NSData data] options:0 error:NULL];if(![old[@"status"] isEqualToString:@"videoReady"]){NSString*status=(self.nativeVideoReady||[event[@"status"] isEqualToString:@"videoReady"])?@"videoReady":([event[@"status"] isKindOfClass:NSString.class]?event[@"status"]:@"unknown");NSMutableDictionary*liveResult=[@{@"context":event[@"context"],@"status":status,@"proxyEnabled":@(self.liveScreen!=nil),@"rendererAttached":@(self.liveRendererAttached),@"rendererReady":@(self.liveScreen.liveRendererLayer.readyForDisplay),@"presentationWidth":@(self.nativeItem.presentationSize.width),@"presentationHeight":@(self.nativeItem.presentationSize.height),@"playURLIsLoopback":@([self.nativeItem.asset isKindOfClass:AVURLAsset.class]&&[((AVURLAsset*)self.nativeItem.asset).URL.host isEqualToString:@"127.0.0.1"]),@"proxyHTTPStatus":@(self.hlsProxy.lastHTTPStatus),@"proxyError":self.hlsProxy.lastTransportError?:@""} mutableCopy];if(event[@"error"])liveResult[@"error"]=event[@"error"];NSData*liveData=[NSJSONSerialization dataWithJSONObject:liveResult options:NSJSONWritingPrettyPrinted error:NULL];if(liveData)[liveData writeToFile:livePath atomically:YES];}}
  if([event[@"status"] isEqualToString:@"ready"])self.smokePlayerReady=YES;
  if([event[@"status"] isEqualToString:@"progress"]&&self.smokePlayerReady&&[event[@"time"] doubleValue]>1&&!self.smokeLiveStarted){
    self.smokeLiveStarted=YES;
    NSDictionary*result=@{@"nativePlayerReady":@YES,@"hlsProxyActive":@(self.smokeProxyActive),@"removedAdSegments":@(self.hlsProxy.removed),@"inlinePlayback":@(self.nativePlayer.parentViewController==self.appScreen&&self.presentedViewController==nil&&self.nativePlayer.view.superview==self.appScreen.playerHost&&self.nativePlayer.view.frame.size.height>0&&self.nativePlayer.view.frame.size.height<self.view.bounds.size.height*0.8),@"nativePageController":@(self.appScreen.view.superview==self.view),@"playbackTime":event[@"time"],@"devicePlaybackTested":@NO};
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
  if([self.liveSnapshot[@"panel"] isEqualToString:@"categories"])self.smokeLiveScrollReset=self.liveScreen.content.contentOffset.y<=1;
  if(![self.liveSnapshot[@"panel"] isEqualToString:@"categories"]){
    CGFloat bottom=MAX(0,self.liveScreen.content.contentSize.height-self.liveScreen.content.bounds.size.height);[self.liveScreen.content setContentOffset:CGPointMake(0,bottom) animated:NO];
    BOOL sentCategoryAction=NO;
    for(UIView*view in self.liveScreen.content.subviews)if([view isKindOfClass:SYLiveActionButton.class]){SYLiveActionButton*button=(SYLiveActionButton*)view;if([button.action isEqualToString:@"live-panel"]&&[button.value isEqualToString:@"categories"]){[button sendActionsForControlEvents:UIControlEventTouchUpInside];sentCategoryAction=YES;break;}}
    if(!sentCategoryAction)[self.web evaluateJavaScript:@"window.NativeLiveAction&&window.NativeLiveAction('live-panel','categories')" completionHandler:nil];
    if(self.smokeLiveAttempts<30){[self performSelector:@selector(runLiveScreenSmoke) withObject:nil afterDelay:.5];return;}
  }
  if(!self.smokeLiveCategoryLinked){
    BOOL sentAllChannels=NO;
    for(UIView*view in self.liveScreen.content.subviews)if([view isKindOfClass:SYLiveActionButton.class]){SYLiveActionButton*button=(SYLiveActionButton*)view;if([button.action isEqualToString:@"live-category"]&&[button.value isEqualToString:@"__all__"]){[button sendActionsForControlEvents:UIControlEventTouchUpInside];sentAllChannels=YES;break;}}
    if(sentAllChannels){
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(0.5*NSEC_PER_SEC)),dispatch_get_main_queue(),^{
        self.smokeLiveCategoryLinked=[self.liveSnapshot[@"panel"] isEqualToString:@"channels"]&&[self.liveSnapshot[@"category"] isEqualToString:@"__all__"];
        [self.web evaluateJavaScript:@"window.NativeLiveAction&&window.NativeLiveAction('live-panel','categories')" completionHandler:nil];
        [self performSelector:@selector(runFastLiveScreenSmoke) withObject:nil afterDelay:.75];
      });
      return;
    }
  }
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
  BOOL embedded=self.liveScreen.parentViewController==self.appScreen&&self.liveScreen.view.superview==self.appScreen.view&&self.appScreen.content.hidden&&!self.appScreen.bottomBar.hidden&&!self.presentedViewController;
  [self stopNativePlayback];self.playContext=@"live:layout-smoke";SYPlayerViewController*layoutProbe=[SYPlayerViewController new];self.nativePlayer=layoutProbe;[self.liveScreen addChildViewController:layoutProbe];layoutProbe.view.frame=CGRectZero;[self.liveScreen.playerHost addSubview:layoutProbe.view];[layoutProbe didMoveToParentViewController:self.liveScreen];[self.liveScreen.view setNeedsLayout];[self.liveScreen.view layoutIfNeeded];[self.liveScreen layoutEmbeddedPlayer];
  CGRect initialFrame=layoutProbe.view.frame,initialBounds=self.liveScreen.playerHost.bounds;BOOL playerAttached=layoutProbe.view.superview==self.liveScreen.playerHost;BOOL playerFillsHost=initialFrame.size.width>0&&initialFrame.size.height>0&&initialFrame.size.width==initialBounds.size.width&&initialFrame.size.height==initialBounds.size.height;
  CGRect originalScreenFrame=self.liveScreen.view.frame;self.liveScreen.view.frame=CGRectMake(0,0,MAX(240,originalScreenFrame.size.width-24),originalScreenFrame.size.height);[self.liveScreen.view setNeedsLayout];[self.liveScreen.view layoutIfNeeded];[self.liveScreen layoutEmbeddedPlayer];CGRect resizedFrame=layoutProbe.view.frame,resizedBounds=self.liveScreen.playerHost.bounds;BOOL resizesWithHost=resizedFrame.size.width==resizedBounds.size.width&&resizedFrame.size.height==resizedBounds.size.height&&resizedFrame.size.width>0&&resizedFrame.size.height>0;self.liveScreen.view.frame=originalScreenFrame;[self.liveScreen.view setNeedsLayout];[self.liveScreen.view layoutIfNeeded];[self.liveScreen layoutEmbeddedPlayer];BOOL routePickerAbovePlayer=[[self.liveScreen.playerHost.subviews lastObject] isEqual:self.liveScreen.routePicker];
  layoutProbe.player=[AVPlayer playerWithURL:[NSURL fileURLWithPath:@"/dev/null"]];[self.liveScreen layoutEmbeddedPlayer];BOOL avPlayerControllerEmbedded=[layoutProbe isKindOfClass:AVPlayerViewController.class]&&layoutProbe.view.superview==self.liveScreen.playerHost;
  self.liveScreen.view.frame=CGRectMake(0,0,MAX(240,originalScreenFrame.size.width-24),originalScreenFrame.size.height);[self.liveScreen.view setNeedsLayout];[self.liveScreen.view layoutIfNeeded];[self.liveScreen layoutEmbeddedPlayer];CGRect rendererFrame=layoutProbe.view.frame,rendererBounds=self.liveScreen.playerHost.bounds;BOOL rendererResizesWithHost=rendererFrame.size.width==rendererBounds.size.width&&rendererFrame.size.height==rendererBounds.size.height&&rendererFrame.size.width>0&&rendererFrame.size.height>0;self.liveScreen.view.frame=originalScreenFrame;[self.liveScreen.view setNeedsLayout];[self.liveScreen.view layoutIfNeeded];[self.liveScreen layoutEmbeddedPlayer];
  NSData*gzipFixture=[[NSData alloc]initWithBase64EncodedString:@"H4sIAAAAAAACA7MpKbOzKSjKTy9KzM1NVUjOSMzLS82xVXJ2DgkzUlIoLkksKrFVMjIwMjMEYSMDIFDQNrAwMABJ5hcgyRkjydnZlGSW5KTaPe3rfr5n5Yuupuez1z3tnfpsa/eL9VNt9CGSNvpwi4FsoEMAHdULJo0AAAA=" options:0];NSString*gzipText=[[NSString alloc]initWithData:SYGunzipEPG(gzipFixture) encoding:NSUTF8StringEncoding];BOOL gzipEPGDecoded=[gzipText containsString:@"压缩节目单测试"];
  NSDictionary*report=@{@"nativeLiveScreen":@(ready),@"embeddedLiveScreen":@(embedded),@"pinnedPlayerHost":@(self.liveScreen.playerHost!=nil),@"airplayRoutePicker":@(self.liveScreen.routePicker!=nil),@"livePlayerAttachedToHost":@(playerAttached),@"livePlayerFillsHost":@(playerFillsHost),@"livePlayerResizesWithHost":@(resizesWithHost),@"routePickerAbovePlayer":@(routePickerAbovePlayer),@"avPlayerControllerEmbedded":@(avPlayerControllerEmbedded),@"avPlayerControllerResizesWithHost":@(rendererResizesWithHost),@"visibleNativeControls":@(self.liveScreen.content.subviews.count),@"categoryActionReachedBridge":@(self.smokeLiveCategoryLinked),@"categorySwitchReturnsToTop":@(self.smokeLiveScrollReset),@"fastSwitchUpdatesWithoutRebuild":@(self.smokeLiveFastStateApplied),@"gzipEPGDecoded":@(gzipEPGDecoded)};
  NSData*data=[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:NULL];
  [data writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-live-smoke.json"] atomically:YES];
  [self stopNativePlayback];self.smokeLiveVideoStarted=YES;
  // The layout fixture can finish failing after this direct bridge test starts.
  // Production channel switching updates nativeSession; this injected context
  // bypasses it, so ignore only the earlier fixture's stale live callbacks.
  [self.web evaluateJavaScript:@"(()=>{const forward=window.NativeTransport.onPlaybackEvent;window.NativeTransport.onPlaybackEvent=event=>{if(event.context?.startsWith('live:')&&event.context!=='live:smoke-cctv2')return;forward?.(event);};return window.NativeTransport.play('http://118.190.200.12:8767/cctv2.m3u8',{}, {context:'live:smoke-cctv2',frame:{visible:true,x:0,y:0,width:390,height:220,viewportWidth:390},title:'CCTV2财经模拟实播验证'});})()" completionHandler:^(id result,NSError*error){if(error){NSDictionary*failure=@{@"context":@"live:smoke-cctv2",@"status":@"failed",@"error":error.localizedDescription?:@"播放器桥接失败"};NSData*failureData=[NSJSONSerialization dataWithJSONObject:failure options:NSJSONWritingPrettyPrinted error:NULL];[failureData writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-live-video-smoke.json"] atomically:YES];}}];
}
#endif
// VOD stall grace: one AVPlayerItemPlaybackStalledNotification usually means a
// slow CDN segment behind the local HLS proxy, not a dead line. AVPlayer
// rebuffers on its own, so only act after 15s with no playback progress:
// three 5s checks. A re-stall refreshes the deadline, user pause cancels
// the watch, and recovery clears it. On expiry, first try the same line
// with CicadaPlayer (same quality, same position, direct fetch) — only if
// Cicada is unavailable or already tried does the line fail to JS.
- (void)checkVODStallForItem:(AVPlayerItem*)item context:(NSString*)context {
 __weak SYController*weakSelf=self;__weak AVPlayerItem*weakItem=item;
 dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(5*NSEC_PER_SEC)),dispatch_get_main_queue(),^{SYController*owner=weakSelf;if(!owner||owner.nativeItem!=weakItem||![context isEqualToString:owner.playContext?:@""]||!owner.vodStallWatchdogActive)return;
  AVPlayer*player=owner.nativePlayer.player;if(!player||player.rate<=0){owner.vodStallWatchdogActive=NO;return;}
  double now=CMTimeGetSeconds(player.currentTime);
  if(__builtin_isfinite(now)&&__builtin_isfinite(owner.vodStallTime)&&now>owner.vodStallTime+0.5){owner.vodStallWatchdogActive=NO;return;}
  if(++owner.vodStallChecks>=3){owner.vodStallWatchdogActive=NO;if([owner tryCicadaVODFallbackForItem:weakItem])return;[owner sendPlayback:@{@"context":context,@"status":@"failed",@"error":@"视频数据读取中断，请切换备用线路"}];[owner stopNativePlayback];return;}
  [owner checkVODStallForItem:weakItem context:context];});
}
- (void)stopNativePlayback {
 self.vodStallWatchdogActive=NO;self.vodStallTime=0;self.vodStallChecks=0;
  [self destroyCicadaPlayer];
  if(self.nativeItem){@try{[self.nativeItem removeObserver:self forKeyPath:@"status" context:&SYPlaybackStatus];}@catch(NSException*exception){}@try{[self.nativeItem removeObserver:self forKeyPath:@"presentationSize" context:&SYVideoPresentationSize];}@catch(NSException*exception){}self.nativeItem=nil;}
  if(self.liveScreen.liveRendererLayer){@try{[self.liveScreen.liveRendererLayer removeObserver:self forKeyPath:@"readyForDisplay" context:&SYLiveRendererDisplayReady];}@catch(NSException*exception){}self.liveScreen.liveRendererLayer=nil;}
  if(self.stalledObserver){[NSNotificationCenter.defaultCenter removeObserver:self.stalledObserver];self.stalledObserver=nil;}
  if(self.failedObserver){[NSNotificationCenter.defaultCenter removeObserver:self.failedObserver];self.failedObserver=nil;}
  if(self.timeObserver){[self.nativePlayer.player removeTimeObserver:self.timeObserver];self.timeObserver=nil;}
  if(self.endObserver){[NSNotificationCenter.defaultCenter removeObserver:self.endObserver];self.endObserver=nil;}
  self.nativeVideoReady=NO;self.liveRendererAttached=NO;self.liveRendererAttachAttempts=0;self.liveTrackInspectionItem=nil;[self.nativePlayer.player pause];self.nativePlayer.player=nil;[self.nativePlayer willMoveToParentViewController:nil];[self.nativePlayer.view removeFromSuperview];[self.nativePlayer removeFromParentViewController];self.nativePlayer=nil;
  [AVAudioSession.sharedInstance setActive:NO withOptions:1 error:NULL];
}
- (void)inspectLiveVideoTracksForItem:(AVPlayerItem*)item {
  if(!item||item!=self.nativeItem||![self.playContext hasPrefix:@"live:"]||self.liveTrackInspectionItem==item)return;
  self.liveTrackInspectionItem=item;AVAsset*asset=item.asset;__weak SYController*weakSelf=self;__weak AVPlayerItem*weakItem=item;
  [asset loadTracksWithMediaType:AVMediaTypeVideo completionHandler:^(NSArray<AVAssetTrack*>*tracks,NSError*error){
    dispatch_async(SYMainQueue(),^{SYController*owner=weakSelf;AVPlayerItem*current=weakItem;if(!owner||owner.nativeItem!=current||![owner.playContext hasPrefix:@"live:"])return;
      if(tracks.count==0){if(!error&&[owner tryCicadaFallbackForItem:current])return;[owner sendPlayback:@{@"context":owner.playContext?:@"",@"status":error?@"videoTrackUnknown":@"audioOnly",@"error":error.localizedDescription?:@"这条直播流没有可识别的视频轨道"}];return;}
      AVAssetTrack*track=tracks.firstObject;CGSize size=track.naturalSize;FourCharCode subtype=0;id description=track.formatDescriptions.firstObject;if(description)subtype=CMFormatDescriptionGetMediaSubType((__bridge CMFormatDescriptionRef)description);
      NSString*codec=(description&&subtype)?[NSString stringWithFormat:@"%c%c%c%c",(int)((subtype>>24)&0xff),(int)((subtype>>16)&0xff),(int)((subtype>>8)&0xff),(int)(subtype&0xff)]:@"未知";NSUInteger width=(NSUInteger)(size.width<0?-size.width:size.width),height=(NSUInteger)(size.height<0?-size.height:size.height);
      [owner sendPlayback:@{@"context":owner.playContext?:@"",@"status":@"videoTrack",@"width":@(width),@"height":@(height),@"codec":codec?:@""}];
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(15*NSEC_PER_SEC)),dispatch_get_main_queue(),^{SYController*strongOwner=weakSelf;if(!strongOwner||strongOwner.nativeItem!=current||![strongOwner.playContext hasPrefix:@"live:"]||strongOwner.nativeVideoReady)return;
        if(!strongOwner.cicadaFallbackAttempted&&[strongOwner tryCicadaFallbackForItem:current])return;
        [strongOwner sendPlayback:@{@"context":strongOwner.playContext?:@"",@"status":@"rendererFailed"}];
      });
    });
  }];
}
// ---------- Cicada 软解回退（AVPlayer 报 audioOnly 时，同一条流换 Cicada 解） ----------

- (BOOL)tryCicadaFallbackForItem:(AVPlayerItem*)item {
    if(!item||item!=self.nativeItem||![self.playContext hasPrefix:@"live:"])return NO;
    if(self.cicadaFallbackAttempted)return NO;
    if(![SYCicadaLivePlayer isAvailable])return NO;
    if(!self.liveScreen)return NO;
    NSURL*playURL=nil;
    if([item.asset isKindOfClass:AVURLAsset.class])playURL=((AVURLAsset*)item.asset).URL;
    if(!playURL)return NO;
    self.cicadaFallbackAttempted=YES;
    // 先停 AVPlayer 的声音，避免与 Cicada 的声音重叠；画面由 Cicada 接管。
    [self.nativePlayer.player pause];
    SYCicadaLivePlayer*cicada=[[SYCicadaLivePlayer alloc]initWithURL:playURL headers:self.livePlaybackHeaders networkTimeout:20];
    cicada.delegate=self;
    self.cicadaLivePlayer=cicada;
    self.cicadaFallbackActive=YES;
    UIView*view=cicada.playerView;
    view.frame=self.liveScreen.playerHost.bounds;
    view.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
    [self.liveScreen.playerHost addSubview:view];
    [self.liveScreen.playerHost bringSubviewToFront:view];
    [self.liveScreen.playerHost bringSubviewToFront:self.liveScreen.routePicker];
    // 盖住 AVPlayer 的黑画面层，避免布局回调把它重新顶到前面。
    self.nativePlayer.view.hidden=YES;
    [cicada applyVideoGravity:self.preferredVideoGravity.length?self.preferredVideoGravity:AVLayerVideoGravityResizeAspect];
    [cicada prepare];
    [cicada start];
    [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"cicadaFallback"}];
    return YES;
}

// ---------- Cicada 点播回退（AVPlayer 卡死/断流时，同线同清晰度换 Cicada 解） ----------
// 与直播回退的区别：点播走原站直连地址（绕过本地 HLS 代理，用 Cicada 自己的
// 网络栈 + 30 秒缓冲），不是代理地址；起播位置为卡死时的进度；倍速/静音沿用
// 当前设置。Cicada 也失败时走原有 failed 通道切线。
- (BOOL)tryCicadaVODFallbackForItem:(AVPlayerItem*)item {
    if(!item||item!=self.nativeItem||[self.playContext hasPrefix:@"live:"])return NO;
    if(self.cicadaVODFallbackAttempted)return NO;
    if(![SYCicadaLivePlayer isAvailable])return NO;
    NSURL*url=self.vodCicadaURL?:self.vodDirectURL;
    if(!url&&[item.asset isKindOfClass:AVURLAsset.class])url=((AVURLAsset*)item.asset).URL;
    if(!url)return NO;
    double startAt=CMTimeGetSeconds(self.nativePlayer.player.currentTime);
    if(!__builtin_isfinite(startAt)||startAt<0)startAt=MAX(0,self.vodStallTime);
    self.cicadaVODFallbackAttempted=YES;
    // 先停 AVPlayer，避免与 Cicada 的声音重叠；画面由 Cicada 接管。
    [self.nativePlayer.player pause];
    SYCicadaLivePlayer*cicada=[[SYCicadaLivePlayer alloc]initWithURL:url headers:self.vodCicadaHeaders networkTimeout:20];
    cicada.delegate=self;cicada.vodMode=YES;cicada.startPosition=startAt;
    self.cicadaLivePlayer=cicada;
    self.cicadaFallbackActive=YES;
    UIView*host=self.nativePlayer.view.superview?:self.appScreen.playerHost;
    UIView*view=cicada.playerView;
    view.frame=host.bounds;
    view.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
    [host addSubview:view];
    [host bringSubviewToFront:view];
    // 盖住 AVPlayer 的黑画面层，避免布局回调把它重新顶到前面。
    self.nativePlayer.view.hidden=YES;
    [cicada applyVideoGravity:self.preferredVideoGravity.length?self.preferredVideoGravity:AVLayerVideoGravityResizeAspect];
    float rate=self.nativePlayer.player.rate;if(rate>=0.5&&rate<=2.0)[cicada setRate:rate];
    if(self.nativePlayer.player.muted)[cicada setMuted:YES];
    [cicada prepare];
    [cicada start];
    [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"cicadaFallback"}];
    return YES;
}

- (void)destroyCicadaPlayer {
    SYCicadaLivePlayer*cicada=self.cicadaLivePlayer;
    self.cicadaLivePlayer=nil;
    self.cicadaFallbackActive=NO;
    if(!cicada)return;
    [cicada destroy];
    [cicada.playerView removeFromSuperview];
    // 恢复 AVPlayer 画面的可见性（若之后 AVPlayer 重新接管）。
    if(self.nativePlayer)self.nativePlayer.view.hidden=NO;
}

// SYCicadaLivePlayerDelegate
- (void)cicadaLivePlayerDidShowFirstFrame:(id)player size:(CGSize)size {
    if(player!=self.cicadaLivePlayer)return;
    if([self.playContext hasPrefix:@"live:"]){
        self.nativeVideoReady=YES;
        NSMutableDictionary*event=[@{@"context":self.playContext?:@"",@"status":@"cicadaVideoReady"} mutableCopy];
        if(size.width>0&&size.height>0){event[@"width"]=@(size.width);event[@"height"]=@(size.height);}
        [self sendPlayback:event];
        return;
    }
    // 点播：首帧已出，通知 JS 清掉报错、恢复播放状态（不断线、不降质）。
    self.nativeVideoReady=YES;
    [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"ready"}];
}

- (void)cicadaLivePlayer:(id)player didFailWithError:(NSError *)error {
    if(player!=self.cicadaLivePlayer)return;
    if(![self.playContext hasPrefix:@"live:"]){
        // 点播：Cicada 也失败，走原有 failed 通道切线，不恢复 AVPlayer（它已卡死）。
        [self destroyCicadaPlayer];
        [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"failed",@"error":error.localizedDescription?:@"软解播放失败，请切换线路"}];
        [self stopNativePlayback];
        return;
    }
    // Cicada 也失败：拆掉它，恢复 AVPlayer 的声音，回落到原 audioOnly 文案，不换线路。
    [self destroyCicadaPlayer];
    if(self.nativePlayer&&self.nativePlayer.player)[self.nativePlayer.player play];
    [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"audioOnly",@"error":error.localizedDescription?:@"这条直播流没有可识别的视频轨道"}];
}

- (void)cicadaLivePlayer:(id)player didUpdatePosition:(NSTimeInterval)position duration:(NSTimeInterval)duration {
    if(player!=self.cicadaLivePlayer||[self.playContext hasPrefix:@"live:"])return;
    [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"progress",@"time":@(position),@"duration":@(duration),@"removedAdSegments":@0,@"removedAdSeconds":@0}];
}

- (void)cicadaLivePlayerDidComplete:(id)player {
    if(player!=self.cicadaLivePlayer||[self.playContext hasPrefix:@"live:"])return;
    [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"ended"}];
}

- (void)attachLiveLayerRendererForItem:(AVPlayerItem*)item {
  if(!item||item!=self.nativeItem||!self.nativePlayer||!self.liveScreen||![self.playContext hasPrefix:@"live:"]||self.liveRendererAttached)return;
  [self.liveScreen layoutEmbeddedPlayer];AVPlayerLayer*layer=SYFindPlayerLayer(self.nativePlayer.view.layer,self.nativePlayer.player);
  if(!layer){if(++self.liveRendererAttachAttempts>40){[self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"rendererFailed",@"error":@"AVPlayer 没有创建可显示视频的画面层"}];return;}__weak SYController*weakSelf=self;__weak AVPlayerItem*weakItem=item;dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(0.2*NSEC_PER_SEC)),SYMainQueue(),^{SYController*owner=weakSelf;if(owner&&owner.nativeItem==weakItem&&!owner.liveRendererAttached)[owner attachLiveLayerRendererForItem:weakItem];});return;}
  self.liveRendererAttached=YES;self.liveScreen.liveRendererLayer=layer;[layer addObserver:self forKeyPath:@"readyForDisplay" options:NSKeyValueObservingOptionInitial|NSKeyValueObservingOptionNew context:&SYLiveRendererDisplayReady];
  [self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"rendererAttached"}];
}
- (void)observeValueForKeyPath:(NSString*)path ofObject:(id)object change:(NSDictionary*)change context:(void*)context {
  if(context==&SYLiveRendererDisplayReady){dispatch_async(SYMainQueue(),^{if(object!=self.liveScreen.liveRendererLayer||!self.liveScreen.liveRendererLayer.readyForDisplay||self.nativeVideoReady||![self.playContext hasPrefix:@"live:"])return;self.nativeVideoReady=YES;[self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"videoReady"}];});return;}
  if(context==&SYVideoPresentationSize){dispatch_async(SYMainQueue(),^{if(object!=self.nativeItem)return;CGSize size=self.nativeItem.presentationSize;if(size.width<=0||size.height<=0||!self.liveScreen.liveRendererLayer.readyForDisplay||self.nativeVideoReady||![self.playContext hasPrefix:@"live:"])return;self.nativeVideoReady=YES;[self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"videoReady"}];});return;}
  if(context!=&SYPlaybackStatus){[super observeValueForKeyPath:path ofObject:object change:change context:context];return;}
  dispatch_async(SYMainQueue(),^{
    if(object!=self.nativeItem)return;
    if(self.nativeItem.status==1){[self sendPlayback:@{@"context":self.playContext?:@"",@"status":@"ready"}];if([self.playContext hasPrefix:@"live:"])[self inspectLiveVideoTracksForItem:self.nativeItem];}
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
  if([type isEqualToString:@"playerControl"]){
    NSString*action=[body[@"action"] isKindOfClass:NSString.class]?body[@"action"]:@"";
    if([action isEqualToString:@"rate"]){
      double r=[body[@"rate"] doubleValue];
      if(r>=0.5&&r<=2.0){if(self.cicadaFallbackActive&&self.cicadaLivePlayer)[self.cicadaLivePlayer setRate:(float)r];else if(self.nativePlayer.player)self.nativePlayer.player.rate=(float)r;}
    }else if([action isEqualToString:@"seekDelta"]){
      double delta=[body[@"delta"] doubleValue];
      if(__builtin_isfinite(delta)){
        if(self.cicadaFallbackActive&&self.cicadaLivePlayer){double current=[self.cicadaLivePlayer currentPosition];if(__builtin_isfinite(current))[self.cicadaLivePlayer seekToTime:MAX(0,current+delta)];}
        else if(self.nativePlayer.player){double current=CMTimeGetSeconds(self.nativePlayer.player.currentTime);if(__builtin_isfinite(current))[self.nativePlayer.player seekToTime:CMTimeMakeWithSeconds(MAX(0,current+delta),600)];}
      }
    }else if([action isEqualToString:@"seekTo"]){
      double target=[body[@"time"] doubleValue];
      if(__builtin_isfinite(target)&&target>=0){if(self.cicadaFallbackActive&&self.cicadaLivePlayer)[self.cicadaLivePlayer seekToTime:target];else if(self.nativePlayer.player)[self.nativePlayer.player seekToTime:CMTimeMakeWithSeconds(target,600)];}
    }else if([action isEqualToString:@"gravity"]){
      NSString*mode=[body[@"mode"] isKindOfClass:NSString.class]?body[@"mode"]:@"fit";
      NSString*gravity=[mode isEqualToString:@"fill"]?AVLayerVideoGravityResizeAspectFill:([mode isEqualToString:@"stretch"]?AVLayerVideoGravityResize:AVLayerVideoGravityResizeAspect);
      self.preferredVideoGravity=gravity;
      if(self.nativePlayer)self.nativePlayer.videoGravity=gravity;
      if(self.liveScreen.liveRendererLayer)self.liveScreen.liveRendererLayer.videoGravity=gravity;
      if(self.cicadaLivePlayer)[self.cicadaLivePlayer applyVideoGravity:gravity];
    }else if([action isEqualToString:@"mute"]){
      BOOL nextMuted=body[@"muted"]!=nil?[body[@"muted"] boolValue]:(self.nativePlayer.player?!self.nativePlayer.player.muted:YES);
      if(self.nativePlayer.player)self.nativePlayer.player.muted=nextMuted;
      if(self.cicadaLivePlayer)[self.cicadaLivePlayer setMuted:nextMuted];
    }else if([action isEqualToString:@"pause"]){
      // 点播 Cicada：pause 只暂停不断流（睡眠定时用）；直播 Cicada 沿用 stop。
      if(self.cicadaFallbackActive&&self.cicadaLivePlayer&&![self.playContext hasPrefix:@"live:"])[self.cicadaLivePlayer pause];
      else{if(self.nativePlayer.player)[self.nativePlayer.player pause];if(self.cicadaLivePlayer)[self.cicadaLivePlayer stop];}
    }
    return;
  }
  if([type isEqualToString:@"pageState"]){if([body[@"state"] isKindOfClass:NSDictionary.class]){self.pageSnapshot=body[@"state"];
#if defined(SY_SIMULATOR_SMOKE)
    NSString*page=[self.pageSnapshot[@"page"] isKindOfClass:NSString.class]?self.pageSnapshot[@"page"]:@"unknown";self.smokeNavigationDebug=self.smokeNavigationDebug?:[NSMutableDictionary dictionary];self.smokeNavigationDebug[@"phase"]=[NSString stringWithFormat:@"%@-state-received",page];self.smokeNavigationDebug[@"page"]=page;self.smokeNavigationDebug[@"items"]=@([self.pageSnapshot[@"items"] isKindOfClass:NSArray.class]?[self.pageSnapshot[@"items"] count]:0);self.smokeNavigationDebug[@"groups"]=@([self.pageSnapshot[@"groups"] isKindOfClass:NSArray.class]?[self.pageSnapshot[@"groups"] count]:0);self.smokeNavigationDebug[@"sections"]=@([self.pageSnapshot[@"sections"] isKindOfClass:NSArray.class]?[self.pageSnapshot[@"sections"] count]:0);[self writeSmokeNavigationDebug];
#endif
    if(NSThread.isMainThread)[self.appScreen applyState:self.pageSnapshot];else dispatch_async(SYMainQueue(),^{[self.appScreen applyState:self.pageSnapshot];});
#if defined(SY_SIMULATOR_SMOKE)
    self.smokeNavigationDebug[@"phase"]=[NSString stringWithFormat:@"%@-state-%@",page,NSThread.isMainThread?@"applied":@"scheduled"];[self writeSmokeNavigationDebug];
#endif
  }return;}
  if([type isEqualToString:@"liveOpen"]){[self openLiveScreen];return;}
  if([type isEqualToString:@"liveClose"]){[self closeLiveScreen];return;}
  if([type isEqualToString:@"liveState"]||[type isEqualToString:@"liveStateFast"]){if([body[@"state"] isKindOfClass:NSDictionary.class]){self.liveSnapshot=body[@"state"];if([type isEqualToString:@"liveStateFast"])[self.liveScreen applyFastState:self.liveSnapshot];else [self.liveScreen applyState:self.liveSnapshot];}return;}
  if([type isEqualToString:@"stopLive"]){if([self.playContext hasPrefix:@"live:"])[self stopNativePlayback];return;}
  if([type isEqualToString:@"cancel"]){[self.tasks[identifier] cancel];[self.tasks removeObjectForKey:identifier];return;}
  if([type isEqualToString:@"liveCacheGet"]){NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Documents/sanyuan-live-cache.json"];NSData*data=[NSData dataWithContentsOfFile:path];id cached=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:NULL]:nil;[self deliver:@{@"id":identifier,@"cache":[cached isKindOfClass:NSDictionary.class]?cached:@{}}];return;}
  if([type isEqualToString:@"liveCachePut"]){NSString*urlText=[body[@"url"] isKindOfClass:NSString.class]?body[@"url"]:@"",*baseText=[body[@"baseURL"] isKindOfClass:NSString.class]?body[@"baseURL"]:urlText,*playlist=[body[@"text"] isKindOfClass:NSString.class]?body[@"text"]:@"";NSURL*playlistURL=[NSURL URLWithString:urlText],*baseURL=[NSURL URLWithString:baseText];BOOL validScheme=([playlistURL.scheme.lowercaseString isEqualToString:@"https"]||[playlistURL.scheme.lowercaseString isEqualToString:@"http"]),validBase=([baseURL.scheme.lowercaseString isEqualToString:@"https"]||[baseURL.scheme.lowercaseString isEqualToString:@"http"]);NSData*data=playlist.length?[NSJSONSerialization dataWithJSONObject:@{@"url":urlText,@"baseURL":baseText,@"text":playlist} options:0 error:NULL]:nil;if(!validScheme||!playlistURL.host.length||!validBase||!baseURL.host.length||!data||data.length>14*1024*1024){[self deliver:@{@"id":identifier,@"error":@"播放列表过大或地址无效，无法保存在本机"}];return;}NSString*path=[NSHomeDirectory() stringByAppendingPathComponent:@"Documents/sanyuan-live-cache.json"];BOOL saved=[data writeToFile:path atomically:YES];[self deliver:saved?@{@"id":identifier,@"ok":@YES}:@{@"id":identifier,@"error":@"无法将播放列表写入本机存储"}];return;}
  if([type hasPrefix:@"vault"]){
    NSString*key=body[@"key"];
    if(![key isEqualToString:@"kkapp"]&&![key isEqualToString:@"ncat"]&&![key isEqualToString:@"happ"]&&![key isEqualToString:@"souju"])return;
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
#if defined(SY_SIMULATOR_SMOKE)
    if([[body[@"context"] description] isEqualToString:@"smoke:playback"]){self.smokePlaybackDebug[@"phase"]=@"bridge-received";self.smokePlaybackDebug[@"bridgeURL"]=[body[@"url"] description]?:@"";[self writeSmokePlaybackDebug];}
#endif
    NSDictionary*headers=[body[@"headers"] isKindOfClass:NSDictionary.class]?body[@"headers"]:@{};
    NSString*requestedContext=[body[@"context"] isKindOfClass:NSString.class]?body[@"context"]:identifier;
    BOOL livePlayback=[requestedContext hasPrefix:@"live:"];
    NSURL*playURL=livePlayback?[self.hlsProxy prepareLive:url headers:headers]:[self.hlsProxy prepare:url headers:headers enabled:body[@"cleanHLS"]==nil||[body[@"cleanHLS"] boolValue]];
    if(!livePlayback&&[body[@"warmPlaylists"] isKindOfClass:NSArray.class])[self.hlsProxy seedPlaylists:body[@"warmPlaylists"]];
    #if defined(SY_SIMULATOR_SMOKE)
    self.smokeProxyActive=[playURL.scheme isEqualToString:@"http"];
    if([requestedContext isEqualToString:@"smoke:playback"]){NSURL*fixture=[self smokeAudioFixtureURL];if(!fixture){[self deliver:@{@"id":identifier,@"error":@"无法创建模拟器静音媒体"}];return;}playURL=fixture;}
#endif
    [self destroyCicadaPlayer];self.cicadaFallbackAttempted=NO;self.cicadaVODFallbackAttempted=NO;if(livePlayback)self.livePlaybackHeaders=headers;
    if(!livePlayback){self.vodDirectURL=url;self.vodCicadaHeaders=headers;NSString*cicadaURLText=[body[@"cicadaURL"] isKindOfClass:NSString.class]?body[@"cicadaURL"]:@"";NSURL*cicadaURL=[NSURL URLWithString:cicadaURLText];self.vodCicadaURL=([cicadaURL.scheme.lowercaseString isEqualToString:@"https"]||[cicadaURL.scheme.lowercaseString isEqualToString:@"http"])&&cicadaURL.host.length?cicadaURL:nil;}
    AVURLAsset*asset=[AVURLAsset URLAssetWithURL:playURL options:@{@"AVURLAssetHTTPHeaderFieldsKey":headers}];
    AVPlayerItem*item=[AVPlayerItem playerItemWithAsset:asset];
    // Live playlists must keep enough media queued to survive segment jitter.
    // Starting with a one-second buffer and disabling automatic waiting made
    // AVPlayer freeze on the first decoded frame on slower relay servers.
    // VOD keeps 30s ahead: a 4s buffer drained in seconds on slow CDNs
    // (Keke through the local HLS proxy), so playback stalled a few seconds
    // after starting and the 15s stall-grace expiry reloaded the player.
    item.preferredForwardBufferDuration=livePlayback?0:30;if(!livePlayback)item.audioTimePitchAlgorithm=AVAudioTimePitchAlgorithmTimeDomain;
    // Keep one live AVPlayer across channel and mirror changes.
    // Direct AVPlayerLayer rendering avoids controller-owned video output paths.
    if([requestedContext hasPrefix:@"live:"]&&[self.playContext hasPrefix:@"live:"]&&self.nativePlayer&&self.nativePlayer.player){
      self.nativePlayer.player.automaticallyWaitsToMinimizeStalling=YES;
      AVPlayerItem*old=self.nativeItem;if(old){@try{[old removeObserver:self forKeyPath:@"status" context:&SYPlaybackStatus];}@catch(NSException*exception){}}
      if(old){@try{[old removeObserver:self forKeyPath:@"presentationSize" context:&SYVideoPresentationSize];}@catch(NSException*exception){}}
      self.nativeVideoReady=NO;self.liveTrackInspectionItem=nil;
      if(self.stalledObserver){[NSNotificationCenter.defaultCenter removeObserver:self.stalledObserver];self.stalledObserver=nil;}
      if(self.failedObserver){[NSNotificationCenter.defaultCenter removeObserver:self.failedObserver];self.failedObserver=nil;}
      if(self.endObserver){[NSNotificationCenter.defaultCenter removeObserver:self.endObserver];self.endObserver=nil;}
      self.nativeItem=item;self.playContext=requestedContext;
      if([body[@"title"] isKindOfClass:NSString.class]){AVMutableMetadataItem*metadata=[AVMutableMetadataItem metadataItem];metadata.identifier=AVMetadataCommonIdentifierTitle;metadata.value=body[@"title"];item.externalMetadata=@[metadata];}
      [item addObserver:self forKeyPath:@"status" options:5 context:&SYPlaybackStatus];[item addObserver:self forKeyPath:@"presentationSize" options:1 context:&SYVideoPresentationSize];
      __weak SYController*weakOwner=self;__weak AVPlayerItem*weakItem=item;NSString*liveContext=requestedContext;
      self.stalledObserver=[NSNotificationCenter.defaultCenter addObserverForName:AVPlayerItemPlaybackStalledNotification object:item queue:nil usingBlock:^(NSNotification*note){dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;[owner sendPlayback:@{@"context":liveContext,@"status":@"failed",@"error":@"视频数据读取中断，请切换备用线路"}];});}];
      self.failedObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemFailedToPlayToEndTimeNotification" object:item queue:nil usingBlock:^(NSNotification*note){NSError*error=note.userInfo[@"AVPlayerItemFailedToPlayToEndTimeErrorKey"];dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;[owner sendPlayback:@{@"context":liveContext,@"status":@"failed",@"error":error.localizedDescription?:@"视频播放中断，请切换备用线路"}];});}];
      self.endObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemDidPlayToEndTimeNotification" object:item queue:nil usingBlock:^(NSNotification*note){dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(owner.nativeItem==weakItem)[owner sendPlayback:@{@"context":liveContext,@"status":@"ended"}];});}];
      [self.nativePlayer.player replaceCurrentItemWithPlayerItem:item];if(self.liveScreen.liveRendererLayer)self.liveScreen.liveRendererLayer.player=self.nativePlayer.player;[self layoutPlayer:body[@"frame"]?:@{}];[self.nativePlayer.player play];
      [self deliver:@{@"id":identifier,@"ok":@YES}];return;
    }
    [self stopNativePlayback];
    [AVAudioSession.sharedInstance setCategory:AVAudioSessionCategoryPlayback error:NULL];
    [AVAudioSession.sharedInstance setActive:YES error:NULL];
    SYPlayerViewController*player=[SYPlayerViewController new];self.nativePlayer=player;
    player.entersFullScreenWhenPlaybackBegins=NO;player.exitsFullScreenWhenPlaybackEnds=NO;player.delegate=player;player.updatesNowPlayingInfoCenter=YES;player.allowsPictureInPicturePlayback=YES;player.canStartPictureInPictureAutomaticallyFromInline=YES;player.videoGravity=self.preferredVideoGravity.length?self.preferredVideoGravity:AVLayerVideoGravityResizeAspect;
    self.nativeItem=item;self.nativeVideoReady=NO;
    __weak SYController*weakOwner=self;__weak AVPlayerItem*weakItem=item;
    self.stalledObserver=[NSNotificationCenter.defaultCenter addObserverForName:AVPlayerItemPlaybackStalledNotification object:item queue:nil usingBlock:^(NSNotification*note){dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;BOOL live=[owner.playContext hasPrefix:@"live:"];if(live){[owner sendPlayback:@{@"context":owner.playContext?:@"",@"status":@"failed",@"error":@"视频数据读取中断，请切换备用线路"}];return;}AVPlayer*player=owner.nativePlayer.player;owner.vodStallTime=player?CMTimeGetSeconds(player.currentTime):0;owner.vodStallChecks=0;if(owner.vodStallWatchdogActive)return;owner.vodStallWatchdogActive=YES;[owner checkVODStallForItem:weakItem context:owner.playContext?:@""];});}];
    self.failedObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemFailedToPlayToEndTimeNotification" object:item queue:nil usingBlock:^(NSNotification*note){NSError*error=note.userInfo[@"AVPlayerItemFailedToPlayToEndTimeErrorKey"];dispatch_async(SYMainQueue(),^{SYController*owner=weakOwner;if(!owner||owner.nativeItem!=weakItem)return;BOOL live=[owner.playContext hasPrefix:@"live:"];if(!live&&[owner tryCicadaVODFallbackForItem:weakItem])return;[owner sendPlayback:@{@"context":owner.playContext?:@"",@"status":@"failed",@"error":error.localizedDescription?:@"视频播放中断，请切换备用线路"}];if(!live)[owner stopNativePlayback];});}];
    if([body[@"title"] isKindOfClass:NSString.class]){AVMutableMetadataItem*metadata=[AVMutableMetadataItem metadataItem];metadata.identifier=AVMetadataCommonIdentifierTitle;metadata.value=body[@"title"];item.externalMetadata=@[metadata];}
    self.playContext=[body[@"context"] isKindOfClass:NSString.class]?body[@"context"]:identifier;
    player.player=[AVPlayer playerWithPlayerItem:item];player.player.automaticallyWaitsToMinimizeStalling=YES;if(livePlayback){[item addObserver:self forKeyPath:@"presentationSize" options:1 context:&SYVideoPresentationSize];}[item addObserver:self forKeyPath:@"status" options:5 context:&SYPlaybackStatus];
    __weak SYController*owner=self;__weak SYPlayerViewController*weakPlayer=player;
    player.onClose=^{SYController*strongOwner=owner;if(strongOwner.nativePlayer==weakPlayer)[strongOwner stopNativePlayback];};
    player.onRestore=^(void(^handler)(BOOL)){SYController*strongOwner=owner;if(!strongOwner||!weakPlayer){handler(NO);return;}handler(weakPlayer.parentViewController==strongOwner||weakPlayer.parentViewController==strongOwner.appScreen||weakPlayer.parentViewController==strongOwner.liveScreen);};
    self.timeObserver=[player.player addPeriodicTimeObserverForInterval:CMTimeMakeWithSeconds(livePlayback?3:5,600) queue:SYMainQueue() usingBlock:^(CMTime time){
      SYController*strongOwner=owner;if(!strongOwner||strongOwner.nativePlayer!=weakPlayer)return;
      if(strongOwner.cicadaFallbackActive)return;
      double seconds=CMTimeGetSeconds(time);if(!__builtin_isfinite(seconds)||seconds<0)return;
      double totalDuration=strongOwner.nativeItem?CMTimeGetSeconds(strongOwner.nativeItem.duration):0;
      [strongOwner sendPlayback:@{@"context":strongOwner.playContext?:@"",@"status":@"progress",@"time":@(seconds),@"duration":@(__builtin_isfinite(totalDuration)&&totalDuration>0?totalDuration:0),@"removedAdSegments":@(strongOwner.hlsProxy.removed),@"removedAdSeconds":@(strongOwner.hlsProxy.removedSeconds)}];
    }];
    self.endObserver=[NSNotificationCenter.defaultCenter addObserverForName:@"AVPlayerItemDidPlayToEndTimeNotification" object:item queue:nil usingBlock:^(id notification){
      dispatch_async(SYMainQueue(),^{SYController*strongOwner=owner;if(strongOwner.nativePlayer!=weakPlayer)return;[strongOwner sendPlayback:@{@"context":strongOwner.playContext?:@"",@"status":@"ended"}];});
    }];
    double start=[body[@"startAt"] doubleValue];if(__builtin_isfinite(start)&&start>0)[player.player seekToTime:CMTimeMakeWithSeconds(start,600)];
    double requestedRate=[body[@"rate"] doubleValue];float rate=(requestedRate>=0.5&&requestedRate<=2)?(float)requestedRate:1;
    UIViewController*playerOwner=[self.playContext hasPrefix:@"live:"]&&self.liveScreen?self.liveScreen:([self.appScreen.state[@"page"] isEqualToString:@"detail"]?self.appScreen:self);
    [playerOwner addChildViewController:player];
    player.view.frame=(CGRect){{0,0},{0,0}};
    if([self.playContext hasPrefix:@"live:"]&&self.liveScreen) [self.liveScreen.playerHost addSubview:player.view];
    else if(playerOwner==self.appScreen)[self.appScreen.playerHost addSubview:player.view];
    else if([self.playContext hasPrefix:@"live:"]) [self.view addSubview:player.view];
    else [self.web.scrollView addSubview:player.view];
    [player didMoveToParentViewController:playerOwner];
    if([body[@"frame"] isKindOfClass:NSDictionary.class])[self layoutPlayer:body[@"frame"]];if(livePlayback)[self attachLiveLayerRendererForItem:item];
    if(body[@"muted"]!=nil)player.player.muted=[body[@"muted"] boolValue];
    [player.player play];player.player.rate=rate;
#if defined(SY_SIMULATOR_SMOKE)
    if([requestedContext isEqualToString:@"smoke:playback"]){self.smokePlaybackDebug[@"phase"]=@"player-created";self.smokePlaybackDebug[@"playURL"]=playURL.absoluteString?:@"";self.smokePlaybackDebug[@"playerOwner"]=playerOwner==self.appScreen?@"appScreen":@"controller";self.smokePlaybackDebug[@"playItemStatus"]=@(item.status);[self writeSmokePlaybackDebug];}
#endif
    [self deliver:@{@"id":identifier,@"ok":@YES}];return;
  }
  if(![type isEqualToString:@"request"])return;
  NSString*method=body[@"method"]?:@"GET";
  if(![method isEqualToString:@"GET"]&&![method isEqualToString:@"POST"]&&![method isEqualToString:@"HEAD"]){[self deliver:@{@"id":identifier,@"error":@"不支持的请求方法"}];return;}
  NSMutableURLRequest*request=[NSMutableURLRequest requestWithURL:url];request.HTTPMethod=method;request.timeoutInterval=18;if([body[@"livePlaylist"] boolValue])request.cachePolicy=NSURLRequestReloadIgnoringLocalCacheData;
  if([body[@"headers"] isKindOfClass:NSDictionary.class])request.allHTTPHeaderFields=body[@"headers"];
  if([body[@"body"] isKindOfClass:NSString.class])request.HTTPBody=[body[@"body"] dataUsingEncoding:NSUTF8StringEncoding];
  __weak SYController*weakSelf=self;
  NSURLSessionDataTask*task=[self.session dataTaskWithRequest:request completionHandler:^(NSData*data,NSURLResponse*response,NSError*error){
    SYController*owner=weakSelf;if(!owner)return;
    dispatch_async(SYMainQueue(),^{[owner.tasks removeObjectForKey:identifier];});
    if(error){[owner deliver:@{@"id":identifier,@"error":error.localizedDescription?:@"网络错误",@"errorCode":@(error.code)}];return;}
    if(data.length>12*1024*1024){[owner deliver:@{@"id":identifier,@"error":@"响应过大"}];return;}
    NSData*payload=data;if([body[@"liveGuide"] boolValue]){NSData*decoded=SYGunzipEPG(data);if(!decoded){[owner deliver:@{@"id":identifier,@"error":@"节目单压缩文件损坏或解压后超过 48 MB"}];return;}payload=decoded;}
    NSHTTPURLResponse*http=(NSHTTPURLResponse*)response;
    [owner deliver:@{@"id":identifier,@"status":@(http.statusCode),@"url":http.URL.absoluteString?:@"",@"headers":http.allHeaderFields?:@{},@"bodyBase64":[payload base64EncodedStringWithOptions:0]?:@""}];
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
