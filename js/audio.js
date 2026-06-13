// ---- Audio — private state scoped to this file via IIFE ----
// Public API (assigned to window below): initAudio, syncAudioFilterType,
// audioGateOpen, audioGateClose, audioCut, setNoteMode,
// audioEnabled, openAudioHelp, closeAudioHelp, isAudioHelpOpen,
// noteFreqs, noteMode

let noteMode = 'noteA4Btn';
const noteFreqs = { noteE1Btn: 41.2, noteE2Btn: 82.4, noteC4Btn: 261.6, noteA4Btn: 440 };
const FILTER_OPEN_FREQUENCY = 20000; // Hz — fully open (bypassed) filter cutoff
const MASTER_GAIN = 0.7;             // default master output gain

(function(){

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

  let audioCtx=null,osc=null,vcaGain=null,filter1=null,filter2=null,masterGain=null,audioReady=false;

  const noteBtnIds = ['noteE1Btn','noteE2Btn','noteC4Btn','noteA4Btn','noteCustomToggle'];

  function audioEnabled(){ return !!($('audioEnabled')&&$('audioEnabled').checked); }

  function setNoteMode(btnId, freq){
    noteMode = btnId;
    noteBtnIds.forEach(id => { const b=$(''+id); if(b){ b.style.background=''; b.style.color=''; } });
    const b=$(''+btnId); if(b){ b.style.background=BTN_ACTIVE_BG; b.style.color=BTN_ACTIVE_FG; }
    const customRow=$('noteCustomRow');
    if(customRow) customRow.style.display = btnId==='noteCustomToggle' ? '' : 'none';
    if(freq !== null && osc) osc.frequency.value = freq;
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
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    osc=audioCtx.createOscillator(); osc.type='sawtooth'; osc.frequency.value=noteFreq();
    vcaGain=audioCtx.createGain(); vcaGain.gain.value=0;
    filter1=audioCtx.createBiquadFilter(); filter1.type='lowpass'; filter1.frequency.value=FILTER_OPEN_FREQUENCY; filter1.Q.value=0;
    filter2=audioCtx.createBiquadFilter(); filter2.type='lowpass'; filter2.frequency.value=FILTER_OPEN_FREQUENCY; filter2.Q.value=0;
    masterGain=audioCtx.createGain(); masterGain.gain.value=MASTER_GAIN;
    osc.connect(vcaGain); vcaGain.connect(filter1); filter1.connect(filter2); filter2.connect(masterGain); masterGain.connect(audioCtx.destination);
    osc.start();
    audioReady=true;
    syncAudioFilterType();
  }

  function syncAudioFilterType(){
    if(!audioReady) return;
    const freqMode=$('frequencyMode')&&$('frequencyMode').checked;
    const isHP=$('hpMode')&&$('hpMode').checked;
    if(freqMode){
      filter1.type=isHP?'highpass':'lowpass'; filter2.type=isHP?'highpass':'lowpass';
    } else {
      filter1.type='lowpass'; filter1.frequency.value=FILTER_OPEN_FREQUENCY; filter1.Q.value=0;
      filter2.type='lowpass'; filter2.frequency.value=FILTER_OPEN_FREQUENCY; filter2.Q.value=0;
    }
  }

  function audioGateOpen(){
    if(!audioEnabled()||!audioReady) return;
    if(audioCtx.state==='suspended') audioCtx.resume();
    const e=getEffective();
    const freqMode=$('frequencyMode')&&$('frequencyMode').checked;
    const now=audioCtx.currentTime;
    if(!freqMode){
      // Amplitude envelope, filter fully open
      vcaGain.gain.cancelScheduledValues(now);
      vcaGain.gain.setValueAtTime(0,now);
      vcaGain.gain.linearRampToValueAtTime(1,now+Math.max(0.001,e.aT));
      vcaGain.gain.linearRampToValueAtTime(Math.max(0.0001,e.s),now+Math.max(0.001,e.aT)+Math.max(0.001,e.dT));
      filter1.type='lowpass'; filter1.frequency.cancelScheduledValues(now); filter1.frequency.setValueAtTime(FILTER_OPEN_FREQUENCY,now); filter1.Q.value=0;
      filter2.type='lowpass'; filter2.frequency.cancelScheduledValues(now); filter2.frequency.setValueAtTime(FILTER_OPEN_FREQUENCY,now); filter2.Q.value=0;
    } else {
      // Filter envelope, VCA fully open
      vcaGain.gain.cancelScheduledValues(now); vcaGain.gain.setValueAtTime(1,now);
      const fFloor=mapCutoff(e.floor), fCeil=mapCutoff(e.floor+e.scale), fSus=mapCutoff(e.floor+e.s*e.scale);
      filter1.frequency.cancelScheduledValues(now); filter2.frequency.cancelScheduledValues(now);
      filter1.frequency.setValueAtTime(fFloor,now); filter2.frequency.setValueAtTime(fFloor,now);
      filter1.frequency.linearRampToValueAtTime(fCeil,now+Math.max(0.001,e.aT));
      filter2.frequency.linearRampToValueAtTime(fCeil,now+Math.max(0.001,e.aT));
      filter1.frequency.linearRampToValueAtTime(fSus,now+Math.max(0.001,e.aT)+Math.max(0.001,e.dT));
      filter2.frequency.linearRampToValueAtTime(fSus,now+Math.max(0.001,e.aT)+Math.max(0.001,e.dT));
    }
  }

  function audioGateClose(){
    if(!audioReady) return;
    const e=getEffective();
    const freqMode=$('frequencyMode')&&$('frequencyMode').checked;
    const now=audioCtx.currentTime;
    if(!freqMode){
      if(e.releaseOn){
        vcaGain.gain.cancelScheduledValues(now);
        vcaGain.gain.setValueAtTime(vcaGain.gain.value,now);
        vcaGain.gain.linearRampToValueAtTime(0,now+Math.max(0.001,e.rT));
      } else {
        vcaGain.gain.cancelScheduledValues(now); vcaGain.gain.setTargetAtTime(0,now,0.005);
      }
    } else {
      const fFloor=mapCutoff(e.floor), fSus=mapCutoff(e.floor+e.s*e.scale);
      if(e.releaseOn){
        filter1.frequency.cancelScheduledValues(now); filter2.frequency.cancelScheduledValues(now);
        filter1.frequency.setValueAtTime(filter1.frequency.value,now); filter2.frequency.setValueAtTime(filter2.frequency.value,now);
        filter1.frequency.linearRampToValueAtTime(fFloor,now+Math.max(0.001,e.rT));
        filter2.frequency.linearRampToValueAtTime(fFloor,now+Math.max(0.001,e.rT));
      } else {
        filter1.frequency.cancelScheduledValues(now); filter1.frequency.setValueAtTime(fFloor,now);
        filter2.frequency.cancelScheduledValues(now); filter2.frequency.setValueAtTime(fFloor,now);
      }
    }
  }

  function audioCut(){
    if(!audioReady) return;
    const now=audioCtx.currentTime;
    const minFreq=mapCutoff(0); // 10 Hz
    vcaGain.gain.cancelScheduledValues(now); vcaGain.gain.setTargetAtTime(0,now,0.005);
    filter1.frequency.cancelScheduledValues(now); filter1.frequency.setTargetAtTime(minFreq,now,0.005);
    filter2.frequency.cancelScheduledValues(now); filter2.frequency.setTargetAtTime(minFreq,now,0.005);
  }

  function openAudioHelp(){ $('audioHelpText').style.display=''; }
  function closeAudioHelp(){ $('audioHelpText').style.display='none'; }
  function isAudioHelpOpen(){ return $('audioHelpText').style.display !== 'none'; }

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

})();
