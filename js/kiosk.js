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
const POINTER_LENGTH = 40;

function drawKiosk(){
  const canvas = document.getElementById('kioskCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 6;
  ctx.lineCap     = 'round';

  KIOSK_KNOBS.forEach(knob => {
    const val = Math.max(0, Math.min(1, knob.getVal()));
    // curve knobs use piecewise angle table; linear knobs use 210°→510° sweep
    // angle convention: 0° = 6 o'clock, increasing clockwise
    const angleDeg = knob.curve
      ? posToAngle(val)
      : knob.sustain
        ? 210 + val * 300
        : 210 + val * 300;
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    const x2 = knob.x + Math.cos(angleRad) * POINTER_LENGTH;
    const y2 = knob.y + Math.sin(angleRad) * POINTER_LENGTH;
    ctx.beginPath();
    ctx.moveTo(knob.x, knob.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // Filter Emphasis — static at zero
  const emphX = 466, emphY = 371;
  const emphAngle = (210 - 90) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(emphX, emphY);
  ctx.lineTo(emphX + Math.cos(emphAngle) * POINTER_LENGTH, emphY + Math.sin(emphAngle) * POINTER_LENGTH);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();
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
