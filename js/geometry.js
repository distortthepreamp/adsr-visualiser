// ---- geometry.js — pure mathematical functions for the ADSR envelope ----
// No DOM access. All functions are top-level globals, called by paths.js and others.

// ---- displayTimeWidth curve coefficients ----
const DISPLAY_SHORTBOOST_AMP = 38;    // amplitude of the exponential short-value boost
const DISPLAY_SHORTBOOST_TC  = 0.012; // time constant of the short-value boost (seconds)
const DISPLAY_LOG_AMP        = 245;   // amplitude of the logarithmic long-value component
const DISPLAY_LOG_SCALE      = 6.5;   // horizontal scale of the logarithmic component

function clamp(v,min=0,max=1){ return Math.max(min, Math.min(max, v)); }
function easeInOut(t){ return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }
function mapTime(p){
  p = clamp(p);
  for(let i=0;i<curve.length-1;i++){
    const a=curve[i], b=curve[i+1];
    if(p>=a.p && p<=b.p){ const f=(p-a.p)/(b.p-a.p); return a.t + f*(b.t-a.t); }
  }
  return curve[curve.length-1].t;
}
function positionFromMs(ms){
  const sec = Math.max(0, Number(ms) || 0) / 1000;
  if (sec <= curve[0].t) return curve[0].p;
  for (let i = 0; i < curve.length - 1; i++){
    const a = curve[i], b = curve[i+1];
    if (sec >= a.t && sec <= b.t){
      const f = (sec - a.t) / (b.t - a.t || 1);
      return a.p + (b.p - a.p) * f;
    }
  }
  return curve[curve.length - 1].p;
}
function msFromPosition(p){ return Math.round(mapTime(p) * 1000); }
function fmtTime(t){
  if(t < .001) return '0 ms';
  if(t < 1) return Math.round(t*1000)+' ms';
  if(t < 10) return (Math.round(t*10)/10).toString().replace('.0','')+' s';
  return Math.round(t)+' s';
}
function displayTimeWidth(t){
  // presentation scale: visible short values, compressed long values.
  // True zero is zero-width, but the short-value boost eases in smoothly
  // to avoid an initial jump when transitioning away from zero.
  t = Math.max(0, t);
  if(t === 0) return 0;
  const shortBoost = DISPLAY_SHORTBOOST_AMP * (1 - Math.exp(-t / DISPLAY_SHORTBOOST_TC));
  return shortBoost + DISPLAY_LOG_AMP * Math.log10(1 + DISPLAY_LOG_SCALE * t);
}
function getEffective(){
  const aT=mapTime(state.a), dT=mapTime(state.d);
  const rawS=state.s;
  const s=($('keyboardControl') && $('keyboardControl').checked) ? rawS*.8 : rawS;
  const textbookOn = $('textbookAdsr') && $('textbookAdsr').checked;
  const releaseOn = textbookOn ? true : $('loudDecay').checked;
  const freqMode = $('frequencyMode') && $('frequencyMode').checked;
  const floor = freqMode ? clamp(state.floor,0,1) : 0;
  const scale = freqMode ? clamp(state.scale,0,1) : 1;
  return {aT,dT,s,rawS,releaseOn,rT:releaseOn?(textbookOn?mapTime(state.r):dT):0,floor,scale};
}
function yFor(level){ return graph.y0 - level*graph.h; }
function getLinearTotalMs(){
  return 6000 / Math.max(1, state.zoomFactor);
}
function timeToPixels(t, linearOn){
  return linearOn ? t * 1000 * (graph.w / getLinearTotalMs()) : displayTimeWidth(t);
}

function computePoints(){
  const e=getEffective();
  const linearTimeEl = document.getElementById('linearTime');
  const linearTime = linearTimeEl && linearTimeEl.checked;
  let aw, dwFull;
  aw     = timeToPixels(e.aT, linearTime);
  dwFull = timeToPixels(e.dT, linearTime);
  if(linearTime){
    // Clip: decay end cannot exceed graph right edge
    const maxX = graph.x0 + graph.w;
    if(graph.x0 + aw > maxX) aw = graph.w;
    if(graph.x0 + aw + dwFull > maxX) dwFull = maxX - (graph.x0 + aw);
  }
  const x0=graph.x0;

  // Experimental sustain-marker model:
  // Attack rises to peak, then there is one master downward decay/release
  // trajectory from 100% to 0%. Sustain is a level marker on that trajectory,
  // not a timed horizontal plateau.
  const p0={x:x0,y:yFor(e.floor),level:0};
  const p1={x:x0+aw,y:yFor(e.floor+e.scale),level:1};
  const pEnd={x:p1.x+dwFull,y:yFor(e.floor),level:0};
  const mimicOn = $('keyboardControl') && $('keyboardControl').checked;
  const sAbsolute = e.floor + e.s * e.scale;
  const sSafe = (mimicOn && sAbsolute > 0.8 && e.scale > 0)
    ? Math.max(0, (0.8 - e.floor) / e.scale)
    : e.s;
  const pS={x:p1.x+dwFull*(1-sSafe),y:yFor(e.floor+sSafe*e.scale),level:sSafe};
  return {p0,p1,pS,pEnd,e,aw,dwFull};
}
