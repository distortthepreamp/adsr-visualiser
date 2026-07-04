// ---- cue-list.js — cue list state, parsing, and transport controls ----

// ---- State ----
let cueListText = '';
let cueList = [];
let cueIndex = 0;
let cueTimecodeMs = 0;
let cuePlayTimers = [];
let cueIsPlaying = false;
let elapsedTimerRaf = null;
let elapsedStartTime = null;
let elapsedSoFarMs = 0;

// ---- Timecode helpers (24fps) ----
function tcToMs(tc) {
  const parts = tc.split(':');
  if (parts.length !== 4) return 0;
  const h  = parseInt(parts[0], 10) || 0;
  const m  = parseInt(parts[1], 10) || 0;
  const s  = parseInt(parts[2], 10) || 0;
  const ff = parseInt(parts[3], 10) || 0;
  return ((h * 3600 + m * 60 + s) * 1000) + Math.round(ff * 1000 / 24);
}

function msToTc(ms) {
  const totalFrames = Math.round(ms * 24 / 1000);
  const ff = totalFrames % 24;
  const totalSec = Math.floor(totalFrames / 24);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return [h, m, s, ff].map(n => String(n).padStart(2, '0')).join(':');
}

function msToElapsed(ms) {
  const totalFrames = Math.round(ms * 24 / 1000);
  const ff = totalFrames % 24;
  const totalSec = Math.floor(totalFrames / 24);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  return [m, s, ff].map(n => String(n).padStart(2, '0')).join(':');
}

function startElapsedTimer() {
  // elapsedStartTime must be seeded by the caller before invoking this
  const svgParent = document.getElementById('svgTimecodes');
  if (svgParent) svgParent.style.display = '';
  function tick() {
    const el = document.getElementById('svgElapsed');
    if (el) el.textContent = 'ELAPSED: ' + msToElapsed(performance.now() - elapsedStartTime);
    elapsedTimerRaf = requestAnimationFrame(tick);
  }
  elapsedTimerRaf = requestAnimationFrame(tick);
}

function stopElapsedTimer() {
  if (elapsedTimerRaf !== null) {
    cancelAnimationFrame(elapsedTimerRaf);
    elapsedTimerRaf = null;
  }
}

function updateTimecodeDisplay() {
  const tc = msToTc(cueTimecodeMs);
  const svgCueEl = document.getElementById('svgCue');
  if (svgCueEl) svgCueEl.textContent = 'CUE: ' + tc;
  const svgParent = document.getElementById('svgTimecodes');
  if (svgParent) svgParent.style.display = cueList.length > 0 ? '' : 'none';
}

// ---- Parser ----

// Parse a single command fragment (no semicolons). Returns an event object or null.
function parseOneCommand(frag) {
  // wait HH:MM:SS:FF
  const waitMatch = frag.match(/^wait\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (waitMatch) return { type: 'wait', ms: tcToMs(waitMatch[1]) };

  // set attack NNNms
  const setAttackMatch = frag.match(/^set\s+attack\s+(\d+(?:\.\d+)?)ms$/i);
  if (setAttackMatch) return { type: 'set', param: 'attack', value: parseFloat(setAttackMatch[1]) };

  // set decay NNNms
  const setDecayMatch = frag.match(/^set\s+decay\s+(\d+(?:\.\d+)?)ms$/i);
  if (setDecayMatch) return { type: 'set', param: 'decay', value: parseFloat(setDecayMatch[1]) };

  // set sustain N
  const setSustainMatch = frag.match(/^set\s+sustain\s+(\d+(?:\.\d+)?)$/i);
  if (setSustainMatch) return { type: 'set', param: 'sustain', value: parseFloat(setSustainMatch[1]) };

  // set release NNNms
  const setReleaseMatch = frag.match(/^set\s+release\s+(\d+(?:\.\d+)?)ms$/i);
  if (setReleaseMatch) return { type: 'set', param: 'release', value: parseFloat(setReleaseMatch[1]) };

  // set loud-decay on/off
  const setLoudDecayMatch = frag.match(/^set\s+loud-decay\s+(on|off)$/i);
  if (setLoudDecayMatch) return { type: 'set', param: 'loud-decay', value: setLoudDecayMatch[1].toLowerCase() === 'on' };

  // set filter-mode on/off
  const setFilterModeMatch = frag.match(/^set\s+filter-mode\s+(on|off)$/i);
  if (setFilterModeMatch) return { type: 'set', param: 'filter-mode', value: setFilterModeMatch[1].toLowerCase() === 'on' };

  // set <checkbox-param> on/off — single regex for boolean params
  const setBoolMatch = frag.match(/^set\s+(filter-decay|hp-mode|mimic-sustain|analogue|show-clipped|show-contour|show-gate-time|clip-at-gate|show-peak-discharge|link-r-to-d|show-effective-lines|show-stated-lines|show-spans|slomo|persist)\s+(on|off)$/i);
  if (setBoolMatch) return { type: 'set', param: setBoolMatch[1].toLowerCase(), value: setBoolMatch[2].toLowerCase() === 'on' };

  // set zoom N — numeric zoom factor
  const setZoomMatch = frag.match(/^set\s+zoom\s+(\d+(?:\.\d+)?)$/i);
  if (setZoomMatch) return { type: 'set', param: 'zoom', value: parseFloat(setZoomMatch[1]) };

  // zoom-fit — compute fit zoom from current geometry
  if (/^zoom-fit$/i.test(frag)) return { type: 'set', param: 'zoom-fit' };

  // set textbook attack|decay|sustain|release on/off — underlay per-leg visibility
  const setTextbookLegMatch = frag.match(/^set\s+textbook\s+(attack|decay|sustain|release)\s+(on|off)$/i);
  if (setTextbookLegMatch) return { type: 'set', param: 'textbook-' + setTextbookLegMatch[1].toLowerCase(), value: setTextbookLegMatch[2].toLowerCase() === 'on' };

  // set textbook show-all|hide-all — underlay bulk visibility
  const setTextbookBulkMatch = frag.match(/^set\s+textbook\s+(show-all|hide-all)$/i);
  if (setTextbookBulkMatch) return { type: 'set', param: 'textbook-' + setTextbookBulkMatch[1].toLowerCase() };

  // set actual attack|decay|sustain|release on/off — model per-leg visibility
  const setActualLegMatch = frag.match(/^set\s+actual\s+(attack|decay|sustain|release)\s+(on|off)$/i);
  if (setActualLegMatch) return { type: 'set', param: 'actual-' + setActualLegMatch[1].toLowerCase(), value: setActualLegMatch[2].toLowerCase() === 'on' };

  // set actual show-all|hide-all — model bulk visibility
  const setActualBulkMatch = frag.match(/^set\s+actual\s+(show-all|hide-all)$/i);
  if (setActualBulkMatch) return { type: 'set', param: 'actual-' + setActualBulkMatch[1].toLowerCase() };

  // set cutoff N
  const setCutoffMatch = frag.match(/^set\s+cutoff\s+(\d+(?:\.\d+)?)$/i);
  if (setCutoffMatch) return { type: 'set', param: 'cutoff', value: parseFloat(setCutoffMatch[1]) };

  // set amount N
  const setAmountMatch = frag.match(/^set\s+amount\s+(\d+(?:\.\d+)?)$/i);
  if (setAmountMatch) return { type: 'set', param: 'amount', value: parseFloat(setAmountMatch[1]) };

  // set gate NNNms
  const setGateMatch = frag.match(/^set\s+gate\s+(\d+(?:\.\d+)?)ms$/i);
  if (setGateMatch) return { type: 'set', param: 'gate', value: parseFloat(setGateMatch[1]) };

  // set persist-time NNNms
  const setPersistTimeMatch = frag.match(/^set\s+persist-time\s+(\d+(?:\.\d+)?)ms$/i);
  if (setPersistTimeMatch) return { type: 'set', param: 'persist-time', value: parseFloat(setPersistTimeMatch[1]) };

  // transition attack NNNms HH:MM:SS:FF
  const transAttackMatch = frag.match(/^transition\s+attack\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transAttackMatch) return { type: 'transition', param: 'attack', value: parseFloat(transAttackMatch[1]), durationMs: tcToMs(transAttackMatch[2]) };

  // transition decay NNNms HH:MM:SS:FF
  const transDecayMatch = frag.match(/^transition\s+decay\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transDecayMatch) return { type: 'transition', param: 'decay', value: parseFloat(transDecayMatch[1]), durationMs: tcToMs(transDecayMatch[2]) };

  // transition sustain N HH:MM:SS:FF
  const transSustainMatch = frag.match(/^transition\s+sustain\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transSustainMatch) return { type: 'transition', param: 'sustain', value: parseFloat(transSustainMatch[1]), durationMs: tcToMs(transSustainMatch[2]) };

  // transition release NNNms HH:MM:SS:FF
  const transReleaseMatch = frag.match(/^transition\s+release\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transReleaseMatch) return { type: 'transition', param: 'release', value: parseFloat(transReleaseMatch[1]), durationMs: tcToMs(transReleaseMatch[2]) };

  // transition cutoff N HH:MM:SS:FF
  const transCutoffMatch = frag.match(/^transition\s+cutoff\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transCutoffMatch) return { type: 'transition', param: 'cutoff', value: parseFloat(transCutoffMatch[1]), durationMs: tcToMs(transCutoffMatch[2]) };

  // transition amount N HH:MM:SS:FF
  const transAmountMatch = frag.match(/^transition\s+amount\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transAmountMatch) return { type: 'transition', param: 'amount', value: parseFloat(transAmountMatch[1]), durationMs: tcToMs(transAmountMatch[2]) };

  // transition gate NNNms HH:MM:SS:FF
  const transGateMatch = frag.match(/^transition\s+gate\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transGateMatch) return { type: 'transition', param: 'gate', value: parseFloat(transGateMatch[1]), durationMs: tcToMs(transGateMatch[2]) };

  // transition zoom N HH:MM:SS:FF
  const transZoomMatch = frag.match(/^transition\s+zoom\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transZoomMatch) return { type: 'transition', param: 'zoom', value: parseFloat(transZoomMatch[1]), durationMs: tcToMs(transZoomMatch[2]) };

  // transition zoom-fit HH:MM:SS:FF
  const transZoomFitMatch = frag.match(/^transition\s+zoom-fit\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transZoomFitMatch) return { type: 'transition', param: 'zoom-fit', durationMs: tcToMs(transZoomFitMatch[1]) };

  // transition mimic-sustain on/off HH:MM:SS:FF
  const transMimicMatch = frag.match(/^transition\s+mimic-sustain\s+(on|off)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
  if (transMimicMatch) return { type: 'transition', param: 'mimic-sustain', value: transMimicMatch[1].toLowerCase(), durationMs: tcToMs(transMimicMatch[2]) };

  // play-tap NNNms [note]
  const playTapMatch = frag.match(/^play-tap\s+(\d+(?:\.\d+)?)ms(?:\s+([A-Ga-g]\d))?$/i);
  if (playTapMatch) return { type: 'play', action: 'tap', ms: parseFloat(playTapMatch[1]), note: playTapMatch[2] ? playTapMatch[2].toUpperCase() : null };

  // play-hold [note]
  const playHoldMatch = frag.match(/^play-hold(?:\s+([A-Ga-g]\d))?$/i);
  if (playHoldMatch) return { type: 'play', action: 'hold', note: playHoldMatch[1] ? playHoldMatch[1].toUpperCase() : null };

  // play-decay [note] — starts at the decay onset (skips the attack)
  const playFromDecayMatch = frag.match(/^play-decay(?:\s+([A-Ga-g]\d))?$/i);
  if (playFromDecayMatch) return { type: 'play', action: 'decay', note: playFromDecayMatch[1] ? playFromDecayMatch[1].toUpperCase() : null };

  // play-from-release [note] — starts at the sustain level and immediately releases to floor.
  // (Name kept distinct from the pre-existing 'play-release' = manual release-from-current.)
  const playFromReleaseMatch = frag.match(/^play-from-release(?:\s+([A-Ga-g]\d))?$/i);
  if (playFromReleaseMatch) return { type: 'play', action: 'from-release', note: playFromReleaseMatch[1] ? playFromReleaseMatch[1].toUpperCase() : null };

  // play-attack [note] — plays only the attack (start→peak) then stops at the peak
  const playAttackMatch = frag.match(/^play-attack(?:\s+([A-Ga-g]\d))?$/i);
  if (playAttackMatch) return { type: 'play', action: 'attack', note: playAttackMatch[1] ? playAttackMatch[1].toUpperCase() : null };

  // play-release
  if (/^play-release$/i.test(frag)) return { type: 'play', action: 'release', note: null };

  // play-clear
  if (/^play-clear$/i.test(frag)) return { type: 'play-clear' };

  // set subtitle "..."
  const setSubtitleMatch = frag.match(/^set\s+subtitle\s+"([^"]*)"$/i);
  if (setSubtitleMatch) return { type: 'set', param: 'subtitle', value: setSubtitleMatch[1] };

  return null;
}

function parseCueList(text) {
  const result = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#')) continue;

    // Split on semicolons — each fragment is a separate command, all tagged with the same rawLine
    const fragments = raw.split(';');
    for (let f = 0; f < fragments.length; f++) {
      const frag = fragments[f].trim();
      if (!frag) continue;
      const event = parseOneCommand(frag);
      if (event) {
        event.rawLine = i;
        result.push(event);
      }
    }
  }

  return result;
}

// ---- Event executor ----
function executeEvent(event) {
  console.log(`[CueList] executing ${event.type} ${event.param ?? ''} ${event.value ?? ''} at ${msToTc(cueTimecodeMs)}`);
  if (event.type === 'set') {
    // Helper: operate a checkbox control
    const setCheckbox = (id) => { const el=$(id); if(el){ el.checked=event.value; el.dispatchEvent(new Event('change',{bubbles:true})); } };
    // Helper: operate a knob via its commit path
    const setKnobInput = (inputId, val, commitFn, commitArg) => {
      const inp=document.getElementById(inputId); if(!inp) return;
      inp.value=val; commitFn(commitArg||undefined, commitArg?inp:undefined);
    };
    switch (event.param) {
      // Knob params — operate the real commit path
      case 'attack':
        { const inp=document.getElementById('attackMsInput'); if(inp){ inp.value=event.value; commitTime('a',inp); } }
        break;
      case 'decay':
        { const inp=document.getElementById('decayMsInput'); if(inp){ inp.value=event.value; commitTime('d',inp); } }
        break;
      case 'release':
        { const inp=document.getElementById('releaseMsInput'); if(inp){ inp.value=event.value; commitTime('r',inp); } }
        break;
      case 'sustain':
        { const inp=document.getElementById('sustainScaleInput'); if(inp){ inp.value=event.value; commitSustain(); } }
        break;
      case 'gate':
        { const inp=document.getElementById('gateMsInput'); if(inp){ inp.value=event.value; commitGate(); } }
        break;
      case 'cutoff':
        { const inp=document.getElementById('floorScaleInput'); if(inp){ inp.value=event.value; commitFloor(); } }
        break;
      case 'amount':
        { const inp=document.getElementById('scaleScaleInput'); if(inp){ inp.value=event.value; commitScale(); } }
        break;
      // Checkbox params — set .checked + dispatch change
      case 'loud-decay':
        setCheckbox('loudDecay');
        if (window.kioskNotifySwitch) kioskNotifySwitch('loud-decay');
        break;
      case 'filter-mode':
        setCheckbox('frequencyMode');
        if (window.kioskNotifySwitch) kioskNotifySwitch('filter-mode');
        break;
      case 'filter-decay':
        setCheckbox('loudDecay');
        if (window.kioskNotifySwitch) kioskNotifySwitch('filter-decay');
        break;
      case 'hp-mode':        setCheckbox('hpMode'); break;
      case 'mimic-sustain':  setCheckbox('keyboardControl'); break;
      case 'analogue':       setCheckbox('analogueCurve'); break;
      case 'show-clipped':   setCheckbox('showClipped'); break;
      case 'show-contour':   setCheckbox('showContour'); break;
      case 'show-gate-time': setCheckbox('showGateTime'); break;
      case 'clip-at-gate':        setCheckbox('clipAtGate'); break;
      case 'show-peak-discharge': setCheckbox('showPeakDischarge'); break;
      case 'show-spans':     setCheckbox('showTimesAsSpans'); break;
      case 'link-r-to-d':         setCheckbox('linkRToD'); break;
      case 'show-effective-lines': setCheckbox('showNewEffectiveLines'); break;
      case 'show-stated-lines': setCheckbox('showNewStatedLines'); break;
      case 'slomo': setCheckbox('sloMo'); break;
      case 'persist': setCheckbox('persistEnabled'); break;
      case 'persist-time':
        { const inp=document.getElementById('persistTime'); if(inp) inp.value=event.value; }
        break;
      case 'zoom':
        { const z = Math.max(0.1, Math.min(48, event.value)); state.target.zoomFactor = z; transition(currentTransitionSec); syncZoomReadout(); }
        break;
      case 'zoom-fit':
        computeFitZoom();
        break;
      case 'subtitle':
        state.subtitle = event.value;
        { const subEl=$('subtitleBox'); if(subEl) subEl.textContent = event.value || 'EMPTY'; }
        break;
      // Textbook (underlay) per-leg visibility
      case 'textbook-attack':  setCheckbox('underlayA'); break;
      case 'textbook-decay':   setCheckbox('underlayD'); break;
      case 'textbook-sustain': setCheckbox('underlayS'); break;
      case 'textbook-release': setCheckbox('underlayR'); break;
      case 'textbook-show-all': { const b=$('underlayShowAll'); if(b) b.click(); } break;
      case 'textbook-hide-all': { const b=$('underlayHideAll'); if(b) b.click(); } break;
      // Actual (model) per-leg visibility
      case 'actual-attack':  setCheckbox('modelA'); break;
      case 'actual-decay':   setCheckbox('modelD'); break;
      case 'actual-sustain': setCheckbox('modelS'); break;
      case 'actual-release': setCheckbox('modelR'); break;
      case 'actual-show-all': { const b=$('modelShowAll'); if(b) b.click(); } break;
      case 'actual-hide-all': { const b=$('modelHideAll'); if(b) b.click(); } break;
    }
  } else if (event.type === 'transition') {
    switch (event.param) {
      case 'attack':
        state.target.a = positionFromMs(event.value);
        transition(event.durationMs / 1000);
        break;
      case 'decay':
        state.target.d = positionFromMs(event.value);
        transition(event.durationMs / 1000);
        break;
      case 'sustain':
        state.target.s = event.value / 10;
        transition(event.durationMs / 1000);
        break;
      case 'release':
        state.target.r = positionFromMs(event.value);
        transition(event.durationMs / 1000);
        break;
      case 'gate':
        state.target.gate = gatePositionFromMs(event.value);
        transition(event.durationMs / 1000);
        break;
      case 'cutoff':
        state.target.floor = event.value / 10;
        transition(event.durationMs / 1000);
        break;
      case 'amount':
        state.target.scale = event.value / 10;
        transition(event.durationMs / 1000);
        break;
      case 'zoom':
        state.target.zoomFactor = Math.max(0.1, Math.min(48, event.value));
        transition(event.durationMs / 1000);
        syncZoomReadout();
        break;
      case 'zoom-fit':
        { const rx = state._fitRightmostX;
          if(rx && rx > graph.x0 + 1){
            const margin = Number(($('fitMargin') && $('fitMargin').value) || 90) / 100;
            // Fit target width tracks the meter's real left edge (via METER_RIGHT_MARGIN); at margin==GRAPH_RIGHT_PAD the correction is zero. MUST match computeFitZoom() in js/ui-controls.js.
            let z = state.zoomFactor * (Math.max(120, graph.w * margin + GRAPH_RIGHT_PAD - METER_RIGHT_MARGIN)) / (rx - graph.x0);
            z = Math.max(0.1, Math.min(48, Math.round(z * 10) / 10));
            state.target.zoomFactor = z;
            transition(event.durationMs / 1000);
            syncZoomReadout();
          }
        }
        break;
      case 'mimic-sustain':
        // Ease the mimic effect over the parsed duration: set the transition time, then flip the
        // checkbox so its change → animateMimic uses currentTransitionSec.
        currentTransitionSec = event.durationMs / 1000;
        { const el = $('keyboardControl'); if(el){ el.checked = (event.value === 'on'); el.dispatchEvent(new Event('change', {bubbles:true})); } }
        break;
    }
  } else if (event.type === 'play') {
    if (event.note && window.noteFreqs) {
      const btnId = 'note' + event.note + 'Btn';
      const freq = noteFreqs[btnId] !== undefined ? noteFreqs[btnId] : null;
      if (freq !== null) setNoteMode(btnId, freq);
    }
    switch (event.action) {
      case 'tap':
        if (window.tap) tap(event.ms);
        break;
      case 'hold':
        if (window.hold) hold();
        break;
      case 'decay':
        if (window.hold) hold(getEffective().aT * 1000);
        break;
      case 'from-release':
        if (window.hold) { const e = getEffective(); hold((e.aT + e.dT) * 1000, 'from-release'); }
        break;
      case 'attack':
        if (window.hold) hold(0, 'attack-only');
        break;
      case 'release':
        if (window.releaseFromCurrent) releaseFromCurrent();
        break;
    }
  } else if (event.type === 'play-clear') {
    if (window.clearBlobAndMarker) clearBlobAndMarker();
  }
}

// ---- Cue script view ----
// Returns the raw line index in cueListText for cueList[idx]
function getRawLineIndex(idx) {
  if (idx < 0 || idx >= cueList.length) return -1;
  const lines = cueListText.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (count === idx) return i;
    count++;
  }
  return -1;
}

function updateCueScriptView() {
  const view = document.getElementById('cueScriptView');
  if (!view) return;
  const showCuesEl = document.getElementById('showCues');
  if (!showCuesEl || !showCuesEl.checked) return;

  const lines = cueListText ? cueListText.split('\n') : [];
  // Anchor: raw line of the most-recently executed event (cueIndex - 1)
  const currentCueIdx = cueIndex - 1;
  let anchorRaw = (currentCueIdx >= 0 && currentCueIdx < cueList.length && cueList[currentCueIdx].rawLine !== undefined)
    ? cueList[currentCueIdx].rawLine : -1;
  if (anchorRaw < 0) anchorRaw = 0;

  const TOTAL = 30;
  const BEFORE = 4; // playhead sits at display position 4 (0-indexed)

  const frag = document.createDocumentFragment();
  for (let pos = 0; pos < TOTAL; pos++) {
    const rawIdx = anchorRaw - BEFORE + pos;
    const text = (rawIdx >= 0 && rawIdx < lines.length) ? lines[rawIdx] : '';
    const lineNum = (rawIdx >= 0 && rawIdx < lines.length) ? String(rawIdx + 1).padStart(3) + '  ' : '     ';
    const div = document.createElement('div');
    div.textContent = lineNum + text;
    div.style.whiteSpace = 'pre';
    div.style.overflow = 'hidden';
    div.style.textOverflow = 'ellipsis';
    if (pos === BEFORE) {
      div.style.opacity = '1';
    } else if (pos < BEFORE) {
      div.style.opacity = '0.35';
    } else {
      div.style.opacity = '0.6';
    }
    frag.appendChild(div);
  }
  view.innerHTML = '';
  view.appendChild(frag);
}


// ---- Playback engine ----
function cuePlay() {
  if (cueIsPlaying) return;
  cueIsPlaying = true;
  console.log(`[CueList] playing from index ${cueIndex}, timecode ${msToTc(cueTimecodeMs)}`);
  elapsedSoFarMs = cueTimecodeMs;
  elapsedStartTime = performance.now() - elapsedSoFarMs;
  startElapsedTimer();

  let accumulatedMs = 0;
  const baseTimecodeMs = cueTimecodeMs;

  for (let i = cueIndex; i < cueList.length; i++) {
    const event = cueList[i];
    if (event.type === 'wait') {
      accumulatedMs += event.ms;
    } else {
      const delay     = accumulatedMs;
      const tcAtFire  = baseTimecodeMs + accumulatedMs;
      const idx       = i;
      const handle = setTimeout(() => {
        cueTimecodeMs = tcAtFire;
        updateTimecodeDisplay();
        executeEvent(event);
        cueIndex = idx + 1;
        updateCueScriptView();
      }, delay);
      cuePlayTimers.push(handle);
    }
  }

  // Final timer — fires after all waits, marks playback complete
  const totalMs = accumulatedMs;
  const endHandle = setTimeout(() => {
    cueIsPlaying = false;
    cueTimecodeMs = baseTimecodeMs + totalMs;
    cueIndex = cueList.length;
    updateTimecodeDisplay();
  }, totalMs);
  cuePlayTimers.push(endHandle);
}

function cueStop() {
  cuePlayTimers.forEach(h => clearTimeout(h));
  cuePlayTimers = [];
  cueIsPlaying = false;
  stopElapsedTimer();
  if (elapsedStartTime !== null) elapsedSoFarMs = performance.now() - elapsedStartTime;
  console.log(`[CueList] stopped at timecode ${msToTc(cueTimecodeMs)}`);
}

function cueReset() {
  cueStop();
  elapsedSoFarMs = 0;
  elapsedStartTime = null;
  cueTimecodeMs = 0;
  const svgElapsedTspan = document.getElementById('svgElapsed');
  if (svgElapsedTspan) svgElapsedTspan.textContent = 'ELAPSED: 00:00:00';
  const svgTimecodes = document.getElementById('svgTimecodes');
  if (svgTimecodes) svgTimecodes.style.display = 'none';
  cueIndex = 0;
  updateTimecodeDisplay();
  updateCueScriptView();
}

// Compute the cumulative wait time (timecode) at a given cueList index
// by summing all wait events from the start of the list up to (not including) idx.
function cueTimecodeAtIndex(idx) {
  let ms = 0;
  for (let i = 0; i < idx && i < cueList.length; i++) {
    if (cueList[i].type === 'wait') ms += cueList[i].ms;
  }
  return ms;
}

function cueStepFwd() {
  if (cueIsPlaying) return;
  // Find the first non-wait event at cueIndex or later
  let firstIdx = -1;
  for (let i = cueIndex; i < cueList.length; i++) {
    if (cueList[i].type !== 'wait') { firstIdx = i; break; }
  }
  if (firstIdx === -1) {
    // Only waits remain (or list exhausted) — advance to end
    cueIndex = cueList.length;
    cueTimecodeMs = cueTimecodeAtIndex(cueIndex);
    updateTimecodeDisplay();
    updateCueScriptView();
    return;
  }
  // Execute all consecutive events sharing the same rawLine (skipping waits)
  const targetLine = cueList[firstIdx].rawLine;
  let lastIdx = firstIdx;
  for (let i = firstIdx; i < cueList.length; i++) {
    if (cueList[i].rawLine !== targetLine) break;
    lastIdx = i;
    if (cueList[i].type === 'wait') continue;
    executeEvent(cueList[i]);
  }
  cueIndex = lastIdx + 1;
  cueTimecodeMs = cueTimecodeAtIndex(cueIndex);
  updateTimecodeDisplay();
  updateCueScriptView();
}

function cueStepBack() {
  if (cueIsPlaying) return;
  if (cueIndex === 0) return;

  // Find the nearest non-wait event before the current position
  let prevEventIdx = -1;
  for (let i = cueIndex - 1; i >= 0; i--) {
    if (cueList[i].type !== 'wait') {
      prevEventIdx = i;
      break;
    }
  }

  if (prevEventIdx === -1) {
    // Only waits before current position — rewind to beginning
    cueIndex = 0;
    cueTimecodeMs = 0;
    if (window.computeStateAtPosition) computeStateAtPosition(cueIndex);
    updateTimecodeDisplay();
    updateCueScriptView();
    return;
  }

  // Rewind to the FIRST event with the same rawLine (whole line group)
  const targetLine = cueList[prevEventIdx].rawLine;
  let firstOfLine = prevEventIdx;
  for (let i = prevEventIdx - 1; i >= 0; i--) {
    if (cueList[i].rawLine === targetLine) firstOfLine = i;
    else break;
  }

  cueIndex = firstOfLine;
  cueTimecodeMs = cueTimecodeAtIndex(cueIndex);
  // Reconstruct the resting state at the new pointer (folds cues [0, cueIndex) atemporally).
  if (window.computeStateAtPosition) computeStateAtPosition(cueIndex);
  updateTimecodeDisplay();
  updateCueScriptView();
}

window.cueStepFwd  = cueStepFwd;
window.cueStepBack = cueStepBack;

// ---- Shared per-control cue formatter (used by Copy State and recorder) ----
const CUE_PARAMS = [
  { key:'attack',              fmt:()=>`set attack ${Math.round(msFromPosition(state.a))}ms` },
  { key:'decay',               fmt:()=>`set decay ${Math.round(msFromPosition(state.d))}ms` },
  { key:'sustain',             fmt:()=>`set sustain ${Math.round(state.s*10)}` },
  { key:'release',             fmt:()=>`set release ${Math.round(msFromPosition(state.r))}ms` },
  { key:'cutoff',              fmt:()=>`set cutoff ${Math.round(state.floor*10)}` },
  { key:'amount',              fmt:()=>`set amount ${Math.round(state.scale*10)}` },
  { key:'gate',                fmt:()=>`set gate ${Math.round(gateMsFromPosition(state.gate))}ms` },
  { key:'loud-decay',          fmt:()=>`set loud-decay ${$('loudDecay').checked?'on':'off'}` },
  { key:'filter-mode',         fmt:()=>`set filter-mode ${$('frequencyMode').checked?'on':'off'}` },
  { key:'hp-mode',             fmt:()=>`set hp-mode ${$('hpMode').checked?'on':'off'}` },
  { key:'mimic-sustain',       fmt:()=>`set mimic-sustain ${$('keyboardControl').checked?'on':'off'}` },
  { key:'analogue',            fmt:()=>`set analogue ${$('analogueCurve').checked?'on':'off'}` },
  { key:'show-clipped',        fmt:()=>`set show-clipped ${$('showClipped').checked?'on':'off'}` },
  { key:'show-contour',        fmt:()=>`set show-contour ${$('showContour').checked?'on':'off'}` },
  { key:'show-gate-time',      fmt:()=>`set show-gate-time ${$('showGateTime').checked?'on':'off'}` },
  { key:'clip-at-gate',        fmt:()=>`set clip-at-gate ${$('clipAtGate').checked?'on':'off'}` },
  { key:'show-peak-discharge', fmt:()=>`set show-peak-discharge ${$('showPeakDischarge').checked?'on':'off'}` },
  { key:'show-spans',          fmt:()=>`set show-spans ${$('showTimesAsSpans').checked?'on':'off'}` },
  { key:'link-r-to-d',         fmt:()=>`set link-r-to-d ${$('linkRToD').checked?'on':'off'}` },
  { key:'show-effective-lines',fmt:()=>`set show-effective-lines ${$('showNewEffectiveLines').checked?'on':'off'}` },
  { key:'show-stated-lines',   fmt:()=>`set show-stated-lines ${$('showNewStatedLines').checked?'on':'off'}` },
  { key:'slomo',               fmt:()=>`set slomo ${$('sloMo').checked?'on':'off'}` },
  { key:'persist',             fmt:()=>`set persist ${$('persistEnabled').checked?'on':'off'}` },
  { key:'persist-time',        fmt:()=>`set persist-time ${Number($('persistTime')?$('persistTime').value:2000)}ms` },
  { key:'zoom',                fmt:()=>`set zoom ${state.target.zoomFactor}` },
  { key:'textbook-attack',     fmt:()=>`set textbook attack ${$('underlayA').checked?'on':'off'}` },
  { key:'textbook-decay',      fmt:()=>`set textbook decay ${$('underlayD').checked?'on':'off'}` },
  { key:'textbook-sustain',    fmt:()=>`set textbook sustain ${$('underlayS').checked?'on':'off'}` },
  { key:'textbook-release',    fmt:()=>`set textbook release ${$('underlayR').checked?'on':'off'}` },
  { key:'actual-attack',       fmt:()=>`set actual attack ${$('modelA').checked?'on':'off'}` },
  { key:'actual-decay',        fmt:()=>`set actual decay ${$('modelD').checked?'on':'off'}` },
  { key:'actual-sustain',      fmt:()=>`set actual sustain ${$('modelS').checked?'on':'off'}` },
  { key:'actual-release',      fmt:()=>`set actual release ${$('modelR').checked?'on':'off'}` },
  { key:'subtitle',            fmt:()=>`set subtitle "${state.subtitle||''}"` },
];

function formatCueCommand(key){ const p = CUE_PARAMS.find(p=>p.key===key); return p ? p.fmt() : null; }

// ---- Cue recorder ----
let cueLog = [];
let _cueT0 = Date.now();
const CUE_RECORD_MERGE_MS = 200;
window.cueRecord = function(key){ const c = formatCueCommand(key); if(c){ const t = Date.now()-_cueT0; cueLog.push({ t, command: c }); const subEl=$('subtitleBox'); if(subEl) subEl.textContent = msToTc(t) + '  ' + c; /* display-only echo */ } };
window.cueRecordRaw = function(cmd){ const t = Date.now()-_cueT0; cueLog.push({ t, command: cmd }); const subEl=$('subtitleBox'); if(subEl) subEl.textContent = msToTc(t) + '  ' + cmd; /* display-only echo */ };
window.getCueLog = function(){ return cueLog; };
window.clearCueLog = function(){ cueLog = []; };

// ---- generateStateSnapshot — returns set commands for all cueable params ----
function generateStateSnapshot() {
  return CUE_PARAMS.map(p=>p.fmt()).join('; ');
}

window.resetCueRec = function(){
  cueLog = [];
  _cueT0 = Date.now();
  cueLog.push({ t: 0, command: generateStateSnapshot() });
};

function buildCueScript(){
  const lines = [];
  for(let i = 0; i < cueLog.length; i++){
    const entry = cueLog[i];
    if(i === 0){
      lines.push(entry.command);
      continue;
    }
    if(i > 0){
      const gap = entry.t - cueLog[i-1].t;
      const MIN_WAIT_MS = Math.ceil(1000/24); // 1 frame @ 24fps = 42ms
      lines.push('wait ' + msToTc(Math.max(gap, MIN_WAIT_MS)));
    }
    lines.push(entry.command);
  }
  return lines.join('\n');
}

// ---- Cue Log viewer modal ----
(function(){
  const overlay = document.createElement('div');
  overlay.id = 'cueLogOverlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:500;align-items:center;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:rgba(18,18,18,.97);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:22px 28px 24px;width:600px;max-width:95vw;display:flex;flex-direction:column;color:#fff;font-family:Arial,Helvetica,sans-serif;position:relative;">' +
      '<button id="cueLogClose" style="position:absolute;top:10px;right:14px;background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;font-weight:800;cursor:pointer;line-height:1;padding:0">\xd7</button>' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin-bottom:12px">Cue Log</div>' +
      '<textarea id="cueLogText" readonly style="width:100%;box-sizing:border-box;height:360px;background:#0a0a0a;color:#ccc;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:10px;font-family:monospace;font-size:12px;resize:vertical;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">' +
        '<button id="cueLogCopy" style="padding:5px 14px;">Copy</button>' +
        '<button id="cueLogClose2" style="padding:5px 14px;">Close</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  function closeModal(){ overlay.style.display = 'none'; }
  document.getElementById('cueLogClose').addEventListener('click', closeModal);
  document.getElementById('cueLogClose2').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  document.getElementById('cueLogCopy').addEventListener('click', () => {
    const ta = document.getElementById('cueLogText');
    if(navigator.clipboard){
      navigator.clipboard.writeText(ta.value).catch(() => { ta.select(); document.execCommand('copy'); });
    } else {
      ta.select(); document.execCommand('copy');
    }
  });

  const openBtn = document.getElementById('cueLogBtn');
  if(openBtn) openBtn.addEventListener('click', () => {
    document.getElementById('cueLogText').value = buildCueScript();
    overlay.style.display = 'flex';
  });

  const recResetBtn = document.getElementById('cueRecResetBtn');
  if(recResetBtn) recResetBtn.addEventListener('click', () => { resetCueRec(); });

  const loadLogBtn = document.getElementById('cueLogLoadBtn');
  if(loadLogBtn) loadLogBtn.addEventListener('click', () => {
    const script = buildCueScript();
    if(!script || !script.trim()){ alert('Cue log is empty \u2014 nothing to load.'); return; }
    if(cueListText.trim() && !confirm('Replace the current cue script?')) return;
    cueListText = script;
    cueList = parseCueList(cueListText);
    cueIndex = 0;
    cueTimecodeMs = 0;
    updateTimecodeDisplay();
    updateCueScriptView();
  });
})();

// ---- initCueList ----
function initCueList() {
  updateTimecodeDisplay();

  // Load default script
  fetch('data/cue-test.txt')
    .then(r => r.text())
    .then(text => {
      cueListText = text;
      cueList = parseCueList(text);
      console.log('[CueList] events:', cueList.length);
    })
    .catch(() => { /* no default script present — silently ignore */ });

  // Show Cues checkbox
  const showCuesEl = document.getElementById('showCues');
  const allPanels = document.querySelectorAll('.ui .panel');
  const cuePanel2 = allPanels[1] || null;
  if (showCuesEl) {
    showCuesEl.addEventListener('change', () => {
      const on = showCuesEl.checked;
      if (cuePanel2) cuePanel2.classList.toggle('cues-mode', on);
      const view = document.getElementById('cueScriptView');
      if (view) view.style.display = on ? 'block' : 'none';
      if (on) updateCueScriptView();
    });
  }

  // Transport buttons
  const playBtn      = document.getElementById('cuePlayBtn');
  const stopBtn      = document.getElementById('cueStopBtn');
  const resetBtn     = document.getElementById('cueResetBtn');
  const stepFwdBtn   = document.getElementById('cueStepFwdBtn');
  const stepBackBtn  = document.getElementById('cueStepBackBtn');
  if (playBtn)     playBtn.addEventListener('click',    cuePlay);
  if (stopBtn)     stopBtn.addEventListener('click',    cueStop);
  if (resetBtn)    resetBtn.addEventListener('click',   cueReset);
  if (stepFwdBtn)  stepFwdBtn.addEventListener('click', cueStepFwd);
  if (stepBackBtn) stepBackBtn.addEventListener('click',cueStepBack);

  // Edit modal — inject into DOM once
  const editOverlay = document.createElement('div');
  editOverlay.id = 'cueEditOverlay';
  editOverlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:500;align-items:center;justify-content:center;';
  editOverlay.innerHTML =
    '<div style="background:rgba(18,18,18,.97);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:22px 28px 24px;width:680px;max-width:92vw;max-height:90vh;overflow:auto;color:#fff;font-family:Arial,Helvetica,sans-serif;position:relative;">' +
      '<button id="cueEditClose" style="position:absolute;top:10px;right:14px;background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;font-weight:800;cursor:pointer;line-height:1;padding:0">\xd7</button>' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin-bottom:10px">Cue List</div>' +
      '<div style="display:flex;position:relative;border:1px solid rgba(255,255,255,.2);border-radius:6px;overflow:hidden">' +
        '<div id="cueEditGutter" style="flex:0 0 auto;height:380px;overflow:hidden;text-align:right;padding:8px 6px;font-family:monospace;font-size:13px;line-height:1.4;color:#666;background:rgba(255,255,255,.04);user-select:none"></div>' +
        '<textarea id="cueEditTextarea" style="flex:1;box-sizing:border-box;height:380px;background:#0a0a0a;color:#ccc;border:none;padding:8px;font-family:monospace;font-size:13px;line-height:1.4;white-space:pre-wrap;overflow-wrap:break-word;overflow-y:auto;resize:vertical;"></textarea>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">' +
        '<button id="cueEditCopy" style="padding:5px 16px;">Copy</button>' +
        '<button id="cueEditSave" style="padding:5px 16px;">Save</button>' +
        '<button id="cueEditCancel" style="padding:5px 16px;">Cancel</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(editOverlay);

  let _editAnchorRaw = -1;
  let _measuredHeights = [];

  // Hidden div for measuring wrapped line heights — matches textarea's wrapping
  const _measureDiv = document.createElement('div');
  _measureDiv.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;font-family:monospace;font-size:13px;line-height:1.4;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;padding:0 8px;';
  document.body.appendChild(_measureDiv);

  function measureLineHeight(text, wrapWidth){
    _measureDiv.style.width = wrapWidth + 'px';
    _measureDiv.textContent = text === '' ? ' ' : text;
    return _measureDiv.offsetHeight;
  }

  function populateGutter(){
    const gutter = document.getElementById('cueEditGutter');
    const ta = document.getElementById('cueEditTextarea');
    if(!gutter || !ta) return;
    const wrapWidth = ta.clientWidth - 16; // minus horizontal padding (8px each side)
    const lines = ta.value.split('\n');
    _measuredHeights = [];
    const divs = [];
    for(let i = 0; i < lines.length; i++){
      const h = measureLineHeight(lines[i], wrapWidth);
      _measuredHeights.push(h);
      const isCurrent = i === _editAnchorRaw;
      divs.push(isCurrent
        ? '<div style="height:' + h + 'px;font-weight:700;color:#fff">' + (i+1) + '</div>'
        : '<div style="height:' + h + 'px">' + (i+1) + '</div>');
    }
    gutter.innerHTML = divs.join('');
    gutter.scrollTop = ta.scrollTop;
  }

  function cueEditEscHandler(e) {
    if (e.key === 'Escape') { closeEditModal(); }
  }
  function openEditModal()  {
    const ta = document.getElementById('cueEditTextarea');
    ta.value = cueListText;
    editOverlay.style.display = 'flex';
    document.addEventListener('keydown', cueEditEscHandler);

    // Compute current line
    const ci = cueIndex - 1;
    _editAnchorRaw = (ci >= 0 && ci < cueList.length && cueList[ci].rawLine !== undefined)
      ? cueList[ci].rawLine : -1;

    populateGutter();

    // Jump to current line
    if(_editAnchorRaw >= 0){
      const lines = cueListText.split('\n');
      let charStart = 0;
      for(let i = 0; i < _editAnchorRaw && i < lines.length; i++){
        charStart += lines[i].length + 1;
      }
      const charEnd = charStart + (lines[_editAnchorRaw] || '').length;
      ta.setSelectionRange(charStart, charEnd);
      ta.focus();
      let scrollY = 0;
      for(let i = 0; i < _editAnchorRaw && i < _measuredHeights.length; i++) scrollY += _measuredHeights[i];
      ta.scrollTop = Math.max(0, scrollY - ta.clientHeight / 2);
      const gutter = document.getElementById('cueEditGutter');
      if(gutter) gutter.scrollTop = ta.scrollTop;
    } else {
      ta.scrollTop = 0;
      ta.focus();
    }
  }
  function closeEditModal() {
    editOverlay.style.display = 'none';
    document.removeEventListener('keydown', cueEditEscHandler);
  }

  // Scroll sync + gutter repopulate on edit
  const _ta = document.getElementById('cueEditTextarea');
  if(_ta){
    _ta.addEventListener('scroll', () => {
      const gutter = document.getElementById('cueEditGutter');
      if(gutter) gutter.scrollTop = _ta.scrollTop;
    });
    _ta.addEventListener('input', populateGutter);
    if(typeof ResizeObserver !== 'undefined'){
      new ResizeObserver(() => {
        const gutter = document.getElementById('cueEditGutter');
        if(gutter) gutter.style.height = _ta.clientHeight + 'px';
      }).observe(_ta);
    }
  }

  document.getElementById('cueEditClose').addEventListener('click',  closeEditModal);
  document.getElementById('cueEditCancel').addEventListener('click', closeEditModal);
  document.getElementById('cueEditCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('cueEditTextarea').value);
  });
  editOverlay.addEventListener('click', e => { if (e.target === editOverlay) closeEditModal(); });
  document.getElementById('cueEditSave').addEventListener('click', () => {
    const text = document.getElementById('cueEditTextarea').value;
    cueListText = text;
    cueList = parseCueList(text);
    closeEditModal();
  });

  const editBtn = document.getElementById('cueEditBtn');
  if (editBtn) editBtn.addEventListener('click', openEditModal);

  const copyStateBtn = document.getElementById('cueCopyStateBtn');
  if (copyStateBtn) copyStateBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(generateStateSnapshot());
    cueLog.push({ t: Date.now()-_cueT0, command: generateStateSnapshot() });
  });

  // Load button — file picker
  const loadBtn = document.getElementById('cueLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.txt,.cue';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) { document.body.removeChild(inp); return; }
        const reader = new FileReader();
        reader.onload = ev => {
          cueListText = ev.target.result;
          cueList = parseCueList(cueListText);
          document.body.removeChild(inp);
        };
        reader.onerror = () => { document.body.removeChild(inp); };
        reader.readAsText(file);
      });
      inp.click();
    });
  }
}
