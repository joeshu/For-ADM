// App-local HLS transport. No TLS interception, certificate installation, or remote scripts.
#if __has_include(<Network/Network.h>)
#import <Network/Network.h>
#import <JavaScriptCore/JavaScriptCore.h>
@interface SYHLSProxy:NSObject
@property(nonatomic,strong) nw_listener_t listener;
@property(nonatomic,strong) NSURLSession*session;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSURL*>*resources;
@property(nonatomic,strong) NSMutableDictionary<NSString*,NSString*>*paths;
@property(nonatomic,strong) JSContext*js;
@property(nonatomic,strong) NSDictionary*headers;
@property(nonatomic,copy) NSString*token;
@property(nonatomic) uint16_t port;
@property(nonatomic) BOOL enabled;
@property(nonatomic) NSUInteger removed;
@end
@implementation SYHLSProxy
- (instancetype)init {
 if((self=[super init])){
  self.resources=[NSMutableDictionary dictionary];self.paths=[NSMutableDictionary dictionary];
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
 if(![url.scheme.lowercaseString isEqualToString:@"https"])return nil;
 NSString*path=self.paths[url.absoluteString];
 if(!path){path=[NSString stringWithFormat:@"/%@/%@.%@",self.token,NSUUID.UUID.UUIDString,[url.path.lowercaseString hasSuffix:@".m3u8"]?@"m3u8":@"bin"];self.paths[url.absoluteString]=path;self.resources[path]=url;}
 return [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%u%@",self.port,path]];
}
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled {
 [self.session invalidateAndCancel];self.removed=0;self.enabled=enabled;self.headers=headers;self.token=NSUUID.UUID.UUIDString;
 [self.resources removeAllObjects];[self.paths removeAllObjects];
 NSURLSessionConfiguration*config=[NSURLSessionConfiguration ephemeralSessionConfiguration];config.timeoutIntervalForRequest=20;config.HTTPMaximumConnectionsPerHost=6;
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
  if(data.length>16384||error){nw_connection_cancel(connection);return;}
  if([request containsString:@"\r\n\r\n"]){[owner handle:request connection:connection];}
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
    if([absolute.scheme.lowercaseString isEqualToString:@"https"]){NSURL*mapped=[self mapped:absolute];[changed replaceCharactersInRange:[match rangeAtIndex:1] withString:mapped.absoluteString];}
   }
   [output addObject:changed];
  }
 }
 return [output componentsJoinedByString:@"\n"];
}
- (void)handle:(NSString*)request connection:(nw_connection_t)connection {
 NSArray*lines=[request componentsSeparatedByString:@"\r\n"],*parts=[lines.firstObject componentsSeparatedByString:@" "];
 BOOL head=parts.count>=2&&[parts[0] isEqual:@"HEAD"];
 NSURL*url=parts.count>=2?self.resources[parts[1]]:nil;
 if(!url||(!head&&![parts[0] isEqual:@"GET"])){[self reply:connection status:404 headers:@{} data:[NSData data] head:head];return;}
 NSMutableURLRequest*upstream=[NSMutableURLRequest requestWithURL:url];upstream.allHTTPHeaderFields=self.headers;upstream.HTTPMethod=head?@"HEAD":@"GET";
 for(NSString*line in lines)if(![url.path.lowercaseString hasSuffix:@".m3u8"]&&[line.lowercaseString hasPrefix:@"range:"])[upstream setValue:[[line substringFromIndex:6] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet] forHTTPHeaderField:@"Range"];
 NSString*token=self.token;
 __weak SYHLSProxy*weak=self;
 [[self.session dataTaskWithRequest:upstream completionHandler:^(NSData*body,NSURLResponse*response,NSError*error){
  dispatch_async(dispatch_get_main_queue(),^{
   SYHLSProxy*owner=weak;if(!owner||![token isEqual:owner.token]){nw_connection_cancel(connection);return;}
   NSHTTPURLResponse*http=(NSHTTPURLResponse*)response;
   if(error||body.length>32*1024*1024){[owner reply:connection status:502 headers:@{} data:[NSData data] head:head];return;}
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
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled;
@end
@implementation SYHLSProxy
- (NSURL*)prepare:(NSURL*)url headers:(NSDictionary*)headers enabled:(BOOL)enabled{return url;}
@end
#endif
