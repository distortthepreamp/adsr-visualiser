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
    if(activeBtn){ activeBtn.style.background = 'rgba(255,255,255,0.35)'; activeBtn.style.color = '#ffffff'; }
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
    // Restore checkbox states if saved in preset
    if(preset.loudDecay !== undefined) $('loudDecay').checked = preset.loudDecay;
    if(preset.drawReleaseWhenZero !== undefined) $('drawReleaseWhenZero').checked = preset.drawReleaseWhenZero;
    if(preset.filterMode !== undefined) $('frequencyMode').checked = preset.filterMode;
    if(preset.lpHp !== undefined) $('hpMode').checked = preset.lpHp;
    if(preset.keyboardControl !== undefined) $('keyboardControl').checked = preset.keyboardControl;
    if(preset.textbookAdsr !== undefined) $('textbookAdsr').checked = preset.textbookAdsr;
    // Set target knob values
    state.target.a = positionFromMs(preset.a);
    state.target.d = positionFromMs(preset.d);
    state.target.s = preset.s / 10;
    state.target.r = positionFromMs(preset.r !== undefined ? preset.r : 500);
    state.target.floor = (preset.floor || 0) / 10;
    state.target.scale = (preset.scale !== undefined ? preset.scale : 10) / 10;
    // Highlight active button
    if(activeBtn){ activeBtn.style.background = ''; activeBtn.style.color = ''; }
    const btns = container.querySelectorAll('button');
    activeBtn = btns[idx] || null;
    if(activeBtn){ activeBtn.style.background = '#ffffff'; activeBtn.style.color = '#111111'; }
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
        if(dirtyState === 'dirty'){ activeBtn.style.background = 'rgba(255,255,255,0.35)'; activeBtn.style.color = '#ffffff'; }
        else { activeBtn.style.background = '#ffffff'; activeBtn.style.color = '#111111'; }
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
    preset.label = label.trim() || preset.label;
    preset.a = msFromPosition(state.a);
    preset.d = msFromPosition(state.d);
    preset.s = parseFloat((state.s * 10).toFixed(1));
    preset.r = msFromPosition(state.r);
    preset.floor = parseFloat((state.floor * 10).toFixed(1));
    preset.scale = parseFloat((state.scale * 10).toFixed(1));
    preset.loudDecay = $('loudDecay').checked;
    preset.drawReleaseWhenZero = $('drawReleaseWhenZero').checked;
    preset.filterMode = $('frequencyMode').checked;
    preset.lpHp = $('hpMode').checked;
    preset.keyboardControl = $('keyboardControl').checked;
    preset.textbookAdsr = $('textbookAdsr').checked;
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
  $('exportPresetsBtn').addEventListener('click', () => {
    const json = JSON.stringify(PRESETS, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'presets.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

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
      reader.readAsText(file);
    });
    inp.click();
  });
}
