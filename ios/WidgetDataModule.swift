import Foundation
import WidgetKit

@objc(WidgetDataModule)
class WidgetDataModule: NSObject {
  private let appGroupID = "group.org.reactjs.native.example.VoiceScribeApp"

  @objc(updateSessions:resolve:reject:)
  func updateSessions(
    _ sessionsJSON: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard
      let data = sessionsJSON.data(using: .utf8),
      let defaults = UserDefaults(suiteName: appGroupID)
    else {
      reject("WIDGET_ERROR", "Failed to write widget data", nil)
      return
    }
    defaults.set(data, forKey: "widgetSessions")
    WidgetCenter.shared.reloadAllTimelines()
    resolve(nil)
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
