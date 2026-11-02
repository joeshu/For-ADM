// App-local HLS transport. No TLS interception, certificate installation, or remote scripts.
#if __has_include(<Network/Network.h>)
#import <Network/Network.h>
#import <JavaScriptCore/JavaScriptCore.h>
// Bounded system-network fallback for the embedded Node provider.
@interface SYHGFetch:NSObject<NSURLSessionDataDelegate>
@property(nonatomic,strong) NSURLSession *session;
@property(nonatomic,strong) NSMutableData *data;
@property(nonatomic,strong) NSHTTPURLResponse *response;
@property(nonatomic,copy) void(^completion)(NSData*,NSHTTPURLResponse*,NSError*);
@end
@implementation SYHGFetch
+ (void)request:(NSURLRequest*)request completion:(void(^)(NSData*,NSHTTPURLResponse*,NSError*))completion {
 SYHGFetch *job=[SYHGFetch new];job.data=[NSMutableData data];job.completion=completion;
 NSURLSessionConfiguration *config=NSURLSessionConfiguration.ephemeralSessionConfiguration;config.timeoutIntervalForResource=request.timeoutInterval+2;config.timeoutIntervalForRequest=request.timeoutInterval;config.URLCache=nil;config.HTTPCookieStorage=nil;
 job.session=[NSURLSession sessionWithConfiguration:config delegate:job delegateQueue:nil];[[job.session dataTaskWithRequest:request] resume];
}
- (void)URLSession:(NSURLSession*)session dataTask:(NSURLSessionDataTask*)task didReceiveResponse:(NSURLResponse*)response completionHandler:(void(^)(NSURLSessionResponseDisposition))completionHandler {
 self.response=(NSHTTPURLResponse*)response;completionHandler(response.expectedContentLength>16*1024*1024?NSURLSessionResponseCancel:NSURLSessionResponseAllow);
}
- (void)URLSession:(NSURLSession*)session dataTask:(NSURLSessionDataTask*)task didReceiveData:(NSData*)data {if(self.data.length+data.length>16*1024*1024){[task cancel];return;}[self.data appendData:data];}
- (void)URLSession:(NSURLSession*)session task:(NSURLSessionTask*)task willPerformHTTPRedirection:(NSHTTPURLResponse*)response newRequest:(NSURLRequest*)request completionHandler:(void(^)(NSURLRequest*))completionHandler {
 NSString *host=request.URL.host.lowercaseString;BOOL allowed=[host isEqual:@"hongguoduanju.com"]||[host isEqual:@"api5-normal-sinfonlineb.fqnovel.com"]||[host hasSuffix:@".qznovelvod.com"];
 completionHandler(allowed&&[request.URL.scheme isEqual:@"https"]&&!request.URL.user&&!request.URL.password?request:nil);
}
- (void)URLSession:(NSURLSession*)session task:(NSURLSessionTask*)task didCompleteWithError:(NSError*)error {if(self.completion)self.completion(error?nil:self.data,self.response,error);self.completion=nil;[session finishTasksAndInvalidate];self.session=nil;}
@end
@interface SYHLSProxy:NSObject
@property(nonatomic,strong) nw_listener_t listener;
@property(nonatomic,strong) NSURLSession*session;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSURL*>*resources;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSString*>*paths;
@property(nonatomic,strong) JSContext*js;
@property(nonatomic,strong) NSMutableDictionary *localFiles;
@property(nonatomic,copy) NSString *hostFetchToken;
- (NSURL*)mapLocalFile:(NSURL*)file;
@property(nonatomic,strong) NSDictionary*headers;
@property(nonatomic,copy) NSString*token;
@property(nonatomic) uint16_t port;
@property(nonatomic) BOOL enabled;
@property(nonatomic) NSUInteger removed;
@property(nonatomic,copy) NSString*lastTransportError;
@property(nonatomic) NSInteger lastHTTPStatus;
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers;
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled;
@end
@implementation SYHLSProxy
- (instancetype)init {
 if((self=[super init])){
  self.resources=[NSMutableDictionary dictionary];self.paths=[NSMutableDictionary dictionary];self.localFiles=[NSMutableDictionary dictionary];self.hostFetchToken=NSUUID.UUID.UUIDString;
  self.js=[JSContext new];
  NSString*script=[NSString stringWithContentsOfFile:[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Web/hls-cleaner.js"] encoding:NSUTF8StringEncoding error:nil];
  if(script)[self.js evaluateScript:script];
  nw_parameters_t parameters=nw_parameters_create_secure_tcp(NW_PARAMETERS_DISABLE_PROTOCOL,NW_PARAMETERS_DEFAULT_CONFIGURATION);
  nw_parameters_set_local_endpoint(parameters,nw_endpoint_create_host("127.0.0.1","0"));
  self.listener=nw_listener_create(parameters);
  if(self.listener){
   __weak SYHLSProxy*weak=self;
   nw_listener_set_queue(self.listener,dispatch_get_main_queue());
   nw_listener_set_state_changed_handler(self.listener,^(nw_listener_state_t state,nw_error_t error){if(state==nw_listener_state_ready)weak.port=nw_listener_get_port(weak.listener);else if(state==nw_listener_state_failed)weak.port=0;});
   nw_listener_set_new_connection_handler(self.listener,^(nw_connection_t connection){
    SYHLSProxy*owner=weak;if(!owner){nw_connection_cancel(connection);return;}
    nw_connection_set_queue(connection,dispatch_get_main_queue());nw_connection_start(connection);
    [owner read:connection data:[NSMutableData data]];
   });
   nw_listener_start(self.listener);
  }
 }
 return self;
}
- (void)dealloc {if(_listener)nw_listener_cancel(_listener);[_session invalidateAndCancel];}
- (NSURL*)mapped:(NSURL*)url {
 if(![@[@"https",@"http"] containsObject:url.scheme.lowercaseString]||!url.host.length||!self.port)return nil;
 NSString*path=self.paths[url.absoluteString];
 if(!path){NSString*extension=url.pathExtension.lowercaseString;NSSet*known=[NSSet setWithArray:@[@"m3u8",@"mp4",@"m4v",@"mov",@"ts",@"aac"]];if(![known containsObject:extension])extension=@"bin";path=[NSString stringWithFormat:@"/%@/%@.%@",self.token,NSUUID.UUID.UUIDString,extension];self.paths[url.absoluteString]=path;self.resources[path]=url;}
 return [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%u%@",self.port,path]];
}
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers {
 [self prepare:url headers:headers enabled:NO];
 if(!self.port||![url.path.lowercaseString hasSuffix:@".m3u8"])return url;
 return [self mapped:url]?:url;
}
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled {
 [self.session invalidateAndCancel];self.removed=0;self.enabled=enabled;self.headers=headers;self.token=NSUUID.UUID.UUIDString;
 [self.resources removeAllObjects];[self.paths removeAllObjects];
 NSURLSessionConfiguration*config=[NSURLSessionConfiguration ephemeralSessionConfiguration];config.timeoutIntervalForRequest=20;config.HTTPMaximumConnectionsPerHost=6;config.URLCache=nil;config.requestCachePolicy=NSURLRequestReloadIgnoringLocalCacheData;
 self.session=[NSURLSession sessionWithConfiguration:config];
 if(!enabled||!self.port||![url.path.lowercaseString hasSuffix:@".m3u8"])return url;
 return [self mapped:url]?:url;
}
- (void)reply:(nw_connection_t)connection status:(NSInteger)status headers:(NSDictionary*)headers data:(NSData*)data head:(BOOL)head {
 NSMutableString*text=[NSMutableString stringWithFormat:@"HTTP/1.1 %ld Response\r\nConnection: close\r\nContent-Length: %lu\r\n",(long)status,(unsigned long)(headers[@"Content-Length"]?[headers[@"Content-Length"] unsignedLongLongValue]:data.length)];
 for(NSString*name in headers){if([name isEqualToString:@"Content-Length"])continue;NSString*value=[headers[name] description];if([value rangeOfCharacterFromSet:NSCharacterSet.newlineCharacterSet].location==NSNotFound)[text appendFormat:@"%@: %@\r\n",name,value];}
 [text appendString:@"\r\n"];NSMutableData*response=[[text dataUsingEncoding:NSUTF8StringEncoding] mutableCopy];if(!head)[response appendData:data];
 dispatch_data_t payload=dispatch_data_create(response.bytes,response.length,dispatch_get_main_queue(),^{(void)response;});
 nw_connection_send(connection,payload,NW_CONNECTION_DEFAULT_MESSAGE_CONTEXT,true,^(nw_error_t error){nw_connection_cancel(connection);});
}
- (void)read:(nw_connection_t)connection data:(NSMutableData*)data {
 __weak SYHLSProxy*weak=self;
 nw_connection_receive(connection,1,16384,^(dispatch_data_t content,nw_content_context_t context,bool complete,nw_error_t error){
  SYHLSProxy*owner=weak;if(!owner){nw_connection_cancel(connection);return;}
  if(content)dispatch_data_apply(content,^bool(dispatch_data_t region,size_t offset,const void*bytes,size_t size){[data appendBytes:bytes length:size];return true;});
  NSString*request=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
  if(data.length>2*1024*1024||error){nw_connection_cancel(connection);return;}
  NSRange separator=[request rangeOfString:@"\r\n\r\n"];
  if(separator.location!=NSNotFound){
   NSUInteger needed=0;for(NSString *line in [[request substringToIndex:separator.location] componentsSeparatedByString:@"\r\n"])if([line.lowercaseString hasPrefix:@"content-length:"])needed=[[line substringFromIndex:15] integerValue];
   if(needed>2*1024*1024){nw_connection_cancel(connection);return;}
   NSUInteger received=[[request substringFromIndex:separator.location+4] lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
   if(received>=needed)[owner handle:request connection:connection];else if(!complete)[owner read:connection data:data];else nw_connection_cancel(connection);
  }
  else if(!complete)[owner read:connection data:data];else nw_connection_cancel(connection);
 });
}
- (NSString*)rewrite:(NSString*)text base:(NSURL*)base {
 NSMutableArray*output=[NSMutableArray array];
 NSRegularExpression*uri=[NSRegularExpression regularExpressionWithPattern:@"URI=\"([^\"\\r\\n]+)\"" options:0 error:nil];
 for(NSString*raw in [text componentsSeparatedByString:@"\n"]){
  NSString*line=[raw stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  if(line.length&&![line hasPrefix:@"#"]){NSURL*mapped=[self mapped:[NSURL URLWithString:line relativeToURL:base].absoluteURL];if(!mapped)return nil;[output addObject:mapped.absoluteString];}
  else{
   NSMutableString*changed=[raw mutableCopy];
   for(NSTextCheckingResult*match in [[uri matchesInString:raw options:0 range:NSMakeRange(0,raw.length)] reverseObjectEnumerator]){
    NSString*value=[raw substringWithRange:[match rangeAtIndex:1]];
    // Non-HTTP key URIs (for example FairPlay) are preserved; HTTPS keys stay encrypted.
    NSURL*absolute=[NSURL URLWithString:value relativeToURL:base].absoluteURL;
    if([@[@"https",@"http"] containsObject:absolute.scheme.lowercaseString]){NSURL*mapped=[self mapped:absolute];if(mapped)[changed replaceCharactersInRange:[match rangeAtIndex:1] withString:mapped.absoluteString];}
   }
   [output addObject:changed];
  }
 }
 return [output componentsJoinedByString:@"\n"];
}
- (NSURL*)mapLocalFile:(NSURL*)file {
 if(!self.port||!file.isFileURL)return nil;
 if(self.localFiles.count>=64)[self.localFiles removeObjectForKey:self.localFiles.allKeys.firstObject];
 NSString *path=[NSString stringWithFormat:@"/hongguo/%@.mp4",NSUUID.UUID.UUIDString];self.localFiles[path]=file;
 return [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%u%@",self.port,path]];
}
- (void)sendFile:(NSFileHandle*)file remaining:(unsigned long long)remaining connection:(nw_connection_t)connection {
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{
  NSData *chunk=nil;@try{chunk=[file readDataOfLength:(NSUInteger)MIN(remaining,512*1024)];}@catch(NSException *e){}
  if(!chunk.length){[file closeFile];nw_connection_cancel(connection);return;}
  dispatch_data_t data=dispatch_data_create(chunk.bytes,chunk.length,dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{(void)chunk;});
  nw_connection_send(connection,data,NW_CONNECTION_DEFAULT_MESSAGE_CONTEXT,chunk.length==remaining,^(nw_error_t error){if(error||chunk.length==remaining){[file closeFile];nw_connection_cancel(connection);}else [self sendFile:file remaining:remaining-chunk.length connection:connection];});
 });
}
- (void)serveFile:(NSURL*)url request:(NSString*)request connection:(nw_connection_t)connection head:(BOOL)head {
 unsigned long long size=[NSFileManager.defaultManager attributesOfItemAtPath:url.path error:nil].fileSize,start=0,end=size?size-1:0;BOOL partial=NO;
 NSString *range=nil;for(NSString *line in [request componentsSeparatedByString:@"\r\n"])if([line.lowercaseString hasPrefix:@"range:"])range=[[line substringFromIndex:6] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
 if(range){NSRegularExpression *re=[NSRegularExpression regularExpressionWithPattern:@"^bytes=([0-9]*)-([0-9]*)$" options:0 error:nil];NSTextCheckingResult *match=[re firstMatchInString:range options:0 range:NSMakeRange(0,range.length)];
  if(!match){[self reply:connection status:416 headers:@{@"Content-Range":[NSString stringWithFormat:@"bytes */%llu",size]} data:[NSData data] head:head];return;}
  NSString *a=[range substringWithRange:[match rangeAtIndex:1]],*b=[range substringWithRange:[match rangeAtIndex:2]];
  if(a.length){start=a.longLongValue;if(b.length)end=MIN(size-1,(unsigned long long)b.longLongValue);}else if(b.longLongValue>0){start=size> b.longLongValue?size-b.longLongValue:0;}else start=size;
  partial=YES;
 }
 if(!size||start>=size||end<start){[self reply:connection status:416 headers:@{@"Content-Range":[NSString stringWithFormat:@"bytes */%llu",size]} data:[NSData data] head:head];return;}
 unsigned long long length=end-start+1;
 NSMutableDictionary *headers=[@{@"Content-Type":@"video/mp4",@"Accept-Ranges":@"bytes",@"Content-Length":@(length)} mutableCopy];
 if(partial)headers[@"Content-Range"]=[NSString stringWithFormat:@"bytes %llu-%llu/%llu",start,end,size];
 if(head){[self reply:connection status:partial?206:200 headers:headers data:[NSData data] head:YES];return;}
 NSFileHandle *file=[NSFileHandle fileHandleForReadingAtPath:url.path];if(!file){[self reply:connection status:404 headers:@{} data:[NSData data] head:NO];return;}[file seekToFileOffset:start];
 NSMutableString *text=[NSMutableString stringWithFormat:@"HTTP/1.1 %d OK\r\nConnection: close\r\n",partial?206:200];for(NSString *k in headers)[text appendFormat:@"%@: %@\r\n",k,headers[k]];[text appendString:@"\r\n"];
 NSData *raw=[text dataUsingEncoding:NSUTF8StringEncoding];dispatch_data_t data=dispatch_data_create(raw.bytes,raw.length,dispatch_get_main_queue(),^{(void)raw;});nw_connection_send(connection,data,NW_CONNECTION_DEFAULT_MESSAGE_CONTEXT,false,^(nw_error_t error){if(error){[file closeFile];nw_connection_cancel(connection);}else [self sendFile:file remaining:length connection:connection];});
}
- (void)hostFetch:(NSString*)request connection:(nw_connection_t)connection {
 NSString *auth=nil;for(NSString *line in [request componentsSeparatedByString:@"\r\n"])if([line.lowercaseString hasPrefix:@"x-cctvhost-host-fetch:"])auth=[[line substringFromIndex:[@"x-cctvhost-host-fetch:" length]] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
 if(![auth isEqual:self.hostFetchToken]){[self reply:connection status:403 headers:@{} data:[NSData data] head:NO];return;}
 NSRange at=[request rangeOfString:@"\r\n\r\n"];NSData *data=[[request substringFromIndex:at.location+4] dataUsingEncoding:NSUTF8StringEncoding];NSDictionary *body=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
 if(![body isKindOfClass:NSDictionary.class]){[self reply:connection status:400 headers:@{} data:[NSData data] head:NO];return;}
 NSURL *url=[NSURL URLWithString:[body[@"url"] isKindOfClass:NSString.class]?body[@"url"]:@""];NSString *host=url.host.lowercaseString;
#if defined(SY_SIMULATOR_SMOKE)
 if([host isEqual:@"fixture.sanyuan.invalid"]&&[url.path isEqual:@"/model"]){
   NSData *payload=[[NSData alloc]initWithBase64EncodedString:body[@"bodyBase64"]?:@"" options:0];NSDictionary *input=payload?[NSJSONSerialization JSONObjectWithData:payload options:0 error:nil]:nil;
   BOOL valid=[body[@"method"] isEqual:@"POST"]&&[input[@"mixed_video_id_map"][@"1004"] isEqual:@[@"1"]]&&[body[@"headers"] isKindOfClass:NSDictionary.class];
   NSString *fixture=[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Hongguo/model-fixture.json"];NSData *data=valid?[NSData dataWithContentsOfFile:fixture]:nil;
   if(data){[[NSJSONSerialization dataWithJSONObject:@{@"bodyValidated":@YES,@"nonceValidated":@YES,@"method":@"POST"} options:0 error:nil] writeToFile:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/sanyuan-hongguo-native-https.json"] atomically:YES];}
   [self reply:connection status:data?200:400 headers:@{@"Content-Type":@"application/json"} data:data?:[NSData data] head:NO];return;
 }
#endif
 BOOL allowed=[host isEqual:@"hongguoduanju.com"]||[host isEqual:@"api5-normal-sinfonlineb.fqnovel.com"]||[host hasSuffix:@".qznovelvod.com"];
 NSString *method=[body[@"method"] isKindOfClass:NSString.class]?body[@"method"]:@"GET";
 if(!allowed||![url.scheme isEqual:@"https"]||url.user||url.password||![@[@"GET",@"HEAD",@"POST"] containsObject:method]){[self reply:connection status:400 headers:@{} data:[NSData data] head:NO];return;}
 double timeout=MAX(1,MIN(30,[body[@"timeoutMs"] doubleValue]/1000.0));
 NSMutableURLRequest *up=[NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:timeout];up.HTTPMethod=method;
 if([body[@"headers"] isKindOfClass:NSDictionary.class])for(NSString *key in body[@"headers"]){id v=body[@"headers"][key];if([v isKindOfClass:NSString.class]&&![@[@"host",@"content-length",@"connection"] containsObject:key.lowercaseString]&&[v rangeOfCharacterFromSet:NSCharacterSet.newlineCharacterSet].location==NSNotFound)[up setValue:v forHTTPHeaderField:key];}
 if([body[@"bodyBase64"] isKindOfClass:NSString.class])up.HTTPBody=[[NSData alloc]initWithBase64EncodedString:body[@"bodyBase64"] options:0];
 [SYHGFetch request:up completion:^(NSData *bytes,NSHTTPURLResponse *response,NSError *error){dispatch_async(dispatch_get_main_queue(),^{
  if(error||bytes.length>16*1024*1024){[self reply:connection status:502 headers:@{} data:[NSData data] head:NO];return;}
  NSHTTPURLResponse *http=(NSHTTPURLResponse*)response;NSMutableDictionary *headers=[NSMutableDictionary dictionary];for(NSString *key in http.allHeaderFields)if(![@[@"content-encoding",@"content-length",@"connection",@"transfer-encoding"] containsObject:key.lowercaseString])headers[key]=[http.allHeaderFields[key] description];
  [self reply:connection status:http.statusCode?:502 headers:headers data:bytes?:[NSData data] head:NO];
 });}];
}
- (void)handle:(NSString*)request connection:(nw_connection_t)connection {
 NSArray*lines=[request componentsSeparatedByString:@"\r\n"],*parts=[lines.firstObject componentsSeparatedByString:@" "];
 BOOL head=parts.count>=2&&[parts[0] isEqual:@"HEAD"];
 if(parts.count>=2&&[parts[0] isEqual:@"POST"]&&[parts[1] isEqual:@"/_cctvhost/host-fetch"]){[self hostFetch:request connection:connection];return;}
 NSURL *local=parts.count>=2?self.localFiles[parts[1]]:nil;if(local){if(head||[parts[0] isEqual:@"GET"])[self serveFile:local request:request connection:connection head:head];else [self reply:connection status:405 headers:@{} data:[NSData data] head:NO];return;}
 NSURL*url=parts.count>=2?self.resources[parts[1]]:nil;
 if(!url||(!head&&![parts[0] isEqual:@"GET"])){self.lastTransportError=@"proxy-resource-not-found";[self reply:connection status:404 headers:@{} data:[NSData data] head:head];return;}
 NSMutableURLRequest*upstream=[NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:20];upstream.allHTTPHeaderFields=self.headers;upstream.HTTPMethod=head?@"HEAD":@"GET";
 for(NSString*line in lines)if(![url.path.lowercaseString hasSuffix:@".m3u8"]&&([line.lowercaseString hasPrefix:@"range:"]||[line.lowercaseString hasPrefix:@"if-range:"])) {NSRange colon=[line rangeOfString:@":"];if(colon.location!=NSNotFound)[upstream setValue:[[line substringFromIndex:colon.location+1] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet] forHTTPHeaderField:[[line substringToIndex:colon.location] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]];}
 NSString*token=self.token;
 __weak SYHLSProxy*weak=self;
 [[self.session dataTaskWithRequest:upstream completionHandler:^(NSData*body,NSURLResponse*response,NSError*error){
  dispatch_async(dispatch_get_main_queue(),^{
   SYHLSProxy*owner=weak;if(!owner||![token isEqual:owner.token]){nw_connection_cancel(connection);return;}
   NSHTTPURLResponse*http=(NSHTTPURLResponse*)response;
   owner.lastHTTPStatus=http.statusCode;owner.lastTransportError=error?error.localizedDescription:@"";
   if(error||body.length>32*1024*1024){NSLog(@"SYHLSProxy upstream failure host=%@ status=%ld error=%@",url.host,(long)http.statusCode,error.localizedDescription?:@"response-too-large");[owner reply:connection status:502 headers:@{} data:[NSData data] head:head];return;}
   if(http.statusCode<200||http.statusCode>=300)NSLog(@"SYHLSProxy upstream HTTP status host=%@ status=%ld",url.host,(long)http.statusCode);
   NSMutableDictionary*headers=[NSMutableDictionary dictionary];headers[@"Content-Type"]=http.MIMEType?:@"application/octet-stream";if(head&&response.expectedContentLength>=0)headers[@"Content-Length"]=@(response.expectedContentLength);
   for(NSString*name in http.allHeaderFields)if([@[@"content-range",@"accept-ranges"] containsObject:name.lowercaseString])headers[name]=http.allHeaderFields[name];
   NSData*result=body?:[NSData data];
   if(!head&&http.statusCode==200&&body.length<4*1024*1024){
    NSString*text=[[NSString alloc]initWithData:body encoding:NSUTF8StringEncoding];
    if([[text stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] hasPrefix:@"#EXTM3U"]){
     JSValue*clean=owner.js[@"SYHLS"][@"cleanPlaylist"];
     NSDictionary*report=[[clean callWithArguments:@[text,@{@"enabled":@(owner.enabled)}]] toDictionary];
     if([report[@"body"] isKindOfClass:NSString.class]){text=report[@"body"];owner.removed+=[report[@"removed"] unsignedIntegerValue];}
     NSString*rewritten=[owner rewrite:text base:http.URL?:url];
     if(!rewritten){[owner reply:connection status:502 headers:@{} data:[NSData data] head:NO];return;}
     result=[rewritten dataUsingEncoding:NSUTF8StringEncoding];headers[@"Content-Type"]=@"application/vnd.apple.mpegurl";
    }
   }
   [owner reply:connection status:http.statusCode?:502 headers:headers data:result head:head];
  });
 }] resume];
}
@end
#else
// Experimental ABI-only build has no HLS proxy; release builds always use Apple's SDK.
@interface SYHLSProxy:NSObject
@property(nonatomic) NSUInteger removed;
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers;
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled;
@end
@implementation SYHLSProxy
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers{return url;}
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled{return url;}
@end
#endif
