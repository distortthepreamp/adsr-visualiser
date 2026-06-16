// ---- Kiosk overlay — panel image with live knob pointer rendering ----

const panelImgLoudness = new Image();
panelImgLoudness.src = 'images/panel-loudness.png';
const panelImgFilter = new Image();
panelImgFilter.src = 'images/panel-filter.png';
panelImgLoudness.addEventListener('load', () => { if(kioskOpen) drawKiosk(); });
panelImgFilter.addEventListener('load',   () => { if(kioskOpen) drawKiosk(); });

const KIOSK_KNOBS = [
  { id:'cutoff',   x:280, y:371,  getVal:()=> state.floor, curve: false, modes: ['filter']   },
  { id:'amount',   x:651, y:371,  getVal:()=> state.scale, curve: false, modes: ['filter']   },
  { id:'attackF',  x:280, y:618,  getVal:()=> state.a,     curve: true,  modes: ['filter']   },
  { id:'decayF',   x:466, y:618,  getVal:()=> state.d,     curve: true,  modes: ['filter']   },
  { id:'sustainF', x:651, y:618,  getVal:()=> state.s,     curve: false, modes: ['filter']   },
  { id:'attack',   x:280, y:864,  getVal:()=> state.a,     curve: true,  modes: ['loudness'] },
  { id:'decay',    x:466, y:864,  getVal:()=> state.d,     curve: true,  modes: ['loudness'] },
  { id:'sustain',  x:651, y:864,  getVal:()=> state.s,     curve: false, modes: ['loudness'] },
];

const KNOB_ANGLE_CURVE = [
  { p: 0.00, deg: 210 },
  { p: 0.08, deg: 240 },
  { p: 0.25, deg: 270 },
  { p: 0.42, deg: 330 },
  { p: 0.58, deg: 390 },  // 30 + 360 — avoids wrap-around discontinuity
  { p: 0.75, deg: 420 },  // 60 + 360
  { p: 0.90, deg: 465 },  // 105 + 360
  { p: 1.00, deg: 510 },  // 150 + 360
];

function posToAngle(p) {
  for (let i = 1; i < KNOB_ANGLE_CURVE.length; i++) {
    const lo = KNOB_ANGLE_CURVE[i-1], hi = KNOB_ANGLE_CURVE[i];
    if (p <= hi.p) {
      const t = (p - lo.p) / (hi.p - lo.p);
      return lo.deg + t * (hi.deg - lo.deg);
    }
  }
  return KNOB_ANGLE_CURVE[KNOB_ANGLE_CURVE.length - 1].deg;
}

const KNOB_RADIUS    = 50;
const POINTER_LENGTH = 61;

const SWITCH_LEFT_X   = 53;
const SWITCH_CENTRE_X = 114;
const SWITCH_RIGHT_X  = 175;
const SWITCH_ARROW_H  = 45;

function drawSwitch(ctx, x, y, on, color) {
  ctx.beginPath();
  if (on) {
    ctx.moveTo(SWITCH_CENTRE_X + (SWITCH_RIGHT_X - SWITCH_CENTRE_X) * 0.9, y);
    ctx.lineTo(SWITCH_CENTRE_X, y - SWITCH_ARROW_H/2);
    ctx.lineTo(SWITCH_CENTRE_X + (SWITCH_RIGHT_X - SWITCH_CENTRE_X) * 0.2, y);
    ctx.lineTo(SWITCH_CENTRE_X, y + SWITCH_ARROW_H/2);
  } else {
    ctx.moveTo(SWITCH_CENTRE_X - (SWITCH_CENTRE_X - SWITCH_LEFT_X) * 0.9, y);
    ctx.lineTo(SWITCH_CENTRE_X, y - SWITCH_ARROW_H/2);
    ctx.lineTo(SWITCH_CENTRE_X - (SWITCH_CENTRE_X - SWITCH_LEFT_X) * 0.2, y);
    ctx.lineTo(SWITCH_CENTRE_X, y + SWITCH_ARROW_H/2);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawKnobPointer(ctx, cx, cy, angleDeg, color) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  const offset = KNOB_RADIUS - POINTER_LENGTH; // = -11

  const tipX = cx + Math.cos(rad) * (POINTER_LENGTH + offset);
  const tipY = cy + Math.sin(rad) * (POINTER_LENGTH + offset);

  const perpRad = rad + Math.PI / 2;
  const halfH = 22.5;
  const backLeftX  = cx + Math.cos(rad) * offset + Math.cos(perpRad) * halfH;
  const backLeftY  = cy + Math.sin(rad) * offset + Math.sin(perpRad) * halfH;
  const backRightX = cx + Math.cos(rad) * offset - Math.cos(perpRad) * halfH;
  const backRightY = cy + Math.sin(rad) * offset - Math.sin(perpRad) * halfH;

  const notchX = cx + Math.cos(rad) * (POINTER_LENGTH * 0.2 + offset);
  const notchY = cy + Math.sin(rad) * (POINTER_LENGTH * 0.2 + offset);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backLeftX, backLeftY);
  ctx.lineTo(notchX, notchY);
  ctx.lineTo(backRightX, backRightY);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawKiosk(){
  const canvas = document.getElementById('kioskCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const filterOn = $('frequencyMode') && $('frequencyMode').checked;
  const panelImg = filterOn ? panelImgFilter : panelImgLoudness;
  ctx.drawImage(panelImg, 0, 0, canvas.width, canvas.height);

  const _cs = getComputedStyle(document.documentElement);
  const loudnessColor     = _cs.getPropertyValue('--kioskLoudnessColor').trim()     || '#F20D0D';
  const filterColor       = _cs.getPropertyValue('--kioskFilterColor').trim()       || '#0DCAF2';
  const cutoffAmountColor = _cs.getPropertyValue('--kioskCutoffAmountColor').trim() || '#E5F20D';

  const glowEnabled = $('kioskKnobGlow') && $('kioskKnobGlow').checked;
  const glowRadius  = parseInt($('kioskKnobGlowRadius') && $('kioskKnobGlowRadius').value) || 40;

  // Expire glow if its window has passed
  if (performance.now() >= activeKioskGlowUntil) activeKioskKnob = null;
  const nowGlowing = activeKioskKnob !== null && performance.now() < activeKioskGlowUntil;

  function drawKnobCircle(x, y, color, param) {
    const glow = nowGlowing && activeKioskKnob.includes(param);
    if (glow && glowEnabled) {
      ctx.shadowColor = color;
      ctx.shadowBlur  = glowRadius;
    }
    ctx.beginPath();
    ctx.arc(x, y, KNOB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (!filterOn) {
    drawKnobCircle(280, 864, loudnessColor,     'attack');
    drawKnobCircle(466, 864, loudnessColor,     'decay');
    drawKnobCircle(651, 864, loudnessColor,     'sustain');
  } else {
    drawKnobCircle(280, 618, filterColor,       'attack');
    drawKnobCircle(466, 618, filterColor,       'decay');
    drawKnobCircle(651, 618, filterColor,       'sustain');
    drawKnobCircle(280, 371, cutoffAmountColor, 'cutoff');
    drawKnobCircle(651, 371, cutoffAmountColor, 'amount');
  }

  // Compute time-based eased angles for attack and decay
  const now = performance.now();
  const attackT = kioskAttackTransDur > 0 ? Math.min(1, (now - kioskAttackTransStart) / kioskAttackTransDur) : 1;
  const decayT  = kioskDecayTransDur  > 0 ? Math.min(1, (now - kioskDecayTransStart)  / kioskDecayTransDur)  : 1;
  const currentAttackAngle = attackT >= 1
    ? posToAngle(Math.max(0, Math.min(1, state.a)))
    : kioskAttackStart + easeInOut(attackT) * (kioskAttackTarget - kioskAttackStart);
  const currentDecayAngle = decayT >= 1
    ? posToAngle(Math.max(0, Math.min(1, state.d)))
    : kioskDecayStart + easeInOut(decayT) * (kioskDecayTarget - kioskDecayStart);
  lastDrawnAttackAngle = currentAttackAngle;
  lastDrawnDecayAngle  = currentDecayAngle;

  KIOSK_KNOBS.forEach(knob => {
    if (knob.modes.includes('filter')   && !filterOn) return;
    if (knob.modes.includes('loudness') &&  filterOn) return;
    const val = Math.max(0, Math.min(1, knob.getVal()));
    // curve knobs use time-based eased angle; linear knobs use 210°→510° sweep
    // angle convention: 0° = 6 o'clock, increasing clockwise
    let angleDeg;
    if (knob.curve) {
      angleDeg = (knob.id === 'attack' || knob.id === 'attackF') ? currentAttackAngle : currentDecayAngle;
    } else {
      angleDeg = 210 + val * 300;
    }
    drawKnobPointer(ctx, knob.x, knob.y, angleDeg);
  });

  // Switch indicators
  const loudDecayOn = !!($('loudDecay') && $('loudDecay').checked);
  const hpModeOn    = !!($('hpMode')    && $('hpMode').checked);
  if (filterOn)  drawSwitch(ctx, 114, 248, hpModeOn,    'white');  // Filter Mode Lo/Hi
  if (filterOn)  drawSwitch(ctx, 114, 744, loudDecayOn, 'black');  // Filter Decay
  if (!filterOn) drawSwitch(ctx, 114, 864, loudDecayOn, 'black');  // Loud Decay
}

let kioskAttackStart = 210, kioskAttackTarget = 210, kioskAttackTransStart = 0, kioskAttackTransDur = 0;
let kioskDecayStart  = 210, kioskDecayTarget  = 210, kioskDecayTransStart  = 0, kioskDecayTransDur  = 0;
let lastDrawnAttackAngle = 210;
let lastDrawnDecayAngle  = 210;
let activeKioskKnob   = null; // array of param strings currently glowing, or null
let activeKioskGlowUntil = 0;
let kioskGlowRaf = null;

// Keeps drawKiosk() running until 100ms past activeKioskGlowUntil so the
// expiry check inside drawKiosk() has a chance to fire and clear the glow.
function startKioskGlowLoop() {
  if (kioskGlowRaf !== null) cancelAnimationFrame(kioskGlowRaf);
  function tick() {
    kioskGlowRaf = null;
    if (!kioskOpen) return;
    drawKiosk();
    if (performance.now() < activeKioskGlowUntil + 100) {
      kioskGlowRaf = requestAnimationFrame(tick);
    }
  }
  kioskGlowRaf = requestAnimationFrame(tick);
}

window.kioskBeginTransition = function(fromA, toA, fromD, toD, durMs) {
  const now = performance.now();
  kioskAttackStart = lastDrawnAttackAngle;
  kioskDecayStart  = lastDrawnDecayAngle;
  kioskAttackTarget    = posToAngle(Math.max(0, Math.min(1, toA)));
  kioskDecayTarget     = posToAngle(Math.max(0, Math.min(1, toD)));
  kioskAttackTransStart = now;
  kioskDecayTransStart  = now;
  kioskAttackTransDur   = durMs;
  kioskDecayTransDur    = durMs;
  // Track which knobs are actually changing
  const changing = [];
  if (Math.abs(toA - fromA) > 0.0001) changing.push('attack');
  if (Math.abs(toD - fromD) > 0.0001) changing.push('decay');
  if (changing.length > 0) {
    activeKioskKnob = changing;
    activeKioskGlowUntil = now + durMs + 1000;
    startKioskGlowLoop();
  }
};

// Called by cue list / quick-sets for sustain, cutoff, amount transitions
window.kioskNotifyKnob = function(param, durMs) {
  activeKioskKnob = [param];
  activeKioskGlowUntil = performance.now() + durMs + 1000;
  startKioskGlowLoop();
};

let kioskOpen = false;

function openKiosk(){
  kioskOpen = true;
  const overlay = document.getElementById('kioskOverlay');
  if(overlay) overlay.style.display = 'flex';
  document.body.classList.add('kiosk-open');
  const img = ($('frequencyMode') && $('frequencyMode').checked) ? panelImgFilter : panelImgLoudness;
  if(img.complete) {
    drawKiosk();
  } else {
    img.addEventListener('load', drawKiosk, { once: true });
  }
}

function closeKiosk(){
  kioskOpen = false;
  const overlay = document.getElementById('kioskOverlay');
  if(overlay) overlay.style.display = 'none';
  document.body.classList.remove('kiosk-open');
}

function toggleKiosk(){
  kioskOpen ? closeKiosk() : openKiosk();
}

window.kioskDrawIfOpen = function(){
  if(kioskOpen) drawKiosk();
};

// Click outside the panel to close
(function(){
  const overlay = document.getElementById('kioskOverlay');
  if(overlay) overlay.addEventListener('click', e => { if(e.target === overlay) closeKiosk(); });
})();
