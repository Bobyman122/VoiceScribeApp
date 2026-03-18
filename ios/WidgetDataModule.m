#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataModule, NSObject)
RCT_EXTERN_METHOD(
  updateSessions:(NSString *)sessionsJSON
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)
@end
