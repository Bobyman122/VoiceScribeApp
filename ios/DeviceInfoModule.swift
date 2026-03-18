import Foundation

// Type aliases matching React Native's ObjC promise block types
typealias RCTPromiseResolveBlock = (Any?) -> Void
typealias RCTPromiseRejectBlock = (String?, String?, Error?) -> Void

@objc(DeviceInfoModule)
class DeviceInfoModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  // Returns the hardware model identifier, e.g. "iPhone16,1"
  @objc func getDeviceIdentifier(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    var systemInfo = utsname()
    uname(&systemInfo)
    let identifier = withUnsafePointer(to: &systemInfo.machine) {
      $0.withMemoryRebound(to: CChar.self, capacity: 1) {
        String(validatingUTF8: $0) ?? "unknown"
      }
    }
    resolve(identifier)
  }

  // Returns total physical RAM in bytes
  @objc func getTotalRam(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(NSNumber(value: ProcessInfo.processInfo.physicalMemory))
  }

  // Returns currently used RAM in bytes (active + wired + compressed pages)
  @objc func getUsedRam(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    var stats = vm_statistics64()
    var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &stats) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
      }
    }
    guard result == KERN_SUCCESS else {
      reject("RAM_ERROR", "Failed to read VM statistics", nil)
      return
    }
    let pageSize = UInt64(vm_kernel_page_size)
    let usedPages = UInt64(stats.active_count) + UInt64(stats.wire_count) + UInt64(stats.compressor_page_count)
    resolve(NSNumber(value: usedPages * pageSize))
  }
}
