// ---- Kiosk overlay — panel image with live knob pointer rendering ----

const KIOSK_KNOBS = [
  { id:'cutoff',   x:280, y:371,  getVal:()=> state.floor, curve: false },
  { id:'amount',   x:651, y:371,  getVal:()=> state.scale, curve: false },
  { id:'attackF',  x:280, y:618,  getVal:()=> state.a,     curve: true  },
  { id:'decayF',   x:466, y:618,  getVal:()=> state.d,     curve: true  },
  { id:'sustainF', x:651, y:618,  getVal:()=> state.s,     curve: false },
  { id:'attack',   x:280, y:864,  getVal:()=> state.a,     curve: true  },
  { id:'decay',    x:466, y:864,  getVal:()=> state.d,     curve: true  },
  { id:'sustain',  x:651, y:864,  getVal:()=> state.s,     curve: false },
];

const KNOB_ANGLE_CURVE = [
  { p: 0.00, deg: 210 },
  { p: 0.08, deg: 240 },
  { p: 0.25, deg: 270 },
  { p: 0.42, deg: 330 },
  { p: 0.58, deg:  30 },
  { p: 0.75, deg:  60 },
  { p: 0.90, deg: 105 },
  { p: 1.00, deg: 150 },
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

function drawKnobPointer(ctx, cx, cy, angleDeg) {
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
  ctx.fillStyle = 'white';
  ctx.fill();
}

function drawKiosk(){
  const canvas = document.getElementById('kioskCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  KIOSK_KNOBS.forEach(knob => {
    const val = Math.max(0, Math.min(1, knob.getVal()));
    // curve knobs use piecewise angle table; linear knobs use 210°→510° sweep
    // angle convention: 0° = 6 o'clock, increasing clockwise
    const angleDeg = knob.curve
      ? posToAngle(val)
      : 210 + val * 300;
    drawKnobPointer(ctx, knob.x, knob.y, angleDeg);
  });

  // Switch indicators
  const loudDecayOn = !!($('loudDecay') && $('loudDecay').checked);
  const hpModeOn    = !!($('hpMode')    && $('hpMode').checked);
  drawSwitch(ctx, 114, 248, hpModeOn,    'white');  // Filter Mode Lo/Hi
  drawSwitch(ctx, 114, 744, loudDecayOn, 'black');  // Filter Decay
  drawSwitch(ctx, 114, 864, loudDecayOn, 'black');  // Loud Decay
  drawSwitch(ctx, 114, 371, false, 'white');        // Filter Modulation (static)
  drawSwitch(ctx, 114, 495, false, 'white');        // Keyboard Control 1 (static)
  drawSwitch(ctx, 114, 618, false, 'white');        // Keyboard Control 2 (static)

  // Filter Emphasis — static at zero
  drawKnobPointer(ctx, 466, 371, 210);
}

let kioskOpen = false;

function openKiosk(){
  kioskOpen = true;
  const overlay = document.getElementById('kioskOverlay');
  if(overlay) overlay.style.display = 'flex';
  drawKiosk();
}

function closeKiosk(){
  kioskOpen = false;
  const overlay = document.getElementById('kioskOverlay');
  if(overlay) overlay.style.display = 'none';
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
