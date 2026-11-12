// App-local HLS transport. No TLS interception, certificate installation, or remote scripts.
#if __has_include(<Network/Network.h>)
#import <Network/Network.h>
#import <JavaScriptCore/JavaScriptCore.h>
@interface SYHLSProxy:NSObject
@property(nonatomic,strong) nw_listener_t listener;
@property(nonatomic,strong) dispatch_queue_t proxyQueue;
@property(nonatomic,strong) NSURLSession*session;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSURL*>*resources;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSString*>*paths;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSData*>*playlistCache;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSDictionary*>*segmentCache;
@property(nonatomic,strong) NSMutableArray<NSString*>*segmentCacheOrder;
@property(nonatomic) NSUInteger segmentCacheBytes;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSArray<NSString*>*>*playlistSegments;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSNumber*>*segmentIndexByPath;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSString*>*segmentPlaylistByPath;
@property(nonatomic,strong) NSMutableSet<NSString*>*prefetchingPaths;
@property(nonatomic,strong) JSContext*js;
@property(nonatomic,strong) NSDictionary*headers;
@property(nonatomic,copy) NSString*token;
@property(nonatomic) uint16_t port;
@property(nonatomic) BOOL enabled;
@property(nonatomic) NSUInteger removed;
@property(nonatomic) double removedSeconds;
@property(nonatomic,copy) NSString*lastTransportError;
@property(nonatomic) NSInteger lastHTTPStatus;
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers;
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled;
- (void)seedPlaylists:(NSArray*)items;
@end
@implementation SYHLSProxy
- (instancetype)init {
 if((self=[super init])){
  self.proxyQueue=dispatch_queue_create("com.joeshu.sanyuan.hlsproxy",DISPATCH_QUEUE_SERIAL);
  self.resources=[NSMutableDictionary dictionary];self.paths=[NSMutableDictionary dictionary];self.playlistCache=[NSMutableDictionary dictionary];
  self.segmentCache=[NSMutableDictionary dictionary];self.segmentCacheOrder=[NSMutableArray array];self.segmentCacheBytes=0;
  self.playlistSegments=[NSMutableDictionary dictionary];self.segmentIndexByPath=[NSMutableDictionary dictionary];self.segmentPlaylistByPath=[NSMutableDictionary dictionary];self.prefetchingPaths=[NSMutableSet set];
  self.js=[JSContext new];
  NSString*script=[NSString stringWithContentsOfFile:[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"Web/hls-cleaner.js"] encoding:NSUTF8StringEncoding error:nil];
  if(script)[self.js evaluateScript:script];
  NSURLSessionConfiguration*config=[NSURLSessionConfiguration ephemeralSessionConfiguration];
  config.timeoutIntervalForRequest=20;config.HTTPMaximumConnectionsPerHost=8;config.URLCache=nil;config.requestCachePolicy=NSURLRequestReloadIgnoringLocalCacheData;
  self.session=[NSURLSession sessionWithConfiguration:config];
  [self startListener];
 }
 return self;
}
- (void)startListener {
 if(self.listener){nw_listener_cancel(self.listener);self.listener=nil;}
 nw_parameters_t parameters=nw_parameters_create_secure_tcp(NW_PARAMETERS_DISABLE_PROTOCOL,NW_PARAMETERS_DEFAULT_CONFIGURATION);
 nw_parameters_set_local_endpoint(parameters,nw_endpoint_create_host("127.0.0.1","0"));
 self.listener=nw_listener_create(parameters);
 if(!self.listener)return;
 __weak SYHLSProxy*weak=self;
 nw_listener_set_queue(self.listener,self.proxyQueue);
 nw_listener_set_state_changed_handler(self.listener,^(nw_listener_state_t state,nw_error_t error){
  if(state==nw_listener_state_ready)weak.port=nw_listener_get_port(weak.listener);
  else if(state==nw_listener_state_failed||state==nw_listener_state_cancelled)weak.port=0;
 });
 nw_listener_set_new_connection_handler(self.listener,^(nw_connection_t connection){
  SYHLSProxy*owner=weak;if(!owner){nw_connection_cancel(connection);return;}
  nw_connection_set_queue(connection,owner.proxyQueue);nw_connection_start(connection);
  [owner read:connection data:[NSMutableData data]];
 });
 nw_listener_start(self.listener);
}
- (void)dealloc {if(_listener)nw_listener_cancel(_listener);[_session invalidateAndCancel];}
- (NSURL*)mapped:(NSURL*)url {
 if(![@[@"https",@"http"] containsObject:url.scheme.lowercaseString]||!url.host.length||!self.port)return nil;
 NSString*path=self.paths[url.absoluteString];
 if(!path){if(self.paths.count>=4096&&self.paths.count>=65536){[self.paths removeAllObjects];[self.resources removeAllObjects];}NSString*extension=url.pathExtension.lowercaseString;NSSet*known=[NSSet setWithArray:@[@"m3u8",@"mp4",@"m4v",@"mov",@"ts",@"aac"]];if(![known containsObject:extension])extension=@"bin";path=[NSString stringWithFormat:@"/%@/%@.%@",self.token,NSUUID.UUID.UUIDString,extension];self.paths[url.absoluteString]=path;self.resources[path]=url;}
 return [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%u%@",self.port,path]];
}
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers {
 [self prepare:url headers:headers enabled:NO];
 if(!self.port)return url;
 __block NSURL*result=url;
 dispatch_sync(self.proxyQueue,^{result=[self mapped:url]?:url;});
 return result;
}
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled {
 __block NSURL*result=url;
 dispatch_sync(self.proxyQueue,^{
  self.removed=0;self.removedSeconds=0;self.enabled=enabled;self.headers=headers;self.token=NSUUID.UUID.UUIDString;
  [self.resources removeAllObjects];[self.paths removeAllObjects];[self.playlistCache removeAllObjects];
  [self.segmentCache removeAllObjects];[self.segmentCacheOrder removeAllObjects];self.segmentCacheBytes=0;
  [self.playlistSegments removeAllObjects];[self.segmentIndexByPath removeAllObjects];[self.segmentPlaylistByPath removeAllObjects];[self.prefetchingPaths removeAllObjects];
  if(!self.session){
   NSURLSessionConfiguration*config=[NSURLSessionConfiguration ephemeralSessionConfiguration];config.timeoutIntervalForRequest=20;config.HTTPMaximumConnectionsPerHost=8;config.URLCache=nil;config.requestCachePolicy=NSURLRequestReloadIgnoringLocalCacheData;
   self.session=[NSURLSession sessionWithConfiguration:config];
  }
  if(!self.port)[self startListener];
  if(!enabled||!self.port||![url.path.lowercaseString hasSuffix:@".m3u8"]){result=url;return;}
  result=[self mapped:url]?:url;
 });
 return result;
}
- (void)seedPlaylists:(NSArray*)items {
 if(!self.enabled||!self.port||![items isKindOfClass:NSArray.class])return;
 NSArray*copied=[items copy];
 dispatch_async(self.proxyQueue,^{
  for(NSDictionary*entry in copied){
   if(![entry isKindOfClass:NSDictionary.class])continue;
   NSString*urlText=[entry[@"url"] isKindOfClass:NSString.class]?entry[@"url"]:@"",*rawText=[entry[@"text"] isKindOfClass:NSString.class]?entry[@"text"]:@"",*baseText=[entry[@"baseURL"] isKindOfClass:NSString.class]?entry[@"baseURL"]:urlText;
   NSURL*u=[NSURL URLWithString:urlText],*baseURL=[NSURL URLWithString:baseText]?:u;
   NSString*trimmed=[[rawText stringByReplacingOccurrencesOfString:@"\uFEFF" withString:@""] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
   if(!u||!rawText.length||rawText.length>2*1024*1024||![trimmed hasPrefix:@"#EXTM3U"])continue;
   BOOL isStaticVOD=[rawText containsString:@"#EXT-X-ENDLIST"]||[rawText containsString:@"#EXT-X-STREAM-INF:"];
   if(!isStaticVOD)continue;
   NSString*text=rawText;
   JSValue*clean=self.js[@"SYHLS"][@"cleanPlaylist"];
   NSDictionary*report=[[clean callWithArguments:@[text,@{@"enabled":@(self.enabled)}]] toDictionary];
   if([report[@"body"] isKindOfClass:NSString.class]){
    text=report[@"body"];
    self.removed+=[report[@"removed"] unsignedIntegerValue];
    if([report[@"seconds"] respondsToSelector:@selector(doubleValue)])self.removedSeconds+=[report[@"seconds"] doubleValue];
   }
   NSString*rewritten=[self rewrite:text base:baseURL playlistKey:u.absoluteString isStaticVOD:[rawText containsString:@"#EXT-X-ENDLIST"]];
   if(rewritten&&self.playlistCache.count<24){
    NSData*data=[rewritten dataUsingEncoding:NSUTF8StringEncoding];
    if(data)self.playlistCache[u.absoluteString]=data;
   }
  }
 });
}
- (void)reply:(nw_connection_t)connection status:(NSInteger)status headers:(NSDictionary*)headers data:(NSData*)data head:(BOOL)head {
 NSMutableString*text=[NSMutableString stringWithFormat:@"HTTP/1.1 %ld Response\r\nConnection: close\r\nContent-Length: %lu\r\n",(long)status,(unsigned long)(headers[@"Content-Length"]?[headers[@"Content-Length"] unsignedLongLongValue]:data.length)];
 for(NSString*name in headers){if([name isEqualToString:@"Content-Length"])continue;NSString*value=[headers[name] description];if([value rangeOfCharacterFromSet:NSCharacterSet.newlineCharacterSet].location==NSNotFound)[text appendFormat:@"%@: %@\r\n",name,value];}
 [text appendString:@"\r\n"];NSMutableData*response=[[text dataUsingEncoding:NSUTF8StringEncoding] mutableCopy];if(!head)[response appendData:data];
 dispatch_data_t payload=dispatch_data_create(response.bytes,response.length,self.proxyQueue,^{(void)response;});
 nw_connection_send(connection,payload,NW_CONNECTION_DEFAULT_MESSAGE_CONTEXT,true,^(nw_error_t error){nw_connection_cancel(connection);});
}
- (void)read:(nw_connection_t)connection data:(NSMutableData*)data {
 __weak SYHLSProxy*weak=self;
 nw_connection_receive(connection,1,16384,^(dispatch_data_t content,nw_content_context_t context,bool complete,nw_error_t error){
  SYHLSProxy*owner=weak;if(!owner){nw_connection_cancel(connection);return;}
  if(content)dispatch_data_apply(content,^bool(dispatch_data_t region,size_t offset,const void*bytes,size_t size){[data appendBytes:bytes length:size];return true;});
  NSString*request=[[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding]?:[[NSString alloc]initWithData:data encoding:NSISOLatin1StringEncoding];
  if(data.length>2*1024*1024||error){nw_connection_cancel(connection);return;}
  NSRange separator=request?[request rangeOfString:@"\r\n\r\n"]:NSMakeRange(NSNotFound,0);
  if(separator.location!=NSNotFound&&separator.length>0){
   NSUInteger needed=0;for(NSString *line in [[request substringToIndex:separator.location] componentsSeparatedByString:@"\r\n"])if([line.lowercaseString hasPrefix:@"content-length:"])needed=[[line substringFromIndex:15] integerValue];
   if(needed>2*1024*1024){nw_connection_cancel(connection);return;}
   NSUInteger received=[[request substringFromIndex:separator.location+4] lengthOfBytesUsingEncoding:NSUTF8StringEncoding];
   if(received>=needed)[owner handle:request connection:connection];else if(!complete)[owner read:connection data:data];else nw_connection_cancel(connection);
  }
  else if(!complete)[owner read:connection data:data];else nw_connection_cancel(connection);
 });
}
- (NSString*)rewrite:(NSString*)text base:(NSURL*)base {
 return [self rewrite:text base:base playlistKey:nil isStaticVOD:NO];
}
- (NSString*)rewrite:(NSString*)text base:(NSURL*)base playlistKey:(NSString*)playlistKey isStaticVOD:(BOOL)isStaticVOD {
 NSMutableArray*output=[NSMutableArray array];
 NSMutableArray*segments=(playlistKey&&isStaticVOD)?[NSMutableArray array]:nil;
 NSRegularExpression*uri=[NSRegularExpression regularExpressionWithPattern:@"URI=\"([^\"\\r\\n]+)\"" options:0 error:nil];
 for(NSString*raw in [text componentsSeparatedByString:@"\n"]){
  NSString*line=[raw stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  if(line.length&&![line hasPrefix:@"#"]){
   NSURL*resolved=[NSURL URLWithString:line relativeToURL:base]?:[NSURL URLWithString:[line stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLQueryAllowedCharacterSet] relativeToURL:base];
   NSURL*mapped=[self mapped:resolved.absoluteURL];if(!mapped)return nil;
   [output addObject:mapped.absoluteString];
   if(segments&&mapped.path.length){self.segmentIndexByPath[mapped.path]=@(segments.count);self.segmentPlaylistByPath[mapped.path]=playlistKey;[segments addObject:mapped.path];}
  }
  else{
   NSMutableString*changed=[raw mutableCopy];
   for(NSTextCheckingResult*match in [[uri matchesInString:raw options:0 range:NSMakeRange(0,raw.length)] reverseObjectEnumerator]){
    NSString*value=[raw substringWithRange:[match rangeAtIndex:1]];
    // Non-HTTP key URIs (for example FairPlay) are preserved; HTTPS keys stay encrypted.
    NSURL*resolved=[NSURL URLWithString:value relativeToURL:base]?:[NSURL URLWithString:[value stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLQueryAllowedCharacterSet] relativeToURL:base];
    NSURL*absolute=resolved.absoluteURL;
    if([@[@"https",@"http"] containsObject:absolute.scheme.lowercaseString]){NSURL*mapped=[self mapped:absolute];if(mapped)[changed replaceCharactersInRange:[match rangeAtIndex:1] withString:mapped.absoluteString];}
   }
   [output addObject:changed];
  }
 }
 if(segments.count&&playlistKey)self.playlistSegments[playlistKey]=segments;
 return [output componentsJoinedByString:@"\n"];
}
- (void)storeSegmentCache:(NSString*)path status:(NSInteger)status headers:(NSDictionary*)headers data:(NSData*)data {
 if(!path.length||status!=200||!data.length||data.length>8*1024*1024)return;
 if(self.segmentCache[path])return;
 NSUInteger maxBytes=24*1024*1024;
 while(self.segmentCacheBytes+data.length>maxBytes&&self.segmentCacheOrder.count){
  NSString*oldest=self.segmentCacheOrder.firstObject;[self.segmentCacheOrder removeObjectAtIndex:0];
  NSDictionary*oldEntry=self.segmentCache[oldest];[self.segmentCache removeObjectForKey:oldest];
  NSData*oldData=oldEntry[@"data"];if(oldData.length<=self.segmentCacheBytes)self.segmentCacheBytes-=oldData.length;else self.segmentCacheBytes=0;
 }
 self.segmentCache[path]=@{@"headers":headers?:@{},@"data":data};[self.segmentCacheOrder addObject:path];self.segmentCacheBytes+=data.length;
}
- (void)prefetchLookaheadFromPath:(NSString*)path {
 if(!self.enabled||!path.length)return;
 NSString*playlistKey=self.segmentPlaylistByPath[path];NSNumber*idxObj=self.segmentIndexByPath[path];
 if(!playlistKey||!idxObj)return;
 NSArray<NSString*>*segments=self.playlistSegments[playlistKey];if(!segments.count)return;
 NSUInteger idx=[idxObj unsignedIntegerValue];
 for(NSUInteger offset=1;offset<=2;offset++){
  if(idx+offset>=segments.count)break;
  NSString*nextPath=segments[idx+offset];
  if(self.segmentCache[nextPath]||[self.prefetchingPaths containsObject:nextPath])continue;
  NSURL*nextURL=self.resources[nextPath];if(!nextURL)continue;
  [self.prefetchingPaths addObject:nextPath];
  NSString*token=self.token;__weak SYHLSProxy*weak=self;
  NSMutableURLRequest*req=[NSMutableURLRequest requestWithURL:nextURL cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:15];
  req.allHTTPHeaderFields=self.headers;
  [[self.session dataTaskWithRequest:req completionHandler:^(NSData*body,NSURLResponse*response,NSError*error){
   SYHLSProxy*owner=weak;if(!owner)return;
   dispatch_async(owner.proxyQueue,^{
    [owner.prefetchingPaths removeObject:nextPath];
    if(![token isEqual:owner.token]||error||!body.length)return;
    NSHTTPURLResponse*http=(NSHTTPURLResponse*)response;
    if(http.statusCode!=200||body.length>8*1024*1024)return;
    NSMutableDictionary*headers=[NSMutableDictionary dictionary];headers[@"Content-Type"]=http.MIMEType?:@"application/octet-stream";
    if(body.length>=189&&((const uint8_t*)body.bytes)[0]==0x47&&((const uint8_t*)body.bytes)[188]==0x47)headers[@"Content-Type"]=@"video/mp2t";
    [owner storeSegmentCache:nextPath status:200 headers:headers data:body];
   });
  }] resume];
 }
}
- (void)fetchUpstream:(NSMutableURLRequest*)upstream originalURL:(NSURL*)url path:(NSString*)path head:(BOOL)head retriesLeft:(NSInteger)retriesLeft connection:(nw_connection_t)connection {
 NSString*token=self.token;
 __weak SYHLSProxy*weak=self;
 NSURLSessionDataTask*task=[self.session dataTaskWithRequest:upstream completionHandler:^(NSData*body,NSURLResponse*response,NSError*error){
  SYHLSProxy*owner=weak;if(!owner)return;
  dispatch_async(owner.proxyQueue,^{
   if(![token isEqual:owner.token]){nw_connection_cancel(connection);return;}
   if(error&&retriesLeft>0&&!head&&error.code!=NSURLErrorCancelled){
    [owner fetchUpstream:upstream originalURL:url path:path head:head retriesLeft:retriesLeft-1 connection:connection];
    return;
   }
   NSHTTPURLResponse*http=(NSHTTPURLResponse*)response;
   owner.lastHTTPStatus=http.statusCode;owner.lastTransportError=error?error.localizedDescription:@"";
   if(error||body.length>128*1024*1024){NSLog(@"SYHLSProxy upstream failure host=%@ status=%ld error=%@",url.host,(long)http.statusCode,error.localizedDescription?:@"response-too-large");[owner reply:connection status:502 headers:@{} data:[NSData data] head:head];return;}
   // 上限 128MB：10 秒 4K 分片在 25Mbps 下约 31MB，旧的 32MB 上限正好踩线，
   // 稍高码率或稍长分片就 502，播放器随即 FailedToPlayToEndTime 切线。
   if(http.statusCode<200||http.statusCode>=300)NSLog(@"SYHLSProxy upstream HTTP status host=%@ status=%ld",url.host,(long)http.statusCode);
   NSMutableDictionary*headers=[NSMutableDictionary dictionary];headers[@"Content-Type"]=http.MIMEType?:@"application/octet-stream";if(head&&response.expectedContentLength>=0)headers[@"Content-Length"]=@(response.expectedContentLength);
   for(NSString*name in http.allHeaderFields)if([@[@"content-range",@"accept-ranges"] containsObject:name.lowercaseString])headers[name]=http.allHeaderFields[name];
   NSData*result=body?:[NSData data];BOOL isPlaylist=NO;
   if(!head&&http.statusCode==200&&body.length<4*1024*1024){
    NSString*text=[[NSString alloc]initWithData:body encoding:NSUTF8StringEncoding]?:[[NSString alloc]initWithData:body encoding:NSISOLatin1StringEncoding];
    NSString*trimmed=[[text stringByReplacingOccurrencesOfString:@"\uFEFF" withString:@""] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if([[text stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] hasPrefix:@"#EXTM3U"]||[trimmed hasPrefix:@"#EXTM3U"]){
     isPlaylist=YES;
     BOOL isStaticVOD=[text containsString:@"#EXT-X-ENDLIST"]||[text containsString:@"#EXT-X-STREAM-INF:"];
     JSValue*clean=owner.js[@"SYHLS"][@"cleanPlaylist"];
     NSDictionary*report=[[clean callWithArguments:@[text,@{@"enabled":@(owner.enabled)}]] toDictionary];
     if([report[@"body"] isKindOfClass:NSString.class]){
      text=report[@"body"];
      owner.removed+=[report[@"removed"] unsignedIntegerValue];
      if([report[@"seconds"] respondsToSelector:@selector(doubleValue)])owner.removedSeconds+=[report[@"seconds"] doubleValue];
     }
     NSString*rewritten=[owner rewrite:text base:http.URL?:url playlistKey:url.absoluteString isStaticVOD:[text containsString:@"#EXT-X-ENDLIST"]];
     if(!rewritten){[owner reply:connection status:502 headers:@{} data:[NSData data] head:NO];return;}
     result=[rewritten dataUsingEncoding:NSUTF8StringEncoding];headers[@"Content-Type"]=@"application/vnd.apple.mpegurl";
     if(owner.enabled&&isStaticVOD&&owner.playlistCache.count<24)owner.playlistCache[url.absoluteString]=result;
    }
   }
   if(!head&&!isPlaylist&&result.length>=189&&((const uint8_t*)result.bytes)[0]==0x47&&((const uint8_t*)result.bytes)[188]==0x47)headers[@"Content-Type"]=@"video/mp2t";
   if(!head&&!isPlaylist&&http.statusCode==200&&![upstream valueForHTTPHeaderField:@"Range"]){[owner storeSegmentCache:path status:200 headers:headers data:result];[owner prefetchLookaheadFromPath:path];}
   [owner reply:connection status:http.statusCode?:502 headers:headers data:result head:head];
  });
 }];
 nw_connection_set_state_changed_handler(connection,^(nw_connection_state_t state,nw_error_t error){
  if(state==nw_connection_state_cancelled||state==nw_connection_state_failed)[task cancel];
 });
 [task resume];
}
- (void)handle:(NSString*)request connection:(nw_connection_t)connection {
 NSArray*lines=[request componentsSeparatedByString:@"\r\n"],*parts=[lines.firstObject componentsSeparatedByString:@" "];
 BOOL head=parts.count>=2&&[parts[0] isEqual:@"HEAD"];
 NSString*reqPath=parts.count>=2?parts[1]:@"";
 NSURL*url=parts.count>=2?self.resources[reqPath]:nil;
 if(!url||(!head&&![parts[0] isEqual:@"GET"])){self.lastTransportError=@"proxy-resource-not-found";[self reply:connection status:404 headers:@{} data:[NSData data] head:head];return;}
 if(!head&&self.enabled&&self.playlistCache[url.absoluteString]){
  [self reply:connection status:200 headers:@{@"Content-Type":@"application/vnd.apple.mpegurl"} data:self.playlistCache[url.absoluteString] head:NO];
  return;
 }
 BOOL hasRange=NO;
 NSMutableURLRequest*upstream=[NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:20];upstream.allHTTPHeaderFields=self.headers;upstream.HTTPMethod=head?@"HEAD":@"GET";
 for(NSString*line in lines)if(![url.path.lowercaseString hasSuffix:@".m3u8"]&&([line.lowercaseString hasPrefix:@"range:"]||[line.lowercaseString hasPrefix:@"if-range:"])) {hasRange=YES;NSRange colon=[line rangeOfString:@":"];if(colon.location!=NSNotFound)[upstream setValue:[[line substringFromIndex:colon.location+1] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet] forHTTPHeaderField:[[line substringToIndex:colon.location] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]];}
 if(!head&&!hasRange&&self.segmentCache[reqPath]){
  NSDictionary*cached=self.segmentCache[reqPath];
  [self prefetchLookaheadFromPath:reqPath];
  [self reply:connection status:200 headers:cached[@"headers"]?:@{} data:cached[@"data"] head:NO];
  return;
 }
 [self fetchUpstream:upstream originalURL:url path:reqPath head:head retriesLeft:head?0:1 connection:connection];
}
@end
#else
// Experimental ABI-only build has no HLS proxy; release builds always use Apple's SDK.
@interface SYHLSProxy:NSObject
@property(nonatomic,strong) NSMutableDictionary*playlistCache;
@property(nonatomic) NSUInteger removed;
@property(nonatomic) double removedSeconds;
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers;
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled;
- (void)seedPlaylists:(NSArray*)items;
@end
@implementation SYHLSProxy
- (NSURL*)prepareLive:(NSURL*)url headers:(NSDictionary*)headers{return url;}
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled{return url;}
- (void)seedPlaylists:(NSArray*)items{}
@end
#endif
