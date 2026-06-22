// ---- Blob animation state ----
let animationToken = 0;
let releaseStartPoint = null;
// glowPulseRaf is scoped inside the glow closure below
const INSTANT_PHASE_THRESHOLD = 0.0005; // treat phases shorter than this as instant
const PATH_BISECT_ITERATIONS  = 32;     // binary search depth for SVG path Y sampling
const GLOW_PULSE_PERIOD_MS    = 400;    // period of the sustain blob glow pulse animation
const MIN_RELEASE_MS          = 20;     // minimum release/decay animation duration in ms

// ---- Point geometry helpers ----

function pointOnAttackDecay(ms){
  const pts=computePoints(), e=pts.e; const t=ms/1000;

  if(e.aT > INSTANT_PHASE_THRESHOLD && t <= e.aT){
    const f=clamp(t/e.aT);
    return { x:pts.p0.x+(pts.p1.x-pts.p0.x)*f, y:pts.p0.y+(pts.p1.y-pts.p0.y)*f, level:f, phase:'attack' };
  }

  const after = e.aT <= INSTANT_PHASE_THRESHOLD ? t : t-e.aT;
  const f=e.dT<=INSTANT_PHASE_THRESHOLD ? 1 : clamp(after/e.dT);
  const level=1-f;
  const phase = level <= e.s + .0001 ? 'sustain' : 'decay';
  return { x:pts.p1.x+(pts.pEnd.x-pts.p1.x)*f, y:yFor(e.floor+level*e.scale), level, phase };
}

// Gate-high behaviour: attack, then decay only until the sustain level.
// If the gate is still high after that, the blob parks at the sustain intersection.
function pointWhileGateHigh(ms){
  const pts=computePoints(), e=pts.e;
  const pt = pointOnAttackDecay(ms);
  if(pt.phase === 'sustain' || (pt.phase !== 'attack' && pt.level <= e.s + .0001)){
    return { x:pts.pS.x, y:pts.pS.y, level:e.s, phase:'decay' };
  }
  return pt;
}

// Sample the actual rendered decay curve y at the sustain park x, so the blob
// doesn't jump in analogue curve mode where pts.pS.y is geometrically computed.
function sampledSustainPoint(pt){
  if(pt.phase !== 'sustain') return pt;
  const decayPathEl = document.getElementById('decayInner');
  const sampledY = decayPathEl ? getYFromPath(decayPathEl, pt.x) : pt.y;
  return { x: pt.x, y: sampledY, level: pt.level, phase: 'sustain' };
}

// Gate-high point for textbook mode: attack to peak, decay to sustain level (not floor).
function pointWhileGateHighTextbook(ms){
  const tb=tbComputeAnimPoints();
  const e=tb.e;
  const t=ms/1000;
  const floorY=yFor(e.floor);
  if(e.aT>INSTANT_PHASE_THRESHOLD && t<=e.aT){
    const f=clamp(t/e.aT);
    return {x:graph.x0+(tb.tbAttackEnd.x-graph.x0)*f, y:floorY+(tb.tbAttackEnd.y-floorY)*f, level:f, phase:'attack'};
  }
  const afterAttack=e.aT<=INSTANT_PHASE_THRESHOLD?t:t-e.aT;
  const f=e.dT<=INSTANT_PHASE_THRESHOLD?1:clamp(afterAttack/e.dT);
  if(f>=1) return {x:tb.tbDecayEnd.x, y:tb.tbDecayEnd.y, level:e.s, phase:'sustain'};
  const level=1-f*(1-e.s);
  return {
    x:tb.tbAttackEnd.x+(tb.tbDecayEnd.x-tb.tbAttackEnd.x)*f,
    y:tb.tbAttackEnd.y+(tb.tbDecayEnd.y-tb.tbAttackEnd.y)*f,
    level, phase:'decay'
  };
}

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
  let dotY = pt.y;
  if(pt.phase === 'attack' || pt.phase === 'decay' || pt.phase === 'release'){
    const pathId = pt.phase === 'attack' ? 'attackInner' : pt.phase === 'decay' ? 'decayInner' : 'releaseInner';
    const pathEl = document.getElementById(pathId);
    if(pathEl){
      const sampled = getYFromPath(pathEl, pt.x);
      if(sampled !== null) dotY = sampled;
    }
  }
  dot.setAttribute('cy', dotY);
  dot.style.opacity='1';
  dot.style.fill = getComputedStyle(document.documentElement).getPropertyValue('--attackColor').trim() || '#ff0000';
  applyBlobGlow();
  state.dotLevel=pt.level;
  setMeterLevel(pt.level);
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
  if(releaseEndEl && releaseEndEl.getTotalLength() > 0){
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
  updateButtonStates();
}

// ---- Tap and Hold ----

function tap(ms){
  logEvent('ANIMATION', { action: 'tap', ms: Number(ms) || 200 });
  if(state.currentPhase === 'hold' || state.currentPhase === 'sustain') clearBlobAndMarker();
  releaseStartPoint=null;
  hideDot();
  hideTapMarker();
  if(audioEnabled()){ initAudio(); audioGateOpen(); }
  animationToken++;
  const myAnimationToken = animationToken;
  cancelAnimationFrame(state.dotAnim);
  const tapMs=Number(ms)||200;
  const t0=performance.now();
  state.held=false;
  state.currentPhase='tap';
  updateButtonStates();
  if($('textbookAdsr') && $('textbookAdsr').checked){
    function tbTapStep(now){
      if(myAnimationToken !== animationToken) return;
      const elapsed=now-t0;
      if(elapsed < tapMs){
        const pt=pointWhileGateHighTextbook(elapsed);
        setDot(pt.phase==='sustain'?{x:pt.x,y:pt.y,level:pt.level,phase:'decay'}:pt, true);
        state.dotAnim=requestAnimationFrame(tbTapStep);
      } else {
        const landing=pointWhileGateHighTextbook(tapMs);
        const landPt=landing.phase==='sustain'?{x:landing.x,y:landing.y,level:landing.level,phase:'decay'}:landing;
        setDot(landPt, true);
        releaseFromCurrent();
      }
    }
    requestAnimationFrame(tbTapStep);
    return;
  }
  function step(now){
    if (myAnimationToken !== animationToken) return;
    const elapsed=now-t0;
    if(elapsed < tapMs){ setDot(sampledSustainPoint(pointWhileGateHigh(elapsed)), true); state.dotAnim=requestAnimationFrame(step); }
    else {
      const landing=sampledSustainPoint(pointWhileGateHigh(tapMs));
      setDot(landing, true);
      const e=getEffective();
      if(!e.releaseOn){ setTapMarker({x: Number($('dot').getAttribute('cx')), y: Number($('dot').getAttribute('cy')), level: landing.level}); }
      if(e.releaseOn){
        releaseFromCurrent();
      } else {
        cancelAnimationFrame(state.dotAnim);
        audioCut();
        hideDot();
        state.held=false;
        state.currentPhase='idle';
        state.dotLevel=landing.level;
        updateButtonStates();
      }
    }
  }
  requestAnimationFrame(step);
}

// ---- t-based effective position ----
// Given playback time t (ms since note-on), return {x, y, phase, level} on the effective curve.
// x is geometric; y is sampled from the rendered path.
function effectivePos(t){
  const pts = computePoints(), e = pts.e;
  const tSec = t / 1000;
  let x, phase, level;
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
function statedPos(t){
  const pts = computePoints(), e = pts.e;
  const tSec = t / 1000;
  let x, phase, level;
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
}

function hideDotStated(){
  const el = $('dotStated');
  if(el){ el.style.opacity = 0; el.style.visibility = 'hidden'; el.removeAttribute('filter'); }
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

  // t-based clock: t = playback time in ms, advanced by (realDelta * rate) each frame
  let tPlay = 0;
  let prevNow = null;
  let effParked = false;
  let statedParked = false;

  function step(now){
    if(myAnimationToken !== animationToken) return;
    if(prevNow !== null){
      const realDelta = now - prevNow;
      tPlay += realDelta * animRate();
    }
    prevNow = now;

    // Effective blob
    if(!effParked){
      const pos = effectivePos(tPlay);
      setDot(pos, true);
      if(pos.phase === 'sustain'){
        $('dot').style.animation = 'none';
        startGlowPulse();
        effParked = true;
      }
    }

    // Stated blob
    if(!statedParked){
      const spos = statedPos(tPlay);
      setDotStated(spos, true);
      if(spos.phase === 'sustain'){
        applyBlobGlow();
        statedParked = true;
      }
    }

    // Both parked → enter sustain state, stop loop
    if(effParked && statedParked){
      state.currentPhase = 'sustain';
      updateButtonStates();
      return;
    }
    state.dotAnim = requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
