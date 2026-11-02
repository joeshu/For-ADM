#import <Foundation/Foundation.h>
#import "NodePluginRuntime.h"
// One background Node session for the bundled, pinned Hongguo provider.
@interface SYHongguoRuntime:NSObject
@property(nonatomic,strong) NSOperationQueue *queue;
@property(nonatomic,copy) NSString *root;
@property(nonatomic,copy) NSString *session;
@property(nonatomic,copy) NSString *previousFile;
- (void)resolveSeries:(NSString*)series episode:(NSString*)episode bridge:(NSURL*)bridge token:(NSString*)token completion:(void(^)(NSURL*,NSError*))completion;
@end
@implementation SYHongguoRuntime
- (instancetype)init {if((self=[super init])){_queue=[NSOperationQueue new];_queue.maxConcurrentOperationCount=1;_session=NSUUID.UUID.UUIDString;_root=[NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory,NSUserDomainMask,YES).firstObject stringByAppendingPathComponent:@"Services/Hongguo-0.2.49"];}return self;}
- (NSDictionary*)call:(NSString*)operation payload:(NSDictionary*)payload error:(NSError**)error {
 NSData *data=[NSJSONSerialization dataWithJSONObject:payload options:0 error:error];if(!data)return nil;
 NSString *reply=[[NodePluginRuntime shared] callOperation:operation json:[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding] error:error];
 NSDictionary *result=reply?[NSJSONSerialization JSONObjectWithData:[reply dataUsingEncoding:NSUTF8StringEncoding] options:0 error:error]:nil;
 if(![result[@"ok"] boolValue]){NSString *reason=[result[@"error"] isKindOfClass:NSString.class]?result[@"error"]:@"runtime request failed";NSRegularExpression *redact=[NSRegularExpression regularExpressionWithPattern:@"https?://[^\\s]+" options:NSRegularExpressionCaseInsensitive error:nil];reason=[redact stringByReplacingMatchesInString:reason options:0 range:NSMakeRange(0,reason.length) withTemplate:@"[URL hidden]"];NSLog(@"SYHongguo operation=%@ error=%@",operation,[reason substringToIndex:MIN(reason.length,180)]);if(error&&!*error)*error=[NSError errorWithDomain:@"SYHongguo" code:1 userInfo:@{NSLocalizedDescriptionKey:@"红果后台未返回可播放媒体，请重试或切换剧集"}];return nil;}return result;
}
- (void)resolveSeries:(NSString*)series episode:(NSString*)episode bridge:(NSURL*)bridge token:(NSString*)token completion:(void(^)(NSURL*,NSError*))completion {
 // Keep only the latest queued request. An active download can finish and
 // populate the cache; cancelled web promises ignore its old reply.
 [self.queue cancelAllOperations];
 [self.queue addOperationWithBlock:^{@autoreleasepool{
  NSError *error=nil;NSFileManager *fm=NSFileManager.defaultManager;
  [fm createDirectoryAtPath:self.root withIntermediateDirectories:YES attributes:nil error:&error];
  self.root=[NSURL fileURLWithPath:self.root].URLByResolvingSymlinksInPath.path;
  [[NSURL fileURLWithPath:self.root] setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
  NSString *entry=[self.root stringByAppendingPathComponent:@"hgtv.js"];
  NSData *bundled=[NSData dataWithContentsOfFile:[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Hongguo/hgtv.js"]];
  if(!bundled||![[NSData dataWithContentsOfFile:entry] isEqual:bundled]){if(![bundled writeToFile:entry options:NSDataWritingAtomic error:&error]){completion(nil,error?:[NSError errorWithDomain:@"SYHongguo" code:2 userInfo:@{NSLocalizedDescriptionKey:@"红果资源文件不可用"}]);return;}}
  NodePluginRuntime *runtime=[NodePluginRuntime shared];
  if(![runtime isRunningSession:self.session]){
   if([runtime isManagedSession:self.session]&&![runtime stopSession:self.session error:&error]){completion(nil,error);return;}
   NSDictionary *start=@{@"session":self.session,@"serviceID":@"sanyuan-hongguo",@"packageRoot":self.root,@"dataDirectory":self.root,@"entry":@"hgtv.js",@"protocol":@"catvod-js",@"hostFetchURL":bridge.absoluteString?:@"",@"hostFetchToken":token?:@""};
   if(![self call:@"start" payload:start error:&error]){completion(nil,error);return;}
  }
  NSDictionary *play=[self call:@"play" payload:@{@"session":self.session,@"lineId":@"官网完整播放",@"id":[NSString stringWithFormat:@"%@~%@",series,episode]} error:&error];
  NSDictionary *result=[play[@"result"] isKindOfClass:NSDictionary.class]?play[@"result"]:nil;
  NSString *url=[result[@"url"] isKindOfClass:NSString.class]?result[@"url"]:nil;
  if(![url hasPrefix:@"cenc://"]){NSLog(@"SYHongguo stage=model series=%@ episode=%@ failed",series,episode);completion(nil,error?:[NSError errorWithDomain:@"SYHongguo" code:3 userInfo:@{NSLocalizedDescriptionKey:@"红果取流服务未返回该集的可用媒体"}]);return;}
  NSDictionary *proxy=[self call:@"proxy" payload:@{@"session":self.session,@"url":url,@"method":@"HEAD"} error:&error];
  NSArray *parts=[proxy[@"result"] isKindOfClass:NSArray.class]?proxy[@"result"]:nil;
  NSDictionary *file=parts.count==3&&[parts[2] isKindOfClass:NSDictionary.class]?parts[2]:nil;
  NSString *path=[file[@"path"] isKindOfClass:NSString.class]?file[@"path"]:nil;
  NSString *real=path?[NSURL fileURLWithPath:path].URLByResolvingSymlinksInPath.path:nil;
  BOOL valid=[file[@"__cctvhostFileResponse"] boolValue]&&[real hasPrefix:[self.root stringByAppendingString:@"/"]]&&[parts[0] integerValue]>=200&&[parts[0] integerValue]<300;
  NSDictionary *attrs=valid?[fm attributesOfItemAtPath:real error:&error]:nil;
  if(!attrs||[attrs[NSFileSize] unsignedLongLongValue]<32||[attrs[NSFileSize] unsignedLongLongValue]>32*1024*1024){NSLog(@"SYHongguo stage=media series=%@ episode=%@ failed",series,episode);completion(nil,error?:[NSError errorWithDomain:@"SYHongguo" code:4 userInfo:@{NSLocalizedDescriptionKey:@"红果媒体准备失败，未交给播放器"}]);return;}
  [fm setAttributes:@{NSFileModificationDate:[NSDate date]} ofItemAtPath:real error:nil];
  NSString *cache=[real stringByDeletingLastPathComponent];NSMutableArray *files=[NSMutableArray array];unsigned long long total=0;
  for(NSString *name in [fm contentsOfDirectoryAtPath:cache error:nil]){if(![name hasSuffix:@".mp4"]||[name containsString:@".tmp."]||[name containsString:@".enc."])continue;NSString *path=[cache stringByAppendingPathComponent:name];NSDictionary *a=[fm attributesOfItemAtPath:path error:nil];total+=[a[NSFileSize] unsignedLongLongValue];[files addObject:@{@"path":path,@"size":a[NSFileSize]?:@0,@"date":a[NSFileModificationDate]?:[NSDate distantPast]}];}
  [files sortUsingComparator:^NSComparisonResult(NSDictionary *a,NSDictionary *b){return [a[@"date"] compare:b[@"date"]];}];
  for(NSDictionary *f in files){if(total<=256*1024*1024)break;if([f[@"path"] isEqual:real]||[f[@"path"] isEqual:self.previousFile])continue;if([fm removeItemAtPath:f[@"path"] error:nil])total-=[f[@"size"] unsignedLongLongValue];}
  NSLog(@"SYHongguo stage=prepared series=%@ episode=%@ bytes=%@",series,episode,attrs[NSFileSize]);self.previousFile=real;completion([NSURL fileURLWithPath:real],nil);
 }}];
}
@end
