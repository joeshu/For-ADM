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
typedef long NSInteger;
typedef double CGFloat;
typedef signed char BOOL;
#define YES ((BOOL)1)
#define NO ((BOOL)0)
#define nil ((id)0)
#define NULL ((void*)0)
typedef struct {CGFloat x,y;} CGPoint;
typedef struct {CGFloat width,height;} CGSize;
typedef struct {CGPoint origin;CGSize size;} CGRect;
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
@end
@interface NSNumber:NSObject
+ (NSNumber*)numberWithInt:(int)value;
+ (NSNumber*)numberWithInteger:(NSInteger)value;
+ (NSNumber*)numberWithBool:(BOOL)value;
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
@property(readonly) NSUInteger length;
- (NSString*)base64EncodedStringWithOptions:(NSUInteger)options;
- (instancetype)initWithBase64EncodedString:(NSString*)string options:(NSUInteger)options;
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
@end
@interface NSURLResponse:NSObject @end
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
@end
@interface UIView:NSObject
@property CGRect frame;
@property CGRect bounds;
@property NSUInteger autoresizingMask;
@property(strong) UIColor*backgroundColor;
- (void)addSubview:(UIView*)view;
@end
@interface UIViewController:NSObject
@property(strong) UIView*view;
- (void)viewDidLoad;
- (void)viewDidLayoutSubviews;
- (void)presentViewController:(UIViewController*)controller animated:(BOOL)animated completion:(void(^)(void))completion;
@end
@interface UIScreen:NSObject
+ (UIScreen*)mainScreen;
@property(readonly) CGRect bounds;
@end
@interface UIWindow:UIView
- (instancetype)initWithFrame:(CGRect)frame;
@property(strong) UIViewController*rootViewController;
- (void)makeKeyAndVisible;
@end
@protocol UIApplicationDelegate<NSObject> @end
@interface UIApplication:NSObject @end
extern int UIApplicationMain(int,char**,NSString*,NSString*);
extern NSString*NSStringFromClass(Class);
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
@end
@interface AVPlayer:NSObject
+ (instancetype)playerWithPlayerItem:(AVPlayerItem*)item;
- (void)play;
@end
@interface AVPlayerViewController:UIViewController
@property(strong) AVPlayer*player;
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
