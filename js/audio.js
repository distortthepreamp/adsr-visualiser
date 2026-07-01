// ---- Audio — two-voice (Model D + Textbook) with stereo panning ----
// Public API (assigned to window below): initAudio, syncAudioFilterType,
// audioGateOpen, audioGateClose, audioCut, setNoteMode,
// audioEnabled, openAudioHelp, closeAudioHelp, isAudioHelpOpen,
// noteFreqs, noteMode

let noteMode = 'noteA4Btn';
const noteFreqs = { noteE1Btn: 41.2, noteE2Btn: 82.4, noteC4Btn: 261.6, noteA4Btn: 440 };
const FILTER_OPEN_FREQUENCY = 20000; // Hz — fully open (bypassed) filter cutoff
const MASTER_GAIN = 0.7;             // default master output gain

(function(){

  // ---- Cutoff curve (DO NOT TOUCH) ----
  const cutoffCurve = [
    {p:0.00,f:10},{p:0.10,f:40},{p:0.20,f:140},{p:0.30,f:500},{p:0.40,f:1800},
    {p:0.50,f:3500},{p:0.60,f:6000},{p:0.70,f:9000},{p:0.80,f:13000},{p:0.90,f:17000},{p:1.00,f:FILTER_OPEN_FREQUENCY}
  ];
  function mapCutoff(p){
    p=clamp(p);
    for(let i=0;i<cutoffCurve.length-1;i++){
      const a=cutoffCurve[i],b=cutoffCurve[i+1];
      if(p>=a.p&&p<=b.p){ const f=(p-a.p)/(b.p-a.p); return a.f+f*(b.f-a.f); }
    }
    return cutoffCurve[cutoffCurve.length-1].f;
  }

  // Keyboard tracking: multiplies the audio filter cutoff by 2^(octave shift).
  // octave values mirror the scale-label logic (paths.js Hz labels): kb1=1.41, kb2=2.29, both=3.12, none=0.
  function filterTrackingMult(){
    const kb1 = $('keyboardTrack1') && $('keyboardTrack1').checked;
    const kb2 = $('keyboardTrack2') && $('keyboardTrack2').checked;
    const oct = (kb1 && kb2) ? 3.12 : kb2 ? 2.29 : kb1 ? 1.41 : 0;
    return Math.pow(2, oct);
  }


  // ---- RC curve sampling for setValueCurveAtTime ----
  const RC_SAMPLES = 256;
  const RC_NTAU = 3;

  // Returns a Float32Array ramping from startLevel to endLevel following RC shape.
  // isCharge=true: RC charge (exponential rise, fast start, slow approach to end)
  // isCharge=false: RC discharge (exponential fall, fast start, slow approach to end)
  // Endpoints land EXACTLY on startLevel and endLevel (normalised, no residual tail).
  function rcCurveArray(startLevel, endLevel, isCharge){
    const arr = new Float32Array(RC_SAMPLES);
    const tail = Math.exp(-RC_NTAU); // ≈ 0.0498
    const norm = 1 - tail;           // ≈ 0.9502
    for(let i = 0; i < RC_SAMPLES; i++){
      const t = i / (RC_SAMPLES - 1); // 0..1
      if(isCharge){
        // charge: shape goes 0→1 (fast rise then slow approach)
        const shape = (1 - Math.exp(-RC_NTAU * t) - tail * (1 - t)) ;
        // Simpler: normalised charge = (1 - e^(-nτ*t)) / (1 - e^(-nτ))
        const s = (1 - Math.exp(-RC_NTAU * t)) / norm;
        arr[i] = startLevel + (endLevel - startLevel) * s;
      } else {
        // discharge: shape goes 1→0 (fast fall then slow approach)
        const s = (Math.exp(-RC_NTAU * t) - tail) / norm;
        arr[i] = endLevel + (startLevel - endLevel) * s;
      }
    }
    // Force exact endpoints (avoid floating-point drift)
    arr[0] = startLevel;
    arr[RC_SAMPLES - 1] = endLevel;
    return arr;
  }

  // ---- Audio nodes ----
  let audioCtx = null, masterGain = null, audioReady = false;
  // Voice 1 (Model D)
  let osc1 = null, v1Gain = null, v1Filter1 = null, v1Filter2 = null, v1Panner = null;
  // Voice 2 (Textbook)
  let osc2 = null, v2Gain = null, v2Filter1 = null, v2Filter2 = null, v2Panner = null;
  // Track which voices were audible at gate-open (for gate-close)
  let v1Audible = false, v2Audible = false;

  const noteBtnIds = ['noteE1Btn','noteE2Btn','noteC4Btn','noteA4Btn','noteCustomToggle'];

  function audioEnabled(){ return !!(($('audioModelD')&&$('audioModelD').checked)||($('audioTextbook')&&$('audioTextbook').checked)); }
  function audioStretch(){ return ($('sloMo')&&$('sloMo').checked) ? 10 : 1; }

  function setNoteMode(btnId, freq){
    noteMode = btnId;
    noteBtnIds.forEach(id => { const b=$(''+id); if(b){ b.style.background=''; b.style.color=''; } });
    const b=$(''+btnId); if(b){ b.style.background=BTN_ACTIVE_BG; b.style.color=BTN_ACTIVE_FG; }
    const customRow=$('noteCustomRow');
    if(customRow) customRow.style.display = btnId==='noteCustomToggle' ? '' : 'none';
    if(freq !== null){
      if(osc1) osc1.frequency.value = freq;
      if(osc2) osc2.frequency.value = freq;
    }
  }

  function noteFreq(){
    const customActive = $('noteCustomRow') && $('noteCustomRow').style.display !== 'none';
    if(customActive) return Number($('noteCustomHz').value) || 440;
    for(const [btnId, freq] of Object.entries(noteFreqs)){
      const b=$(''+btnId);
      if(b && b.style.background === 'rgb(255, 255, 255)') return freq;
    }
    return 440;
  }

  function initAudio(){
    if(audioReady) return;
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const freq = noteFreq();
    masterGain = audioCtx.createGain(); masterGain.gain.value = MASTER_GAIN;

    // Voice 1 (Model D)
    osc1 = audioCtx.createOscillator(); osc1.type='sawtooth'; osc1.frequency.value=freq;
    v1Gain = audioCtx.createGain(); v1Gain.gain.value=0;
    v1Filter1 = audioCtx.createBiquadFilter(); v1Filter1.type='lowpass'; v1Filter1.frequency.value=FILTER_OPEN_FREQUENCY; v1Filter1.Q.value=0;
    v1Filter2 = audioCtx.createBiquadFilter(); v1Filter2.type='lowpass'; v1Filter2.frequency.value=FILTER_OPEN_FREQUENCY; v1Filter2.Q.value=0;
    v1Panner = audioCtx.createStereoPanner(); v1Panner.pan.value=0;
    osc1.connect(v1Gain); v1Gain.connect(v1Filter1); v1Filter1.connect(v1Filter2); v1Filter2.connect(v1Panner); v1Panner.connect(masterGain);
    osc1.start();

    // Voice 2 (Textbook)
    osc2 = audioCtx.createOscillator(); osc2.type='sawtooth'; osc2.frequency.value=freq;
    v2Gain = audioCtx.createGain(); v2Gain.gain.value=0;
    v2Filter1 = audioCtx.createBiquadFilter(); v2Filter1.type='lowpass'; v2Filter1.frequency.value=FILTER_OPEN_FREQUENCY; v2Filter1.Q.value=0;
    v2Filter2 = audioCtx.createBiquadFilter(); v2Filter2.type='lowpass'; v2Filter2.frequency.value=FILTER_OPEN_FREQUENCY; v2Filter2.Q.value=0;
    v2Panner = audioCtx.createStereoPanner(); v2Panner.pan.value=0;
    osc2.connect(v2Gain); v2Gain.connect(v2Filter1); v2Filter1.connect(v2Filter2); v2Filter2.connect(v2Panner); v2Panner.connect(masterGain);
    osc2.start();

    masterGain.connect(audioCtx.destination);
    audioReady = true;
    syncAudioFilterType();
  }

  function syncAudioFilterType(){
    if(!audioReady) return;
    const freqMode=$('frequencyMode')&&$('frequencyMode').checked;
    const isHP=$('hpMode')&&$('hpMode').checked;
    if(freqMode){
      const t = isHP ? 'highpass' : 'lowpass';
      v1Filter1.type=t; v1Filter2.type=t;
      v2Filter1.type=t; v2Filter2.type=t;
    } else {
      [v1Filter1,v1Filter2,v2Filter1,v2Filter2].forEach(f=>{
        f.type='lowpass'; f.frequency.value=FILTER_OPEN_FREQUENCY; f.Q.value=0;
      });
    }
  }

  // ---- Audibility helpers ----
  function isModelDAudible(){
    return ($('audioModelD')&&$('audioModelD').checked) && !!($('modelA')&&$('modelA').checked || $('modelD')&&$('modelD').checked || $('modelS')&&$('modelS').checked || $('modelR')&&$('modelR').checked);
  }
  function isTextbookAudible(){
    return ($('audioTextbook')&&$('audioTextbook').checked) && !!($('underlayA')&&$('underlayA').checked || $('underlayD')&&$('underlayD').checked || $('underlayS')&&$('underlayS').checked || $('underlayR')&&$('underlayR').checked);
  }

  // ---- Schedule helpers ----
  // Schedule attack+decay on a gain param (loudness mode)
  function scheduleGainAD(param, now, aT, dT, peak, sus, useRC, fromDecay){
    param.cancelScheduledValues(now);
    const dDur = Math.max(0.001, dT);
    if(fromDecay){
      // Play from decay: start at peak, schedule ONLY the decay→sustain ramp (skip the attack).
      param.setValueAtTime(peak, now);
      if(useRC){
        param.setValueCurveAtTime(rcCurveArray(peak, Math.max(0.0001, sus), false), now, dDur);
      } else {
        param.linearRampToValueAtTime(Math.max(0.0001, sus), now + dDur);
      }
      return;
    }
    param.setValueAtTime(0, now);
    const aDur = Math.max(0.001, aT);
    if(useRC){
      param.setValueCurveAtTime(rcCurveArray(0, peak, true), now, aDur);
      param.setValueCurveAtTime(rcCurveArray(peak, Math.max(0.0001, sus), false), now + aDur, dDur);
    } else {
      param.linearRampToValueAtTime(peak, now + aDur);
      param.linearRampToValueAtTime(Math.max(0.0001, sus), now + aDur + dDur);
    }
  }

  function audioGateOpen(fromDecay){
    if(!audioEnabled()||!audioReady) return;
    if(audioCtx.state==='suspended') audioCtx.resume();
    const e = getEffective();
    const freqMode = $('frequencyMode')&&$('frequencyMode').checked;
    const analogue = !!($('analogueCurve')&&$('analogueCurve').checked);
    const now = audioCtx.currentTime;
    const str = audioStretch();
    const aT = e.aT * str, dT = e.dT * str;

    v1Audible = isModelDAudible();
    v2Audible = isTextbookAudible();
    const bothOn = v1Audible && v2Audible;

    // Panning
    if(v1Panner) v1Panner.pan.value = bothOn ? -1 : 0;
    if(v2Panner) v2Panner.pan.value = bothOn ? +1 : 0;

    if(!freqMode){
      // ---- LOUDNESS MODE ----
      if(v1Audible){
        scheduleGainAD(v1Gain.gain, now, aT, dT, 1, e.s, analogue, fromDecay);
        [v1Filter1,v1Filter2].forEach(f=>{ f.type='lowpass'; f.frequency.cancelScheduledValues(now); f.frequency.setValueAtTime(FILTER_OPEN_FREQUENCY,now); f.Q.value=0; });
      } else {
        v1Gain.gain.cancelScheduledValues(now); v1Gain.gain.setValueAtTime(0, now);
      }
      if(v2Audible){
        scheduleGainAD(v2Gain.gain, now, aT, dT, 1, e.s, false, fromDecay);
        [v2Filter1,v2Filter2].forEach(f=>{ f.type='lowpass'; f.frequency.cancelScheduledValues(now); f.frequency.setValueAtTime(FILTER_OPEN_FREQUENCY,now); f.Q.value=0; });
      } else {
        v2Gain.gain.cancelScheduledValues(now); v2Gain.gain.setValueAtTime(0, now);
      }
    } else {
      // ---- FILTER MODE ----
      // Audio cutoff uses the approximate transfer function (NOT mapCutoff, which drives the visual)
      const clampHz = f => Math.max(10, Math.min(f, 20000));
      const trk = filterTrackingMult();
      const fFloor = clampHz(filterCutoffHz(e.floor) * trk);
      // Filter frequency is driven per-frame from the blob (audioSetFilterLevels); establish the floor at start.
      if(v1Audible){
        v1Gain.gain.cancelScheduledValues(now); v1Gain.gain.setValueAtTime(1, now);
        [v1Filter1,v1Filter2].forEach(flt => { flt.frequency.cancelScheduledValues(now); flt.frequency.setValueAtTime(fFloor, now); });
      } else {
        v1Gain.gain.cancelScheduledValues(now); v1Gain.gain.setValueAtTime(0, now);
      }
      if(v2Audible){
        v2Gain.gain.cancelScheduledValues(now); v2Gain.gain.setValueAtTime(1, now);
        [v2Filter1,v2Filter2].forEach(flt => { flt.frequency.cancelScheduledValues(now); flt.frequency.setValueAtTime(fFloor, now); });
      } else {
        v2Gain.gain.cancelScheduledValues(now); v2Gain.gain.setValueAtTime(0, now);
      }
    }
  }

  function audioGateClose(){
    if(!audioReady) return;
    const e = getEffective();
    const freqMode = $('frequencyMode')&&$('frequencyMode').checked;
    const analogue = !!($('analogueCurve')&&$('analogueCurve').checked);
    const now = audioCtx.currentTime;
    const str = audioStretch();
    const v1rDur = Math.max(0.001, e.rT * str);
    const v2rDur = Math.max(0.001, mapTime(state.r) * str);

    if(!freqMode){
      // Voice 1 (Model D) release
      if(v1Audible){
        v1Gain.gain.cancelScheduledValues(now);
        v1Gain.gain.setValueAtTime(v1Gain.gain.value, now);
        if(e.releaseOn){
          if(analogue){
            v1Gain.gain.setValueCurveAtTime(rcCurveArray(v1Gain.gain.value, 0, false), now, v1rDur);
          } else {
            v1Gain.gain.linearRampToValueAtTime(0, now + v1rDur);
          }
        } else {
          v1Gain.gain.setTargetAtTime(0, now, 0.005);
        }
      }
      // Voice 2 (Textbook) release — always linear
      if(v2Audible){
        v2Gain.gain.cancelScheduledValues(now);
        v2Gain.gain.setValueAtTime(v2Gain.gain.value, now);
        if(e.releaseOn){
          v2Gain.gain.linearRampToValueAtTime(0, now + v2rDur);
        } else {
          v2Gain.gain.setTargetAtTime(0, now, 0.005);
        }
      }
    } else {
      // FILTER MODE: the filter frequency release is now driven per-frame from the blob
      // (audioSetFilterLevels), which follows the release curve to the floor. Nothing to schedule here.
    }
  }

  function audioCut(){
    if(!audioReady) return;
    const now = audioCtx.currentTime;
    const clampHz = f => Math.max(10, Math.min(f, 20000));
    const minFreq = clampHz(filterCutoffHz(0) * filterTrackingMult()); // ≈10 Hz (×tracking)
    // Voice 1
    v1Gain.gain.cancelScheduledValues(now); v1Gain.gain.setTargetAtTime(0, now, 0.005);
    v1Filter1.frequency.cancelScheduledValues(now); v1Filter1.frequency.setTargetAtTime(minFreq, now, 0.005);
    v1Filter2.frequency.cancelScheduledValues(now); v1Filter2.frequency.setTargetAtTime(minFreq, now, 0.005);
    // Voice 2
    v2Gain.gain.cancelScheduledValues(now); v2Gain.gain.setTargetAtTime(0, now, 0.005);
    v2Filter1.frequency.cancelScheduledValues(now); v2Filter1.frequency.setTargetAtTime(minFreq, now, 0.005);
    v2Filter2.frequency.cancelScheduledValues(now); v2Filter2.frequency.setTargetAtTime(minFreq, now, 0.005);
  }

  function openAudioHelp(){ $('audioHelpText').style.display=''; }
  function closeAudioHelp(){ $('audioHelpText').style.display='none'; }
  function isAudioHelpOpen(){ return $('audioHelpText').style.display !== 'none'; }

  function audioUpdateFrequency(freq){
    if(osc1) osc1.frequency.value = freq;
    if(osc2) osc2.frequency.value = freq;
  }

  // Per-frame filter drive: each voice's filter follows its blob's cutoff POSITION (0..1),
  // derived in the animation loop from blob y (which bakes in floor/scale/clipping/ceiling/RC).
  // NOTE: args are cutoff positions p, NOT raw ADSR levels — see animation.js step loop.
  window.audioSetFilterLevels = function(effPos, statedPos){
    if(!audioReady) return;
    if(!($('frequencyMode') && $('frequencyMode').checked)) return;  // filter mode only
    const clampHz = f => Math.max(10, Math.min(f, 20000));
    const trk = filterTrackingMult();
    const tc = 0.015;                       // smoothing time constant (avoids zipper noise)
    const now = audioCtx.currentTime;
    if(isModelDAudible()){
      const f = clampHz(filterCutoffHz(effPos) * trk);
      [v1Filter1, v1Filter2].forEach(flt => flt.frequency.setTargetAtTime(f, now, tc));
    }
    if(isTextbookAudible()){
      const f = clampHz(filterCutoffHz(statedPos) * trk);
      [v2Filter1, v2Filter2].forEach(flt => flt.frequency.setTargetAtTime(f, now, tc));
    }
  };

  window.initAudio          = initAudio;
  window.syncAudioFilterType= syncAudioFilterType;
  window.audioGateOpen      = audioGateOpen;
  window.audioGateClose     = audioGateClose;
  window.audioCut           = audioCut;
  window.setNoteMode        = setNoteMode;
  window.audioEnabled       = audioEnabled;
  window.openAudioHelp      = openAudioHelp;
  window.closeAudioHelp     = closeAudioHelp;
  window.isAudioHelpOpen    = isAudioHelpOpen;
  window.audioUpdateFrequency = audioUpdateFrequency;

})();
