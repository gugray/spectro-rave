import {G} from "./global.js";
import {InplaceFFT} from "./fft-inplace";
import * as twgl from "twgl.js";

const vs = `#version 300 es
in vec4 position;
void main() {
    // This is [-1, 1] for both X and Y
    gl_Position = position;
}`;


const fs = `#version 300 es
precision highp float;

out vec4 outColor;
uniform vec2 resolution;
uniform float n_bands;
uniform sampler2D spectra;
uniform float cursor_x;
uniform vec3 color;

void main() {
    float band = round(gl_FragCoord.y / resolution.y * n_bands);
    float sample_x = floor(band / 4.0);
    float sample_dim = mod(band, 4.0);
    float sample_y = gl_FragCoord.x;
    ivec2 coords = ivec2(sample_x, sample_y);
    vec4 s = texelFetch(spectra, coords, 0);
    float lum = s[int(sample_dim)] * 8.;
    
    float pastCursorBy = gl_FragCoord.x - cursor_x;
    if (pastCursorBy < 0.) pastCursorBy += resolution.x;
    float cursorWidth = min(64., resolution.x * 0.3);
    // lum *= smoothstep(0., cursorWidth, pastCursorBy);
    
    vec3 res = lum * color * 0.01;
    res = clamp(res, 0., 1.);
    res *= smoothstep(0., cursorWidth, pastCursorBy);
    outColor = vec4(res, 1.0);
}
`;

class ShaderVizBox {
  constructor(elm) {
    this.elm = elm;
    this.w = this.elm.clientWidth;
    this.h = this.elm.clientHeight;
    this.nSeconds = 4;
    this.gain = 100;
    this.r = 100;
    this.g = 25;
    this.b = 25;
    this.fftSize = 8192;
    this.halfFFTSize = this.fftSize / 2;
    this.fft = new InplaceFFT(this.fftSize);
    this.resetSpectra(this.w);
    this.currSampleIx = 0;
    this.looping = false;
    this.visible = true;

    this.initShaders();

    const ro = new ResizeObserver(() => {
      if (this.w == this.elm.clientWidth && this.h == this.elm.clientHeight)
        return;
      const oldW = this.w;
      this.w = this.elm.clientWidth;
      this.h = this.elm.clientHeight;
      this.elm.width = this.w;
      this.elm.height = this.h;
      this.resetSpectra(oldW);
    });
    ro.observe(this.elm);
  }

  resetSpectra(oldW) {
    let oldSpectra;
    if (this.allSpectra) oldSpectra = this.allSpectra;
    this.allSpectra = new Float32Array(this.halfFFTSize * this.w);
    if (!oldSpectra) return;

    const oldHalfFFTSize = oldSpectra.length / oldW;
    for (let x = 0; x < this.w; ++x) {
      const startIx = x * this.halfFFTSize;
      const oldX = Math.floor(oldW * x / this.w);
      const oldStartIx = oldX * oldHalfFFTSize;
      for (let band = 0; band < this.halfFFTSize; ++band) {
        const oldBand = Math.floor(oldHalfFFTSize * band / this.halfFFTSize);
        this.allSpectra[startIx + band] = oldSpectra[oldStartIx + oldBand];
      }
    }
  }

  setFFTSize(fftSize) {
    fftSize = Math.round(fftSize);
    fftSize = Math.max(fftSize, 6);
    fftSize = Math.min(fftSize, 14);
    this.fftSize = Math.pow(2, fftSize);
    this.halfFFTSize = this.fftSize / 2;
    this.fft = new InplaceFFT(this.fftSize);
    this.resetSpectra(this.w);
  }

  setVisible(val) {
    this.visible = val;
    if (!this.visible)
      this.allSpectra.fill(0);
  }


  setLooping(val) {
    this.looping = val;
  }

  setGain(gain) {
    this.gain = gain;
  }

  setRGB(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  setPeriod(seconds) {
    this.nSeconds = seconds;
  }

  initShaders() {
    this.elm.width = this.w;
    this.elm.height = this.h;

    // 3D WebGL canvas, and twgl
    this.gl = this.elm.getContext("webgl2");
    twgl.addExtensionsToContext(this.gl);

    this.arrays = {
      position: {numComponents: 2, data: [-1, -1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1]},
    };
    this.bufferInfo = twgl.createBufferInfoFromArrays(this.gl, this.arrays);
    this.progInfo = twgl.createProgramInfo(this.gl, [vs, fs]);
    this.gl.useProgram(this.progInfo.program);

    this.txSpectra = twgl.createTexture(this.gl, {
      internalFormat: this.gl.RGBA32F,
      format: this.gl.RGBA,
      type: this.gl.FLOAT,
      height: this.w,
      width: this.fftSize / 2 / 4,
      src: this.allSpectra,
    });
  }

  render(currColumnIx) {
    const uniforms = {
      resolution: [this.w, this.h],
      n_bands: this.halfFFTSize,
      spectra: this.txSpectra,
      cursor_x: currColumnIx,
      color: [this.r, this.g, this.b],
    };
    twgl.bindFramebufferInfo(this.gl, null);
    this.gl.viewport(0, 0, this.w, this.h);
    twgl.setBuffersAndAttributes(this.gl, this.progInfo, this.bufferInfo);
    twgl.setUniforms(this.progInfo, uniforms);
    twgl.setTextureFromArray(this.gl, this.txSpectra, this.allSpectra, {
      internalFormat: this.gl.RGBA32F,
      format: this.gl.RGBA,
      type: this.gl.FLOAT,
      height: this.w,
      width: this.fftSize / 2 / 4,
    });
    twgl.drawBufferInfo(this.gl, this.bufferInfo);
  }

  update() {
    const nSamples = this.nSeconds * G.sampleRate;
    const samplesPerColumn = nSamples / this.w;
    const prevSampleIx = this.currSampleIx;
    const prevColumnIx = Math.floor(this.w * (prevSampleIx % nSamples) / nSamples);
    const currSampleIx = this.currSampleIx = G.sampleIx;
    const currColumnIx = Math.floor(this.w * (currSampleIx % nSamples) / nSamples);
    let cix, i;
    if (!this.looping && this.visible) {
      for (cix = prevColumnIx, i = 0; cix != currColumnIx; cix = (cix + 1) % this.w, ++i) {
        const sampleIx = Math.floor(prevSampleIx + i * samplesPerColumn) - this.fftSize;
        const spectrumPos = cix * this.halfFFTSize;
        this.fft.forward(G.samples, sampleIx, this.gain, this.allSpectra, spectrumPos);
      }
    }
    this.render(currColumnIx);
  }
}

export {ShaderVizBox}
