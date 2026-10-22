#import <Foundation/Foundation.h>
#import "../Sources/HLSProxy.h"
@interface FixtureProtocol:NSURLProtocol @end
@implementation FixtureProtocol
+ (BOOL)canInitWithRequest:(NSURLRequest*)request{return [request.URL.host isEqual:@"fixture.test"];}
+ (NSURLRequest*)canonicalRequestForRequest:(NSURLRequest*)request{return request;}
- (void)startLoading {
 NSString*path=self.request.URL.path;NSString*text=@"",*type=@"application/vnd.apple.mpegurl";NSInteger status=200;
 if(![[self.request valueForHTTPHeaderField:@"Referer"] isEqual:@"https://site.test/"]){[self.client URLProtocol:self didFailWithError:[NSError errorWithDomain:@"missing-referer" code:1 userInfo:nil]];return;}
 if([path isEqual:@"/master.m3u8"])text=@"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant/list.m3u8\n";
 else if([path isEqual:@"/variant/list.m3u8"]){
  NSMutableString*list=[NSMutableString stringWithString:@"#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\n../../ads/UoK3btd2/0.ts\n"];
  for(int i=0;i<20;i++)[list appendFormat:@"#EXTINF:10,\n../../media/movie/%d.ts\n",i];
  [list appendString:@"#EXT-X-ENDLIST\n"];text=list;
 }else if([path isEqual:@"/encrypted.m3u8"])text=@"#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-KEY:METHOD=AES-128,URI=\"keys/key.bin\"\n#EXT-X-MAP:URI=\"init.mp4\"\n#EXTINF:10,\nmedia/movie/0.ts\n#EXT-X-ENDLIST\n";
 else{type=@"application/octet-stream";text=@"0123456789";if([self.request valueForHTTPHeaderField:@"Range"]) {status=206;text=@"2345";}}
 NSMutableDictionary*headers=[@{@"Content-Type":type,@"Content-Length":@(text.length).stringValue} mutableCopy];
 if(status==206)headers[@"Content-Range"]=@"bytes 2-5/10";
 NSHTTPURLResponse*response=[[NSHTTPURLResponse alloc]initWithURL:self.request.URL statusCode:status HTTPVersion:@"HTTP/1.1" headerFields:headers];
 [self.client URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
 if(![self.request.HTTPMethod isEqual:@"HEAD"])[self.client URLProtocol:self didLoadData:[text dataUsingEncoding:NSUTF8StringEncoding]];
 [self.client URLProtocolDidFinishLoading:self];
}
- (void)stopLoading {}
@end
static void waitFor(BOOL(^done)(void)){
 NSDate*deadline=[NSDate dateWithTimeIntervalSinceNow:8];
 while(!done()&&deadline.timeIntervalSinceNow>0)[NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.01]];
 NSCAssert(done(),@"async operation timed out");
}
static NSData*get(NSURL*url,NSString*method,NSString*range,NSHTTPURLResponse**out){
 __block BOOL done=NO;__block NSData*data;__block NSHTTPURLResponse*response;__block NSError*failure;
 NSMutableURLRequest*r=[NSMutableURLRequest requestWithURL:url];r.HTTPMethod=method;
 if(range)[r setValue:range forHTTPHeaderField:@"Range"];
 [[NSURLSession.sharedSession dataTaskWithRequest:r completionHandler:^(NSData*d,NSURLResponse*s,NSError*e){data=d;response=(id)s;failure=e;done=YES;}] resume];
 waitFor(^BOOL{return done;});NSCAssert(!failure,@"%@",failure);if(out)*out=response;return data;
}
static NSURLSession*fixtureSession(void){NSURLSessionConfiguration*c=NSURLSessionConfiguration.ephemeralSessionConfiguration;c.protocolClasses=@[FixtureProtocol.class];return [NSURLSession sessionWithConfiguration:c];}
static NSString*text(NSData*d){return [[NSString alloc]initWithData:d encoding:NSUTF8StringEncoding];}
int main(int argc,char**argv){@autoreleasepool{
 SYHLSProxy*p=[SYHLSProxy new];[p.js evaluateScript:[NSString stringWithContentsOfFile:@(argv[1]) encoding:NSUTF8StringEncoding error:nil]];
 waitFor(^BOOL{return p.port>0;});
 NSURL*root=[p prepare:[NSURL URLWithString:@"https://fixture.test/master.m3u8"] headers:@{@"Referer":@"https://site.test/"} enabled:YES];p.session=fixtureSession();
 NSString*master=text(get(root,@"GET",nil,NULL));NSString*child=[master componentsSeparatedByString:@"\n"][2];
 NSCAssert([child hasPrefix:@"http://127.0.0.1:"],@"master child not mapped");
 NSString*media=text(get([NSURL URLWithString:child],@"GET",nil,NULL));
 NSCAssert(p.removed==1&&! [media containsString:@"UoK3btd2"],@"ad not removed");
 NSString*segment=nil;for(NSString*line in [media componentsSeparatedByString:@"\n"])if([line hasPrefix:@"http://"]){segment=line;break;}
 NSHTTPURLResponse*response;NSData*range=get([NSURL URLWithString:segment],@"GET",@"bytes=2-5",&response);
 NSCAssert(response.statusCode==206&&[text(range) isEqual:@"2345"]&&[response.allHeaderFields[@"Content-Range"] isEqual:@"bytes 2-5/10"],@"range lost");
 get([NSURL URLWithString:segment],@"HEAD",nil,&response);NSCAssert(response.expectedContentLength==10,@"HEAD length lost");
 NSURL*old=root;root=[p prepare:[NSURL URLWithString:@"https://fixture.test/encrypted.m3u8"] headers:@{@"Referer":@"https://site.test/"} enabled:YES];p.session=fixtureSession();
 NSString*encrypted=text(get(root,@"GET",nil,NULL));NSCAssert([encrypted containsString:@"METHOD=AES-128"]&&[encrypted containsString:@"URI=\"http://127.0.0.1:"],@"key/map mapping lost");
 get(old,@"GET",nil,&response);NSCAssert(response.statusCode==404,@"old token still usable");
 NSURL*direct=[p prepare:[NSURL URLWithString:@"https://fixture.test/master.m3u8"] headers:@{} enabled:NO];NSCAssert([direct.scheme isEqual:@"https"],@"off switch still proxies");
 NSLog(@"HLS transport passed: nested playlists, ad removal, relative URLs, Referer, Range, HEAD, encrypted keys/maps, token replacement and disabled path.");
 nw_listener_cancel(p.listener);[p.session invalidateAndCancel];return 0;
}}
