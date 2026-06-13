// ---- UI Controls — event listeners, interaction wiring, and control functions ----
// Top-level declarations/functions are global (accessible by render.js, animation.js, etc.)
// Event listener registration is deferred to initUIControls(), called from init after $ is defined.

// ---- Transport modal state ----
let tapMode = 'tap200';
const tapModeBtns = ['tapMode50Btn','tapMode100Btn','tapMode200Btn','tap500Btn','tap1sBtn','tapModeCustomBtn','tapModeHoldBtn'];
const transBtnIds = ['transInstantBtn','trans1Btn','trans2Btn','trans3Btn','trans4Btn','trans5Btn','transCustomToggle'];

// ---- Numeric input typed-display state ----
const typedDisplay = {
  live: { a: null, d: null, r: null },
  animate: { a: null, d: null, r: null }
};

// Assigned inside initUIControls() so DOM exists; used by refreshNumericInputs() etc.
let attackInput, decayInput, releaseInput, sustainInput, floorInput, scaleInput;

// ---- syncControls — sync knob/slider/readout display to state ----
function syncControls(){
  const mode=document.querySelector('input[name="mode"]:checked').value;
  const vals = mode==='live' ? state : state.target;
  $('attack').value=Math.round(vals.a*1000); $('decay').value=Math.round(vals.d*1000); $('sustain').value=Math.round(vals.s*1000);
  $('release').value=Math.round(vals.r*1000);
  $('floor').value=Math.round(vals.floor*1000); $('scale').value=Math.round(vals.scale*1000);
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

function setFromSlider(){
  const mode=document.querySelector('input[name="mode"]:checked').value;
  const dest=mode==='live' ? state : state.target;
  dest.a=$('attack').value/1000; dest.d=$('decay').value/1000; dest.s=$('sustain').value/1000;
  dest.r=$('release').value/1000;
  dest.floor=$('floor').value/1000; dest.scale=$('scale').value/1000;
  if(mode==='live') { state.target={a:state.a,d:state.d,s:state.s,r:state.r,floor:state.floor,scale:state.scale,tbSustainGap:state.tbSustainGap}; render(); } else syncControls();
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
  const fill=$('meterFill');
  if(fill){
    const e=getEffective();
    const mx=METER_X, mw=METER_W;
    const isHP=$('hpMode')&&$('hpMode').checked;
    fill.setAttribute('x',mx); fill.setAttribute('width',mw);
    if(!isHP){
      const floorY=yFor(e.floor), bottomAbsY=graph.y0;
      fill.setAttribute('y',floorY); fill.setAttribute('height',Math.max(0,bottomAbsY-floorY));
    } else {
      const floorY = yFor(e.floor);
      const topY = yFor(1);
      fill.setAttribute('y', String(topY));
      fill.setAttribute('height', String(floorY - topY));
    }
  }
}

function updateButtonStates(){
  const phase = state.currentPhase;
}

// ---- setTapMode ----
function setTapMode(mode, btnId){
  tapMode = mode;
  tapModeBtns.forEach(id => { const b=$(id); if(b){ b.style.background=''; b.style.color=''; } });
  const b=$(btnId); if(b){ b.style.background='#ffffff'; b.style.color='#111111'; }
  const customRow=$('tapCustomRow');
  if(customRow) customRow.style.display = mode==='tapCustom' ? '' : 'none';
}

// ---- Help / Advanced popup helpers ----
function showHelp(){ $('helpOverlay').style.display='flex'; }
function hideHelp(){ $('helpOverlay').style.display='none'; }
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

// ---- Keyboard helpers ----
function toggleCheckbox(id){
  const el=$(id); if(!el) return;
  el.checked=!el.checked;
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
function toggleMode(){
  const live=document.querySelector('input[name="mode"][value="live"]');
  const anim=document.querySelector('input[name="mode"][value="animate"]');
  if(!live||!anim) return;
  if(live.checked){ anim.checked=true; anim.dispatchEvent(new Event('change',{bubbles:true})); }
  else            { live.checked=true; live.dispatchEvent(new Event('change',{bubbles:true})); }
}

// ---- Mode / object helpers ----
function currentMode(){
  const el = document.querySelector('input[name="mode"]:checked');
  return el ? el.value : 'live';
}
function activeObject(){
  return currentMode() === 'animate' ? state.target : state;
}

// ---- Numeric display helpers ----
function formatSustainScale(v){
  const pct = Math.round(v * 100);
  const scale = v * 10;
  const scaleText = Number.isInteger(scale) ? String(scale) : scale.toFixed(1).replace(/\.0$/, '');
  return `${scaleText} (${pct}%)`;
}

function ensureInputAfter(sliderId, inputId, label, attrs){
  const slider = document.getElementById(sliderId);
  if (!slider) return null;
  let input = document.getElementById(inputId);
  if (input) return input;
  const wrap = document.createElement('div');
  wrap.className = ['sustainScaleInput','floorScaleInput','scaleScaleInput'].includes(inputId) ? 'numeric-value-control' : 'numeric-ms-control';
  wrap.innerHTML = `<label>${label} <input id="${inputId}" ${attrs}></label>`;
  slider.insertAdjacentElement('afterend', wrap);
  return document.getElementById(inputId);
}

function commitTime(which, input){
  if (!input) return;
  if(currentMode()==='live') clearBlobAndMarker();
  if(window.markPresetDirty) markPresetDirty();
  const ms = Math.max(0, Math.min(12000, Math.round(Number(input.value) || 0)));
  input.value = ms;
  const m = currentMode();
  typedDisplay[m][which] = ms;
  const obj = activeObject();
  obj[which] = positionFromMs(ms);
  if (m === 'live') {
    state.target = { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale };
    render();
  } else {
    syncControls();
  }
  requestAnimationFrame(refreshNumericInputs);
}

function commitSustain(){
  if (!sustainInput) return;
  if(window.markPresetDirty) markPresetDirty();
  const scale = Math.max(0, Math.min(10, Number(sustainInput.value) || 0));
  sustainInput.value = Number.isInteger(scale) ? String(scale) : scale.toFixed(1).replace(/\.0$/, '');
  const obj = activeObject();
  obj.s = scale / 10;
  if (currentMode() === 'live') {
    state.target = { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale };
    render();
  } else {
    syncControls();
  }
  requestAnimationFrame(refreshNumericInputs);
}

function refreshNumericInputs(){
  const m = currentMode();
  const obj = activeObject();
  if (attackInput && document.activeElement !== attackInput) {
    attackInput.value = typedDisplay[m].a !== null ? typedDisplay[m].a : msFromPosition(obj.a);
  }
  if (decayInput && document.activeElement !== decayInput) {
    decayInput.value = typedDisplay[m].d !== null ? typedDisplay[m].d : msFromPosition(obj.d);
  }
  if (releaseInput && document.activeElement !== releaseInput) {
    releaseInput.value = typedDisplay[m].r !== null ? typedDisplay[m].r : msFromPosition(obj.r);
  }
  if (sustainInput && document.activeElement !== sustainInput) {
    const scale = obj.s * 10;
    sustainInput.value = Number.isInteger(scale) ? String(scale) : scale.toFixed(1).replace(/\.0$/, '');
  }
  if (floorInput && document.activeElement !== floorInput) {
    const v = obj.floor * 10;
    floorInput.value = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
  }
  if (scaleInput && document.activeElement !== scaleInput) {
    const v = obj.scale * 10;
    scaleInput.value = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
  }
  patchSustainReadouts();
}

function patchSustainReadouts(){
  const eff = getEffective();
  const formatted = formatSustainScale(eff.s);
  const sustainRead = document.getElementById('sustainRead');
  if (sustainRead) sustainRead.textContent = formatted;
  const sustainTarget = document.getElementById('sustainTarget');
  if (sustainTarget && currentMode() === 'animate') {
    const targetS = document.getElementById('keyboardControl').checked ? state.target.s * 0.8 : state.target.s;
    sustainTarget.textContent = 'Target: ' + formatSustainScale(targetS);
  }
}

function commitFloor(){
  if (!floorInput) return;
  if(window.markPresetDirty) markPresetDirty();
  const v = Math.max(0, Math.min(10, Number(floorInput.value) || 0));
  floorInput.value = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
  const obj = activeObject();
  obj.floor = v / 10;
  if (currentMode() === 'live') {
    state.target = { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale };
    render();
  } else { syncControls(); }
  setMeterLevel(state.dotLevel);
  requestAnimationFrame(refreshNumericInputs);
}

function commitScale(){
  if (!scaleInput) return;
  if(window.markPresetDirty) markPresetDirty();
  const v = Math.max(0, Math.min(10, Number(scaleInput.value) || 0));
  scaleInput.value = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
  const obj = activeObject();
  obj.scale = v / 10;
  if (currentMode() === 'live') {
    state.target = { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale };
    render();
  } else { syncControls(); }
  requestAnimationFrame(refreshNumericInputs);
}

function clearTypedForSlider(which){
  typedDisplay[currentMode()][which] = null;
}

// ---- Pointer feedback and axis cleanup ----
function hideLikelyAxes(){
  document.querySelectorAll('svg line, svg path, svg text').forEach(el => {
    if (el.id === 'timeAxis0' || el.id === 'timeAxis0Stated' || el.id === 'timeAxisAttack' || el.id === 'timeAxisAttackStated' || el.id === 'timeAxisDecayStart' || el.id === 'timeAxisDecayEnd' || el.id === 'timeAxisDecayEndEffective' || el.id === 'timeAxisDecayEndStated' || el.id === 'timeAxisReleaseEnd' || el.id === 'timeAxisReleaseEndStated' || el.id === 'timeAxisReleaseStart' || el.id === 'timeAxisReleaseStartStated' || el.id === 'timeAxisEffectiveLabel' || el.id === 'timeAxisStatedLabel') return;
    const idClass = ((el.id || '') + ' ' + (el.getAttribute('class') || '')).toLowerCase();
    const text = (el.textContent || '').trim();
    if (/axis|xaxis|yaxis|baseline|zero-line|reference-line/.test(idClass)) {
      el.style.display = 'none'; el.style.opacity = '0'; return;
    }
    if (el.tagName.toLowerCase() === 'text') {
      if (text === 'TIME' || text === 'AMPLITUDE' || text === '0' || text === '1.0') {
        el.style.display = 'none'; el.style.opacity = '0';
      }
    }
    if (el.tagName.toLowerCase() === 'line') {
      const stroke = (el.getAttribute('stroke') || '').toLowerCase();
      const op = Number(el.getAttribute('opacity') || el.style.opacity || 1);
      if ((stroke === '#ffffff' || stroke === 'white' || stroke === '#fff') && op < 0.45) {
        el.style.display = 'none'; el.style.opacity = '0';
      }
    }
  });
}

function addPointerFeedback(){
  document.querySelectorAll('button').forEach(btn => {
    if (btn.__v28PointerFeedback) return;
    btn.__v28PointerFeedback = true;
    function press(){ btn.classList.add('v28-pressed'); }
    function release(){ setTimeout(() => btn.classList.remove('v28-pressed'), 120); }
    btn.addEventListener('pointerdown', press, true);
    btn.addEventListener('mousedown', press, true);
    btn.addEventListener('pointerup', release, true);
    btn.addEventListener('mouseup', release, true);
    btn.addEventListener('pointercancel', release, true);
    btn.addEventListener('mouseleave', release, true);
    btn.addEventListener('blur', release, true);
  });
}

// ---- initUIControls — registers all event listeners; called from init ----
function initUIControls(){

  // Slider input listeners
  ['attack','decay','release'].forEach(id=>$(id).addEventListener('input',()=>{ if(currentMode()==='live') clearBlobAndMarker(); setFromSlider(); if(window.markPresetDirty) markPresetDirty(); }));
  $('sustain').addEventListener('input',()=>{ setFromSlider(); if(window.markPresetDirty) markPresetDirty(); });
  ['floor','scale'].forEach(id=>$(id).addEventListener('input',()=>{
    const mode=document.querySelector('input[name="mode"]:checked').value;
    const dest=mode==='live' ? state : state.target;
    dest.floor=$('floor').value/1000; dest.scale=$('scale').value/1000;
    if(mode==='live') { state.target={...state.target,floor:state.floor,scale:state.scale}; render(); } else syncControls();
    if(window.markPresetDirty) markPresetDirty();
  }));

  // Mode change
  document.querySelectorAll('input[name="mode"]').forEach(el=>el.addEventListener('change',()=>{ if(el.value==='animate' && el.checked) state.target={a:state.a,d:state.d,s:state.s,r:state.r,floor:state.floor,scale:state.scale,tbSustainGap:state.tbSustainGap}; syncControls(); }));

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

  // Help popup
  $('helpBtn').addEventListener('click', showHelp);
  $('helpClose').addEventListener('click', hideHelp);
  $('helpOverlay').addEventListener('click', e => { if(e.target===$('helpOverlay')) hideHelp(); });

  // Advanced popup
  $('advancedToggle').addEventListener('click', e => { e.stopPropagation(); isAdvancedOpen() ? closeAdvanced() : openAdvanced(); });
  $('advancedPopup').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if(isAdvancedOpen()) closeAdvanced(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if(['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
    if($('helpOverlay').style.display !== 'none'){
      if(e.key === 'Escape') hideHelp();
      return;
    }
    if(isAdvancedOpen()){ if(e.key === 'Escape') closeAdvanced(); return; }
    if(e.key === 'Escape') return;
    if(e.key === '?'){ showHelp(); return; }
    if(e.key === ' '){
      e.preventDefault();
      if(tapMode === 'hold'){
        if(state.currentPhase === 'hold' || state.currentPhase === 'sustain'){ releaseFromCurrent(); }
        else { hold(); }
      } else {
        const ms = tapMode === 'tap50' ? 50 : tapMode === 'tap100' ? 100 : tapMode === 'tap500' ? 500 : tapMode === 'tap1000' ? 1000 : tapMode === 'tapCustom' ? (Number($('tapCustomMs').value)||200) : 200;
        tap(ms);
      }
    } else if(e.key === '1' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap50','tapMode50Btn');
    } else if(e.key === '2' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap100','tapMode100Btn');
    } else if(e.key === '3' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap200','tapMode200Btn');
    } else if(e.key === '4' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap500', 'tap500Btn');
    } else if(e.key === '5' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap1000', 'tap1sBtn');
    } else if(e.key === 'h' || e.key === 'H'){ setTapMode('hold','tapModeHoldBtn');
    } else if(e.key === 'Enter'){
      e.preventDefault();
      transition(currentTransitionSec);
    } else if((e.key === 'c' || e.key === 'C') && e.altKey){ clearBlobAndMarker();
    } else if(e.key === 'c' || e.key === 'C'){ toggleCheckbox('showClipped');
    } else if(e.key === 'l' || e.key === 'L'){ toggleMode();
    } else if(e.key === 'a' || e.key === 'A'){ toggleCheckbox('audioEnabled');
    } else if(e.key === 'd' || e.key === 'D'){ toggleCheckbox('loudDecay');
    } else if(e.key === 'r' || e.key === 'R'){ toggleCheckbox('drawReleaseWhenZero');
    } else if(e.key === 'z' || e.key === 'Z'){ toggleCheckbox('timelineZoom3x');
    } else if(e.key === ','){ toggleCheckbox('showBounds');
    } else if(e.key === '.'){ toggleCheckbox('showContour');
    } else if(e.key === ';'){ toggleCheckbox('showEffectiveTimes');
    } else if(e.key === ':'){ toggleCheckbox('showEffectiveLines');
    } else if(e.key === "'"){ toggleCheckbox('showStatedTimes');
    } else if(e.key === '"'){ toggleCheckbox('showStatedLines');
    } else if(e.key === 'f' || e.key === 'F'){ toggleCheckbox('frequencyMode');
    } else if(e.key === 'm' || e.key === 'M'){ toggleCheckbox('hpMode');
    } else if(e.key === 's' || e.key === 'S'){ toggleCheckbox('keyboardControl');
    } else if(e.key === 'x' || e.key === 'X'){ toggleCheckbox('linearTime');
    } else if(e.key === 't' || e.key === 'T'){ toggleCheckbox('textbookAdsr');
    } else if(e.key === '['){ toggleCheckbox('tbSustainDotted');
    } else if(e.key === ']'){ toggleCheckbox('tbSustainCollapse');
    } else if(e.key === '\\'){ toggleCheckbox('tbShowModelDSustain');
    } else if(e.key === 'b' || e.key === 'B'){ toggleCheckbox('analogueCurve');
    } else if(/^Digit[1-6]$/.test(e.code) && (e.shiftKey||e.altKey||e.metaKey)){
      const idx = parseInt(e.code.replace('Digit', '')) - 1;
      const qs = k => { const b=document.querySelectorAll(`.quickset-btn[data-knob="${k}"]`)[idx]; return b?Number(b.dataset.value):null; };
      if(e.shiftKey && e.altKey && e.metaKey && !e.ctrlKey){ const v=qs('release'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.r=positionFromMs(v); transition(currentTransitionSec); } }
      else if(e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey){ const v=qs('attack'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.a=positionFromMs(v); transition(currentTransitionSec); } }
      else if(e.shiftKey && e.altKey && !e.metaKey && !e.ctrlKey){ const v=qs('decay'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.d=positionFromMs(v); transition(currentTransitionSec); } }
      else if(e.altKey && e.metaKey && !e.shiftKey && !e.ctrlKey){ const v=qs('amount'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.scale=v/10; transition(currentTransitionSec); } }
      else if(e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey){ const v=qs('sustain'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.s=v/10; transition(currentTransitionSec); } }
      else if(e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey){ const v=qs('cutoff'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.floor=v/10; transition(currentTransitionSec); } }
      e.preventDefault();
    }
  });

  // Numeric inputs for Attack / Decay / Sustain / Release / Floor / Scale
  attackInput  = ensureInputAfter('attack',  'attackMsInput',    '', 'type="number" min="0" max="12000" step="1"');
  decayInput   = ensureInputAfter('decay',   'decayMsInput',     '', 'type="number" min="0" max="12000" step="1"');
  releaseInput = ensureInputAfter('release', 'releaseMsInput',   '', 'type="number" min="0" max="12000" step="1"');
  sustainInput = ensureInputAfter('sustain', 'sustainScaleInput','', 'type="number" min="0" max="10" step="0.1"');
  floorInput   = ensureInputAfter('floor',   'floorScaleInput',  '', 'type="number" min="0" max="10" step="0.1"');
  scaleInput   = ensureInputAfter('scale',   'scaleScaleInput',  '', 'type="number" min="0" max="10" step="0.1"');

  if (attackInput) {
    attackInput.addEventListener('change', () => commitTime('a', attackInput));
    attackInput.addEventListener('blur',   () => commitTime('a', attackInput));
    attackInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitTime('a', attackInput); });
  }
  if (decayInput) {
    decayInput.addEventListener('change', () => commitTime('d', decayInput));
    decayInput.addEventListener('blur',   () => commitTime('d', decayInput));
    decayInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitTime('d', decayInput); });
  }
  if (releaseInput) {
    releaseInput.addEventListener('change', () => commitTime('r', releaseInput));
    releaseInput.addEventListener('blur',   () => commitTime('r', releaseInput));
    releaseInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitTime('r', releaseInput); });
  }
  if (sustainInput) {
    sustainInput.addEventListener('change', commitSustain);
    sustainInput.addEventListener('blur',   commitSustain);
    sustainInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitSustain(); });
  }
  if (floorInput) {
    floorInput.addEventListener('change', commitFloor);
    floorInput.addEventListener('blur',   commitFloor);
    floorInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitFloor(); });
  }
  if (scaleInput) {
    scaleInput.addEventListener('change', commitScale);
    scaleInput.addEventListener('blur',   commitScale);
    scaleInput.addEventListener('keydown', e => { if (e.key === 'Enter') commitScale(); });
  }

  const attackSlider  = document.getElementById('attack');
  const decaySlider   = document.getElementById('decay');
  const sustainSlider = document.getElementById('sustain');
  const floorSlider   = document.getElementById('floor');
  const scaleSlider   = document.getElementById('scale');
  const releaseSlider = document.getElementById('release');

  if (attackSlider)  attackSlider.addEventListener('input',  () => { clearTypedForSlider('a'); setTimeout(refreshNumericInputs, 0); });
  if (decaySlider)   decaySlider.addEventListener('input',   () => { clearTypedForSlider('d'); setTimeout(refreshNumericInputs, 0); });
  if (releaseSlider) releaseSlider.addEventListener('input', () => { clearTypedForSlider('r'); setTimeout(refreshNumericInputs, 0); });
  if (sustainSlider) sustainSlider.addEventListener('input', () => { setTimeout(refreshNumericInputs, 0); });
  if (floorSlider)   floorSlider.addEventListener('input',  () => { setMeterLevel(state.dotLevel); setTimeout(refreshNumericInputs, 0); });
  if (scaleSlider)   scaleSlider.addEventListener('input',  () => { setTimeout(refreshNumericInputs, 0); });

  document.querySelectorAll('input[name="mode"]').forEach(el => {
    el.addEventListener('change', () => setTimeout(refreshNumericInputs, 0));
  });
  ['loudDecay','keyboardControl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => setTimeout(refreshNumericInputs, 0));
  });

  // Knob drag interaction
  [
    { knobId: 'attackKnob',  sliderId: 'attack'  },
    { knobId: 'decayKnob',   sliderId: 'decay'   },
    { knobId: 'sustainKnob', sliderId: 'sustain' },
    { knobId: 'releaseKnob', sliderId: 'release' },
    { knobId: 'floorKnob',   sliderId: 'floor'   },
    { knobId: 'scaleKnob',   sliderId: 'scale'   },
  ].forEach(({ knobId, sliderId }) => {
    const knob   = $(knobId);
    const slider = $(sliderId);
    knob.style.cursor = 'ns-resize';
    let startY, startVal;
    knob.addEventListener('pointerdown', e => {
      startY   = e.clientY;
      startVal = Number(slider.value);
      knob.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    knob.addEventListener('pointermove', e => {
      if (!knob.hasPointerCapture(e.pointerId)) return;
      const delta = startY - e.clientY;
      const range = Number(slider.max) - Number(slider.min);
      const newVal = Math.round(clamp(startVal + delta * (range / 200), Number(slider.min), Number(slider.max)));
      slider.value = newVal;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    knob.addEventListener('pointerup', e => {
      knob.releasePointerCapture(e.pointerId);
    });
  });

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
