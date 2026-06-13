// ---- UI Controls — event listeners, interaction wiring, and control functions ----
// Top-level declarations/functions are global (accessible by render.js, animation.js, etc.)
// Event listener registration is deferred to initUIControls(), called from init after $ is defined.

// ---- Transport modal state ----
let tapMode = 'tap200';
const tapModeBtns = ['tapMode50Btn','tapMode100Btn','tapMode200Btn','tap500Btn','tap1sBtn','tapModeCustomBtn','tapModeHoldBtn'];
const transBtnIds = ['transInstantBtn','trans1Btn','trans2Btn','trans3Btn','trans4Btn','trans5Btn','transCustomToggle'];

// ---- syncControls — sync knob/slider/readout display to state ----
function syncControls(){
  const mode=document.querySelector('input[name="mode"]:checked').value;
  const vals = mode==='live' ? state : state.target;
  $('attackKnob').style.setProperty('--deg', (-135 + vals.a*270)+'deg');
  $('decayKnob').style.setProperty('--deg', (-135 + vals.d*270)+'deg');
  $('sustainKnob').style.setProperty('--deg', (-135 + vals.s*270)+'deg');
  $('releaseKnob').style.setProperty('--deg', (-135 + vals.r*270)+'deg');
  $('floorKnob').style.setProperty('--deg', (-135 + vals.floor*270)+'deg');
  $('scaleKnob').style.setProperty('--deg', (-135 + vals.scale*270)+'deg');
  $('attackTarget').textContent=mode==='animate' ? 'Target: '+fmtTime(mapTime(state.target.a)) : '';
  $('decayTarget').textContent=mode==='animate' ? 'Target: '+fmtTime(mapTime(state.target.d)) : '';
  $('sustainTarget').textContent=mode==='animate' ? 'Target: '+Math.round(($('keyboardControl').checked?state.target.s*.8:state.target.s)*100)+'%' : '';
  $('releaseTarget').textContent=mode==='animate' ? 'Target: '+fmtTime(mapTime(state.target.r)) : '';
  $('floorTarget').textContent=mode==='animate' ? 'Target: '+formatSustainScale(state.target.floor) : '';
  $('scaleTarget').textContent=mode==='animate' ? 'Target: '+formatSustainScale(state.target.scale) : '';
  $('modeHint').textContent = mode==='live' ? 'Live Mode: Knobs Update The Graph Immediately.' : 'Animate Mode: Knobs Set Targets. Press Transition To Morph The Graph.';
  patchSustainReadouts();
  { const linearOn = $('linearTime') && $('linearTime').checked; const zl = $('timelineZoom3xLabel'); if(zl){ zl.style.opacity = linearOn ? '' : '0.35'; zl.style.pointerEvents = linearOn ? '' : 'none'; } }

  // Quick-set button highlight: exact match = solid white; closest = dim; others = default
  (function(){
    const checks = [
      { knob: 'attack',  val: Math.round(msFromPosition(state.a)) },
      { knob: 'decay',   val: Math.round(msFromPosition(state.d)) },
      { knob: 'sustain', val: Math.round(state.s * 10) },
      { knob: 'release', val: Math.round(msFromPosition(state.r)) },
      { knob: 'cutoff',  val: Math.round(state.floor * 10) },
      { knob: 'amount',  val: Math.round(state.scale * 10) },
    ];
    checks.forEach(({ knob, val }) => {
      const btns = Array.from(document.querySelectorAll(`.quickset-btn[data-knob="${knob}"]`));
      const exactIdx = btns.findIndex(b => parseInt(b.dataset.value) === val);
      let closestIdx = -1;
      if(exactIdx === -1){
        let minDist = Infinity;
        btns.forEach((b, i) => {
          const dist = Math.abs(parseInt(b.dataset.value) - val);
          if(dist < minDist){ minDist = dist; closestIdx = i; }
        });
      }
      btns.forEach((btn, i) => {
        if(exactIdx !== -1 && i === exactIdx){
          btn.style.background = '#ffffff'; btn.style.color = '#111111';
        } else if(exactIdx === -1 && i === closestIdx){
          btn.style.background = 'rgba(255,255,255,0.35)'; btn.style.color = '#ffffff';
        } else {
          btn.style.background = ''; btn.style.color = '';
        }
      });
    });
  })();
}

// ---- transition — animates state toward state.target ----
function transition(durSec){
  clearBlobAndMarker();
  animationToken++;
  const myAnimationToken = animationToken;
  hideTapMarker();
  if(durSec===undefined) durSec=currentTransitionSec;
  const dur=durSec*1000;
  const start={a:state.a,d:state.d,s:state.s,r:state.r,floor:state.floor,scale:state.scale,tbSustainGap:state.tbSustainGap,zoomFactor:state.zoomFactor}, end={...state.target};
  const startAms=mapTime(start.a)*1000, endAms=mapTime(end.a)*1000;
  const startDms=mapTime(start.d)*1000, endDms=mapTime(end.d)*1000;
  const startRms=mapTime(start.r)*1000, endRms=mapTime(end.r)*1000;
  cancelAnimationFrame(state.anim);
  state.a=start.a; state.d=start.d; state.s=start.s; state.r=start.r; state.floor=start.floor; state.scale=start.scale; state.tbSustainGap=start.tbSustainGap; state.zoomFactor=start.zoomFactor;
  render();
  let t0=null;
  function step(now){
    if (myAnimationToken !== animationToken) return;
    if(t0===null) t0=now;
    const f=clamp((now-t0)/dur); const k=easeInOut(f);
    state.a=positionFromMs(startAms+(endAms-startAms)*k);
    state.d=positionFromMs(startDms+(endDms-startDms)*k);
    state.s=start.s+(end.s-start.s)*k;
    state.r=positionFromMs(startRms+(endRms-startRms)*k);
    state.floor=start.floor+(end.floor-start.floor)*k;
    state.scale=start.scale+(end.scale-start.scale)*k;
    state.tbSustainGap=start.tbSustainGap+(end.tbSustainGap-start.tbSustainGap)*k;
    state.zoomFactor=start.zoomFactor+(end.zoomFactor-start.zoomFactor)*k;
    render();
    if(f<1) state.anim=requestAnimationFrame(step); else { state.a=end.a; state.d=end.d; state.s=end.s; state.r=end.r; state.floor=end.floor; state.scale=end.scale; state.tbSustainGap=end.tbSustainGap; state.zoomFactor=end.zoomFactor; render(); }
  }
  state.anim=requestAnimationFrame(step);
}

function setTransMode(durSec, activeBtnId){
  if(durSec !== null) currentTransitionSec = durSec;
  activeTransBtn = activeBtnId;
  transBtnIds.forEach(id => { const b=$(id); if(b){ b.style.background=''; b.style.color=''; } });
  const b=$(activeBtnId); if(b){ b.style.background='#ffffff'; b.style.color='#111111'; }
  const row=$('customTransitionRow');
  if(row) row.style.display = activeBtnId==='transCustomToggle' ? '' : 'none';
}

// ---- setMeterLevel — updates the meter fill to reflect the current level ----
function setMeterLevel(level){
  const fill=$('meterFill');
  if(!fill) return;
  const e=getEffective();
  const mx=METER_X, mw=METER_W;
  const bottomAbsY=graph.y0;
  const topAbsY=graph.y0-graph.h;
  const levelY = Math.max(yFor(e.floor+level*e.scale), yFor(1));
  const isHP=$('hpMode')&&$('hpMode').checked;
  const freqModeOn=$('frequencyMode')&&$('frequencyMode').checked;
  const fillColor=freqModeOn
    ? (getComputedStyle(document.documentElement).getPropertyValue('--meterFillFilter').trim()||'#00ffff')
    : (getComputedStyle(document.documentElement).getPropertyValue('--meterFill').trim()||'#00ff00');
  fill.style.fill=fillColor;
  const glowR = Math.max(0, Number(($('meterGlowRadius')&&$('meterGlowRadius').value)||20));
  fill.style.filter=($('meterGlow')&&$('meterGlow').checked) ? `drop-shadow(0 0 ${glowR}px ${fillColor}) drop-shadow(0 0 ${glowR*2}px ${fillColor})` : '';
  fill.setAttribute('x',mx); fill.setAttribute('width',mw);
  if(!isHP){
    const h=Math.max(0,bottomAbsY-levelY);
    fill.setAttribute('y',levelY); fill.setAttribute('height',h);
  } else {
    const topY = yFor(1);
    fill.setAttribute('y', String(topY));
    fill.setAttribute('height', String(Math.max(0, levelY - topY)));
  }
}

function hideDot(){
  const dot=$('dot');
  dot.style.opacity=0;
  dot.style.visibility='hidden';
  setMeterLevel(0);
}

function updateButtonStates(){
}

// ---- setTapMode ----
function setTapMode(mode, btnId){
  tapMode = mode;
  tapModeBtns.forEach(id => { const b=$(id); if(b){ b.style.background=''; b.style.color=''; } });
  const b=$(btnId); if(b){ b.style.background='#ffffff'; b.style.color='#111111'; }
  const customRow=$('tapCustomRow');
  if(customRow) customRow.style.display = mode==='tapCustom' ? '' : 'none';
}

// ---- Advanced popup helpers ----
function openAdvanced(){ $('advancedPopup').style.display=''; $('advancedToggle').style.background='#ffffff'; $('advancedToggle').style.color='#111111'; }
function closeAdvanced(){ $('advancedPopup').style.display='none'; $('advancedToggle').style.background=''; $('advancedToggle').style.color=''; }
function isAdvancedOpen(){ return $('advancedPopup').style.display !== 'none'; }

// ---- Sync helpers (also called from loadConfigObject) ----
function syncHpModeEnabled(){
  const freqOn = $('frequencyMode') && $('frequencyMode').checked;
  const hpLabel = $('hpMode') && $('hpMode').closest('label');
  if(hpLabel){ hpLabel.style.opacity = freqOn ? '' : '0.35'; hpLabel.style.pointerEvents = freqOn ? '' : 'none'; }
}
function syncLinearTimeScale(){
  const on = $('linearTime') && $('linearTime').checked;
  const zoomLbl = $('timelineZoom3xLabel');
  if(zoomLbl){ zoomLbl.style.opacity = on ? '' : '0.35'; zoomLbl.style.pointerEvents = on ? '' : 'none'; }
}
function syncAnalogueCurve(){
  const on = $('analogueCurve') && $('analogueCurve').checked;
  const opacity = on ? '' : '0.35';
  const sl = $('curveAmount'), val = $('curveAmountVal');
  if(sl)  sl.style.opacity  = opacity;
  if(val){ val.style.opacity = opacity; val.textContent = sl ? sl.value : '40'; }
}
function syncConsoleScale(){
  const s = Number($('consoleScale').value) || 0.7;
  const uiEl = document.querySelector('.ui');
  if(uiEl){ uiEl.style.transform = `scale(${s})`; uiEl.style.width = `${(1/s)*100}%`; }
}

// ---- Shared flash-green button feedback ----
function flashButton(btn, isActive){
  btn.style.background = '#00ff88';
  btn.style.color = '#000';
  setTimeout(() => {
    if(isActive()){ btn.style.background = '#ffffff'; btn.style.color = '#111111'; }
    else { btn.style.background = ''; btn.style.color = ''; }
  }, 600);
}

// ---- Shared inline name-edit widget ----
// onSave(null)     → { label } to open the editor, or null to abort (guard)
// onSave(newLabel) → string display text to show in the span after committing
function attachNameEdit(spanId, onSave){
  const el = $(spanId);
  if(!el || el.tagName !== 'SPAN') return;
  el.style.cursor = 'text';
  el.title = 'Click to rename';
  el.onclick = () => {
    const ctx = onSave(null);
    if(!ctx) return;
    const originalText = el.textContent;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = ctx.label;
    inp.style.cssText = 'font-size:13px;font-weight:700;background:rgba(0,0,0,.5);color:#fff;border:1px solid rgba(255,255,255,.7);border-radius:4px;padding:1px 5px;width:130px;outline:none';
    el.replaceWith(inp);
    inp.id = spanId;
    inp.focus(); inp.select();
    let committed = false;
    function restoreSpan(text){
      const span = document.createElement('span');
      span.id = spanId;
      span.style.cssText = 'font-size:13px;font-weight:700;opacity:.85';
      span.textContent = text;
      inp.replaceWith(span);
      attachNameEdit(spanId, onSave);
    }
    function save(){
      if(committed) return; committed = true;
      const newLabel = inp.value.trim() || ctx.label;
      restoreSpan(onSave(newLabel));
    }
    function revert(){
      if(committed) return; committed = true;
      restoreSpan(originalText);
    }
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ save(); e.preventDefault(); }
      else if(e.key === 'Escape') revert();
    });
    inp.addEventListener('blur', save);
  };
}

// ---- initUIControls — registers all event listeners; called from init ----
function initUIControls(){

  // Mode change
  document.querySelectorAll('input[name="mode"]').forEach(el=>el.addEventListener('change',()=>{ if(el.value==='animate' && el.checked) syncTargetToLive(); syncControls(); }));

  // Checkbox render-only listeners
  ['loudDecay','keyboardControl','drawReleaseWhenZero','showBounds','showContour','showEffectiveTimes','showStatedTimes','showEffectiveLines','showStatedLines','frequencyMode','hpMode','showClipped','linearTime','textbookAdsr','tbSustainDotted','tbSustainCollapse','tbShowModelDSustain','showOuterLine'].forEach(id=>$(id).addEventListener('change',render));

  // tbSustainCollapse — also triggers a transition
  $('tbSustainCollapse').addEventListener('change', () => {
    state.target.tbSustainGap = $('tbSustainCollapse').checked ? 0 : SUSTAIN_GAP_MAX;
    transition(currentTransitionSec);
  });

  // Meter / blob glow
  $('meterGlow').addEventListener('change', () => setMeterLevel(state.dotLevel));
  $('meterGlowRadius').addEventListener('input', e => { const inp=e.target,c=Math.min(60,Math.max(0,isNaN(parseInt(inp.value))?5:parseInt(inp.value))); inp.value=c; setMeterLevel(state.dotLevel); });
  $('meterScanlinesVisible').addEventListener('change', render);
  $('blobGlowEnabled').addEventListener('change', () => { applyBlobGlow(); if(state.currentPhase==='sustain') startGlowPulse(); else stopGlowPulse(); });
  $('blobGlowRadius').addEventListener('input', e => { const inp=e.target,c=Math.min(30,Math.max(0,isNaN(parseInt(inp.value))?8:parseInt(inp.value))); inp.value=c; applyBlobGlow(); if(state.currentPhase==='sustain') startGlowPulse(); });

  // Filter mode
  $('frequencyMode').addEventListener('change', () => { syncHpModeEnabled(); setMeterLevel(state.dotLevel); });
  $('hpMode').addEventListener('change', () => setMeterLevel(state.dotLevel));

  // Linear time / zoom
  $('linearTime').addEventListener('change', syncLinearTimeScale);
  $('timelineZoom3x') && $('timelineZoom3x').addEventListener('change', () => { state.target.zoomFactor = $('timelineZoom3x').checked ? 3 : 1; transition(currentTransitionSec); });

  // Analogue curve
  $('analogueCurve').addEventListener('change', () => { syncAnalogueCurve(); render(); if(state.currentPhase === 'idle') clearBlobAndMarker(); });
  $('curveAmount').addEventListener('input', () => { syncAnalogueCurve(); render(); });

  // Colour inputs
  $('lineColor').addEventListener('input',e=>document.documentElement.style.setProperty('--line', e.target.value));
  $('bgColor').addEventListener('input',e=>document.documentElement.style.setProperty('--bg', e.target.value));
  $('meterFillColor').addEventListener('input',e=>document.documentElement.style.setProperty('--meterFill', e.target.value));
  $('meterFillColorFilter').addEventListener('input',e=>document.documentElement.style.setProperty('--meterFillFilter', e.target.value));
  $('timeAxisStatedColor').addEventListener('input',e=>document.documentElement.style.setProperty('--timeAxisStatedColor', e.target.value));
  $('contourLineColor').addEventListener('input',e=>{ document.documentElement.style.setProperty('--contourLineColor', e.target.value); render(); });
  $('attackColor').addEventListener('input',e=>document.documentElement.style.setProperty('--attackColor', e.target.value));
  $('decayColor').addEventListener('input',e=>document.documentElement.style.setProperty('--decayColor', e.target.value));
  $('releaseColor').addEventListener('input',e=>document.documentElement.style.setProperty('--releaseColor', e.target.value));

  // Line widths / label sizes
  $('lineWidth').addEventListener('input',e=>{ const inp=e.target,c=Math.min(30,Math.max(4,isNaN(parseInt(inp.value))?14:parseInt(inp.value))); inp.value=c; document.documentElement.style.setProperty('--lineWidth',c); syncRadii(); });
  $('innerLineWidth').addEventListener('input',e=>{ const inp=e.target,c=Math.min(18,Math.max(1,isNaN(parseInt(inp.value))?6:parseInt(inp.value))); inp.value=c; document.documentElement.style.setProperty('--innerLineWidth',c); syncRadii(); });
  $('labelSize').addEventListener('input',e=>{ const inp=e.target,c=Math.min(72,Math.max(10,isNaN(parseInt(inp.value))?17:parseInt(inp.value))); inp.value=c; document.documentElement.style.setProperty('--labelSize',c); });
  $('h1Scale').addEventListener('change',e=>{ const inp=e.target,c=Math.min(3.0,Math.max(1.0,isNaN(parseFloat(inp.value))?1.0:Math.round(parseFloat(inp.value)*10)/10)); inp.value=c.toFixed(1); document.documentElement.style.setProperty('--h1Scale',c); render(); });
  $('h2Scale').addEventListener('change',e=>{ const inp=e.target,c=Math.min(3.0,Math.max(1.0,isNaN(parseFloat(inp.value))?1.0:Math.round(parseFloat(inp.value)*10)/10)); inp.value=c.toFixed(1); document.documentElement.style.setProperty('--h2Scale',c); render(); });
  $('consoleScale').addEventListener('input', e => { const inp=e.target,raw=parseFloat(inp.value),c=Math.min(1.0,Math.max(0.5,isNaN(raw)?0.7:raw)); inp.value=c; syncConsoleScale(); });
  $('meterWidth').addEventListener('input', e => { const inp=e.target,c=Math.min(80,Math.max(10,isNaN(parseInt(inp.value))?40:parseInt(inp.value))); inp.value=c; METER_W=c; recalcGeometry(); render(); });
  $('meterStrokeWidth').addEventListener('input', e => { const inp=e.target,c=Math.min(20,Math.max(1,isNaN(parseInt(inp.value))?7:parseInt(inp.value))); inp.value=c; METER_STROKE_W=c; render(); });
  $('tbSustainGapMax').addEventListener('input', e => { const inp=e.target,c=Math.min(30,Math.max(15,isNaN(parseInt(inp.value))?15:parseInt(inp.value))); inp.value=c; SUSTAIN_GAP_MAX=c/100; render(); });
  $('vbWidth').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(2400,Math.max(800,isNaN(parseInt(inp.value))?1200:parseInt(inp.value)))/10)*10; inp.value=c; VB_WIDTH=c; recalcGeometry(); render(); });
  $('vbHeight').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(1200,Math.max(400,isNaN(parseInt(inp.value))?595:parseInt(inp.value)))/10)*10; inp.value=c; VB_HEIGHT=c; recalcGeometry(); render(); });
  $('graphLeft').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(400,Math.max(80,isNaN(parseInt(inp.value))?220:parseInt(inp.value)))/10)*10; inp.value=c; GRAPH_LEFT=c; recalcGeometry(); render(); });

  // Transition buttons
  $('transInstantBtn').addEventListener('click',()=>{ setTransMode(0.001,'transInstantBtn'); transition(0.001); });
  $('trans1Btn').addEventListener('click',()=>{ setTransMode(1,'trans1Btn'); transition(1); });
  $('trans2Btn').addEventListener('click',()=>{ setTransMode(2,'trans2Btn'); transition(2); });
  $('trans3Btn').addEventListener('click',()=>{ setTransMode(3,'trans3Btn'); transition(3); });
  $('trans4Btn').addEventListener('click',()=>{ setTransMode(4,'trans4Btn'); transition(4); });
  $('trans5Btn').addEventListener('click',()=>{ setTransMode(5,'trans5Btn'); transition(5); });
  $('transCustomToggle').addEventListener('click',()=>{ const val=Number($('customTransitionTime').value)||3; setTransMode(val,'transCustomToggle'); });
  $('transitionBtn').addEventListener('click',()=>{ currentTransitionSec=Number($('customTransitionTime').value)||3; transition(currentTransitionSec); });
  $('customTransitionTime').addEventListener('input',()=>{ currentTransitionSec=Number($('customTransitionTime').value)||3; });

  // Tap mode buttons
  $('tapMode50Btn').addEventListener('click', () => setTapMode('tap50','tapMode50Btn'));
  $('tapMode100Btn').addEventListener('click', () => setTapMode('tap100','tapMode100Btn'));
  $('tapMode200Btn').addEventListener('click', () => setTapMode('tap200','tapMode200Btn'));
  $('tapModeCustomBtn').addEventListener('click', () => setTapMode('tapCustom','tapModeCustomBtn'));
  $('tap500Btn').addEventListener('click', () => setTapMode('tap500','tap500Btn'));
  $('tap1sBtn').addEventListener('click', () => setTapMode('tap1000','tap1sBtn'));
  $('tapModeHoldBtn').addEventListener('click', () => setTapMode('hold','tapModeHoldBtn'));
  $('clearBtn').addEventListener('click',clearBlobAndMarker);
  $('keepTapMarker').addEventListener('change',()=>{ if(!$('keepTapMarker').checked) hideTapMarker(); });

  // Quick-set buttons
  document.querySelectorAll('.quickset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ms = Number(btn.dataset.value);
      const knob = btn.dataset.knob;
      state.target.tbSustainGap = state.tbSustainGap;
      if(knob === 'attack') state.target.a = positionFromMs(ms);
      else if(knob === 'decay') state.target.d = positionFromMs(ms);
      else if(knob === 'sustain') state.target.s = ms / 10;
      else if(knob === 'release') state.target.r = positionFromMs(ms);
      else if(knob === 'cutoff') state.target.floor = ms / 10;
      else if(knob === 'amount') state.target.scale = ms / 10;
      transition(currentTransitionSec);
    });
  });

  // Advanced popup
  $('advancedToggle').addEventListener('click', e => { e.stopPropagation(); isAdvancedOpen() ? closeAdvanced() : openAdvanced(); });
  $('advancedPopup').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if(isAdvancedOpen()) closeAdvanced(); });

  // Note mode buttons
  Object.entries(noteFreqs).forEach(([btnId, freq]) => {
    const btn = $(btnId);
    if(btn) btn.addEventListener('click', () => { setNoteMode(btnId, freq); });
  });
  $('audioHelpBtn').addEventListener('click', e => { e.stopPropagation(); isAudioHelpOpen() ? closeAudioHelp() : openAudioHelp(); });
  $('audioHelpText').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if(isAudioHelpOpen()) closeAudioHelp(); });
  $('noteCustomToggle') && $('noteCustomToggle').addEventListener('click', () => {
    const hz = Number($('noteCustomHz').value) || 440;
    setNoteMode('noteCustomToggle', hz);
  });
  $('noteCustomHz') && $('noteCustomHz').addEventListener('input', () => {
    if($('noteCustomRow') && $('noteCustomRow').style.display !== 'none'){
      const hz = Number($('noteCustomHz').value) || 440;
      if(osc) osc.frequency.value = hz;
    }
  });
  ['frequencyMode','hpMode'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('change',syncAudioFilterType); });

  // Run initial sync passes
  syncHpModeEnabled();
  syncLinearTimeScale();
  syncAnalogueCurve();
  syncConsoleScale();
}
