import Foundation
import AVFoundation

@objc(AudioNormalizer)
class AudioNormalizer: NSObject {

  // Normalize a 16-bit mono PCM WAV file in-place.
  // If the peak amplitude is below targetPeak, applies linear gain (capped at maxGain).
  // Returns the output path on success.
  @objc(normalizeWav:resolve:reject:)
  func normalizeWav(
    _ inputPath: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let inputURL = URL(fileURLWithPath: inputPath)
    let outputURL = inputURL.deletingPathExtension().appendingPathExtension("normalized.wav")

    do {
      let inputFile = try AVAudioFile(forReading: inputURL)
      let format = inputFile.processingFormat
      let frameCount = AVAudioFrameCount(inputFile.length)

      guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
        resolve(inputPath); return
      }
      try inputFile.read(into: buffer)

      let length = Int(buffer.frameLength)

      // Work with float samples for gain calculation
      guard let floatData = buffer.floatChannelData else {
        resolve(inputPath); return
      }

      let channel = floatData[0]

      // Find peak
      var peak: Float = 0
      for i in 0..<length {
        let abs = fabsf(channel[i])
        if abs > peak { peak = abs }
      }

      // Target peak = 0.85 of full scale; max gain = 30x
      let targetPeak: Float = 0.85
      let maxGain: Float = 10.0

      if peak > 0 && peak < targetPeak {
        let gain = min(targetPeak / peak, maxGain)
        for i in 0..<length {
          channel[i] = max(-1.0, min(1.0, channel[i] * gain))
        }
      } else {
        // Audio already loud enough — skip re-encoding
        resolve(inputPath); return
      }

      let outputSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: format.sampleRate,
        AVNumberOfChannelsKey: format.channelCount,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
      ]

      let outputFile = try AVAudioFile(forWriting: outputURL, settings: outputSettings)
      try outputFile.write(from: buffer)

      resolve(outputURL.path)
    } catch {
      // On any failure, pass through original file so recording still works
      resolve(inputPath)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
