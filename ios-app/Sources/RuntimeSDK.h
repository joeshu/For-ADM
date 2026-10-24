// Minimal public Objective-C ABI declarations for the Linux cross-build.
// macOS builds use Apple's actual SDK headers instead. No Apple SDK is bundled.
#ifndef __has_include
#define __has_include(x) 0
#endif
#if __has_include(<UIKit/UIKit.h>)
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <AVKit/AVKit.h>
#import <Security/Security.h>
#define SYMainQueue() dispatch_get_main_queue()
#else
typedef unsigned long NSUInteger;
struct dispatch_queue_s;
typedef struct {long long value;int timescale;unsigned int flags;long long epoch;} CMTime;
extern CMTime CMTimeMakeWithSeconds(double,int);
extern double CMTimeGetSeconds(CMTime);
typedef long NSInteger;
typedef void* SEL;
typedef NSInteger UIStatusBarStyle;
typedef NSInteger WKNavigationActionPolicy;
typedef double CGFloat;
typedef signed char BOOL;
#define YES ((BOOL)1)
#define NO ((BOOL)0)
#define nil ((id)0)
#define NULL ((void*)0)
#define UIControlEventTouchUpInside (1UL<<6)
#define UIControlStateNormal 0
#define UIControlStateSelected 4
typedef struct {CGFloat x,y;} CGPoint;
typedef struct {CGFloat width,height;} CGSize;
typedef struct {CGPoint origin;CGSize size;} CGRect;
#define CGRectMake(x,y,w,h) ((CGRect){{(x),(y)},{(w),(h)}})
#define CGSizeMake(w,h) ((CGSize){(w),(h)})
typedef NSUInteger NSStringEncoding;
enum {NSUTF8StringEncoding=4};
@class NSString,NSArray,NSDictionary,NSData,NSURL,NSError;
@protocol NSObject @end
__attribute__((objc_root_class))
@interface NSObject <NSObject>
+ (instancetype)alloc;
+ (instancetype)new;
+ (Class)class;
- (instancetype)init;
- (BOOL)isKindOfClass:(Class)cls;
- (void)addObserver:(NSObject*)observer forKeyPath:(NSString*)keyPath options:(NSUInteger)options context:(void*)context;
- (void)removeObserver:(NSObject*)observer forKeyPath:(NSString*)keyPath context:(void*)context;
- (void)observeValueForKeyPath:(NSString*)keyPath ofObject:(id)object change:(NSDictionary*)change context:(void*)context;
@end
@interface NSString:NSObject
@property(readonly) NSUInteger length;
+ (instancetype)stringWithFormat:(NSString*)format,...;
- (instancetype)initWithData:(NSData*)data encoding:(NSStringEncoding)encoding;
- (NSData*)dataUsingEncoding:(NSStringEncoding)encoding;
- (NSString*)stringByAppendingPathComponent:(NSString*)path;
- (BOOL)isEqualToString:(NSString*)other;
- (BOOL)hasPrefix:(NSString*)prefix;
- (NSString*)lowercaseString;
- (NSString*)stringByStandardizingPath;
- (NSString*)substringFromIndex:(NSUInteger)index;
@end
@interface NSNumber:NSObject
+ (NSNumber*)numberWithInt:(int)value;
+ (NSNumber*)numberWithInteger:(NSInteger)value;
+ (NSNumber*)numberWithBool:(BOOL)value;
+ (NSNumber*)numberWithDouble:(double)value;
- (double)doubleValue;
- (NSInteger)integerValue;
- (NSString*)stringValue;
@end
@interface NSArray:NSObject
+ (instancetype)arrayWithObjects:(const id[])objects count:(NSUInteger)count;
@property(readonly) NSUInteger count;
@end
@interface NSDictionary:NSObject
+ (instancetype)dictionaryWithObjects:(const id[])objects forKeys:(const id[])keys count:(NSUInteger)count;
- (id)objectForKeyedSubscript:(id)key;
@end
@interface NSMutableDictionary:NSDictionary
+ (instancetype)dictionary;
- (void)setObject:(id)object forKeyedSubscript:(id)key;
- (void)removeObjectForKey:(id)key;
@end
@interface NSData:NSObject
+ (instancetype)dataWithContentsOfFile:(NSString*)path;
@property(readonly) NSUInteger length;
- (NSString*)base64EncodedStringWithOptions:(NSUInteger)options;
- (instancetype)initWithBase64EncodedString:(NSString*)string options:(NSUInteger)options;
- (BOOL)writeToFile:(NSString*)path atomically:(BOOL)atomically;
@end
@interface NSBundle:NSObject
+ (instancetype)mainBundle;
@property(readonly) NSString*resourcePath;
@end
@interface NSURL:NSObject
+ (instancetype)URLWithString:(NSString*)string;
+ (instancetype)fileURLWithPath:(NSString*)path isDirectory:(BOOL)isDirectory;
@property(readonly) NSString*scheme;
@property(readonly) NSString*host;
@property(readonly) NSString*path;
@property(readonly) NSNumber*port;
@property(readonly) NSString*absoluteString;
@property(readonly) BOOL isFileURL;
@end
@interface NSURLRequest:NSObject
@property(readonly) NSURL*URL;
@end
@interface NSMutableURLRequest:NSURLRequest
+ (instancetype)requestWithURL:(NSURL*)url;
@property(copy) NSString*HTTPMethod;
@property(copy) NSDictionary*allHTTPHeaderFields;
@property(copy) NSData*HTTPBody;
@property double timeoutInterval;
@end
@interface NSError:NSObject
@property(readonly) NSString*localizedDescription;
@property(readonly) NSInteger code;
@end
@interface NSURLResponse:NSObject
@property(readonly) NSURL*URL;
@end
@interface NSHTTPURLResponse:NSURLResponse
@property(readonly) NSInteger statusCode;
@property(readonly) NSDictionary*allHeaderFields;
@end
@interface NSURLSessionConfiguration:NSObject
+ (instancetype)ephemeralSessionConfiguration;
@property double timeoutIntervalForRequest;
@property NSUInteger HTTPMaximumConnectionsPerHost;
@end
@interface NSURLSessionDataTask:NSObject
- (void)resume;
- (void)cancel;
@end
@interface NSURLSession:NSObject
+ (instancetype)sessionWithConfiguration:(NSURLSessionConfiguration*)configuration;
- (NSURLSessionDataTask*)dataTaskWithRequest:(NSURLRequest*)request completionHandler:(void(^)(NSData*,NSURLResponse*,NSError*))completion;
@end
@interface NSJSONSerialization:NSObject
+ (NSData*)dataWithJSONObject:(id)object options:(NSUInteger)options error:(NSError**)error;
+ (id)JSONObjectWithData:(NSData*)data options:(NSUInteger)options error:(NSError**)error;
@end
@interface UIColor:NSObject
+ (UIColor*)colorWithRed:(CGFloat)red green:(CGFloat)green blue:(CGFloat)blue alpha:(CGFloat)alpha;
+ (UIColor*)whiteColor;
+ (UIColor*)blackColor;
+ (UIColor*)systemBlueColor;
@end
@interface UIFont:NSObject
+ (instancetype)systemFontOfSize:(CGFloat)size;
+ (instancetype)boldSystemFontOfSize:(CGFloat)size;
@end
@interface UIView:NSObject
- (instancetype)initWithFrame:(CGRect)frame;
@property CGRect frame;
@property CGRect bounds;
@property NSUInteger autoresizingMask;
@property(strong) UIColor*backgroundColor;
@property BOOL clipsToBounds;
@property(readonly) NSArray*subviews;
- (void)addSubview:(UIView*)view;
- (void)bringSubviewToFront:(UIView*)view;
- (void)removeFromSuperview;
- (CGRect)convertRect:(CGRect)rect toView:(UIView*)view;
@end
@interface UIControl:UIView
@property BOOL enabled;
@property BOOL selected;
- (void)addTarget:(id)target action:(SEL)action forControlEvents:(NSUInteger)events;
@end
@interface UILabel:UIView
@property(copy) NSString*text;
@property(strong) UIFont*font;
@property(strong) UIColor*textColor;
@property NSInteger numberOfLines;
@property NSInteger textAlignment;
@end
@interface UIButton:UIControl
@property(readonly) UILabel*titleLabel;
+ (instancetype)buttonWithType:(NSInteger)type;
- (void)setTitle:(NSString*)title forState:(NSUInteger)state;
- (void)setTitleColor:(UIColor*)color forState:(NSUInteger)state;
@end
@interface UITextField:UIControl
@property(copy) NSString*text;
@property(copy) NSString*placeholder;
@property(strong) UIFont*font;
@property(strong) UIColor*textColor;
@property NSInteger borderStyle;
@property NSInteger keyboardType;
@property NSInteger clearButtonMode;
@end
@interface UIScrollView:UIView
@property CGSize contentSize;
@property BOOL showsVerticalScrollIndicator;
@property BOOL showsHorizontalScrollIndicator;
@property BOOL alwaysBounceVertical;
@end
@interface UIViewController:NSObject
@property(strong) UIView*view;
@property(readonly) UIViewController*parentViewController;
@property(readonly) UIViewController*presentedViewController;
@property NSInteger modalPresentationStyle;
@property(readonly) UIStatusBarStyle preferredStatusBarStyle;
- (void)addChildViewController:(UIViewController*)controller;
- (void)willMoveToParentViewController:(UIViewController*)controller;
- (void)didMoveToParentViewController:(UIViewController*)controller;
- (void)removeFromParentViewController;
- (void)viewDidLoad;
- (void)viewDidLayoutSubviews;
- (void)setNeedsStatusBarAppearanceUpdate;
- (void)viewDidDisappear:(BOOL)animated;
- (void)viewDidAppear:(BOOL)animated;
- (void)dismissViewControllerAnimated:(BOOL)animated completion:(void(^)(void))completion;
- (void)presentViewController:(UIViewController*)controller animated:(BOOL)animated completion:(void(^)(void))completion;
@end
@interface UIScreen:NSObject
+ (UIScreen*)mainScreen;
@property(readonly) CGRect bounds;
@end
@interface UIScene:NSObject @end
@interface UIWindowScene:UIScene @end
@interface UISceneSession:NSObject @end
@interface UISceneConnectionOptions:NSObject @end
@protocol UIWindowSceneDelegate<NSObject> @end
@interface UIWindow:UIView
- (instancetype)initWithFrame:(CGRect)frame;
- (instancetype)initWithWindowScene:(UIWindowScene*)scene;
@property(strong) UIViewController*rootViewController;
- (void)makeKeyAndVisible;
@end
@protocol UIApplicationDelegate<NSObject> @end
@interface UIApplication:NSObject @end
extern int UIApplicationMain(int,char**,NSString*,NSString*);
extern NSString*NSStringFromClass(Class);
extern NSString*NSHomeDirectory(void);
@protocol WKScriptMessageHandler<NSObject>
- (void)userContentController:(id)controller didReceiveScriptMessage:(id)message;
@end
@protocol WKNavigationDelegate<NSObject> @end
@interface WKUserContentController:NSObject
- (void)addScriptMessageHandler:(id<WKScriptMessageHandler>)handler name:(NSString*)name;
- (void)removeScriptMessageHandlerForName:(NSString*)name;
@end
@interface WKWebViewConfiguration:NSObject
@property(strong) WKUserContentController*userContentController;
@property BOOL allowsInlineMediaPlayback;
@property NSUInteger mediaTypesRequiringUserActionForPlayback;
@end
@interface WKFrameInfo:NSObject
@property(readonly) BOOL isMainFrame;
@property(readonly) NSURLRequest*request;
@end
@interface WKScriptMessage:NSObject
@property(readonly) id body;
@property(readonly) WKFrameInfo*frameInfo;
@end
@interface WKWebView:UIView
@property(readonly) UIScrollView*scrollView;
- (instancetype)initWithFrame:(CGRect)frame configuration:(WKWebViewConfiguration*)configuration;
@property(weak) id<WKNavigationDelegate>navigationDelegate;
- (id)loadFileURL:(NSURL*)url allowingReadAccessToURL:(NSURL*)directory;
- (void)evaluateJavaScript:(NSString*)script completionHandler:(void(^)(id,NSError*))completion;
@end
@interface WKNavigationAction:NSObject
@property(readonly) NSURLRequest*request;
@end
@interface AVURLAsset:NSObject
+ (instancetype)URLAssetWithURL:(NSURL*)url options:(NSDictionary*)options;
@end
@interface AVPlayerItem:NSObject
+ (instancetype)playerItemWithAsset:(AVURLAsset*)asset;
@property(readonly) NSInteger status;
@property(readonly) NSError*error;
@property(readonly) CMTime duration;
@property double preferredForwardBufferDuration;
@property BOOL automaticallyWaitsToMinimizeStalling;
@property(copy) NSString*audioTimePitchAlgorithm;
@property(copy) NSArray*externalMetadata;
@end
@interface AVPlayer:NSObject
+ (instancetype)playerWithPlayerItem:(AVPlayerItem*)item;
- (void)replaceCurrentItemWithPlayerItem:(AVPlayerItem*)item;
- (void)play;
- (void)pause;
@property float rate;
- (void)seekToTime:(CMTime)time;
@property(readonly) CMTime currentTime;
- (id)addPeriodicTimeObserverForInterval:(CMTime)time queue:(struct dispatch_queue_s*)queue usingBlock:(void(^)(CMTime))block;
- (void)removeTimeObserver:(id)observer;
@end
@protocol AVPlayerViewControllerDelegate<NSObject> @end
@interface AVPlayerViewController:UIViewController
@property(strong) AVPlayer*player;
@property(weak) id<AVPlayerViewControllerDelegate>delegate;
@property BOOL allowsPictureInPicturePlayback;
@property BOOL entersFullScreenWhenPlaybackBegins;
@property BOOL exitsFullScreenWhenPlaybackEnds;
@property BOOL updatesNowPlayingInfoCenter;
@property BOOL canStartPictureInPictureAutomaticallyFromInline;
@property(copy) NSString*videoGravity;
@end
@interface AVRoutePickerView:UIView
@property(strong) UIColor*activeTintColor;
@property(strong) UIColor*tintColor;
- (instancetype)initWithFrame:(CGRect)frame;
@end
extern NSString*const AVLayerVideoGravityResizeAspect;
extern NSString*const AVPlayerItemPlaybackStalledNotification;
extern NSString*const AVAudioSessionCategoryPlayback;
extern NSString*const AVAudioTimePitchAlgorithmTimeDomain;
extern NSString*const AVMetadataCommonIdentifierTitle;
@interface AVAudioSession:NSObject
+ (instancetype)sharedInstance;
- (BOOL)setCategory:(NSString*)category error:(NSError**)error;
- (BOOL)setActive:(BOOL)active error:(NSError**)error;
- (BOOL)setActive:(BOOL)active withOptions:(NSUInteger)options error:(NSError**)error;
@end
@interface AVMutableMetadataItem:NSObject
+ (instancetype)metadataItem;
@property(copy) NSString*identifier;
@property(copy) id value;
@end
@interface NSNotification:NSObject
@property(readonly) NSDictionary*userInfo;
@end
@interface NSNotificationCenter:NSObject
+ (instancetype)defaultCenter;
- (id)addObserverForName:(NSString*)name object:(id)object queue:(id)queue usingBlock:(void(^)(NSNotification*))block;
- (void)removeObserver:(id)observer;
@end
typedef const void* CFTypeRef;
typedef const void* CFDictionaryRef;
extern const void *kSecClass,*kSecClassGenericPassword,*kSecAttrService,*kSecAttrAccount,*kSecValueData,*kSecReturnData,*kSecAttrAccessible,*kSecAttrAccessibleWhenUnlockedThisDeviceOnly;
extern int SecItemCopyMatching(CFDictionaryRef,CFTypeRef*);
extern int SecItemAdd(CFDictionaryRef,CFTypeRef*);
extern int SecItemDelete(CFDictionaryRef);
struct dispatch_queue_s;
extern struct dispatch_queue_s _dispatch_main_q;
#define SYMainQueue() (&_dispatch_main_q)
extern void dispatch_async(struct dispatch_queue_s*,void(^)(void));
#endif
