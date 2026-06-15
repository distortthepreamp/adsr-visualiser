// ---- Kiosk overlay — panel image with live knob pointer rendering ----

const KIOSK_KNOBS = [
  { id:'cutoff',   x:280, y:371,  getVal:()=> state.floor },
  { id:'amount',   x:651, y:371,  getVal:()=> state.scale },
  { id:'attackF',  x:280, y:618,  getVal:()=> state.a },
  { id:'decayF',   x:466, y:618,  getVal:()=> state.d },
  { id:'sustainF', x:651, y:618,  getVal:()=> state.s },
  { id:'attack',   x:280, y:864,  getVal:()=> state.a },
  { id:'decay',    x:466, y:864,  getVal:()=> state.d },
  { id:'sustain',  x:651, y:864,  getVal:()=> state.s },
];

const KNOB_RADIUS    = 50;
const POINTER_LENGTH = 40;
const MIN_ANGLE      = -135; // degrees, measured from 12 o'clock
const MAX_ANGLE      =  135;

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
    const angleDeg = MIN_ANGLE + val * (MAX_ANGLE - MIN_ANGLE);
    // Convert from 12 o'clock (−90° in canvas coords) to canvas radians
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    const x2 = knob.x + Math.cos(angleRad) * POINTER_LENGTH;
    const y2 = knob.y + Math.sin(angleRad) * POINTER_LENGTH;
    ctx.beginPath();
    ctx.moveTo(knob.x, knob.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
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
