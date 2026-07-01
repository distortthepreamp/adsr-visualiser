// ---- UI Controls — event listeners, interaction wiring, and control functions ----
// Top-level declarations/functions are global (accessible by render.js, animation.js, etc.)
// Event listener registration is deferred to initUIControls(), called from init after $ is defined.

// ---- Shared UI constants ----
const UI_DISABLED_OPACITY = '0.35';
const VB_WIDTH_MAX  = 2400;
const VB_WIDTH_MIN  = 800;
const VB_HEIGHT_MAX = 1200;
const VB_HEIGHT_MIN = 400;
const BTN_ACTIVE_BG  = '#ffffff';
const BTN_ACTIVE_FG  = '#111111';
const BTN_PARTIAL_BG = 'rgba(255,255,255,0.35)';

// ---- Transport state ----

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
  if($('gateKnob')) $('gateKnob').style.setProperty('--deg', (-135 + vals.gate*270)+'deg');
  $('attackTarget').textContent=mode==='animate' ? 'Target: '+fmtTime(mapTime(state.target.a)) : '';
  $('decayTarget').textContent=mode==='animate' ? 'Target: '+fmtTime(mapTime(state.target.d)) : '';
  $('sustainTarget').textContent=mode==='animate' ? 'Target: '+Math.round(($('keyboardControl').checked?state.target.s*MIMIC_SUSTAIN_CAP:state.target.s)*100)+'%' : '';
  $('releaseTarget').textContent=mode==='animate' ? 'Target: '+fmtTime(mapTime(state.target.r)) : '';
  $('floorTarget').textContent=mode==='animate' ? 'Target: '+formatSustainScale(state.target.floor) : '';
  $('scaleTarget').textContent=mode==='animate' ? 'Target: '+formatSustainScale(state.target.scale) : '';
  if($('gateTarget')) $('gateTarget').textContent=mode==='animate' ? 'Target: '+Math.round(gateMsFromPosition(state.target.gate))+'ms' : '';
  const mh=$('modeHint'); if(mh) mh.textContent = mode==='live' ? 'Live Mode: Knobs Update The Graph Immediately.' : 'Animate Mode: Knobs Set Targets. Press Transition To Morph The Graph.';
  patchSustainReadouts();
  syncZoomReadout();

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
          btn.style.background = BTN_ACTIVE_BG; btn.style.color = BTN_ACTIVE_FG;
        } else if(exactIdx === -1 && i === closestIdx){
          btn.style.background = BTN_PARTIAL_BG; btn.style.color = '#ffffff';
        } else {
          btn.style.background = ''; btn.style.color = '';
        }
      });
    });
  })();
}

// ---- transition — animates state toward state.target ----
function transition(durSec){
  logEvent('TRANSITION', { durSec: durSec !== undefined ? durSec : currentTransitionSec, from: { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale }, target: { a: state.target.a, d: state.target.d, s: state.target.s, r: state.target.r, floor: state.target.floor, scale: state.target.scale }, geometry: window._lastRenderGeometry || null });
  clearBlobAndMarker();
  animationToken++;
  const myAnimationToken = animationToken;
  if(durSec===undefined) durSec=currentTransitionSec;
  const dur=durSec*1000;
  const start={a:state.a,d:state.d,s:state.s,r:state.r,floor:state.floor,scale:state.scale,gate:state.gate,tbSustainGap:state.tbSustainGap,zoomFactor:state.zoomFactor}, end={...state.target};
  if(window.kioskBeginTransition) window.kioskBeginTransition(start.a, end.a, start.d, end.d, dur);
  if(window.kioskNotifyKnob && dur > 0) {
    if(Math.abs(end.s     - start.s)     > 0.0001) window.kioskNotifyKnob('sustain', dur);
    if(Math.abs(end.floor - start.floor) > 0.0001) window.kioskNotifyKnob('cutoff',  dur);
    if(Math.abs(end.scale - start.scale) > 0.0001) window.kioskNotifyKnob('amount',  dur);
  }
  const startAms=mapTime(start.a)*1000, endAms=mapTime(end.a)*1000;
  const startDms=mapTime(start.d)*1000, endDms=mapTime(end.d)*1000;
  const startRms=mapTime(start.r)*1000, endRms=mapTime(end.r)*1000;
  const startGms=gateMsFromPosition(start.gate), endGms=gateMsFromPosition(end.gate);
  cancelAnimationFrame(state.anim);
  state.a=start.a; state.d=start.d; state.s=start.s; state.r=start.r; state.floor=start.floor; state.scale=start.scale; state.gate=start.gate; state.tbSustainGap=start.tbSustainGap; state.zoomFactor=start.zoomFactor;
  render();
  if(dur <= 0){
    state.a=end.a; state.d=end.d; state.s=end.s; state.r=end.r; state.floor=end.floor; state.scale=end.scale; state.gate=end.gate; state.tbSustainGap=end.tbSustainGap; state.zoomFactor=end.zoomFactor;
    render();
    return;
  }
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
    state.gate=gatePositionFromMs(startGms+(endGms-startGms)*k);
    state.tbSustainGap=start.tbSustainGap+(end.tbSustainGap-start.tbSustainGap)*k;
    state.zoomFactor=start.zoomFactor+(end.zoomFactor-start.zoomFactor)*k;
    render();
    if(f<1) state.anim=requestAnimationFrame(step); else { state.a=end.a; state.d=end.d; state.s=end.s; state.r=end.r; state.floor=end.floor; state.scale=end.scale; state.gate=end.gate; state.tbSustainGap=end.tbSustainGap; state.zoomFactor=end.zoomFactor; render(); }
  }
  state.anim=requestAnimationFrame(step);
}

function setTransMode(durSec, activeBtnId){
  const transBtns = ['transInstantBtn','trans1Btn','trans2Btn','trans3Btn','trans4Btn','trans5Btn','transCustomToggle'];
  if(durSec !== null) currentTransitionSec = durSec;
  activeTransBtn = activeBtnId;
  transBtns.forEach(id => { const b=$(id); if(b){ b.style.background=''; b.style.color=''; } });
  const b=$(activeBtnId); if(b){ b.style.background=BTN_ACTIVE_BG; b.style.color=BTN_ACTIVE_FG; }
  const row=$('customTransitionRow');
  if(row) row.style.display = activeBtnId==='transCustomToggle' ? '' : 'none';
}

// ---- setMeterFill — core: updates a given fill rect from a blob's y coordinate ----
function setMeterFill(fill, blobY, fillColor){
  if(!fill) return;
  const ceilY = yFor(1);
  const floorY = graph.y0;
  // Clamp blobY to the graph area
  const levelY = Math.max(blobY, ceilY);
  const isHP=$('hpMode')&&$('hpMode').checked;
  fill.style.fill=fillColor;
  const glowR = Math.max(0, Number(($('meterGlowRadius')&&$('meterGlowRadius').value)||20));
  fill.style.filter=($('meterGlow')&&$('meterGlow').checked) ? `drop-shadow(0 0 ${glowR}px ${fillColor}) drop-shadow(0 0 ${glowR*2}px ${fillColor})` : '';
  if(!isHP){
    const h=Math.max(0, floorY - levelY);
    fill.setAttribute('y', levelY); fill.setAttribute('height', h);
  } else {
    fill.setAttribute('y', String(ceilY));
    fill.setAttribute('height', String(Math.max(0, levelY - ceilY)));
  }
}
// ---- setMeterLevel — effective (right half), driven by blob y ----
function setMeterLevel(blobY){
  const freqModeOn=$('frequencyMode')&&$('frequencyMode').checked;
  const fillColor=freqModeOn
    ? (getComputedStyle(document.documentElement).getPropertyValue('--meterFillFilter').trim()||'#00ffff')
    : (getComputedStyle(document.documentElement).getPropertyValue('--meterFill').trim()||'#00ff00');
  setMeterFill($('meterFill'), blobY, fillColor);
}
// ---- setMeterLevelStated — stated (left half), driven by blob y ----
function setMeterLevelStated(blobY){
  const ulCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
  setMeterFill($('meterFillStated'), blobY, ulCol);
}

function hideDot(){
  const dot=$('dot');
  dot.style.opacity=0;
  dot.style.visibility='hidden';
  state.dotY=graph.y0;
  setMeterLevel(graph.y0);
}

function updateButtonStates(){
  // stub — reserved for future button state sync
}


// ---- Expert popup helpers ----
function openExpert(){ closePending(); $('expertPopup').style.display=''; $('expertToggle').style.background=BTN_ACTIVE_BG; $('expertToggle').style.color=BTN_ACTIVE_FG; }
function closeExpert(){ $('expertPopup').style.display='none'; $('expertToggle').style.background=''; $('expertToggle').style.color=''; }
function isExpertOpen(){ return $('expertPopup').style.display !== 'none'; }
// Pending Removal popup — mirrors Expert; mutually exclusive so the two upward popups never overlap.
function openPending(){ closeExpert(); $('pendingPopup').style.display=''; $('pendingToggle').style.background=BTN_ACTIVE_BG; $('pendingToggle').style.color=BTN_ACTIVE_FG; }
function closePending(){ $('pendingPopup').style.display='none'; $('pendingToggle').style.background=''; $('pendingToggle').style.color=''; }
function isPendingOpen(){ return $('pendingPopup').style.display !== 'none'; }

// ---- Floating-panel helpers (Colours / Display) ----
// Reset a draggable panel card back to flex-centred (cleared inline position) when reopened.
function resetModalPos(card){ if(!card) return; card.style.position='relative'; card.style.left=''; card.style.top=''; card.style.margin=''; }
// Make a panel card draggable by its header; switches the card to fixed positioning on first drag.
function makeDraggable(card, handle){
  if(!card || !handle) return;
  let dragging=false, offX=0, offY=0;
  handle.addEventListener('pointerdown', e => {
    if(e.button !== 0) return;
    const r = card.getBoundingClientRect();
    card.style.position='fixed'; card.style.margin='0';
    card.style.left=r.left+'px'; card.style.top=r.top+'px';
    offX = e.clientX - r.left; offY = e.clientY - r.top;
    dragging=true;
    try{ handle.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if(!dragging) return;
    const r = card.getBoundingClientRect();
    const m = 40; // keep at least this many px on-screen so it can't be lost
    let nx = e.clientX - offX, ny = e.clientY - offY;
    nx = Math.max(m - r.width, Math.min(nx, window.innerWidth - m));
    ny = Math.max(0,           Math.min(ny, window.innerHeight - m));
    card.style.left=nx+'px'; card.style.top=ny+'px';
  });
  const end = e => { if(dragging){ dragging=false; try{ handle.releasePointerCapture(e.pointerId); }catch(_){} } };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// ---- Sync helpers (also called from loadConfigObject) ----
function syncHpModeEnabled(){
  const freqOn = $('frequencyMode') && $('frequencyMode').checked;
  const hpLabel = $('hpMode') && $('hpMode').closest('label');
  if(hpLabel){ hpLabel.style.opacity = freqOn ? '' : UI_DISABLED_OPACITY; hpLabel.style.pointerEvents = freqOn ? '' : 'none'; }
  const kb1 = $('keyboardTrack1') && $('keyboardTrack1').closest('label');
  if(kb1){ kb1.style.opacity = freqOn ? '' : UI_DISABLED_OPACITY; kb1.style.pointerEvents = freqOn ? '' : 'none'; }
  const kb2 = $('keyboardTrack2') && $('keyboardTrack2').closest('label');
  if(kb2){ kb2.style.opacity = freqOn ? '' : UI_DISABLED_OPACITY; kb2.style.pointerEvents = freqOn ? '' : 'none'; }
}
// ---- Zoom — single numeric input drives state.zoomFactor ----
function syncZoomReadout(){
  const inp = $('zoomFactorInput');
  const rd = $('zoomSecondsReadout');
  if(inp && document.activeElement !== inp) inp.value = parseFloat(state.zoomFactor.toPrecision(3));
  if(rd) rd.textContent = parseFloat((8 / Math.max(0.1, state.zoomFactor)).toPrecision(2)) + 's';
}
function computeFitZoom(){
  const rx = state._fitRightmostX;
  if(!rx || rx <= graph.x0 + 1) return;
  const margin = Number(($('fitMargin') && $('fitMargin').value) || 90) / 100;
  let z = state.zoomFactor * (graph.w * margin) / (rx - graph.x0);
  z = Math.max(0.1, Math.min(48, Math.round(z * 10) / 10));
  const inp = $('zoomFactorInput'); if(!inp) return;
  // Apply silently (no synthetic change event → no cueRecord('zoom')); the Fit button records 'zoom-fit'.
  inp.value = z;
  state.target.zoomFactor = z;
  transition(currentTransitionSec);
  syncZoomReadout();
}
function commitZoom(){
  const inp = $('zoomFactorInput'); if(!inp) return;
  const v = Math.max(0.1, Math.min(48, parseFloat(inp.value) || 3));
  inp.value = v;
  state.target.zoomFactor = v;
  transition(currentTransitionSec);
  syncZoomReadout();
  if(window.cueRecord) cueRecord('zoom');
}
function syncAnalogueCurve(){
  const on = $('analogueCurve') && $('analogueCurve').checked;
  const opacity = on ? '' : UI_DISABLED_OPACITY;
  const sl = $('curveAmount'), val = $('curveAmountVal');
  if(sl)  sl.style.opacity  = opacity;
  if(val){ val.style.opacity = opacity; val.textContent = sl ? sl.value : '40'; }
}
function syncConsoleScale(){
  const s = Number($('consoleScale').value) || 0.7;
  const uiEl = document.querySelector('.ui');
  if(uiEl){ uiEl.style.transform = `scale(${s})`; uiEl.style.width = `${(1/s)*100}%`; }
}

// ---- Shared JSON download helper ----
function downloadJSON(data, filename){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Shared flash-green button feedback ----
function flashButton(btn, isActive){
  btn.style.background = '#00ff88';
  btn.style.color = '#000';
  setTimeout(() => {
    if(isActive()){ btn.style.background = BTN_ACTIVE_BG; btn.style.color = BTN_ACTIVE_FG; }
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

  // Declutter toggle
  if($('declutter')) $('declutter').addEventListener('change', e => {
    document.body.classList.toggle('decluttered', e.target.checked);
  });

  // Checkbox render, debug log, and cue recorder listeners
  const TOGGLE_CUE_KEY = { loudDecay:'loud-decay', keyboardControl:'mimic-sustain', showContour:'show-contour', frequencyMode:'filter-mode', hpMode:'hp-mode', showClipped:'show-clipped', linkRToD:'link-r-to-d' };
  ['loudDecay','keyboardControl','showContour','frequencyMode','hpMode','showClipped','linkRToD'].forEach(id => {
    const el = $(id); if(!el) return;
    el.addEventListener('change', render);
    el.addEventListener('change', () => {
      const chk = id2 => { const e2=$(id2); return e2 ? e2.checked : undefined; };
      logEvent('CHECKBOX', {
        id, checked: el.checked,
        state: { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale },
        flags: {
          loudDecay: chk('loudDecay'), keyboardControl: chk('keyboardControl'),
          frequencyMode: chk('frequencyMode'), hpMode: chk('hpMode'),
          showClipped: chk('showClipped'), analogueCurve: chk('analogueCurve')
        },
        geometry: window._lastRenderGeometry || null
      });
      if(window.cueRecord) cueRecord(TOGGLE_CUE_KEY[id]);
    });
  });


  // Meter / blob glow
  $('meterGlow').addEventListener('change', () => setMeterLevel(state.dotY || graph.y0));
  $('meterGlowRadius').addEventListener('input', e => { const inp=e.target,c=Math.min(60,Math.max(0,isNaN(parseInt(inp.value))?5:parseInt(inp.value))); inp.value=c; setMeterLevel(state.dotY || graph.y0); });
  $('meterScanlinesVisible').addEventListener('change', render);
  $('blobGlowEnabled').addEventListener('change', () => { applyBlobGlow(); if(state.currentPhase==='sustain') startGlowPulse(); else stopGlowPulse(); });
  $('blobGlowRadius').addEventListener('input', e => { const inp=e.target,c=Math.min(30,Math.max(0,isNaN(parseInt(inp.value))?8:parseInt(inp.value))); inp.value=c; applyBlobGlow(); if(state.currentPhase==='sustain') startGlowPulse(); });
  $('kioskKnobGlow').addEventListener('change', () => { render(); if(window.kioskDrawIfOpen) kioskDrawIfOpen(); });
  $('kioskKnobGlowRadius').addEventListener('input', e => { const inp=e.target,c=Math.min(100,Math.max(0,isNaN(parseInt(inp.value))?40:parseInt(inp.value))); inp.value=c; if(window.kioskDrawIfOpen) kioskDrawIfOpen(); });
  $('kioskInactiveOpacity').addEventListener('input', e => { const inp=e.target,c=Math.min(100,Math.max(0,isNaN(parseInt(inp.value))?70:parseInt(inp.value))); inp.value=c; if(window.kioskDrawIfOpen) kioskDrawIfOpen(); });

  // Filter mode
  $('frequencyMode').addEventListener('change', () => { syncHpModeEnabled(); setMeterLevel(state.dotY || graph.y0); });
  $('hpMode').addEventListener('change', () => setMeterLevel(state.dotY || graph.y0));

  // Kiosk switch glow — notify on manual checkbox changes
  $('loudDecay').addEventListener('change', () => { if(window.kioskNotifySwitch) kioskNotifySwitch($('frequencyMode').checked ? 'filter-decay' : 'loud-decay'); });
  $('hpMode').addEventListener('change', () => { if(window.kioskNotifySwitch) kioskNotifySwitch('hp-mode'); });
  $('keyboardTrack1').addEventListener('change', () => { if(window.kioskNotifySwitch) kioskNotifySwitch('keyboard1'); render(); });
  $('keyboardTrack2').addEventListener('change', () => { if(window.kioskNotifySwitch) kioskNotifySwitch('keyboard2'); render(); });

  // Zoom input
  if($('zoomFactorInput')){
    $('zoomFactorInput').addEventListener('change', commitZoom);
    $('zoomFactorInput').addEventListener('keydown', e => { if(e.key === 'Enter') commitZoom(); });
  }
  if($('fitBtn')) $('fitBtn').addEventListener('click', () => { computeFitZoom(); if(window.cueRecordRaw) cueRecordRaw('zoom-fit'); });

  // Analogue curve
  $('analogueCurve').addEventListener('change', () => { syncAnalogueCurve(); render(); if(state.currentPhase === 'idle') clearBlobAndMarker(); if(window.cueRecord) cueRecord('analogue'); });
  $('curveAmount').addEventListener('input', () => { syncAnalogueCurve(); render(); });

  // Colour inputs
  $('lineColor').addEventListener('input',e=>document.documentElement.style.setProperty('--line', e.target.value));
  $('bgColor').addEventListener('input',e=>document.documentElement.style.setProperty('--bg', e.target.value));
  $('meterFillColor').addEventListener('input',e=>document.documentElement.style.setProperty('--meterFill', e.target.value));
  $('meterFillColorFilter').addEventListener('input',e=>document.documentElement.style.setProperty('--meterFillFilter', e.target.value));
  $('timeAxisStatedColor') && $('timeAxisStatedColor').addEventListener('input',e=>document.documentElement.style.setProperty('--timeAxisStatedColor', e.target.value));
  $('contourLineColor').addEventListener('input',e=>{ document.documentElement.style.setProperty('--contourLineColor', e.target.value); render(); });
  ['loudnessAttackColor','loudnessDecayColor','loudnessReleaseColor','loudnessGateColor','filterAttackColor','filterDecayColor','filterReleaseColor','filterGateColor'].forEach(id => {
    const el = $(id); if(el) el.addEventListener('input', render);
  });

  // Line widths / label sizes
  $('innerLineWidth').addEventListener('input',e=>{ const inp=e.target,c=Math.min(18,Math.max(1,isNaN(parseInt(inp.value))?6:parseInt(inp.value))); inp.value=c; document.documentElement.style.setProperty('--innerLineWidth',c); syncRadii(); });
  $('labelSize').addEventListener('input',e=>{ const inp=e.target,c=Math.min(72,Math.max(10,isNaN(parseInt(inp.value))?17:parseInt(inp.value))); inp.value=c; document.documentElement.style.setProperty('--labelSize',c); });
  $('h1Scale').addEventListener('change',e=>{ const inp=e.target,c=Math.min(3.0,Math.max(1.0,isNaN(parseFloat(inp.value))?1.0:Math.round(parseFloat(inp.value)*10)/10)); inp.value=c.toFixed(1); document.documentElement.style.setProperty('--h1Scale',c); render(); });
  $('h2Scale').addEventListener('change',e=>{ const inp=e.target,c=Math.min(3.0,Math.max(1.0,isNaN(parseFloat(inp.value))?1.0:Math.round(parseFloat(inp.value)*10)/10)); inp.value=c.toFixed(1); document.documentElement.style.setProperty('--h2Scale',c); render(); });
  $('blobScale').addEventListener('input',e=>{ const inp=e.target,c=Math.min(8,Math.max(1,isNaN(parseFloat(inp.value))?3:Math.round(parseFloat(inp.value)*2)/2)); inp.value=c; syncRadii(); });
  $('consoleScale').addEventListener('input', e => { const inp=e.target,raw=parseFloat(inp.value),c=Math.min(1.0,Math.max(0.5,isNaN(raw)?0.7:raw)); inp.value=c; syncConsoleScale(); });
  $('meterWidth').addEventListener('input', e => { const inp=e.target,c=Math.min(80,Math.max(10,isNaN(parseInt(inp.value))?40:parseInt(inp.value))); inp.value=c; METER_W=c; recalcGeometry(); render(); });
  $('meterRightMargin').addEventListener('input', e => { const inp=e.target,c=Math.min(600,Math.max(0,isNaN(parseInt(inp.value))?265:parseInt(inp.value))); inp.value=c; METER_RIGHT_MARGIN=c; recalcGeometry(); render(); });
  $('dbLabelRightMargin').addEventListener('input', e => { const inp=e.target,c=Math.min(120,Math.max(0,isNaN(parseInt(inp.value))?0:parseInt(inp.value))); inp.value=c; DB_LABEL_RIGHT_MARGIN=c; render(); });
  $('graphBottomMargin').addEventListener('input', e => { const inp=e.target,c=Math.min(300,Math.max(20,isNaN(parseInt(inp.value))?120:parseInt(inp.value))); inp.value=c; GRAPH_BOTTOM_MARGIN=c; recalcGeometry(); render(); });
  $('meterStrokeWidth').addEventListener('input', e => { const inp=e.target,c=Math.min(20,Math.max(0,isNaN(parseInt(inp.value))?7:parseInt(inp.value))); inp.value=c; METER_STROKE_W=c; render(); });
  $('dbLabelSize').addEventListener('input', e => { const inp=e.target, c=Math.min(72,Math.max(6,isNaN(parseInt(inp.value))?11:parseInt(inp.value))); inp.value=c; DB_LABEL_SIZE=c; render(); });
  $('timeLabelGutter').addEventListener('input', e => { const inp=e.target,c=Math.max(0,isNaN(parseInt(inp.value))?0:parseInt(inp.value)); inp.value=c; render(); });
  $('markerLineWidth').addEventListener('input', e => { const inp=e.target,c=Math.min(8,Math.max(1,isNaN(parseFloat(inp.value))?1:Math.round(parseFloat(inp.value)*2)/2)); inp.value=c; document.documentElement.style.setProperty('--markerLineWidth',c); });
  $('dottedMarkers').addEventListener('change', () => { document.documentElement.style.setProperty('--markerDash', $('dottedMarkers').checked ? '4 4' : 'none'); });
  $('tbSustainGapMax').addEventListener('input', e => { const inp=e.target,c=Math.min(30,Math.max(15,isNaN(parseInt(inp.value))?15:parseInt(inp.value))); inp.value=c; SUSTAIN_GAP_MAX=c/100; render(); });
  $('vbWidth').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(VB_WIDTH_MAX,Math.max(VB_WIDTH_MIN,isNaN(parseInt(inp.value))?1200:parseInt(inp.value)))/10)*10; inp.value=c; VB_WIDTH=c; recalcGeometry(); render(); });
  $('vbHeight').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(VB_HEIGHT_MAX,Math.max(VB_HEIGHT_MIN,isNaN(parseInt(inp.value))?595:parseInt(inp.value)))/10)*10; inp.value=c; VB_HEIGHT=c; recalcGeometry(); render(); });
  $('graphLeft').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(400,Math.max(0,isNaN(parseInt(inp.value))?10:parseInt(inp.value)))/10)*10; inp.value=c; GRAPH_LEFT=c; recalcGeometry(); render(); });
  $('graphTop').addEventListener('change', e => { const inp=e.target,c=Math.round(Math.min(400,Math.max(0,isNaN(parseInt(inp.value))?0:parseInt(inp.value)))/10)*10; inp.value=c; GRAPH_TOP_EXTRA=c; recalcGeometry(); render(); });

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

  // Gate knob quickset buttons — set target and transition, matching the other knobs' quicksets
  document.querySelectorAll('.quickset-btn[data-knob="gate"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ms = Number(btn.dataset.value);
      state.target.tbSustainGap = state.tbSustainGap;
      state.target.gate = gatePositionFromMs(ms);
      transition(currentTransitionSec);
      if(window.markPresetDirty) markPresetDirty();
      if(currentTransitionSec <= 0.01){
        if(window.cueRecord) cueRecord('gate');
      } else if(window.cueRecordRaw && window.msToTc){
        cueRecordRaw(`transition gate ${ms}ms ${window.msToTc(currentTransitionSec*1000)}`);
      }
    });
  });
  $('showGateTime') && $('showGateTime').addEventListener('change', () => { render(); if(window.cueRecord) cueRecord('show-gate-time'); });
  $('clipAtGate') && $('clipAtGate').addEventListener('change', () => { render(); if(window.cueRecord) cueRecord('clip-at-gate'); });
  $('showPeakDischarge') && $('showPeakDischarge').addEventListener('change', () => { render(); if(window.cueRecord) cueRecord('show-peak-discharge'); });
  const LEG_CUE_KEY = { underlayA:'textbook-attack', underlayD:'textbook-decay', underlayS:'textbook-sustain', underlayR:'textbook-release', modelA:'actual-attack', modelD:'actual-decay', modelS:'actual-sustain', modelR:'actual-release' };
  ['underlayA','underlayD','underlayS','underlayR'].forEach(id => { $(id) && $(id).addEventListener('change', () => { render(); if(window.cueRecord) cueRecord(LEG_CUE_KEY[id]); }); });
  $('underlayShowAll') && $('underlayShowAll').addEventListener('click', () => { ['underlayA','underlayD','underlayS','underlayR'].forEach(id => { if($(id)) $(id).checked = true; }); render(); if(window.cueRecordRaw) cueRecordRaw('set textbook show-all'); });
  $('underlayHideAll') && $('underlayHideAll').addEventListener('click', () => { ['underlayA','underlayD','underlayS','underlayR'].forEach(id => { if($(id)) $(id).checked = false; }); render(); if(window.cueRecordRaw) cueRecordRaw('set textbook hide-all'); });
  $('underlayColor') && $('underlayColor').addEventListener('change', render);
  $('peakDischargeColor') && $('peakDischargeColor').addEventListener('input', render);
  $('showNewEffectiveLines') && $('showNewEffectiveLines').addEventListener('change', () => { render(); if(window.cueRecord) cueRecord('show-effective-lines'); });
  $('showNewStatedLines') && $('showNewStatedLines').addEventListener('change', () => { render(); if(window.cueRecord) cueRecord('show-stated-lines'); });
  ['modelA','modelD','modelS','modelR'].forEach(id => { $(id) && $(id).addEventListener('change', () => { render(); if(window.cueRecord) cueRecord(LEG_CUE_KEY[id]); }); });
  $('modelShowAll') && $('modelShowAll').addEventListener('click', () => { ['modelA','modelD','modelS','modelR'].forEach(id => { if($(id)) $(id).checked = true; }); render(); if(window.cueRecordRaw) cueRecordRaw('set actual show-all'); });
  $('modelHideAll') && $('modelHideAll').addEventListener('click', () => { ['modelA','modelD','modelS','modelR'].forEach(id => { if($(id)) $(id).checked = false; }); render(); if(window.cueRecordRaw) cueRecordRaw('set actual hide-all'); });
  $('clearBtn').addEventListener('click', () => { logEvent('ANIMATION', { action: 'clear' }); clearBlobAndMarker(); if(window.cueRecordRaw) cueRecordRaw('play-clear'); });
  $('playFromDecayBtn') && $('playFromDecayBtn').addEventListener('click', () => { if(window.hold) hold(getEffective().aT * 1000); });
  $('sloMo') && $('sloMo').addEventListener('change', () => { if($('sloMo').checked) audioCut(); if(window.cueRecord) cueRecord('slomo'); });
  $('persistEnabled') && $('persistEnabled').addEventListener('change', () => { if(window.cueRecord) cueRecord('persist'); });
  $('persistTime') && $('persistTime').addEventListener('change', () => { if(window.cueRecord) cueRecord('persist-time'); });

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
      if(currentTransitionSec <= 0.01){
        if(window.cueRecord) cueRecord(knob);
      } else if(window.cueRecordRaw && window.msToTc){
        const isTimeKnob = ['attack','decay','release','gate'].includes(knob);
        const valStr = isTimeKnob ? ms + 'ms' : String(ms);
        cueRecordRaw(`transition ${knob} ${valStr} ${window.msToTc(currentTransitionSec*1000)}`);
      }
    });
  });

  // Expert popup
  $('expertToggle').addEventListener('click', e => { e.stopPropagation(); isExpertOpen() ? closeExpert() : openExpert(); });
  $('expertPopup').addEventListener('click', e => e.stopPropagation());
  $('pendingToggle').addEventListener('click', e => { e.stopPropagation(); isPendingOpen() ? closePending() : openPending(); });
  $('pendingPopup').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if(isExpertOpen()) closeExpert(); if(isPendingOpen()) closePending(); });
  // Colours panel — non-blocking floating card, draggable by its header (opens centred)
  $('coloursBtn').addEventListener('click', () => { resetModalPos($('coloursModal')); $('coloursOverlay').style.display='flex'; });
  $('coloursClose').addEventListener('click', () => { $('coloursOverlay').style.display='none'; });
  makeDraggable($('coloursModal'), $('coloursHeader'));
  // Display panel — non-blocking floating card, draggable by its header (opens centred)
  $('displayBtn').addEventListener('click', () => { resetModalPos($('displayModal')); $('displayOverlay').style.display='flex'; });
  $('displayClose').addEventListener('click', () => { $('displayOverlay').style.display='none'; });
  makeDraggable($('displayModal'), $('displayHeader'));

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
      if(window.audioUpdateFrequency) audioUpdateFrequency(hz);
    }
  });
  ['frequencyMode','hpMode'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('change',syncAudioFilterType); });

  // Run initial sync passes
  syncHpModeEnabled();
  syncAnalogueCurve();
  syncConsoleScale();
}
