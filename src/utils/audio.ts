/**
 * Helper utilities for raw PCM16 audio processing, conversions, 
 * low latency gapless playback scheduler, and low-latency microphone recorder.
 */

export function float32ToPcm16(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function pcm16ToFloat32(arrayBuffer: ArrayBuffer): Float32Array {
  const view = new DataView(arrayBuffer);
  const length = arrayBuffer.byteLength / 2;
  const float32 = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const value = view.getInt16(i * 2, true);
    float32[i] = value / (value < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * AudioRecorder class handles microphone capture, resamples to 16kHz,
 * converts to 16-bit PCM little endian, and emits Base64 chunks via onAudio.
 */
export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioCallback: (base64: string) => void;

  constructor(onAudio: (base64: string) => void) {
    this.onAudioCallback = onAudio;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.ctx = new AudioContext({ sampleRate: 16000 });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    
    // Create a script processor with 2048 buffer size, 1 input, 1 output channel
    this.processor = this.ctx.createScriptProcessor(2048, 1, 1);
    
    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBuffer = float32ToPcm16(inputData);
      const base64 = arrayBufferToBase64(pcmBuffer);
      this.onAudioCallback(base64);
    };
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * AudioPlayer class manages model voice output at 24kHz using precise scheduling
 * to ensure stutter-free gapless playback.
 */
export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private sources: AudioBufferSourceNode[] = [];
  private sampleRate = 24000;
  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private activeTimers: number[] = [];

  constructor(onSpeakingChange?: (isSpeaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  start() {
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    this.nextStartTime = this.ctx.currentTime;
  }

  stop() {
    this.clearQueue();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.nextStartTime = 0;
  }

  playChunk(base64Data: string) {
    if (!this.ctx) {
      this.start();
    }
    const ctx = this.ctx!;
    const pcmBuffer = base64ToArrayBuffer(base64Data);
    const float32Data = pcm16ToFloat32(pcmBuffer);

    const audioBuffer = ctx.createBuffer(1, float32Data.length, this.sampleRate);
    audioBuffer.copyToChannel(float32Data, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule playback precisely
    const now = ctx.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.sources.push(source);

    // Update speaking state
    if (this.onSpeakingChange) {
      this.onSpeakingChange(true);
    }

    // Set time-driven check to see if we've stopped playing
    const delayMs = (startTime - now) * 1000;
    const durationMs = audioBuffer.duration * 1000;

    const timerId = window.setTimeout(() => {
      // Once this chunk has started playing
      const endTimerId = window.setTimeout(() => {
        const idx = this.sources.indexOf(source);
        if (idx > -1) {
          this.sources.splice(idx, 1);
        }
        if (this.sources.length === 0 && this.onSpeakingChange) {
          this.onSpeakingChange(false);
        }
      }, durationMs);
      this.activeTimers.push(endTimerId);
    }, delayMs);

    this.activeTimers.push(timerId);

    // Also use standard ended callback for robustness
    source.onended = () => {
      const idx = this.sources.indexOf(source);
      if (idx > -1) {
        this.sources.splice(idx, 1);
      }
      if (this.sources.length === 0 && this.onSpeakingChange) {
        this.onSpeakingChange(false);
      }
    };
  }

  clearQueue() {
    this.sources.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // already stopped
      }
    });
    this.sources = [];
    this.activeTimers.forEach((timerId) => clearTimeout(timerId));
    this.activeTimers = [];
    if (this.ctx) {
      this.nextStartTime = this.ctx.currentTime;
    } else {
      this.nextStartTime = 0;
    }
    if (this.onSpeakingChange) {
      this.onSpeakingChange(false);
    }
  }
}
