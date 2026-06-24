// ---- Merge saved presets from localStorage over defaults ----
(function(){
  try {
    const saved = localStorage.getItem('dtpPresets');
    if(!saved) return;
    const parsed = JSON.parse(saved);
    if(!Array.isArray(parsed)) return;
    parsed.forEach(p => {
      const idx = PRESETS.findIndex(q => q.name === p.name);
      if(idx >= 0) Object.assign(PRESETS[idx], p);
      else PRESETS.push(p);
    });
  } catch(e){}
})();

// ---- Presets logic — called from init after $ and state are defined ----
function initPresetsLogic(){
  const container = $('presetBtns');
  let activeBtn = null;
  let activePresetIndex = -1;
  window.presetDirtyState = 'none';

  window.markPresetDirty = function(){
    if(window.presetDirtyState !== 'clean') return;
    window.presetDirtyState = 'dirty';
    if(activeBtn){ activeBtn.style.background = BTN_PARTIAL_BG; activeBtn.style.color = '#ffffff'; }
  };

  function savePresetsToStorage(){
    try { localStorage.setItem('dtpPresets', JSON.stringify(PRESETS)); } catch(e){}
  }
  window.savePresetsToStorage = savePresetsToStorage;

  function updatePresetNameDisplay(preset){
    const el = $('presetName');
    if(el && el.tagName === 'SPAN') el.textContent = `${preset.name}: ${preset.label}`;
  }

  function loadPreset(idx){
    if(idx < 0 || idx >= PRESETS.length) return;
    const preset = PRESETS[idx];
    logEvent('PRESET', { action: 'load', index: idx, name: preset.name });
    // Restore checkbox states if saved in preset
    if(preset.loudDecay !== undefined) $('loudDecay').checked = preset.loudDecay;
    if(preset.filterMode !== undefined) $('frequencyMode').checked = preset.filterMode;
    if(preset.lpHp !== undefined) $('hpMode').checked = preset.lpHp;
    if(preset.keyboardControl !== undefined) $('keyboardControl').checked = preset.keyboardControl;
    if(preset.modelA !== undefined) $('modelA').checked = preset.modelA;
    if(preset.modelD !== undefined) $('modelD').checked = preset.modelD;
    if(preset.modelS !== undefined) $('modelS').checked = preset.modelS;
    if(preset.modelR !== undefined) $('modelR').checked = preset.modelR;
    if(preset.underlayA !== undefined) $('underlayA').checked = preset.underlayA;
    if(preset.underlayD !== undefined) $('underlayD').checked = preset.underlayD;
    if(preset.underlayS !== undefined) $('underlayS').checked = preset.underlayS;
    if(preset.underlayR !== undefined) $('underlayR').checked = preset.underlayR;
    if(preset.showGateTime !== undefined) $('showGateTime').checked = preset.showGateTime;
    if(preset.timelineZoom3x !== undefined) $('timelineZoom3x').checked = preset.timelineZoom3x;
    if(preset.timelineZoom6x !== undefined) $('timelineZoom6x').checked = preset.timelineZoom6x;
    if(preset.timelineZoom12x !== undefined) $('timelineZoom12x').checked = preset.timelineZoom12x;
    if(preset.timelineZoom24x !== undefined) $('timelineZoom24x').checked = preset.timelineZoom24x;
    if(preset.timelineZoom48x !== undefined) $('timelineZoom48x').checked = preset.timelineZoom48x;
    if(preset.showNewEffectiveLines !== undefined) $('showNewEffectiveLines').checked = preset.showNewEffectiveLines;
    if(preset.showNewStatedLines !== undefined) $('showNewStatedLines').checked = preset.showNewStatedLines;
    if(preset.persistEnabled !== undefined) $('persistEnabled').checked = preset.persistEnabled;
    // Set target knob values
    state.target.a = positionFromMs(preset.a);
    state.target.d = positionFromMs(preset.d);
    state.target.s = preset.s / 10;
    state.target.r = positionFromMs(preset.r !== undefined ? preset.r : 500);
    state.target.floor = (preset.floor || 0) / 10;
    state.target.scale = (preset.scale !== undefined ? preset.scale : 10) / 10;
    if(preset.gate !== undefined) state.target.gate = gatePositionFromMs(preset.gate);
    // Highlight active button
    if(activeBtn){ activeBtn.style.background = ''; activeBtn.style.color = ''; }
    const btns = container.querySelectorAll('button');
    activeBtn = btns[idx] || null;
    if(activeBtn){ activeBtn.style.background = BTN_ACTIVE_BG; activeBtn.style.color = BTN_ACTIVE_FG; }
    activePresetIndex = idx;
    window.presetDirtyState = 'clean';
    updatePresetNameDisplay(preset);
    transition(currentTransitionSec);
  }
  window.loadPresetByIndex = loadPreset;

  window.clearPresetDisplay = function(){
    if(activeBtn){ activeBtn.style.background = ''; activeBtn.style.color = ''; activeBtn = null; }
    activePresetIndex = -1;
    window.presetDirtyState = 'none';
    const el = $('presetName');
    if(el) el.textContent = '';
  };

  window.getActivePresetIndex = function(){ return activePresetIndex; };

  window.restorePresetHighlight = function(idx, dirtyState){
    if(activeBtn){ activeBtn.style.background = ''; activeBtn.style.color = ''; activeBtn = null; }
    window.presetDirtyState = dirtyState || 'none';
    activePresetIndex = idx;
    if(idx >= 0 && idx < PRESETS.length){
      const btns = container.querySelectorAll('button');
      activeBtn = btns[idx] || null;
      if(activeBtn){
        if(dirtyState === 'dirty'){ activeBtn.style.background = BTN_PARTIAL_BG; activeBtn.style.color = '#ffffff'; }
        else { activeBtn.style.background = BTN_ACTIVE_BG; activeBtn.style.color = BTN_ACTIVE_FG; }
      }
      updatePresetNameDisplay(PRESETS[idx]);
    } else {
      const el = $('presetName');
      if(el) el.textContent = '';
    }
  };

  function saveCurrentToPreset(idx){
    if(idx < 0 || idx >= PRESETS.length) return;
    const preset = PRESETS[idx];
    const label = prompt('Preset name:', preset.label);
    if(label === null) return; // cancelled
    logEvent('PRESET', { action: 'save', index: idx, name: preset.name });
    preset.label = label.trim() || preset.label;
    preset.a = msFromPosition(state.a);
    preset.d = msFromPosition(state.d);
    preset.s = parseFloat((state.s * 10).toFixed(1));
    preset.r = msFromPosition(state.r);
    preset.floor = parseFloat((state.floor * 10).toFixed(1));
    preset.scale = parseFloat((state.scale * 10).toFixed(1));
    preset.loudDecay = $('loudDecay').checked;
    preset.filterMode = $('frequencyMode').checked;
    preset.lpHp = $('hpMode').checked;
    preset.keyboardControl = $('keyboardControl').checked;
    preset.gate = Math.round(gateMsFromPosition(state.gate));
    preset.modelA = $('modelA').checked;
    preset.modelD = $('modelD').checked;
    preset.modelS = $('modelS').checked;
    preset.modelR = $('modelR').checked;
    preset.underlayA = $('underlayA').checked;
    preset.underlayD = $('underlayD').checked;
    preset.underlayS = $('underlayS').checked;
    preset.underlayR = $('underlayR').checked;
    preset.showGateTime = $('showGateTime').checked;
    preset.timelineZoom3x = $('timelineZoom3x').checked;
    preset.timelineZoom6x = $('timelineZoom6x').checked;
    preset.timelineZoom12x = $('timelineZoom12x').checked;
    preset.timelineZoom24x = $('timelineZoom24x').checked;
    preset.timelineZoom48x = $('timelineZoom48x').checked;
    preset.showNewEffectiveLines = $('showNewEffectiveLines').checked;
    preset.showNewStatedLines = $('showNewStatedLines').checked;
    preset.persistEnabled = $('persistEnabled').checked;
    savePresetsToStorage();
    // Flash green confirmation, then restore highlight state
    const btn = container.querySelectorAll('button')[idx];
    if(btn) flashButton(btn, () => activePresetIndex === idx);
    if(activePresetIndex === idx) updatePresetNameDisplay(preset);
  }

  function restorePresetNameDisplay(){
    const el = $('presetName');
    if(!el || el.tagName !== 'SPAN') return;
    el.textContent = activePresetIndex >= 0 && PRESETS[activePresetIndex]
      ? `${PRESETS[activePresetIndex].name}: ${PRESETS[activePresetIndex].label}`
      : '';
  }

  function buildButtons(){
    container.innerHTML = '';
    PRESETS.forEach((preset, idx) => {
      const btn = document.createElement('button');
      btn.textContent = preset.name;
      btn.style.padding = '3px 5px';
      btn.addEventListener('mouseenter', () => updatePresetNameDisplay(preset));
      btn.addEventListener('mouseleave', restorePresetNameDisplay);
      btn.addEventListener('click', e => {
        if(e.shiftKey){ saveCurrentToPreset(idx); return; }
        loadPreset(idx);
      });
      container.appendChild(btn);
    });
  }
  buildButtons();

  window.refreshPresetButtons = function(){
    activeBtn = null;
    activePresetIndex = -1;
    buildButtons();
    const el = $('presetName');
    if(el) el.textContent = '';
  };

  // Left/right arrow key navigation between presets
  document.addEventListener('keydown', e => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if(['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
    if($('helpOverlay') && $('helpOverlay').style.display !== 'none') return;
    if(e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if(e.key === 'ArrowRight'){
      e.preventDefault();
      loadPreset((activePresetIndex + 1) % PRESETS.length);
    } else if(e.key === 'ArrowLeft'){
      e.preventDefault();
      loadPreset((activePresetIndex - 1 + PRESETS.length) % PRESETS.length);
    }
  });

  // Click-to-edit preset name display
  attachNameEdit('presetName', newLabel => {
    if(newLabel === null){
      if(activePresetIndex < 0) return null;
      return { label: PRESETS[activePresetIndex].label };
    }
    const preset = PRESETS[activePresetIndex];
    preset.label = newLabel;
    savePresetsToStorage();
    return `${preset.name}: ${newLabel}`;
  });

  // Export presets as JSON file
  $('exportPresetsBtn').addEventListener('click', () => downloadJSON(PRESETS, 'presets.json'));

  // Import presets from JSON file
  $('importPresetsBtn').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json'; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', e => {
      const file = e.target.files[0];
      if(!file){ document.body.removeChild(inp); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if(!Array.isArray(data)) throw new Error('Expected a JSON array');
          data.forEach((p, i) => {
            if(typeof p.name !== 'string') throw new Error(`Item ${i} missing "name"`);
            if(typeof p.a !== 'number') throw new Error(`Item ${i} missing "a"`);
          });
          PRESETS.length = 0;
          data.forEach(p => PRESETS.push(p));
          savePresetsToStorage();
          window.refreshPresetButtons();
        } catch(err){ alert('Import failed: ' + err.message); }
        document.body.removeChild(inp);
      };
      reader.onerror = () => alert('Failed to read file — please try again.');
      reader.readAsText(file);
    });
    inp.click();
  });
}
