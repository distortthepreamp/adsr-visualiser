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
function parseCueList(text) {
  const result = [];
  const lines = text.split('\n');
  const tcPat = /\d{2}:\d{2}:\d{2}:\d{2}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    // wait HH:MM:SS:FF
    const waitMatch = line.match(/^wait\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (waitMatch) {
      result.push({ type: 'wait', ms: tcToMs(waitMatch[1]) });
      continue;
    }

    // set attack NNNms
    const setAttackMatch = line.match(/^set\s+attack\s+(\d+(?:\.\d+)?)ms$/i);
    if (setAttackMatch) {
      result.push({ type: 'set', param: 'attack', value: parseFloat(setAttackMatch[1]) });
      continue;
    }

    // set decay NNNms
    const setDecayMatch = line.match(/^set\s+decay\s+(\d+(?:\.\d+)?)ms$/i);
    if (setDecayMatch) {
      result.push({ type: 'set', param: 'decay', value: parseFloat(setDecayMatch[1]) });
      continue;
    }

    // set sustain N
    const setSustainMatch = line.match(/^set\s+sustain\s+(\d+(?:\.\d+)?)$/i);
    if (setSustainMatch) {
      result.push({ type: 'set', param: 'sustain', value: parseFloat(setSustainMatch[1]) });
      continue;
    }

    // set release NNNms
    const setReleaseMatch = line.match(/^set\s+release\s+(\d+(?:\.\d+)?)ms$/i);
    if (setReleaseMatch) {
      result.push({ type: 'set', param: 'release', value: parseFloat(setReleaseMatch[1]) });
      continue;
    }

    // set loud-decay on/off
    const setLoudDecayMatch = line.match(/^set\s+loud-decay\s+(on|off)$/i);
    if (setLoudDecayMatch) {
      result.push({ type: 'set', param: 'loud-decay', value: setLoudDecayMatch[1].toLowerCase() === 'on' });
      continue;
    }

    // set filter-mode on/off
    const setFilterModeMatch = line.match(/^set\s+filter-mode\s+(on|off)$/i);
    if (setFilterModeMatch) {
      result.push({ type: 'set', param: 'filter-mode', value: setFilterModeMatch[1].toLowerCase() === 'on' });
      continue;
    }

    // set <checkbox-param> on/off — single regex for remaining boolean params
    const setBoolMatch = line.match(/^set\s+(filter-decay|hp-mode|mimic-sustain|analogue|linear-time|zoom-time|textbook|show-clipped|show-contour|tb-sustain-dotted|tb-sustain-collapse|tb-model-d-sustain)\s+(on|off)$/i);
    if (setBoolMatch) {
      result.push({ type: 'set', param: setBoolMatch[1].toLowerCase(), value: setBoolMatch[2].toLowerCase() === 'on' });
      continue;
    }

    // set cutoff N
    const setCutoffMatch = line.match(/^set\s+cutoff\s+(\d+(?:\.\d+)?)$/i);
    if (setCutoffMatch) {
      result.push({ type: 'set', param: 'cutoff', value: parseFloat(setCutoffMatch[1]) });
      continue;
    }

    // set amount N
    const setAmountMatch = line.match(/^set\s+amount\s+(\d+(?:\.\d+)?)$/i);
    if (setAmountMatch) {
      result.push({ type: 'set', param: 'amount', value: parseFloat(setAmountMatch[1]) });
      continue;
    }

    // transition attack NNNms HH:MM:SS:FF
    const transAttackMatch = line.match(/^transition\s+attack\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (transAttackMatch) {
      result.push({ type: 'transition', param: 'attack', value: parseFloat(transAttackMatch[1]), durationMs: tcToMs(transAttackMatch[2]) });
      continue;
    }

    // transition decay NNNms HH:MM:SS:FF
    const transDecayMatch = line.match(/^transition\s+decay\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (transDecayMatch) {
      result.push({ type: 'transition', param: 'decay', value: parseFloat(transDecayMatch[1]), durationMs: tcToMs(transDecayMatch[2]) });
      continue;
    }

    // transition sustain N HH:MM:SS:FF
    const transSustainMatch = line.match(/^transition\s+sustain\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (transSustainMatch) {
      result.push({ type: 'transition', param: 'sustain', value: parseFloat(transSustainMatch[1]), durationMs: tcToMs(transSustainMatch[2]) });
      continue;
    }

    // transition release NNNms HH:MM:SS:FF
    const transReleaseMatch = line.match(/^transition\s+release\s+(\d+(?:\.\d+)?)ms\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (transReleaseMatch) {
      result.push({ type: 'transition', param: 'release', value: parseFloat(transReleaseMatch[1]), durationMs: tcToMs(transReleaseMatch[2]) });
      continue;
    }

    // transition cutoff N HH:MM:SS:FF
    const transCutoffMatch = line.match(/^transition\s+cutoff\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (transCutoffMatch) {
      result.push({ type: 'transition', param: 'cutoff', value: parseFloat(transCutoffMatch[1]), durationMs: tcToMs(transCutoffMatch[2]) });
      continue;
    }

    // transition amount N HH:MM:SS:FF
    const transAmountMatch = line.match(/^transition\s+amount\s+(\d+(?:\.\d+)?)\s+(\d{2}:\d{2}:\d{2}:\d{2})$/i);
    if (transAmountMatch) {
      result.push({ type: 'transition', param: 'amount', value: parseFloat(transAmountMatch[1]), durationMs: tcToMs(transAmountMatch[2]) });
      continue;
    }

    // play-tap NNNms [note]
    const playTapMatch = line.match(/^play-tap\s+(\d+(?:\.\d+)?)ms(?:\s+([A-Ga-g]\d))?$/i);
    if (playTapMatch) {
      result.push({ type: 'play', action: 'tap', ms: parseFloat(playTapMatch[1]), note: playTapMatch[2] ? playTapMatch[2].toUpperCase() : null });
      continue;
    }

    // play-hold [note]
    const playHoldMatch = line.match(/^play-hold(?:\s+([A-Ga-g]\d))?$/i);
    if (playHoldMatch) {
      result.push({ type: 'play', action: 'hold', note: playHoldMatch[1] ? playHoldMatch[1].toUpperCase() : null });
      continue;
    }

    // play-release
    if (/^play-release$/i.test(line)) {
      result.push({ type: 'play', action: 'release', note: null });
      continue;
    }
  }

  return result;
}

// ---- Event executor ----
function executeEvent(event) {
  console.log(`[CueList] executing ${event.type} ${event.param ?? ''} ${event.value ?? ''} at ${msToTc(cueTimecodeMs)}`);
  if (event.type === 'set') {
    switch (event.param) {
      case 'attack':
        state.a = positionFromMs(event.value);
        state.target.a = state.a;
        render();
        break;
      case 'decay':
        state.d = positionFromMs(event.value);
        state.target.d = state.d;
        render();
        break;
      case 'sustain':
        state.s = event.value / 10;
        state.target.s = state.s;
        render();
        break;
      case 'release':
        state.r = positionFromMs(event.value);
        state.target.r = state.r;
        render();
        break;
      case 'loud-decay':
        $('loudDecay').checked = event.value;
        $('loudDecay').dispatchEvent(new Event('change'));
        if (window.kioskNotifySwitch) kioskNotifySwitch('loud-decay');
        break;
      case 'filter-mode':
        $('frequencyMode').checked = event.value;
        $('frequencyMode').dispatchEvent(new Event('change'));
        if (window.kioskNotifySwitch) kioskNotifySwitch('filter-mode');
        break;
      case 'filter-decay':
        $('loudDecay').checked = event.value;
        $('loudDecay').dispatchEvent(new Event('change'));
        if (window.kioskNotifySwitch) kioskNotifySwitch('filter-decay');
        break;
      case 'hp-mode':
        $('hpMode').checked = event.value;
        $('hpMode').dispatchEvent(new Event('change'));
        break;
      case 'mimic-sustain':
        $('keyboardControl').checked = event.value;
        $('keyboardControl').dispatchEvent(new Event('change'));
        break;
      case 'analogue':
        $('analogueCurve').checked = event.value;
        $('analogueCurve').dispatchEvent(new Event('change'));
        break;
      case 'linear-time':
        $('linearTime').checked = event.value;
        $('linearTime').dispatchEvent(new Event('change'));
        break;
      case 'zoom-time':
        $('timelineZoom3x').checked = event.value;
        $('timelineZoom3x').dispatchEvent(new Event('change'));
        break;
      case 'textbook':
        $('textbookAdsr').checked = event.value;
        $('textbookAdsr').dispatchEvent(new Event('change'));
        break;
      case 'show-clipped':
        $('showClipped').checked = event.value;
        $('showClipped').dispatchEvent(new Event('change'));
        break;
      case 'show-contour':
        $('showContour').checked = event.value;
        $('showContour').dispatchEvent(new Event('change'));
        break;
      case 'tb-sustain-dotted':
        $('tbSustainDotted').checked = event.value;
        $('tbSustainDotted').dispatchEvent(new Event('change'));
        break;
      case 'tb-sustain-collapse':
        $('tbSustainCollapse').checked = event.value;
        $('tbSustainCollapse').dispatchEvent(new Event('change'));
        break;
      case 'tb-model-d-sustain':
        $('tbShowModelDSustain').checked = event.value;
        $('tbShowModelDSustain').dispatchEvent(new Event('change'));
        break;
      case 'cutoff':
        state.target.floor = event.value / 10;
        transition(0);
        break;
      case 'amount':
        state.target.scale = event.value / 10;
        transition(0);
        break;
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
      case 'cutoff':
        state.target.floor = event.value / 10;
        transition(event.durationMs / 1000);
        break;
      case 'amount':
        state.target.scale = event.value / 10;
        transition(event.durationMs / 1000);
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
      case 'release':
        if (window.releaseFromCurrent) releaseFromCurrent();
        break;
    }
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
  let anchorRaw = currentCueIdx >= 0 ? getRawLineIndex(currentCueIdx) : -1;
  if (anchorRaw < 0) anchorRaw = 0;

  const TOTAL = 30;
  const BEFORE = 4; // playhead sits at display position 4 (0-indexed)

  const frag = document.createDocumentFragment();
  for (let pos = 0; pos < TOTAL; pos++) {
    const rawIdx = anchorRaw - BEFORE + pos;
    const text = (rawIdx >= 0 && rawIdx < lines.length) ? lines[rawIdx] : '';
    const div = document.createElement('div');
    div.textContent = text;
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
  for (let i = cueIndex; i < cueList.length; i++) {
    const event = cueList[i];
    if (event.type === 'wait') continue;
    cueIndex = i + 1;
    cueTimecodeMs = cueTimecodeAtIndex(cueIndex);
    executeEvent(event);
    updateTimecodeDisplay();
    updateCueScriptView();
    return;
  }
  // Only waits remain (or list exhausted) — advance to end
  cueIndex = cueList.length;
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
    updateTimecodeDisplay();
    updateCueScriptView();
    return;
  }

  cueIndex = prevEventIdx;
  cueTimecodeMs = cueTimecodeAtIndex(cueIndex);
  updateTimecodeDisplay();
  updateCueScriptView();
}

window.cueStepFwd  = cueStepFwd;
window.cueStepBack = cueStepBack;

// ---- generateStateSnapshot — returns set commands for all cueable params ----
function generateStateSnapshot() {
  const lines = [];
  lines.push(`set attack ${Math.round(msFromPosition(state.a))}ms`);
  lines.push(`set decay ${Math.round(msFromPosition(state.d))}ms`);
  lines.push(`set sustain ${Math.round(state.s * 10)}`);
  lines.push(`set release ${Math.round(msFromPosition(state.r))}ms`);
  lines.push(`set cutoff ${Math.round(state.floor * 10)}`);
  lines.push(`set amount ${Math.round(state.scale * 10)}`);
  lines.push(`set loud-decay ${$('loudDecay').checked ? 'on' : 'off'}`);
  lines.push(`set filter-mode ${$('frequencyMode').checked ? 'on' : 'off'}`);
  lines.push(`set hp-mode ${$('hpMode').checked ? 'on' : 'off'}`);
  lines.push(`set mimic-sustain ${$('keyboardControl').checked ? 'on' : 'off'}`);
  lines.push(`set analogue ${$('analogueCurve').checked ? 'on' : 'off'}`);
  lines.push(`set linear-time ${$('linearTime').checked ? 'on' : 'off'}`);
  lines.push(`set zoom-time ${$('timelineZoom3x').checked ? 'on' : 'off'}`);
  lines.push(`set textbook ${$('textbookAdsr').checked ? 'on' : 'off'}`);
  lines.push(`set show-clipped ${$('showClipped').checked ? 'on' : 'off'}`);
  lines.push(`set show-contour ${$('showContour').checked ? 'on' : 'off'}`);
  lines.push(`set tb-sustain-dotted ${$('tbSustainDotted').checked ? 'on' : 'off'}`);
  lines.push(`set tb-sustain-collapse ${$('tbSustainCollapse').checked ? 'on' : 'off'}`);
  lines.push(`set tb-model-d-sustain ${$('tbShowModelDSustain').checked ? 'on' : 'off'}`);
  return lines.join('\n');
}

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
    '<div style="background:rgba(18,18,18,.97);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:22px 28px 24px;width:680px;max-width:92vw;color:#fff;font-family:Arial,Helvetica,sans-serif;position:relative;">' +
      '<button id="cueEditClose" style="position:absolute;top:10px;right:14px;background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;font-weight:800;cursor:pointer;line-height:1;padding:0">\xd7</button>' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin-bottom:10px">Cue List</div>' +
      '<textarea id="cueEditTextarea" style="width:100%;box-sizing:border-box;height:380px;background:#0a0a0a;color:#ccc;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:10px;font-family:monospace;font-size:13px;resize:vertical;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">' +
        '<button id="cueEditCopy" style="padding:5px 16px;">Copy</button>' +
        '<button id="cueEditSave" style="padding:5px 16px;">Save</button>' +
        '<button id="cueEditCancel" style="padding:5px 16px;">Cancel</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(editOverlay);

  function cueEditEscHandler(e) {
    if (e.key === 'Escape') { closeEditModal(); }
  }
  function openEditModal()  {
    document.getElementById('cueEditTextarea').value = cueListText;
    editOverlay.style.display = 'flex';
    document.addEventListener('keydown', cueEditEscHandler);
  }
  function closeEditModal() {
    editOverlay.style.display = 'none';
    document.removeEventListener('keydown', cueEditEscHandler);
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
