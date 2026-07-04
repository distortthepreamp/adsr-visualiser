// ---- replay.js — atemporal cue folding ----
// computeStateAtPosition(K): reconstruct the RESTING state as if the cue pointer sits at K,
// i.e. cues [0, K) have been executed. Folds start-defaults + cues 0→K-1 with no timing:
// transitions collapse to their end value, actions/waits are skipped, one render at the end.
// This is what step-back and jump-to-position both call.
(function(){
  // Cue-controllable checkboxes — reset to their HTML-authored default (el.defaultChecked) as the baseline.
  const CK_IDS = [
    'loudDecay','frequencyMode','hpMode','keyboardControl','analogueCurve',
    'showClipped','showContour','showGateTime','clipAtGate','showPeakDischarge',
    'showTimesAsSpans','linkRToD','showNewEffectiveLines','showNewStatedLines','sloMo','persistEnabled',
    'underlayA','underlayD','underlayS','underlayR','modelA','modelD','modelS','modelR'
  ];
  // param → checkbox id (mirrors executeEvent's set switch, but applied directly — no change dispatch)
  const PARAM_CK = {
    'loud-decay':'loudDecay', 'filter-decay':'loudDecay', 'filter-mode':'frequencyMode',
    'hp-mode':'hpMode', 'mimic-sustain':'keyboardControl', 'analogue':'analogueCurve',
    'show-clipped':'showClipped', 'show-contour':'showContour', 'show-gate-time':'showGateTime',
    'clip-at-gate':'clipAtGate', 'show-peak-discharge':'showPeakDischarge', 'show-spans':'showTimesAsSpans',
    'link-r-to-d':'linkRToD', 'show-effective-lines':'showNewEffectiveLines', 'show-stated-lines':'showNewStatedLines',
    'slomo':'sloMo', 'persist':'persistEnabled',
    'textbook-attack':'underlayA','textbook-decay':'underlayD','textbook-sustain':'underlayS','textbook-release':'underlayR',
    'actual-attack':'modelA','actual-decay':'modelD','actual-sustain':'modelS','actual-release':'modelR'
  };

  function setCk(id, on){
    const el = $(id); if(!el) return;
    el.checked = !!on;
    // JS mirror-global read by timeaxis.js (bare identifier, not $().checked)
    if(id === 'showTimesAsSpans') showTimesAsSpans = !!on;
    // cosmetic: analogue slider opacity follows the checkbox
    if(id === 'analogueCurve' && typeof syncAnalogueCurve === 'function') syncAnalogueCurve();
  }
  function setKnob(field, val){ state[field] = val; state.target[field] = val; }

  // Apply one 'set' command's resting effect directly to state / checkboxes (absolute).
  function applySet(param, value){
    // Checkbox params — direct .checked, no dispatch (mirror-sync handled in setCk)
    if(PARAM_CK[param] !== undefined){ setCk(PARAM_CK[param], value); return; }
    switch(param){
      case 'attack':  setKnob('a', positionFromMs(value)); break;
      case 'decay':   setKnob('d', positionFromMs(value)); break;
      case 'release': setKnob('r', positionFromMs(value)); break;
      case 'sustain': setKnob('s', value / 10); break;
      case 'cutoff':  setKnob('floor', value / 10); break;
      case 'amount':  setKnob('scale', value / 10); break;
      case 'gate':    setKnob('gate', gatePositionFromMs(value)); break;
      case 'zoom':    { const z = Math.max(0.1, Math.min(48, value)); setKnob('zoomFactor', z); } break;
      case 'zoom-fit':
        // Evaluate against the folded-so-far geometry: render to populate state._fitRightmostX,
        // then fit. currentTransitionSec is forced to 0 during the fold so computeFitZoom snaps instantly.
        if(typeof render === 'function') render();
        if(typeof computeFitZoom === 'function') computeFitZoom();
        break;
      case 'persist-time': { const inp=$('persistTime'); if(inp) inp.value = value; } break;
      case 'subtitle':
        state.subtitle = value;
        { const sub=$('subtitleBox'); if(sub) sub.textContent = value || 'EMPTY'; }
        break;
      // Bulk leg visibility — all four legs on/off
      case 'textbook-show-all': ['underlayA','underlayD','underlayS','underlayR'].forEach(id=>setCk(id,true)); break;
      case 'textbook-hide-all': ['underlayA','underlayD','underlayS','underlayR'].forEach(id=>setCk(id,false)); break;
      case 'actual-show-all':   ['modelA','modelD','modelS','modelR'].forEach(id=>setCk(id,true)); break;
      case 'actual-hide-all':   ['modelA','modelD','modelS','modelR'].forEach(id=>setCk(id,false)); break;
    }
  }

  // A transition's resting state == its end value applied instantly (same as its set twin).
  function applyTransition(param, value){
    if(param === 'mimic-sustain'){ setCk('keyboardControl', value === 'on'); return; } // checkbox only — never touch mimicFactor
    // attack|decay|sustain|release|gate|cutoff|amount|zoom|zoom-fit share the set semantics
    applySet(param, value);
  }

  function applyResting(ev){
    if(!ev) return;
    if(ev.type === 'set') applySet(ev.param, ev.value);
    else if(ev.type === 'transition') applyTransition(ev.param, ev.value);
    // 'wait' / 'play' / 'play-clear' → SKIP (pure actions, no persistent resting state)
  }

  function resetBaseline(){
    // App-init defaults (index.html state literal). tbSustainGap is a config constant, not cue-settable — leave it.
    state.a = 0.08; state.d = 0.25; state.s = 0.5; state.r = 0.5; state.floor = 0; state.scale = 1;
    state.gate = gatePositionFromMs(200); state.zoomFactor = 3; state.subtitle = '';
    state.target.a = state.a; state.target.d = state.d; state.target.s = state.s; state.target.r = state.r;
    state.target.floor = state.floor; state.target.scale = state.scale;
    state.target.gate = state.gate; state.target.zoomFactor = state.zoomFactor;
    CK_IDS.forEach(id => { const el = $(id); if(el) setCk(id, el.defaultChecked); });
    const pt = $('persistTime'); if(pt) pt.value = pt.defaultValue || 2000;
    const sub = $('subtitleBox'); if(sub) sub.textContent = 'EMPTY';
  }

  function computeStateAtPosition(K){
    if(typeof cueList === 'undefined' || !Array.isArray(cueList)) return;
    // GUARDS: no cue recording, no eased animations during the fold (both go instant).
    const _rec = window.cueRecord, _recRaw = window.cueRecordRaw;
    const _cts = (typeof currentTransitionSec !== 'undefined') ? currentTransitionSec : 0;
    window.cueRecord = function(){}; window.cueRecordRaw = function(){};
    try {
      currentTransitionSec = 0;                 // transition()/computeFitZoom snap instantly, no rAF
      // 1-2. Baseline defaults + transient reset (idle phase, no held blob, no mimic animation)
      resetBaseline();
      if(typeof clearBlobAndMarker === 'function') clearBlobAndMarker();
      state.currentPhase = 'idle'; state.held = false; state.releaseFromDecay = false;
      if(typeof _mimicAnimating !== 'undefined') _mimicAnimating = false;
      // 3. Fold cues [0, K) in order (cueList is the existing parser's output — reused, not re-parsed)
      const end = Math.max(0, Math.min(K | 0, cueList.length));
      for(let i = 0; i < end; i++) applyResting(cueList[i]);
    } finally {
      window.cueRecord = _rec; window.cueRecordRaw = _recRaw;
      currentTransitionSec = _cts;
    }
    // 4. Render ONCE to reflect the folded resting state
    if(typeof render === 'function') render();
    if(typeof syncControls === 'function') syncControls();
    if(typeof refreshNumericInputs === 'function') refreshNumericInputs();
    if(typeof syncZoomReadout === 'function') syncZoomReadout();
  }

  window.computeStateAtPosition = computeStateAtPosition;
})();
