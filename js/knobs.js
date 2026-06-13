// ---- knobs.js — knob drag handlers, numeric input logic, and display helpers ----
// Top-level declarations are global (accessible by render.js, syncControls, etc.)
// Event listener registration is deferred to initKnobs(), called from init after $ is defined.

// ---- Numeric input typed-display state ----
const typedDisplay = {
  live: { a: null, d: null, r: null },
  animate: { a: null, d: null, r: null }
};

// Assigned inside initKnobs() so DOM exists; used by refreshNumericInputs() etc.
let attackInput, decayInput, releaseInput, sustainInput, floorInput, scaleInput;

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

// ---- initKnobs — registers numeric input and knob drag listeners; called from init ----
function initKnobs(){

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

  document.querySelectorAll('input[name="mode"]').forEach(el => {
    el.addEventListener('change', () => setTimeout(refreshNumericInputs, 0));
  });
  ['loudDecay','keyboardControl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => setTimeout(refreshNumericInputs, 0));
  });

  // Knob drag interaction — reads/writes state directly, no hidden slider elements.
  // Sensitivity: 200px drag = full 0–1 position range (same as before: old range was
  // 0–1000 slider units, delta*(1000/200)/1000 = delta/200 in position space).
  [
    { knobId: 'attackKnob',  field: 'a',     isTime: true  },
    { knobId: 'decayKnob',   field: 'd',     isTime: true  },
    { knobId: 'sustainKnob', field: 's',     isTime: false },
    { knobId: 'releaseKnob', field: 'r',     isTime: true  },
    { knobId: 'floorKnob',   field: 'floor', isTime: false },
    { knobId: 'scaleKnob',   field: 'scale', isTime: false },
  ].forEach(({ knobId, field, isTime }) => {
    const knob = $(knobId);
    knob.style.cursor = 'ns-resize';
    let startY, startVal;
    knob.addEventListener('pointerdown', e => {
      startY   = e.clientY;
      startVal = activeObject()[field];
      knob.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    knob.addEventListener('pointermove', e => {
      if (!knob.hasPointerCapture(e.pointerId)) return;
      const delta  = startY - e.clientY;
      const newVal = clamp(startVal + delta / 200);
      const mode   = currentMode();
      if (mode === 'live') {
        if (isTime) clearBlobAndMarker();
        state[field]        = newVal;
        state.target[field] = newVal;
        render();
      } else {
        state.target[field] = newVal;
        syncControls();
        setTimeout(refreshNumericInputs, 0);
      }
      if (isTime) clearTypedForSlider(field);
      if (window.markPresetDirty) markPresetDirty();
    });
    knob.addEventListener('pointerup', e => {
      knob.releasePointerCapture(e.pointerId);
    });
  });
}
