import {G} from "./global.js";
import {FFT} from "./fft.js";

class VizBox {
  constructor(elm) {
    this.elm = elm;
    this.gain = 100;
    this.r = 1;
    this.g = 0.25;
    this.b = 0.25;
    this.fftSize = 8192;
    this.periodSec = 4;
    this.initFFT();
  }

  initFFT() {
    this.halfFFTSize = this.fftSize / 2;
    this.fft = new FFT(this.fftSize, G.sampleRate)
    this.frame = new Float32Array(this.fftSize);
    this.spectra = [];
    this.frameEndSampleIxs = [];
    const nSamples = G.nSeconds * G.sampleRate;
    this.logicalWidth = G.nSeconds / this.periodSec * this.elm.clientWidth;
    for (let i = 0; i < this.logicalWidth; ++i) {
      this.spectra.push(new Float32Array(this.halfFFTSize));
      this.frameEndSampleIxs.push(Math.round((i + 0.5) * (nSamples / this.logicalWidth)) + this.halfFFTSize);
    }
    this.elm.width = this.spectra.length * this.periodSec / G.nSeconds;
    this.elm.height = this.halfFFTSize;
    this.lastSpectrumIx = 0;
    this.x = 0;
  }

  setFFTSize(fftSize) {
    this.fftSize = fftSize;
    this.initFFT();
  }

  setPeriod(period) {
    this.periodSec = period;
    this.initFFT();
  }

  setGain(gain) {
    this.gain = gain;
  }

  setRGB(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  getLatestSpectrumIx() {
    let i = this.lastSpectrumIx;
    // Wrapped around?
    if (G.samplePos < this.frameEndSampleIxs[this.lastSpectrumIx])
      i = 0;
    while (G.samplePos > this.frameEndSampleIxs[i]) {
      ++i;
      if (i == this.frameEndSampleIxs.length) i = 0;
    }
    return i;
  }

  calcSpectrum(ix) {
    // IX of sample at the middle of this spectrum's duration
    // 1 spectrum = 1px horizontally
    const startIx = this.frameEndSampleIxs[ix] - this.fftSize;
    for (let i = 0; i < this.fftSize; ++i) {
      let sampleIx = startIx + i;
      if (sampleIx < 0) sampleIx += G.samples.length;
      if (sampleIx >= G.samples.length) sampleIx -= G.samples.length;
      this.frame[i] = G.samples[sampleIx] * this.gain;
    }
    this.fft.forward(this.frame);
    const spectrum = this.spectra[ix];
    for (let i = 0; i < this.halfFFTSize; ++i)
      spectrum[i] = this.fft.spectrum[i];
  }

  update() {

    let endIx = this.getLatestSpectrumIx();
    let ix = this.lastSpectrumIx;
    let lastSpectrumIx = this.lastSpectrumIx;

    // For all spectra where we have new audio
    while (ix != endIx) {
      // Perform FFT
      this.calcSpectrum(ix);
      // Move on; not forgetting to wrap around
      ++ix;
      if (ix == this.spectra.length) ix = 0;
    }
    this.lastSpectrumIx = endIx;

    // We'll be manipulating pixels directly
    const w = this.elm.clientWidth;
    const h = this.halfFFTSize;
    const ctx = this.elm.getContext("2d");
    const imgData = ctx.getImageData(0, 0, w, h);

    ix = lastSpectrumIx;
    while (ix != endIx) {
      const s = this.spectra[ix];
      for (let i = 0; i < s.length; ++i) {
        const y = h - i - 1;
        let val = s[i] * 2048;
        setPixel(imgData, this.x, y, val * this.r, val * this.g, val * this.b);
      }
      ++ix;
      if (ix == this.spectra.length) ix = 0;
      ++this.x;
      if (this.x == w) this.x = 0;
    }

    // Flush back to screen
    ctx.putImageData(imgData, 0, 0);
  }
}

function setPixel(imgd, x, y, r, g, b, a = 255) {
  const w = imgd.width;
  imgd.data[(y * w + x) * 4] = Math.round(r);
  imgd.data[(y * w + x) * 4 + 1] = Math.round(g);
  imgd.data[(y * w + x) * 4 + 2] = Math.round(b);
  imgd.data[(y * w + x) * 4 + 3] = Math.round(a);
}

export {VizBox}
