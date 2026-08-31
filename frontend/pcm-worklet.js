// AudioWorklet: downsample the mic input to 16 kHz mono and emit Int16 PCM.
// Loaded by app.js (startPCM) for live voice input — the browser can't record
// raw PCM any other way without a build step. Posts an ArrayBuffer (transferred)
// of little-endian 16-bit samples to the main thread every ~100 ms.
class PCMDownsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this._target = 16000;
    this._ratio = sampleRate / this._target; // `sampleRate` = the context's rate
    this._acc = [];                           // buffered input samples (native rate)
    this._minOut = 1600;                      // ~100 ms at 16 kHz
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) this._acc.push(ch[i]);

    const outLen = Math.floor(this._acc.length / this._ratio);
    if (outLen < this._minOut) return true;

    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * this._ratio;
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, this._acc.length - 1);
      const frac = idx - lo;
      let s = this._acc[lo] * (1 - frac) + this._acc[hi] * frac;
      s = Math.max(-1, Math.min(1, s));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this._acc = this._acc.slice(Math.ceil(outLen * this._ratio));
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor('pcm-downsampler', PCMDownsampler);
