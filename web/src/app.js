import {G} from "./global.js";
import {ShaderVizBox} from "./shader-viz-box.js";

// const audioFile = "data-scale.wav";
let audioCtx, source, scriptNode;
const vizBoxes = [];

document.addEventListener('DOMContentLoaded', () => {

  //document.documentElement.style.setProperty("--tophdiv", "35%");

  const elmCmd = document.getElementById("cmd");
  elmCmd.addEventListener("keydown", (evt) => {
    if (evt.key != "Enter") return;
    onCommand(elmCmd.value);
    elmCmd.value = "";
    evt.stopPropagation = true;
    if (evt.preventDefault) evt.preventDefault();
  });
  document.documentElement.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) document.body.classList.add("full");
    else document.body.classList.remove("full");
  });

  requestAnimationFrame(animate);
});

function onCommand(cmd) {
  try { parseCommand(cmd); }
  catch {
    // TODO: Flash input field red
  }
}

function parseCommand(cmd) {
  if (cmd == "full")
    document.documentElement.requestFullscreen();
  else if (cmd == "mic")
    openMic();
  else if (cmd == "shuffle") {
    let tophVal = 0, btmhVal = 0;
    while (Math.abs(tophVal - btmhVal) < 20) {
      tophVal = Math.round(25 + 50 * Math.random());
      btmhVal = Math.round(25 + 50 * Math.random());
    }
    const vVal = Math.round(15 + 70 * Math.random());
    document.documentElement.style.setProperty("--tophdiv", tophVal + "%");
    document.documentElement.style.setProperty("--btmhdiv", btmhVal + "%");
    document.documentElement.style.setProperty("--vdiv", vVal + "%");
  }
  else if (cmd == "a" || cmd == "b" || cmd == "c" || cmd == "d") {
    let vizBoxIx = "abcd".indexOf(cmd);
    vizBoxes[vizBoxIx].setVisible(true);
    vizBoxes[vizBoxIx].setLooping(false);
  }
  else {
    const parts = cmd.split(" ");
    if (parts.length < 2) return;
    let vizBox = null;
    if (parts[0] == "a") vizBox = vizBoxes[0];
    else if (parts[0] == "b") vizBox = vizBoxes[1];
    else if (parts[0] == "c") vizBox = vizBoxes[2];
    else if (parts[0] == "d") vizBox = vizBoxes[3];
    if (vizBox == null) return;
    if (parts[1] == "off") {
      vizBox.setVisible(false);
    }
    else if (parts[1] == "loop") {
      vizBox.setLooping(true);
    }
    else if (parts[1] == "fft") {
      let fftSize = parseInt(parts[2]);
      if (isNaN(fftSize)) throw "not a number";
      vizBox.setFFTSize(fftSize);
    }
    else if (parts[1] == "gain") {
      let gain = parseInt(parts[2]);
      if (isNaN(gain)) throw "not a number";
      vizBox.setGain(gain);
    }
    else if (parts[1] == "period") {
      let period = parseFloat(parts[2]);
      if (isNaN(period)) throw "not a number";
      vizBox.setPeriod(period);
    }
    else if (parts[1] == "rgb") {
      let r = parseFloat(parts[2]);
      let g = parseFloat(parts[3]);
      let b = parseFloat(parts[4]);
      if (isNaN(r) || isNaN(g) || isNaN(b)) throw "not a number";
      vizBox.setRGB(r, g, b);
    }
  }
}

function initVizBoxes() {
  vizBoxes.push(new ShaderVizBox(document.getElementById("cnva")));
  vizBoxes.push(new ShaderVizBox(document.getElementById("cnvb")));
  vizBoxes.push(new ShaderVizBox(document.getElementById("cnvc")));
  vizBoxes.push(new ShaderVizBox(document.getElementById("cnvd")));
}

function openMic() {
  if (audioCtx) return;
  navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaStreamSource(stream);
    G.sampleRate = source.context.sampleRate;
    initVizBoxes();
    G.samples = new Float32Array(G.nSeconds * G.sampleRate);
    G.samplePos = 0;
    G.sampleIx = 0;
    scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
    source.connect(scriptNode);
    // Next line is needed for this to work in Chrome
    // https://github.com/WebAudio/web-audio-api/issues/345
    scriptNode.connect(audioCtx.destination);
    scriptNode.onaudioprocess = function(e) {
      const data = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < data.length; ++i) {
        G.samples[G.samplePos] = data[i];
        G.samplePos = (G.samplePos + 1) % G.samples.length;
      }
      G.sampleIx += data.length;
    }
  }).catch((err) => {
    console.error(`Error from getUserMedia(): ${err}`);
  });
}

function animate() {

  for (let i = 0; i < vizBoxes.length; ++i)
    vizBoxes[i].update();

  requestAnimationFrame(animate);
}


