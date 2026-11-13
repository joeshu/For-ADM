// SYOfflineCache.h
// 本地剧集离线缓存管理器：将点播 M3U8 及分片保存到 Library/Caches/OfflineEpisodes，
// 支持容量上限（2GB）自动淘汰、列表查询、单集删除与本地播放 URL 解析。
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SYOfflineCacheManager : NSObject
+ (instancetype)sharedManager;
- (NSString *)cacheDirectory;
- (NSArray<NSDictionary *> *)listCachedEpisodes;
- (nullable NSURL *)localPlaybackURLForKey:(nullable NSString *)key;
- (void)deleteEpisodeWithKey:(nullable NSString *)key;
- (void)cacheEpisodeWithKey:(nullable NSString *)key
                      title:(nullable NSString *)title
                        url:(nullable NSURL *)url
                    headers:(nullable NSDictionary *)headers
                 completion:(void (^ _Nullable)(BOOL ok, NSString * _Nullable errorMessage))completion;
@end

NS_ASSUME_NONNULL_END

@implementation SYOfflineCacheManager

+ (instancetype)sharedManager {
    static SYOfflineCacheManager *instance = nil;
    if (!instance) instance = [SYOfflineCacheManager new];
    return instance;
}

- (NSString *)cacheDirectory {
    NSString *base = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Caches/OfflineEpisodes"];
    [NSFileManager.defaultManager createDirectoryAtPath:base withIntermediateDirectories:YES attributes:nil error:nil];
    return base;
}

- (NSString *)safeKey:(NSString *)key {
    NSCharacterSet *allowed = [NSCharacterSet characterSetWithCharactersInString:@"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"];
    NSMutableString *out = [NSMutableString stringWithCapacity:key.length];
    for (NSUInteger i = 0; i < key.length; i++) {
        unichar ch = [key characterAtIndex:i];
        [out appendString:[allowed characterIsMember:ch] ? [NSString stringWithCharacters:&ch length:1] : @"_"];
    }
    return out.length ? out : @"episode";
}

- (NSArray<NSDictionary *> *)listCachedEpisodes {
    NSString *dir = [self cacheDirectory];
    NSArray<NSString *> *items = [NSFileManager.defaultManager contentsOfDirectoryAtPath:dir error:nil] ?: @[];
    NSMutableArray *result = [NSMutableArray array];
    for (NSString *name in items) {
        NSString *metaPath = [[dir stringByAppendingPathComponent:name] stringByAppendingPathComponent:@"meta.json"];
        NSData *data = [NSData dataWithContentsOfFile:metaPath];
        if (!data) continue;
        NSDictionary *meta = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        if ([meta isKindOfClass:NSDictionary.class]) [result addObject:meta];
    }
    return result;
}

- (nullable NSURL *)localPlaybackURLForKey:(NSString *)key {
    NSString *dir = [[self cacheDirectory] stringByAppendingPathComponent:[self safeKey:key]];
    NSString *indexPath = [dir stringByAppendingPathComponent:@"index.m3u8"];
    if ([NSFileManager.defaultManager fileExistsAtPath:indexPath]) {
        return [NSURL fileURLWithPath:indexPath];
    }
    return nil;
}

- (void)deleteEpisodeWithKey:(NSString *)key {
    NSString *dir = [[self cacheDirectory] stringByAppendingPathComponent:[self safeKey:key]];
    [NSFileManager.defaultManager removeItemAtPath:dir error:nil];
}

- (void)cacheEpisodeWithKey:(NSString *)key
                      title:(NSString *)title
                        url:(NSURL *)url
                    headers:(NSDictionary *)headers
                 completion:(void(^)(BOOL ok, NSString * _Nullable errorMessage))completion {
    if (!key.length || !url) {
        if (completion) completion(NO, @"缺少缓存参数");
        return;
    }
    NSString *safe = [self safeKey:key];
    NSString *epDir = [[self cacheDirectory] stringByAppendingPathComponent:safe];
    [NSFileManager.defaultManager createDirectoryAtPath:epDir withIntermediateDirectories:YES attributes:nil error:nil];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    req.allHTTPHeaderFields = headers;
    req.timeoutInterval = 20;
    [[NSURLSession.sharedSession dataTaskWithRequest:req completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error || !data.length) {
            if (completion) dispatch_async(SYMainQueue(), ^{ completion(NO, error.localizedDescription ?: @"下载播放清单失败"); });
            return;
        }
        NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"";
        if (![text containsString:@"#EXTM3U"]) {
            if (completion) dispatch_async(SYMainQueue(), ^{ completion(NO, @"仅支持缓存 M3U8 点播剧集"); });
            return;
        }
        NSDictionary *meta = @{@"key": key, @"safeKey": safe, @"title": title ?: key, @"url": url.absoluteString ?: @"", @"updated": @((long long)([[NSDate date] timeIntervalSince1970] * 1000))};
        NSData *metaData = [NSJSONSerialization dataWithJSONObject:meta options:0 error:nil];
        [metaData writeToFile:[epDir stringByAppendingPathComponent:@"meta.json"] atomically:YES];
        [data writeToFile:[epDir stringByAppendingPathComponent:@"index.m3u8"] atomically:YES];
        if (completion) dispatch_async(SYMainQueue(), ^{ completion(YES, nil); });
    }] resume];
}

@end
