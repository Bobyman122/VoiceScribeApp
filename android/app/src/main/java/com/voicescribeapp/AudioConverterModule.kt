package com.voicescribeapp

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.ShortBuffer

class AudioConverterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AudioConverter"

    @ReactMethod
    fun convertToWav(inputPath: String, outputPath: String, promise: Promise) {
        Thread {
            try {
                val (pcm, sampleRate) = decodeToPcm16Mono(inputPath)
                writeWav(outputPath, pcm, sampleRate)
                promise.resolve(outputPath)
            } catch (e: Exception) {
                promise.reject("CONVERT_ERROR", e.message ?: "Unknown error", e)
            }
        }.start()
    }

    private fun decodeToPcm16Mono(inputPath: String): Pair<ShortArray, Int> {
        val extractor = MediaExtractor()
        extractor.setDataSource(inputPath)

        var audioTrack = -1
        var inputFormat: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val fmt = extractor.getTrackFormat(i)
            if (fmt.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                audioTrack = i
                inputFormat = fmt
                break
            }
        }
        if (audioTrack < 0 || inputFormat == null)
            throw Exception("No audio track found in $inputPath")

        extractor.selectTrack(audioTrack)

        val mime = inputFormat.getString(MediaFormat.KEY_MIME)!!
        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(inputFormat, null, null, 0)
        codec.start()

        // Collect raw PCM bytes from the decoder
        val rawBytes = mutableListOf<Byte>()
        val info = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false
        var actualSampleRate = 0
        var actualChannels = 0

        while (!outputDone) {
            if (!inputDone) {
                val inIdx = codec.dequeueInputBuffer(10_000)
                if (inIdx >= 0) {
                    val buf = codec.getInputBuffer(inIdx)!!
                    val size = extractor.readSampleData(buf, 0)
                    if (size < 0) {
                        codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputDone = true
                    } else {
                        codec.queueInputBuffer(inIdx, 0, size, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }

            val outIdx = codec.dequeueOutputBuffer(info, 10_000)
            if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                val fmt = codec.outputFormat
                actualSampleRate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                actualChannels = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            } else if (outIdx >= 0) {
                val buf = codec.getOutputBuffer(outIdx)!!
                if (info.size > 0) {
                    // MediaCodec output data is valid only in [offset, offset + size).
                    // Reading from position 0 can corrupt PCM and tank Whisper accuracy.
                    val readBuffer = buf.duplicate()
                    readBuffer.position(info.offset)
                    readBuffer.limit(info.offset + info.size)
                    val chunk = ByteArray(info.size)
                    readBuffer.get(chunk)
                    rawBytes.addAll(chunk.toList())
                }
                codec.releaseOutputBuffer(outIdx, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
            }
        }

        codec.stop()
        codec.release()
        extractor.release()

        if (actualSampleRate == 0) actualSampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        if (actualChannels == 0) actualChannels = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

        // Convert bytes to signed 16-bit samples
        val byteArray = rawBytes.toByteArray()
        val bb = ByteBuffer.wrap(byteArray).order(ByteOrder.LITTLE_ENDIAN)
        val shorts = ShortArray(byteArray.size / 2)
        bb.asShortBuffer().get(shorts)

        // Downmix to mono if stereo
        val mono = if (actualChannels == 1) shorts else downmixToMono(shorts, actualChannels)

        // Resample to 16kHz if needed
        val targetRate = 16000
        val resampled = if (actualSampleRate == targetRate) mono
                        else resample(mono, actualSampleRate, targetRate)

        return Pair(resampled, targetRate)
    }

    private fun downmixToMono(samples: ShortArray, channels: Int): ShortArray {
        val mono = ShortArray(samples.size / channels)
        for (i in mono.indices) {
            var sum = 0L
            for (c in 0 until channels) sum += samples[i * channels + c]
            mono[i] = (sum / channels).toShort()
        }
        return mono
    }

    private fun resample(input: ShortArray, fromRate: Int, toRate: Int): ShortArray {
        val ratio = fromRate.toDouble() / toRate.toDouble()
        val outputLen = (input.size / ratio).toInt()
        val output = ShortArray(outputLen)
        for (i in output.indices) {
            val srcIdx = i * ratio
            val lo = srcIdx.toInt().coerceIn(0, input.size - 1)
            val hi = (lo + 1).coerceIn(0, input.size - 1)
            val frac = srcIdx - lo
            output[i] = (input[lo] * (1.0 - frac) + input[hi] * frac).toInt().toShort()
        }
        return output
    }

    private fun writeWav(path: String, pcm: ShortArray, sampleRate: Int) {
        val channels = 1
        val bitsPerSample = 16
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataSize = pcm.size * 2

        val fos = FileOutputStream(File(path))
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray())
        header.putInt(dataSize + 36)
        header.put("WAVE".toByteArray())
        header.put("fmt ".toByteArray())
        header.putInt(16)
        header.putShort(1)
        header.putShort(channels.toShort())
        header.putInt(sampleRate)
        header.putInt(byteRate)
        header.putShort(blockAlign.toShort())
        header.putShort(bitsPerSample.toShort())
        header.put("data".toByteArray())
        header.putInt(dataSize)
        fos.write(header.array())

        val dataBuffer = ByteBuffer.allocate(dataSize).order(ByteOrder.LITTLE_ENDIAN)
        for (s in pcm) dataBuffer.putShort(s)
        fos.write(dataBuffer.array())
        fos.close()
    }
}
