#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioNormalizer, NSObject)
RCT_EXTERN_METHOD(normalizeWav:(NSString *)inputPath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
@end
