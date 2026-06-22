// ---- Blob animation state ----
let animationToken = 0;
let releaseStartPoint = null;
// glowPulseRaf is scoped inside the glow closure below
const INSTANT_PHASE_THRESHOLD = 0.0005; // treat phases shorter than this as instant
const PATH_BISECT_ITERATIONS  = 32;     // binary search depth for SVG path Y sampling
const GLOW_PULSE_PERIOD_MS    = 400;    // period of the sustain blob glow pulse animation
const MIN_RELEASE_MS          = 20;     // minimum release/decay animation duration in ms

// (Legacy point geometry helpers removed — effectivePos/statedPos now handle all phases)

// ---- Blob glow ----

function blobGlowRadius(){ return Math.max(0, Number(($('blobGlowRadius')&&$('blobGlowRadius').value)||8)); }

function applyBlobGlow(){
  const dot=$('dot'), dotS=$('dotStated'), feBlur=$('blobGlowBlur');
  const on=$('blobGlowEnabled')&&$('blobGlowEnabled').checked;
  if(on){
    if(feBlur) feBlur.setAttribute('stdDeviation', blobGlowRadius());
    if(dot) dot.setAttribute('filter','url(#blobGlow)');
    if(dotS) dotS.setAttribute('filter','url(#blobGlow)');
  } else {
    if(dot) dot.removeAttribute('filter');
    if(dotS) dotS.removeAttribute('filter');
  }
}

;(function(){
  let glowPulseRaf = null;

  function startGlowPulse(){
    stopGlowPulse();
    if(!$('blobGlowEnabled')||!$('blobGlowEnabled').checked) return;
    const feBlur=$('blobGlowBlur'); if(!feBlur) return;
    const t0=performance.now();
    function pulse(now){
      const r=blobGlowRadius();
      const f=(Math.sin((now-t0)/GLOW_PULSE_PERIOD_MS)+1)/2;
      feBlur.setAttribute('stdDeviation', r+f*r*2);
      glowPulseRaf=requestAnimationFrame(pulse);
    }
    glowPulseRaf=requestAnimationFrame(pulse);
  }

  function stopGlowPulse(){
    if(glowPulseRaf!==null){ cancelAnimationFrame(glowPulseRaf); glowPulseRaf=null; }
    const feBlur=$('blobGlowBlur');
    if(feBlur) feBlur.setAttribute('stdDeviation', blobGlowRadius());
  }

  window.startGlowPulse = startGlowPulse;
  window.stopGlowPulse  = stopGlowPulse;
})();

// ---- Path sampling ----

function getYFromPath(pathEl, targetX){
  if(!pathEl) return null;
  const len = pathEl.getTotalLength();
  if(len === 0) return null;
  let lo = 0, hi = len;
  for(let i = 0; i < PATH_BISECT_ITERATIONS; i++){
    const mid = (lo + hi) / 2;
    const p = pathEl.getPointAtLength(mid);
    if(p.x < targetX) lo = mid; else hi = mid;
  }
  return pathEl.getPointAtLength((lo + hi) / 2).y;
}

// ---- Dot and marker ----

function setDot(pt, visible=true){
  const dot=$('dot');
  if(!dot) return;
  if(!visible){ hideDot(); return; }
  dot.style.visibility='visible';
  dot.setAttribute('cx',pt.x);
  dot.setAttribute('cy', pt.y);
  dot.style.opacity='1';
  dot.style.fill = getComputedStyle(document.documentElement).getPropertyValue('--attackColor').trim() || '#ff0000';
  applyBlobGlow();
  state.dotLevel=pt.level;
  state.dotY=pt.y;
  setMeterLevel(pt.y);
}

function hideTapMarker(){
  const marker=$('tapMarker');
  if(marker) marker.style.opacity=0;
}

function setTapMarker(pt){
  const marker=$('tapMarker');
  if(!marker) return;
  if(!$('keepTapMarker') || !$('keepTapMarker').checked){ hideTapMarker(); return; }
  marker.setAttribute('cx',pt.x);
  marker.setAttribute('cy',pt.y);
  marker.style.opacity=1;
}

// ---- Release ----

function releaseFromCurrent(){
  logEvent('ANIMATION', { action: 'release' });

  // If the hold's unified t-clock is running, trigger release through it (not a separate animation)
  if(window._holdReleaseTrigger){
    window._holdReleaseTrigger();
    return;
  }

  // Legacy release path (for tap and other non-hold contexts)
  audioGateClose();
  animationToken++;
  const myAnimationToken = animationToken;
  const dot=$('dot'); dot.style.animation='none'; dot.style.opacity='1';
  cancelAnimationFrame(state.dotAnim);
  stopGlowPulse();
  hideDotStated();
  const e=getEffective();

  // Loud Decay OFF: no release phase — blob vanishes instantly.
  if(!e.releaseOn){ clearBlobAndMarker(); return; }

  const pts=computePoints();
  let startX = Number($('dot').getAttribute('cx'));
  const startY = Number($('dot').getAttribute('cy'));
  let startLevel;
  if(state.held && state.currentPhase === 'sustain'){
    startLevel = pts.e.s;
    state.releaseFromDecay = false;
  } else {
    startLevel = state.dotLevel;
    state.releaseFromDecay = (startLevel > pts.e.s);
  }
  releaseStartPoint = { x: startX, y: startY, level: startLevel };
  if($('textbookAdsr') && $('textbookAdsr').checked){
    const tb=tbComputeAnimPoints();
    const sY=tb.tbSustainEnd.y, fY=tb.tbReleaseEnd.y;
    // If blob is at or below sustain level (attack hasn't reached sustain yet, or below),
    // interpolate the x start position on the release slope at startY.
    // If blob is above sustain level (decay/sustain phase), snap to top of slope as before.
    let tbStart;
    if(startY >= sY && (fY - sY) > 0){
      const f0=clamp((startY - sY) / (fY - sY));
      tbStart={x: tb.tbSustainEnd.x + f0*(tb.tbReleaseEnd.x - tb.tbSustainEnd.x), y: startY};
    } else {
      tbStart={x: tb.tbSustainEnd.x, y: sY};
    }
    const end={x:tb.tbReleaseEnd.x, y:fY, level:0};
    const dur=Math.max(MIN_RELEASE_MS,e.rT*1000);
    const t0=performance.now();
    state.currentPhase='release';
    setDot({x:tbStart.x, y:tbStart.y, level:startLevel, phase:'sustain'}, true);
    function tbReleaseStep(now){
      if(myAnimationToken !== animationToken) return;
      const f=clamp((now-t0)/dur);
      const dotX=tbStart.x+(end.x-tbStart.x)*f;
      const linearY=tbStart.y+(end.y-tbStart.y)*f;
      const pt={x:dotX, y:linearY, level:startLevel*(1-f), phase:'release'};
      setDot(pt,true);
      if(f<1) state.dotAnim=requestAnimationFrame(tbReleaseStep);
      else { setDot(end,false); audioCut(); state.held=false; state.currentPhase='idle'; updateButtonStates(); }
    }
    requestAnimationFrame(tbReleaseStep);
    return;
  }
  const overrange = e.floor + e.scale > 1;
  const showClipped = $('showClipped') && $('showClipped').checked;
  const f_decay = overrange ? (pts.e.floor + pts.e.scale - 1) / pts.e.scale : 0;
  const ceilDecayX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f_decay;
  const peakForSlope = (showClipped && overrange)
    ? { x: ceilDecayX, y: yFor(1) }
    : overrange
      ? { x: pts.p1.x, y: yFor(1) }
      : pts.p1;
  const slopeX = pts.pS.x - peakForSlope.x;
  const slopeY = pts.pS.y - peakForSlope.y;
  const floorY = yFor(pts.e.floor);
  const remainingY = floorY - pts.pS.y;
  const tSlope = (slopeY !== 0) ? remainingY / slopeY : 1;
  // Land where the drawn release path (releaseInner) actually ends. With the analogue RC
  // release that is the horizontally-offset curve's floor point (right of the chord floor),
  // so the blob follows the curve all the way down and lands on it instead of snapping.
  // For non-analogue / overrange the path end equals the chord floor, so this is a no-op.
  let endX = pts.pS.x + slopeX * tSlope;
  const releaseEndEl = document.getElementById('releaseInner');
  if(e.releaseOn && releaseEndEl && releaseEndEl.getTotalLength() > 0){
    endX = releaseEndEl.getPointAtLength(releaseEndEl.getTotalLength()).x;
  }
  const end = { x: endX, y: floorY, level: 0 };
  const dur = Math.max(MIN_RELEASE_MS, e.dT * startLevel * 1000);
  // If gate ended before the release slope (mid-attack or before sustain), snap the
  // start position to the equivalent point on the release slope at startLevel.
  // This prevents the blob from traversing the attack or decay paths during release.
  if (startX < pts.pS.x) {
    const tEntry = (slopeY !== 0) ? (startY - pts.pS.y) / slopeY : 0;
    startX = pts.pS.x + slopeX * tEntry;
    releaseStartPoint.x = startX;
  }
  const t0=performance.now();
  state.currentPhase='release';
  function step(now){
    if (myAnimationToken !== animationToken) return;
    const f=clamp((now-t0)/dur);
    const dotX = startX + (end.x - startX) * f;
    const linearY = startY + (end.y - startY) * f;
    let sampledY = null;
    if(dotX < pts.p1.x){
      const attackPathEl = document.getElementById('attackInner');
      sampledY = attackPathEl ? getYFromPath(attackPathEl, dotX) : null;
    } else if(dotX < pts.pS.x){
      const decayPathEl = document.getElementById('decayInner');
      sampledY = decayPathEl ? getYFromPath(decayPathEl, dotX) : null;
    } else {
      const releasePathEl = document.getElementById('releaseInner');
      sampledY = releasePathEl ? getYFromPath(releasePathEl, dotX) : null;
    }
    const dotY = (sampledY !== null) ? sampledY : linearY;
    const currentLevel = startLevel*(1-f);
    const dotPhase = dotX < pts.pS.x ? (dotX < pts.p1.x ? 'attack' : 'decay') : 'release';
    setDot({x:dotX, y:dotY, level:currentLevel, phase:dotPhase}, true);
    if(f<1) state.dotAnim=requestAnimationFrame(step); else { setDot(end,false); audioCut(); state.held=false; state.currentPhase='idle'; updateButtonStates(); }
  }
  requestAnimationFrame(step);
}

// ---- Clear ----

function clearBlobAndMarker(){
  cancelAnimationFrame(state.dotAnim);
  stopGlowPulse();
  audioCut();
  $('dot').style.animation='none';
  hideDot();
  hideDotStated();
  hideTapMarker();
  state.held=false;
  state.currentPhase='idle';
  state.dotLevel=0;
  releaseStartPoint=null;
  state.releaseFromDecay=false;
  window._holdReleaseTrigger=null;
  updateButtonStates();
}

// ---- Tap and Hold ----

function tap(ms){
  logEvent('ANIMATION', { action: 'tap', ms: Number(ms) || 200 });
  if(state.currentPhase === 'hold' || state.currentPhase === 'sustain' || state.currentPhase === 'release') clearBlobAndMarker();
  releaseStartPoint=null;
  if(audioEnabled()){ initAudio(); audioGateOpen(); }
  animationToken++;
  const myAnimationToken = animationToken;
  cancelAnimationFrame(state.dotAnim);
  hideDot();
  hideDotStated();
  state.held = false;
  state.currentPhase = 'tap';
  updateButtonStates();

  const tapMs = Number(ms) || 200;
  const e = getEffective();
  let tPlay = 0;
  let prevNow = null;
  let releaseT;           // set when gate closes
  // Determine release mode: if gate closes during sustain, use sustain-origin; else gate-origin
  let releaseMode;        // set at gate close

  function step(now){
    if(myAnimationToken !== animationToken) return;
    if(prevNow !== null){
      tPlay += (now - prevNow) * animRate();
    }
    prevNow = now;

    // Auto-trigger release at gate time
    if(releaseT === undefined && tPlay >= tapMs){
      releaseT = tapMs;   // release starts exactly at gate time (not current tPlay which may overshoot)
      audioGateClose();
      // Determine release mode: if the blob is at sustain, use sustain-origin; else gate-origin
      const posAtGate = effectivePos(tapMs);
      releaseMode = posAtGate.phase === 'sustain' ? 'sustain' : 'gate';
      if(!e.releaseOn){
        // No release — end at gate point
        const effEnd = effectivePos(tapMs);
        const stEnd = statedPos(tapMs);
        setDot(effEnd, true);
        setDotStated(stEnd, true);
        // Brief flash then vanish
        audioCut();
        hideDot();
        hideDotStated();
        state.currentPhase = 'idle';
        state.dotLevel = 0;
        updateButtonStates();
        return;
      }
      state.currentPhase = 'release';
    }

    // Position both blobs
    const pos = effectivePos(tPlay, releaseT, releaseMode);
    const spos = statedPos(tPlay, releaseT, releaseMode);

    // Effective blob
    setDot(pos, true);
    const effVis = effLegVisible(pos.phase);
    $('dot').style.opacity = effVis ? '1' : '0';
    if(!effVis) $('dot').removeAttribute('filter');

    // Stated blob
    setDotStated(spos, true);
    const sVis = statedLegVisible(spos.phase);
    $('dotStated').style.opacity = sVis ? '1' : '0';
    if(!sVis) $('dotStated').removeAttribute('filter');

    // Release completion
    if(pos.done && spos.done){
      hideDot();
      hideDotStated();
      audioCut();
      state.currentPhase = 'idle';
      state.dotLevel = 0;
      updateButtonStates();
      return;
    }
    state.dotAnim = requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---- t-based effective position ----
// Given playback time t (ms since note-on), return {x, y, phase, level} on the effective curve.
// If releaseT is provided and t >= releaseT, the blob is in release phase, sampling releaseInner.
// x is geometric; y is sampled from the rendered path.
// releaseMode: 'sustain' = hold release from sustain (releaseInner), 'gate' = tap release from gate point (tapReleaseOrange)
function effectivePos(t, releaseT, releaseMode){
  const pts = computePoints(), e = pts.e;
  const tSec = t / 1000;
  let x, phase, level;

  // Release phase (if triggered)
  if(releaseT !== undefined && t >= releaseT){
    const relDurMs = Math.max(MIN_RELEASE_MS, e.rT * 1000);
    const rf = clamp((t - releaseT) / relDurMs);
    phase = 'release';
    // Shared x from elapsed release time — both blobs advance at the same pixel rate.
    const linearTimeOn = $('linearTime') && $('linearTime').checked;
    const elapsedRelSec = (t - releaseT) / 1000;
    if(releaseMode === 'gate'){
      // Gate-origin release: shared x from gateCloseX + time-mapped pixels
      const relTSec = releaseT / 1000;
      let gcX;
      if(e.aT > INSTANT_PHASE_THRESHOLD && relTSec <= e.aT){
        gcX = pts.p0.x + (pts.p1.x - pts.p0.x) * clamp(relTSec / e.aT);
      } else {
        const gfd = e.dT > INSTANT_PHASE_THRESHOLD ? clamp((relTSec - e.aT) / e.dT) : 1;
        gcX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * gfd;
      }
      if(gcX > pts.pS.x) gcX = pts.pS.x;
      x = gcX + timeToPixels(elapsedRelSec, linearTimeOn);
      const relEl = document.getElementById('tapReleaseOrange');
      let endX = gcX;
      if(relEl && relEl.getTotalLength() > 0){
        endX = relEl.getPointAtLength(relEl.getTotalLength()).x;
      }
      const done = x >= endX;
      if(done) x = endX;
      let y = null;
      if(relEl) y = getYFromPath(relEl, x);
      level = e.s * (1 - rf);
      if(y === null) y = yFor(e.floor + level * e.scale);
      return { x, y, phase, level, done };
    }
    // Sustain-origin release: shared x from releaseStartX + time-mapped pixels
    level = e.s * (1 - rf);
    const relEl = document.getElementById('releaseInner');
    const startX = pts.pEnd.x + graph.w * state.tbSustainGap;
    x = startX + timeToPixels(elapsedRelSec, linearTimeOn);
    let endX = startX;
    if(relEl && relEl.getTotalLength() > 0){
      endX = relEl.getPointAtLength(relEl.getTotalLength()).x;
    }
    const done = x >= endX;
    if(done) x = endX;
    let y = null;
    if(relEl) y = getYFromPath(relEl, x);
    if(y === null) y = yFor(e.floor + level * e.scale);
    return { x, y, phase, level, done };
  }

  // Attack phase
  if(e.aT > INSTANT_PHASE_THRESHOLD && tSec <= e.aT){
    const f = clamp(tSec / e.aT);
    x = pts.p0.x + (pts.p1.x - pts.p0.x) * f;
    level = f;
    phase = 'attack';
  } else {
    // Decay phase (until sustain level)
    const after = e.aT <= INSTANT_PHASE_THRESHOLD ? tSec : tSec - e.aT;
    const f = e.dT <= INSTANT_PHASE_THRESHOLD ? 1 : clamp(after / e.dT);
    level = 1 - f;
    if(level <= e.s + 0.0001){
      // Sustain — park at sustain point
      x = pts.pS.x;
      level = e.s;
      phase = 'sustain';
    } else {
      x = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f;
      phase = 'decay';
    }
  }
  // Sample rendered path for y
  let y;
  if(phase === 'sustain'){
    const decayPathEl = document.getElementById('decayInner');
    y = decayPathEl ? getYFromPath(decayPathEl, x) : yFor(e.floor + level * e.scale);
    if(y === null) y = yFor(e.floor + level * e.scale);
  } else {
    const pathId = phase === 'attack' ? 'attackInner' : 'decayInner';
    const pathEl = document.getElementById(pathId);
    y = pathEl ? getYFromPath(pathEl, x) : yFor(e.floor + level * e.scale);
    if(y === null) y = yFor(e.floor + level * e.scale);
  }
  return { x, y, phase, level };
}

// ---- t-based stated (textbook) position ----
// Same t and phase logic as effectivePos, but samples underlay paths for y and parks
// at the UNCAPPED stated sustain level (not the mimic-80% level).
// releaseMode: 'sustain' = hold release (underlayRelease), 'gate' = tap release (gateStatedRelease)
function statedPos(t, releaseT, releaseMode){
  const pts = computePoints(), e = pts.e;
  const tSec = t / 1000;
  let x, phase, level;

  // Release phase (if triggered)
  if(releaseT !== undefined && t >= releaseT){
    const relDurMs = Math.max(MIN_RELEASE_MS, e.rT * 1000);
    const rf = clamp((t - releaseT) / relDurMs);
    phase = 'release';
    // Shared x from elapsed release time — same pixel rate as effectivePos for vertical alignment.
    const linearTimeOn = $('linearTime') && $('linearTime').checked;
    const elapsedRelSec = (t - releaseT) / 1000;
    if(releaseMode === 'gate'){
      // Gate-origin release: shared x from gateCloseX + time-mapped pixels
      const relTSec = releaseT / 1000;
      let gcX;
      if(e.aT > INSTANT_PHASE_THRESHOLD && relTSec <= e.aT){
        gcX = pts.p0.x + (pts.p1.x - pts.p0.x) * clamp(relTSec / e.aT);
      } else {
        const gfd = e.dT > INSTANT_PHASE_THRESHOLD ? clamp((relTSec - e.aT) / e.dT) : 1;
        gcX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * gfd;
      }
      if(gcX > pts.pS.x) gcX = pts.pS.x;
      x = gcX + timeToPixels(elapsedRelSec, linearTimeOn);
      const relEl = document.getElementById('gateStatedRelease');
      let endX = gcX;
      if(relEl && relEl.getTotalLength && relEl.getTotalLength() > 0){
        endX = relEl.getPointAtLength(relEl.getTotalLength()).x;
      }
      const done = x >= endX;
      if(done) x = endX;
      let y = null;
      if(relEl && relEl.getTotalLength && relEl.getTotalLength() > 0) y = getYFromPath(relEl, x);
      level = e.s * (1 - rf);
      if(y === null) y = yFor(e.floor + level * e.scale);
      return { x, y, phase, level, done };
    }
    // Sustain-origin release: shared x from release start + time-mapped pixels
    level = e.s * (1 - rf);
    const relEl = document.getElementById('underlayRelease');
    const startX = pts.pEnd.x + graph.w * state.tbSustainGap;
    x = startX + timeToPixels(elapsedRelSec, linearTimeOn);
    let endX = startX;
    if(relEl && relEl.getTotalLength() > 0){
      endX = relEl.getPointAtLength(relEl.getTotalLength()).x;
    }
    const done = x >= endX;
    if(done) x = endX;
    let y = null;
    if(relEl) y = getYFromPath(relEl, x);
    if(y === null) y = yFor(e.floor + level * e.scale);
    return { x, y, phase, level, done };
  }

  // Attack phase
  if(e.aT > INSTANT_PHASE_THRESHOLD && tSec <= e.aT){
    const f = clamp(tSec / e.aT);
    x = pts.p0.x + (pts.p1.x - pts.p0.x) * f;
    level = f;
    phase = 'attack';
  } else {
    // Decay phase — full stated decay traversal to pts.pEnd.x (park when f >= 1)
    const after = e.aT <= INSTANT_PHASE_THRESHOLD ? tSec : tSec - e.aT;
    const f = e.dT <= INSTANT_PHASE_THRESHOLD ? 1 : clamp(after / e.dT);
    level = 1 - f;
    if(f >= 1){
      // Stated sustain park — at the full decay endpoint, uncapped sustain y
      x = pts.pEnd.x;
      level = e.s;
      phase = 'sustain';
    } else {
      x = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f;
      phase = 'decay';
    }
  }
  // Sample underlay paths for y
  let y;
  if(phase === 'sustain'){
    const udEl = document.getElementById('underlayDecay');
    y = udEl ? getYFromPath(udEl, x) : null;
    if(y === null) y = yFor(e.floor + level * e.scale);
  } else {
    const pathId = phase === 'attack' ? 'underlayAttack' : 'underlayDecay';
    const pathEl = document.getElementById(pathId);
    y = pathEl ? getYFromPath(pathEl, x) : null;
    if(y === null) y = yFor(e.floor + level * e.scale);
  }
  return { x, y, phase, level };
}

// ---- Stated blob helpers ----
function setDotStated(pt, visible){
  const el = $('dotStated');
  if(!el) return;
  if(!visible){ hideDotStated(); return; }
  el.style.visibility = 'visible';
  el.setAttribute('cx', pt.x);
  el.setAttribute('cy', pt.y);
  el.style.opacity = '1';
  // Colour from underlay picker
  const ulCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
  el.style.fill = ulCol;
  setMeterLevelStated(pt.y);
}

function hideDotStated(){
  const el = $('dotStated');
  if(el){ el.style.opacity = 0; el.style.visibility = 'hidden'; el.removeAttribute('filter'); }
  setMeterLevelStated(graph.y0);
}

// ---- Per-leg blob visibility ----
// Returns true if the effective blob's current phase's leg is on.
function effLegVisible(phase){
  switch(phase){
    case 'attack':  return $('modelA') ? $('modelA').checked : true;
    case 'decay':   return $('modelD') ? $('modelD').checked : true;
    case 'sustain': return $('modelS') ? $('modelS').checked : true;
    case 'release': return $('modelR') ? $('modelR').checked : true;
    default: return true;
  }
}
// Returns true if the stated blob's current phase's leg is on.
function statedLegVisible(phase){
  switch(phase){
    case 'attack':  return $('underlayA') ? $('underlayA').checked : true;
    case 'decay':   return $('underlayD') ? $('underlayD').checked : true;
    case 'sustain': return $('underlayS') ? $('underlayS').checked : true;
    case 'release': return $('underlayR') ? $('underlayR').checked : true;
    default: return true;
  }
}

// ---- Slo-mo rate ----
function animRate(){ return ($('sloMo') && $('sloMo').checked) ? 0.1 : 1; }

function hold(){
  logEvent('ANIMATION', { action: 'hold' });
  releaseStartPoint = null;
  animationToken++;
  const myAnimationToken = animationToken;
  if(audioEnabled()){ initAudio(); audioGateOpen(); }
  cancelAnimationFrame(state.dotAnim);
  hideDot();
  hideDotStated();
  state.held = true;
  state.currentPhase = 'hold';
  updateButtonStates();

  // Unified t-based clock: runs through attack→decay→sustain→release
  let tPlay = 0;
  let prevNow = null;
  let releaseT;           // undefined until release triggered; then the tPlay at which release began
  let glowStarted = false;

  // Called by releaseFromCurrent when the hold is on the unified clock
  window._holdReleaseTrigger = function(){
    if(releaseT !== undefined) return; // already releasing
    releaseT = tPlay;
    audioGateClose();
    stopGlowPulse();
    state.currentPhase = 'release';
    updateButtonStates();
  };

  function step(now){
    if(myAnimationToken !== animationToken){ window._holdReleaseTrigger = null; return; }
    if(prevNow !== null){
      const realDelta = now - prevNow;
      tPlay += realDelta * animRate();
    }
    prevNow = now;

    // Position both blobs
    const pos = effectivePos(tPlay, releaseT, 'sustain');
    const spos = statedPos(tPlay, releaseT, 'sustain');

    // Effective blob
    setDot(pos, true);
    const effVis = effLegVisible(pos.phase);
    $('dot').style.opacity = effVis ? '1' : '0';
    if(!effVis) $('dot').removeAttribute('filter');

    // Stated blob
    setDotStated(spos, true);
    const sVis = statedLegVisible(spos.phase);
    $('dotStated').style.opacity = sVis ? '1' : '0';
    if(!sVis) $('dotStated').removeAttribute('filter');

    // Glow at sustain (both blobs parked, before release)
    if(releaseT === undefined && pos.phase === 'sustain' && spos.phase === 'sustain'){
      if(!glowStarted){ startGlowPulse(); glowStarted = true; }
      if(effVis) applyBlobGlow();
      if(!effVis) $('dot').removeAttribute('filter');
      if(!sVis) $('dotStated').removeAttribute('filter');
      state.currentPhase = 'sustain';
    } else if(releaseT === undefined){
      // At least one blob still in attack/decay — glow individual sustain arrivals
      if(pos.phase === 'sustain' && effVis) applyBlobGlow();
      if(spos.phase === 'sustain' && sVis) applyBlobGlow();
    }

    // Release completion: both blobs done
    if(pos.done && spos.done){
      hideDot();
      hideDotStated();
      audioCut();
      state.held = false;
      state.currentPhase = 'idle';
      state.dotLevel = 0;
      window._holdReleaseTrigger = null;
      updateButtonStates();
      return;
    }

    state.dotAnim = requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
