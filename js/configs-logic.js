// ---- buildConfigSnapshot — captures full app state to a plain object ----
function buildConfigSnapshot(){
  return {
    dtpConfig: true,
    version: 1,
    a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale,
    loudDecay: $('loudDecay').checked,
    drawReleaseWhenZero: $('drawReleaseWhenZero').checked,
    showBounds: $('showBounds').checked,
    showContour: $('showContour').checked,
    frequencyMode: $('frequencyMode').checked,
    hpMode: $('hpMode').checked,
    keyboardControl: $('keyboardControl').checked,
    showClipped: $('showClipped').checked,
    linearTime: $('linearTime').checked,
    analogueCurve: $('analogueCurve').checked,
    textbookAdsr: $('textbookAdsr').checked,
    tbSustainDotted: $('tbSustainDotted') ? $('tbSustainDotted').checked : true,
    tbSustainCollapse: $('tbSustainCollapse') ? $('tbSustainCollapse').checked : false,
    tbShowModelDSustain: $('tbShowModelDSustain') ? $('tbShowModelDSustain').checked : false,
    showOuterLine: $('showOuterLine') ? $('showOuterLine').checked : true,
    showEffectiveTimes: $('showEffectiveTimes') ? $('showEffectiveTimes').checked : false,
    showStatedTimes: $('showStatedTimes') ? $('showStatedTimes').checked : false,
    showEffectiveLines: $('showEffectiveLines') ? $('showEffectiveLines').checked : false,
    showStatedLines: $('showStatedLines') ? $('showStatedLines').checked : false,
    meterGlow: $('meterGlow') ? $('meterGlow').checked : true,
    meterGlowRadius: Number($('meterGlowRadius') ? $('meterGlowRadius').value : 5),
    meterScanlinesVisible: $('meterScanlinesVisible') ? $('meterScanlinesVisible').checked : true,
    blobGlowEnabled: $('blobGlowEnabled') ? $('blobGlowEnabled').checked : true,
    keepTapMarker: $('keepTapMarker') ? $('keepTapMarker').checked : true,
    timelineZoom3x: $('timelineZoom3x') ? $('timelineZoom3x').checked : false,
    blobGlowRadius: Number($('blobGlowRadius') ? $('blobGlowRadius').value : 8),
    curveAmount: Number($('curveAmount').value),
    audioEnabled: $('audioEnabled').checked,
    tapMode: tapMode,
    tapCustomMs: Number($('tapCustomMs').value),
    noteMode: noteMode,
    noteCustomHz: Number($('noteCustomHz').value),
    transitionSec: currentTransitionSec,
    activeTransBtn: activeTransBtn,
    liveAnimate: (document.querySelector('input[name="mode"]:checked') || {}).value || 'live',
    lineColor: $('lineColor').value,
    bgColor: $('bgColor').value,
    attackColor: $('attackColor').value,
    decayColor: $('decayColor').value,
    releaseColor: $('releaseColor').value,
    meterFillColor: $('meterFillColor').value,
    meterFillColorFilter: $('meterFillColorFilter').value,
    timeAxisStatedColor: $('timeAxisStatedColor').value,
    contourLineColor: $('contourLineColor') ? $('contourLineColor').value : '#ffff00',
    lineWidth: Number($('lineWidth').value),
    innerLineWidth: Number($('innerLineWidth').value),
    labelSize: Number($('labelSize').value),
    h1Scale: Number($('h1Scale') ? $('h1Scale').value : 1.0),
    h2Scale: Number($('h2Scale') ? $('h2Scale').value : 1.0),
    consoleScale: Number($('consoleScale').value),
    meterWidth: Number($('meterWidth').value),
    meterStrokeWidth: Number($('meterStrokeWidth').value),
    tbSustainGapMax: Number($('tbSustainGapMax').value),
    vbWidth: Number($('vbWidth').value),
    vbHeight: Number($('vbHeight').value),
    graphLeft: Number($('graphLeft') ? $('graphLeft').value : 220),
    activePresetIndex: window.getActivePresetIndex ? window.getActivePresetIndex() : -1,
    presetDirtyState: window.presetDirtyState || 'none'
  };
}

// ---- loadConfigObject — restores app state from a plain object ----
function loadConfigObject(cfg){

  // State
  state.a = cfg.a; state.d = cfg.d; state.s = cfg.s; state.r = cfg.r !== undefined ? cfg.r : 0.5; state.floor = cfg.floor; state.scale = cfg.scale;
  state.target.a = cfg.a; state.target.d = cfg.d; state.target.s = cfg.s; state.target.r = state.r; state.target.floor = cfg.floor; state.target.scale = cfg.scale;
  const _tbCollapse = cfg.tbSustainCollapse ? true : false;
  state.tbSustainGap = _tbCollapse ? 0 : SUSTAIN_GAP_MAX;
  state.target.tbSustainGap = state.tbSustainGap;

  // Checkboxes
  ['loudDecay','drawReleaseWhenZero','showBounds','showContour','showEffectiveTimes','showStatedTimes','showEffectiveLines','showStatedLines','frequencyMode','hpMode','keyboardControl','showClipped','linearTime','analogueCurve','textbookAdsr','tbSustainDotted','tbSustainCollapse','tbShowModelDSustain','showOuterLine','meterGlow','meterScanlinesVisible','blobGlowEnabled','keepTapMarker','timelineZoom3x'].forEach(id => {
    if($(id) && cfg[id] !== undefined) $(id).checked = cfg[id];
  });
  const restoredZoom = ($('timelineZoom3x') && $('timelineZoom3x').checked) ? 3 : 1;
  state.zoomFactor = restoredZoom; state.target.zoomFactor = restoredZoom;
  syncHpModeEnabled();
  syncAnalogueCurve();

  // Numeric inputs
  if($('tapCustomMs') && cfg.tapCustomMs !== undefined) $('tapCustomMs').value = cfg.tapCustomMs;
  if($('noteCustomHz') && cfg.noteCustomHz !== undefined) $('noteCustomHz').value = cfg.noteCustomHz;
  if($('curveAmount') && cfg.curveAmount !== undefined){
    $('curveAmount').value = cfg.curveAmount;
    const val = $('curveAmountVal'); if(val) val.textContent = cfg.curveAmount;
  }
  if($('customTransitionTime') && cfg.transitionSec !== undefined) $('customTransitionTime').value = cfg.transitionSec;

  // Audio enabled
  if($('audioEnabled') && cfg.audioEnabled !== undefined) $('audioEnabled').checked = cfg.audioEnabled;

  // Tap mode
  const tapBtnMap = {tap50:'tapMode50Btn', tap100:'tapMode100Btn', tap200:'tapMode200Btn', tap500:'tap500Btn', tap1000:'tap1sBtn', tapCustom:'tapModeCustomBtn', hold:'tapModeHoldBtn'};
  if(cfg.tapMode && tapBtnMap[cfg.tapMode]) setTapMode(cfg.tapMode, tapBtnMap[cfg.tapMode]);

  // Note mode
  if(cfg.noteMode){
    const freq = noteFreqs[cfg.noteMode] !== undefined ? noteFreqs[cfg.noteMode] : null;
    setNoteMode(cfg.noteMode, freq);
  }

  // Transition
  if(cfg.activeTransBtn) setTransMode(cfg.transitionSec !== undefined ? cfg.transitionSec : 1, cfg.activeTransBtn);

  // Live/Animate mode
  if(cfg.liveAnimate){
    const radio = document.querySelector(`input[name="mode"][value="${cfg.liveAnimate}"]`);
    if(radio) radio.checked = true;
  }

  // Colours (dispatch input to update CSS variables)
  ['lineColor','bgColor','attackColor','decayColor','releaseColor','meterFillColor','meterFillColorFilter','timeAxisStatedColor','contourLineColor'].forEach(id => {
    if($(id) && cfg[id]){ $(id).value = cfg[id]; $(id).dispatchEvent(new Event('input')); }
  });

  // Line widths
  if($('lineWidth') && cfg.lineWidth !== undefined){ $('lineWidth').value = cfg.lineWidth; $('lineWidth').dispatchEvent(new Event('input')); }
  if($('innerLineWidth') && cfg.innerLineWidth !== undefined){ $('innerLineWidth').value = cfg.innerLineWidth; $('innerLineWidth').dispatchEvent(new Event('input')); }
  if($('labelSize') && cfg.labelSize !== undefined){ $('labelSize').value = cfg.labelSize; $('labelSize').dispatchEvent(new Event('input')); }
  if($('h1Scale') && cfg.h1Scale !== undefined){ const v=Math.min(3.0,Math.max(1.0,Number(cfg.h1Scale)||1.0)); $('h1Scale').value=v.toFixed(1); document.documentElement.style.setProperty('--h1Scale',v); }
  if($('h2Scale') && cfg.h2Scale !== undefined){ const v=Math.min(3.0,Math.max(1.0,Number(cfg.h2Scale)||1.0)); $('h2Scale').value=v.toFixed(1); document.documentElement.style.setProperty('--h2Scale',v); }
  if($('consoleScale') && cfg.consoleScale !== undefined){ $('consoleScale').value = cfg.consoleScale; syncConsoleScale(); }
  if($('meterWidth') && cfg.meterWidth !== undefined){ $('meterWidth').value = cfg.meterWidth; METER_W = Math.max(10, Math.min(80, Number(cfg.meterWidth) || 40)); }
  if($('meterStrokeWidth') && cfg.meterStrokeWidth !== undefined){ $('meterStrokeWidth').value = cfg.meterStrokeWidth; METER_STROKE_W = Math.max(1, Math.min(20, Number(cfg.meterStrokeWidth) || 7)); }
  if($('tbSustainGapMax') && cfg.tbSustainGapMax !== undefined){ $('tbSustainGapMax').value = cfg.tbSustainGapMax; SUSTAIN_GAP_MAX = Math.max(0.15, Math.min(0.30, (Number(cfg.tbSustainGapMax) || 15) / 100)); }
  if($('vbWidth')  && cfg.vbWidth  !== undefined){ $('vbWidth').value  = Math.round(Math.min(2400, Math.max(800,  Number(cfg.vbWidth)  || 1200)) / 10) * 10; }
  if($('vbHeight') && cfg.vbHeight !== undefined){ $('vbHeight').value = Math.round(Math.min(1200, Math.max(400,  Number(cfg.vbHeight) || 595))  / 10) * 10; }
  VB_WIDTH   = Number(document.getElementById('vbWidth').value);
  VB_HEIGHT  = Number(document.getElementById('vbHeight').value);
  if($('graphLeft') && cfg.graphLeft !== undefined){ $('graphLeft').value = Math.round(Math.min(400,Math.max(80,Number(cfg.graphLeft)||220))/10)*10; }
  GRAPH_LEFT = Number(document.getElementById('graphLeft').value);
  recalcGeometry();
  if($('meterGlowRadius') && cfg.meterGlowRadius !== undefined){ $('meterGlowRadius').value = cfg.meterGlowRadius; }
  if($('blobGlowRadius') && cfg.blobGlowRadius !== undefined){ $('blobGlowRadius').value = cfg.blobGlowRadius; }

  // Preset highlight
  if(window.restorePresetHighlight){
    window.restorePresetHighlight(cfg.activePresetIndex !== undefined ? cfg.activePresetIndex : -1, cfg.presetDirtyState || 'none');
  }
  transition(0);
  refreshNumericInputs();
  syncControls();
}

window.loadConfigObject = loadConfigObject;

// ---- Merge saved configs from localStorage over defaults ----
(function(){
  try {
    const saved = localStorage.getItem('dtpConfigs');
    if(!saved) return;
    const parsed = JSON.parse(saved);
    if(!Array.isArray(parsed)) return;
    parsed.forEach(c => {
      const idx = CONFIGS.findIndex(q => q.name === c.name);
      if(idx >= 0) Object.assign(CONFIGS[idx], c);
      else CONFIGS.push(c);
    });
  } catch(e){}
})();

// ---- Configs logic — called from init after $ and state are defined ----
function initConfigsLogic(){
  const container = $('configBtns');
  let activeConfigBtn = null;
  let activeConfigIndex = -1;

  function saveConfigsToStorage(){
    try { localStorage.setItem('dtpConfigs', JSON.stringify(CONFIGS)); } catch(e){}
  }

  function updateConfigNameDisplay(cfg){
    const el = $('configName');
    if(el && el.tagName === 'SPAN') el.textContent = `${cfg.name}: ${cfg.label}`;
  }

  function restoreConfigNameDisplay(){
    const el = $('configName');
    if(!el || el.tagName !== 'SPAN') return;
    el.textContent = activeConfigIndex >= 0 && CONFIGS[activeConfigIndex]
      ? `${CONFIGS[activeConfigIndex].name}: ${CONFIGS[activeConfigIndex].label}`
      : '';
  }

  function loadConfig(idx){
    if(idx < 0 || idx >= CONFIGS.length) return;
    const cfg = CONFIGS[idx];
    if(activeConfigBtn){ activeConfigBtn.style.background = ''; activeConfigBtn.style.color = ''; }
    const btns = container.querySelectorAll('button');
    activeConfigBtn = btns[idx] || null;
    if(activeConfigBtn){ activeConfigBtn.style.background = '#ffffff'; activeConfigBtn.style.color = '#111111'; }
    activeConfigIndex = idx;
    updateConfigNameDisplay(cfg);
    loadConfigObject(cfg);
  }
  window.loadConfigByIndex = loadConfig;

  function saveCurrentToConfig(idx){
    if(idx < 0 || idx >= CONFIGS.length) return;
    const cfg = CONFIGS[idx];
    const label = prompt('Config name:', cfg.label);
    if(label === null) return;
    const snapshot = buildConfigSnapshot();
    snapshot.name = cfg.name;
    snapshot.label = label.trim() || cfg.label;
    Object.assign(cfg, snapshot);
    saveConfigsToStorage();
    const btn = container.querySelectorAll('button')[idx];
    if(btn) flashButton(btn, () => activeConfigIndex === idx);
    if(activeConfigIndex === idx) updateConfigNameDisplay(cfg);
  }

  function buildButtons(){
    container.innerHTML = '';
    CONFIGS.forEach((cfg, idx) => {
      const btn = document.createElement('button');
      btn.textContent = cfg.name;
      btn.style.padding = '3px 5px';
      btn.addEventListener('mouseenter', () => updateConfigNameDisplay(cfg));
      btn.addEventListener('mouseleave', restoreConfigNameDisplay);
      btn.addEventListener('click', e => {
        if(e.shiftKey){ saveCurrentToConfig(idx); return; }
        loadConfig(idx);
      });
      container.appendChild(btn);
    });
  }
  buildButtons();

  attachNameEdit('configName', newLabel => {
    if(newLabel === null){
      if(activeConfigIndex < 0) return null;
      return { label: CONFIGS[activeConfigIndex].label };
    }
    const cfg = CONFIGS[activeConfigIndex];
    cfg.label = newLabel;
    saveConfigsToStorage();
    return `${cfg.name}: ${newLabel}`;
  });

  $('exportConfigsBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(CONFIGS, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'configs-export.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  $('importConfigsBtn').addEventListener('click', () => {
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
          data.forEach((c, i) => {
            if(typeof c.name !== 'string') throw new Error(`Item ${i} missing "name"`);
            if(!c.dtpConfig) throw new Error(`Item ${i} missing dtpConfig`);
          });
          CONFIGS.length = 0; data.forEach(c => CONFIGS.push(c));
          saveConfigsToStorage();
          activeConfigBtn = null; activeConfigIndex = -1;
          buildButtons();
          const el = $('configName'); if(el) el.textContent = '';
        } catch(err){ alert('Import failed: ' + err.message); }
        document.body.removeChild(inp);
      };
      reader.readAsText(file);
    });
    inp.click();
  });
}
