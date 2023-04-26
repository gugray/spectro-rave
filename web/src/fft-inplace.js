/*
 * FFT code extracted from the DSP.js library:
 * https://github.com/corbanbrook/dsp.js/
 * Used here under the terms of the MIT license
 *
 * DSP.js - a comprehensive digital signal processing  library for javascript
 *
 * Created by Corban Brook <corbanbrook@gmail.com> on 2010-01-01.
 * Copyright 2010 Corban Brook. All rights reserved.
 *
 */

class InplaceFFT {
  constructor(bufferSize) {
    this.bufferSize = bufferSize;
    this.real = new Float32Array(bufferSize);
    this.imag = new Float32Array(bufferSize);
    this.reverseTable = new Uint32Array(bufferSize);

    let limit = 1;
    let bit = bufferSize >> 1;
    while (limit < bufferSize) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit = limit << 1;
      bit = bit >> 1;
    }

    this.sinTable = new Float32Array(bufferSize);
    this.cosTable = new Float32Array(bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      this.sinTable[i] = Math.sin(-Math.PI / i);
      this.cosTable[i] = Math.cos(-Math.PI / i);
    }
  }

  forward(buffer, bufferStartIx, gain, spectrumArr, spectrumArrStartIx) {
    const
      bufferSize = this.bufferSize,
      cosTable = this.cosTable,
      sinTable = this.sinTable,
      reverseTable = this.reverseTable,
      real = this.real,
      imag = this.imag;

    let k = Math.floor(Math.log(bufferSize) / Math.LN2);
    if (Math.pow(2, k) !== bufferSize)
      throw "Invalid buffer size, must be a power of 2.";

    let
      halfSize = 1,
      phaseShiftStepReal,
      phaseShiftStepImag,
      currentPhaseShiftReal,
      currentPhaseShiftImag,
      off,
      tr,
      ti,
      tmpReal,
      i;

    for (i = 0; i < bufferSize; i++) {
      let ix = reverseTable[i];
      ix = (ix + bufferStartIx) % buffer.length;
      real[i] = buffer[ix] * gain;
      imag[i] = 0;
    }

    while (halfSize < bufferSize) {
      phaseShiftStepReal = cosTable[halfSize];
      phaseShiftStepImag = sinTable[halfSize];

      currentPhaseShiftReal = 1;
      currentPhaseShiftImag = 0;

      for (let fftStep = 0; fftStep < halfSize; fftStep++) {
        i = fftStep;
        while (i < bufferSize) {
          off = i + halfSize;
          tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
          ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);
          real[off] = real[i] - tr;
          imag[off] = imag[i] - ti;
          real[i] += tr;
          imag[i] += ti;
          i += halfSize << 1;
        }
        tmpReal = currentPhaseShiftReal;
        currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
        currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
      }
      halfSize = halfSize << 1;
    }

    this.calculateSpectrum(spectrumArr, spectrumArrStartIx);
  }

  calculateSpectrum(spectrumArr, spectrumArrStartIx) {
    const
      real = this.real,
      imag = this.imag,
      bSi = 2 / this.bufferSize,
      sqrt = Math.sqrt;

    let rval, ival, mag;

    for (let i = 0, N = this.bufferSize / 2; i < N; i++) {
      rval = real[i];
      ival = imag[i];
      mag = bSi * sqrt(rval * rval + ival * ival);
      spectrumArr[i + spectrumArrStartIx] = mag;
    }
  };

}

export {InplaceFFT}

