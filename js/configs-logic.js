// ---- buildConfigSnapshot — captures full app state to a plain object ----
function buildConfigSnapshot(){
  return {
    dtpConfig: true,
    version: 1,
    a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale, gate: state.gate,
    loudDecay: $('loudDecay').checked,
    showContour: $('showContour').checked,
    frequencyMode: $('frequencyMode').checked,
    hpMode: $('hpMode').checked,
    keyboardControl: $('keyboardControl').checked,
    showClipped: $('showClipped').checked,
    analogueCurve: $('analogueCurve').checked,
    linkRToD: $('linkRToD') ? $('linkRToD').checked : false,
    showNewEffectiveLines: $('showNewEffectiveLines') ? $('showNewEffectiveLines').checked : true,
    showNewStatedLines: $('showNewStatedLines') ? $('showNewStatedLines').checked : true,
    modelA: $('modelA') ? $('modelA').checked : true,
    modelD: $('modelD') ? $('modelD').checked : true,
    modelS: $('modelS') ? $('modelS').checked : true,
    modelR: $('modelR') ? $('modelR').checked : true,
    showGateTime: $('showGateTime') ? $('showGateTime').checked : false,
    clipAtGate: $('clipAtGate') ? $('clipAtGate').checked : false,
    showPeakDischarge: $('showPeakDischarge') ? $('showPeakDischarge').checked : false,
    meterGlow: $('meterGlow') ? $('meterGlow').checked : true,
    meterGlowRadius: Number($('meterGlowRadius') ? $('meterGlowRadius').value : 5),
    kioskKnobGlow: $('kioskKnobGlow') ? $('kioskKnobGlow').checked : true,
    kioskKnobGlowRadius: Number($('kioskKnobGlowRadius') ? $('kioskKnobGlowRadius').value : 40),
    kioskInactiveOpacity: Number($('kioskInactiveOpacity') ? $('kioskInactiveOpacity').value : 70),
    meterScanlinesVisible: $('meterScanlinesVisible') ? $('meterScanlinesVisible').checked : true,
    blobGlowEnabled: $('blobGlowEnabled') ? $('blobGlowEnabled').checked : true,
    zoomFactor: state.zoomFactor,
    blobGlowRadius: Number($('blobGlowRadius') ? $('blobGlowRadius').value : 8),
    curveAmount: Number($('curveAmount').value),
    audioEnabled: $('audioEnabled').checked,
    noteMode: noteMode,
    noteCustomHz: Number($('noteCustomHz').value),
    transitionSec: currentTransitionSec,
    activeTransBtn: activeTransBtn,
    liveAnimate: (document.querySelector('input[name="mode"]:checked') || {}).value || 'live',
    lineColor: $('lineColor').value,
    bgColor: $('bgColor').value,
    loudnessAttackColor: $('loudnessAttackColor').value,
    loudnessDecayColor: $('loudnessDecayColor').value,
    loudnessReleaseColor: $('loudnessReleaseColor').value,
    filterAttackColor: $('filterAttackColor').value,
    filterDecayColor: $('filterDecayColor').value,
    filterReleaseColor: $('filterReleaseColor').value,
    loudnessGateColor: $('loudnessGateColor') ? $('loudnessGateColor').value : '#ff8800',
    filterGateColor: $('filterGateColor') ? $('filterGateColor').value : '#ff8800',
    meterFillColor: $('meterFillColor').value,
    meterFillColorFilter: $('meterFillColorFilter').value,
    timeAxisStatedColor: $('timeAxisStatedColor').value,
    contourLineColor: $('contourLineColor') ? $('contourLineColor').value : '#ffff00',
    underlayColor: $('underlayColor') ? $('underlayColor').value : '#ffffff',
    innerLineWidth: Number($('innerLineWidth').value),
    markerLineWidth: Number($('markerLineWidth') ? $('markerLineWidth').value : 1),
    dottedMarkers: $('dottedMarkers') ? $('dottedMarkers').checked : true,
    labelSize: Number($('labelSize').value),
    h1Scale: Number($('h1Scale') ? $('h1Scale').value : 1.0),
    blobScale: Number($('blobScale') ? $('blobScale').value : 3),
    h2Scale: Number($('h2Scale') ? $('h2Scale').value : 1.0),
    consoleScale: Number($('consoleScale').value),
    meterWidth: Number($('meterWidth').value),
    meterStrokeWidth: Number($('meterStrokeWidth').value),
    tbSustainGapMax: Number($('tbSustainGapMax').value),
    vbWidth: Number($('vbWidth').value),
    vbHeight: Number($('vbHeight').value),
    graphLeft: Number($('graphLeft') ? $('graphLeft').value : 10),
    graphTop: Number($('graphTop') ? $('graphTop').value : 0),
    activePresetIndex: window.getActivePresetIndex ? window.getActivePresetIndex() : -1,
    presetDirtyState: window.presetDirtyState || 'none',
    kioskOpen: kioskOpen,
    showCues: $('showCues') ? $('showCues').checked : false,
    timeLabelGutter: Number($('timeLabelGutter') ? $('timeLabelGutter').value : 0),
    persistTime: Number($('persistTime') ? $('persistTime').value : 2000)
  };
}

// ---- loadConfigObject — restores app state from a plain object ----
function loadConfigObject(cfg){

  // State
  state.a = cfg.a; state.d = cfg.d; state.s = cfg.s; state.r = cfg.r !== undefined ? cfg.r : 0.5; state.floor = cfg.floor; state.scale = cfg.scale;
  if(cfg.gate !== undefined){ state.gate = cfg.gate; state.target.gate = cfg.gate; }
  state.target.a = cfg.a; state.target.d = cfg.d; state.target.s = cfg.s; state.target.r = state.r; state.target.floor = cfg.floor; state.target.scale = cfg.scale;
  state.tbSustainGap = SUSTAIN_GAP_MAX;
  state.target.tbSustainGap = SUSTAIN_GAP_MAX;

  // Checkboxes
  ['loudDecay','showContour','showNewEffectiveLines','showNewStatedLines','modelA','modelD','modelS','modelR','showGateTime','clipAtGate','showPeakDischarge','frequencyMode','hpMode','keyboardControl','showClipped','analogueCurve','linkRToD','dottedMarkers','meterGlow','meterScanlinesVisible','blobGlowEnabled','kioskKnobGlow'].forEach(id => {
    if($(id) && cfg[id] !== undefined) $(id).checked = cfg[id];
  });
  const restoredZoom = cfg.zoomFactor !== undefined ? cfg.zoomFactor : 3;
  state.zoomFactor = restoredZoom; state.target.zoomFactor = restoredZoom;
  syncZoomReadout();
  syncHpModeEnabled();
  syncAnalogueCurve();

  // Numeric inputs
  if($('noteCustomHz') && cfg.noteCustomHz !== undefined) $('noteCustomHz').value = cfg.noteCustomHz;
  if($('curveAmount') && cfg.curveAmount !== undefined){
    $('curveAmount').value = cfg.curveAmount;
    const val = $('curveAmountVal'); if(val) val.textContent = cfg.curveAmount;
  }
  if($('customTransitionTime') && cfg.transitionSec !== undefined) $('customTransitionTime').value = cfg.transitionSec;

  // Audio enabled
  if($('audioEnabled') && cfg.audioEnabled !== undefined) $('audioEnabled').checked = cfg.audioEnabled;

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
  ['lineColor','bgColor','loudnessAttackColor','loudnessDecayColor','loudnessReleaseColor','loudnessGateColor','filterAttackColor','filterDecayColor','filterReleaseColor','filterGateColor','meterFillColor','meterFillColorFilter','timeAxisStatedColor','contourLineColor','underlayColor'].forEach(id => {
    if($(id) && cfg[id]){ $(id).value = cfg[id]; $(id).dispatchEvent(new Event('input')); }
  });

  // Line widths
  if($('innerLineWidth') && cfg.innerLineWidth !== undefined){ $('innerLineWidth').value = cfg.innerLineWidth; $('innerLineWidth').dispatchEvent(new Event('input')); }
  if($('markerLineWidth') && cfg.markerLineWidth !== undefined){ $('markerLineWidth').value = cfg.markerLineWidth; $('markerLineWidth').dispatchEvent(new Event('input')); }
  if(cfg.dottedMarkers !== undefined) document.documentElement.style.setProperty('--markerDash', cfg.dottedMarkers ? '4 4' : 'none');
  if($('labelSize') && cfg.labelSize !== undefined){ $('labelSize').value = cfg.labelSize; $('labelSize').dispatchEvent(new Event('input')); }
  if($('h1Scale') && cfg.h1Scale !== undefined){ const v=Math.min(3.0,Math.max(1.0,Number(cfg.h1Scale)||1.0)); $('h1Scale').value=v.toFixed(1); document.documentElement.style.setProperty('--h1Scale',v); }
  if($('h2Scale') && cfg.h2Scale !== undefined){ const v=Math.min(3.0,Math.max(1.0,Number(cfg.h2Scale)||1.0)); $('h2Scale').value=v.toFixed(1); document.documentElement.style.setProperty('--h2Scale',v); }
  if($('blobScale') && cfg.blobScale !== undefined){ $('blobScale').value = Math.min(8,Math.max(1,Number(cfg.blobScale)||3)); syncRadii(); }
  if($('consoleScale') && cfg.consoleScale !== undefined){ $('consoleScale').value = cfg.consoleScale; syncConsoleScale(); }
  if($('meterWidth') && cfg.meterWidth !== undefined){ $('meterWidth').value = cfg.meterWidth; METER_W = Math.max(10, Math.min(80, Number(cfg.meterWidth) || 40)); }
  if($('meterStrokeWidth') && cfg.meterStrokeWidth !== undefined){ $('meterStrokeWidth').value = cfg.meterStrokeWidth; METER_STROKE_W = Math.max(1, Math.min(20, Number(cfg.meterStrokeWidth) || 7)); }
  if($('tbSustainGapMax') && cfg.tbSustainGapMax !== undefined){ $('tbSustainGapMax').value = cfg.tbSustainGapMax; SUSTAIN_GAP_MAX = Math.max(0.15, Math.min(0.30, (Number(cfg.tbSustainGapMax) || 15) / 100)); }
  if($('vbWidth')  && cfg.vbWidth  !== undefined){ $('vbWidth').value  = Math.round(Math.min(VB_WIDTH_MAX, Math.max(VB_WIDTH_MIN,  Number(cfg.vbWidth)  || 1200)) / 10) * 10; }
  if($('vbHeight') && cfg.vbHeight !== undefined){ $('vbHeight').value = Math.round(Math.min(VB_HEIGHT_MAX, Math.max(VB_HEIGHT_MIN,  Number(cfg.vbHeight) || 595))  / 10) * 10; }
  VB_WIDTH   = Number(document.getElementById('vbWidth').value);
  VB_HEIGHT  = Number(document.getElementById('vbHeight').value);
  if($('graphLeft') && cfg.graphLeft !== undefined){ $('graphLeft').value = Math.round(Math.min(400,Math.max(0,Number(cfg.graphLeft)||10))/10)*10; }
  GRAPH_LEFT = Number(document.getElementById('graphLeft').value);
  if($('graphTop') && cfg.graphTop !== undefined){ $('graphTop').value = Math.round(Math.min(400,Math.max(0,Number(cfg.graphTop)||0))/10)*10; }
  GRAPH_TOP_EXTRA = Number(document.getElementById('graphTop') ? document.getElementById('graphTop').value : 0);
  recalcGeometry();
  if($('meterGlowRadius') && cfg.meterGlowRadius !== undefined){ $('meterGlowRadius').value = cfg.meterGlowRadius; }
  if($('blobGlowRadius') && cfg.blobGlowRadius !== undefined){ $('blobGlowRadius').value = cfg.blobGlowRadius; }
  if($('kioskKnobGlowRadius') && cfg.kioskKnobGlowRadius !== undefined){ $('kioskKnobGlowRadius').value = cfg.kioskKnobGlowRadius; }
  if($('kioskInactiveOpacity') && cfg.kioskInactiveOpacity !== undefined){ $('kioskInactiveOpacity').value = cfg.kioskInactiveOpacity; }
  if($('timeLabelGutter') && cfg.timeLabelGutter !== undefined){ $('timeLabelGutter').value = cfg.timeLabelGutter; }
  if($('persistTime') && cfg.persistTime !== undefined){ $('persistTime').value = cfg.persistTime; }

  // Preset highlight
  if(window.restorePresetHighlight){
    window.restorePresetHighlight(cfg.activePresetIndex !== undefined ? cfg.activePresetIndex : -1, cfg.presetDirtyState || 'none');
  }
  // Kiosk state
  if(cfg.kioskOpen) openKiosk(); else closeKiosk();

  // Show Cues state
  if($('showCues') && cfg.showCues !== undefined){
    $('showCues').checked = cfg.showCues;
    $('showCues').dispatchEvent(new Event('change'));
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
    logEvent('CONFIG', { action: 'load', index: idx, name: cfg.name });
    if(activeConfigBtn){ activeConfigBtn.style.background = ''; activeConfigBtn.style.color = ''; }
    const btns = container.querySelectorAll('button');
    activeConfigBtn = btns[idx] || null;
    if(activeConfigBtn){ activeConfigBtn.style.background = BTN_ACTIVE_BG; activeConfigBtn.style.color = BTN_ACTIVE_FG; }
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
    logEvent('CONFIG', { action: 'save', index: idx, name: cfg.name });
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

  $('exportConfigsBtn').addEventListener('click', () => downloadJSON(CONFIGS, 'configs.json'));

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
      reader.onerror = () => alert('Failed to read file — please try again.');
      reader.readAsText(file);
    });
    inp.click();
  });
}
