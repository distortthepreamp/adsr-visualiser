// ---- paths.js — SVG path building, knob sync, and the render() coordinator ----
// Depends on geometry.js (clamp, yFor, computePoints, etc.) being loaded first.

function syncKnobColours(freqMode){
  const KNOB_RED    = 'radial-gradient(circle at 36% 30%, #aa1111, #660808 68%, #220000 100%)';
  const KNOB_CYAN   = 'radial-gradient(circle at 36% 30%, #00bbcc, #006677 68%, #001f22 100%)';
  const KNOB_YELLOW = 'radial-gradient(circle at 36% 30%, #ccaa00, #886600 68%, #2a2000 100%)';
  const adsBg = freqMode ? KNOB_CYAN : KNOB_RED;
  ['attackKnob','decayKnob','sustainKnob','releaseKnob'].forEach(id => { const k=$(id); if(k) k.style.background=adsBg; });
  const fsBg = KNOB_YELLOW; // shown/hidden via opacity; always yellow when filter mode on
  ['floorKnob','scaleKnob'].forEach(id => { const k=$(id); if(k) k.style.background = freqMode ? fsBg : KNOB_RED; });
}

function buildPath(x0, y0, x1, y1, curve, scaleFactor, hStartOverride, hEndOverride){
  if(!curve){
    return `M ${x0} ${y0} L ${x1} ${y1}`;
  }
  const h = curve * Math.abs(y1 - y0) * 0.5 * (scaleFactor !== undefined ? scaleFactor : 1);
  const hs = (hStartOverride !== undefined) ? hStartOverride : h;
  const he = (hEndOverride   !== undefined) ? hEndOverride   : h;
  if(y1 < y0){
    // attack: start handle vertical up, end handle horizontal left
    return `M ${x0} ${y0} C ${x0} ${y0-hs} ${x1-he} ${y1} ${x1} ${y1}`;
  } else {
    // decay / release: start handle horizontal right, end handle horizontal left
    return `M ${x0} ${y0} C ${x0+hs} ${y0} ${x1-he} ${y1} ${x1} ${y1}`;
  }
}
function syncRadii(){
  const lw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lineWidth')) || 14;
  document.getElementById('dot').setAttribute('r', Math.round(lw * 1.0));
  document.getElementById('tapMarker').setAttribute('r', Math.round(lw * 0.8));
  document.getElementById('sustainPoint').setAttribute('r', Math.round(lw * 0.57));
  const ilw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--innerLineWidth')) || 6;
  document.getElementById('sustainMarker').style.strokeWidth = ilw;
}

function render(){
  // Keep viewBox and VB_WIDTH-dependent elements in sync
  const svgEl = document.getElementById('svg');
  if(svgEl) svgEl.setAttribute('viewBox', `0 ${VB_Y_ORIGIN} ${VB_WIDTH} ${VB_HEIGHT}`);
  const floorBoundEl = document.getElementById('floorBound');
  if(floorBoundEl){ floorBoundEl.setAttribute('x2', VB_WIDTH); floorBoundEl.setAttribute('y1', graph.y0); floorBoundEl.setAttribute('y2', graph.y0); }
  const ceilingBoundEl = document.getElementById('ceilingBound');
  if(ceilingBoundEl) ceilingBoundEl.setAttribute('x2', VB_WIDTH);

  syncRadii();
  const pts=computePoints();
  // Draw the envelope as separate A/D/R segments. Each segment is drawn twice:
  // a thick white outer stroke, then a softer coloured inner stroke.
  const e = pts.e;
  const ceilY = yFor(1);
  const overrange = e.scale > 0.0001 && e.floor + e.scale > 1.0001;
  const textbookAdsr = $('textbookAdsr') && $('textbookAdsr').checked;
  const showClipped = !textbookAdsr && overrange && $('showClipped') && $('showClipped').checked;

  const drawP1 = showClipped
    ? pts.p1
    : { x: pts.p1.x, y: Math.max(pts.p1.y, ceilY) };

  let drawPS = overrange
    ? { x: pts.pS.x, y: Math.max(pts.pS.y, yFor(1)), level: pts.pS.level }
    : pts.pS;
  if (showClipped) {
    const cDX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * (e.floor + e.scale - 1) / e.scale;
    if (drawPS.x < cDX) drawPS = { x: cDX, y: ceilY, level: drawPS.level };
  }

  const releaseBox = $('releaseKnobBox');
  if(releaseBox){ releaseBox.style.opacity = textbookAdsr ? '1' : UI_DISABLED_OPACITY; releaseBox.style.pointerEvents = textbookAdsr ? 'auto' : 'none'; }
  const releaseLegendEl=$('releaseLegend'); if(releaseLegendEl) releaseLegendEl.style.opacity=textbookAdsr?'1':UI_DISABLED_OPACITY;
  const loudDecayRow = $('loudDecayRow');
  if(loudDecayRow){ loudDecayRow.style.opacity = textbookAdsr ? UI_DISABLED_OPACITY : '1'; loudDecayRow.style.pointerEvents = textbookAdsr ? 'none' : 'auto'; }
  const showClippedRow = $('showClippedRow');
  if(showClippedRow){ showClippedRow.style.opacity = textbookAdsr ? UI_DISABLED_OPACITY : '1'; showClippedRow.style.pointerEvents = textbookAdsr ? 'none' : 'auto'; }
  const analogueCurveRow = $('analogueCurveRow');
  if(analogueCurveRow){ analogueCurveRow.style.opacity = textbookAdsr ? UI_DISABLED_OPACITY : '1'; analogueCurveRow.style.pointerEvents = textbookAdsr ? 'none' : 'auto'; }
  const tbSustainDottedRow = $('tbSustainDottedRow');
  if(tbSustainDottedRow){ tbSustainDottedRow.style.opacity = textbookAdsr ? '1' : UI_DISABLED_OPACITY; tbSustainDottedRow.style.pointerEvents = textbookAdsr ? 'auto' : 'none'; }
  const tbSustainCollapseRow = $('tbSustainCollapseRow');
  if(tbSustainCollapseRow){ tbSustainCollapseRow.style.opacity = textbookAdsr ? '1' : UI_DISABLED_OPACITY; tbSustainCollapseRow.style.pointerEvents = textbookAdsr ? 'auto' : 'none'; }
  const tbShowModelDSustainRow = $('tbShowModelDSustainRow');
  if(tbShowModelDSustainRow){ tbShowModelDSustainRow.style.opacity = textbookAdsr ? '1' : UI_DISABLED_OPACITY; tbShowModelDSustainRow.style.pointerEvents = textbookAdsr ? 'auto' : 'none'; }
  const analogueOn = !textbookAdsr && $('analogueCurve') && $('analogueCurve').checked;
  const curveAmt = analogueOn ? (Number($('curveAmount').value) / 100) : 0;

  const linearTimeOn = $('linearTime') && $('linearTime').checked;
  const aSF = linearTimeOn
    ? Math.min(1, pts.aw / (graph.w * 0.3))
    : Math.min(1, e.aT * 1000 / 500);
  const dSF = linearTimeOn
    ? Math.min(1, pts.dwFull / (graph.w * 0.3))
    : Math.min(1, e.dT * 1000 / 500);

  let aPath, dPath, ceilLeftPath, ceilRightPath;
  if(showClipped){
    const f_a = (1 - e.floor) / e.scale;           // attack fraction at ceiling crossing
    const f_d = (e.floor + e.scale - 1) / e.scale; // decay fraction at ceiling crossing
    const ceilAttackX = pts.p0.x + (pts.p1.x - pts.p0.x) * f_a;
    let ceilDecayX  = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f_d;
    if (ceilDecayX > pts.pS.x) ceilDecayX = pts.pS.x;
    const p1x = pts.p1.x;
    aPath        = buildPath(pts.p0.x, pts.p0.y, ceilAttackX, ceilY, curveAmt, aSF);
    ceilLeftPath = `M ${ceilAttackX} ${ceilY} L ${p1x} ${ceilY}`;
    ceilRightPath= `M ${p1x} ${ceilY} L ${ceilDecayX} ${ceilY}`;
    dPath        = buildPath(ceilDecayX, ceilY, drawPS.x, drawPS.y, curveAmt, dSF);
  } else {
    aPath         = buildPath(pts.p0.x, pts.p0.y, drawP1.x, drawP1.y, curveAmt, aSF);
    ceilLeftPath  = '';
    ceilRightPath = '';
    dPath         = buildPath(drawP1.x, drawP1.y, drawPS.x, drawPS.y, curveAmt, dSF);
  }

  const show = showClipped ? '' : 'none';
  ['attackOuter','attackInner'].forEach(id => $(id).setAttribute('d', aPath));
  ['ceilLeftOuter','ceilRightOuter'].forEach((id,i) => {
    const el=$(id); if(!el) return;
    el.setAttribute('d', i===0 ? ceilLeftPath : ceilRightPath);
    el.style.display = show;
  });
  ['ceilLeftInner','ceilRightInner'].forEach((id,i) => {
    const el=$(id); if(!el) return;
    el.setAttribute('d', i===0 ? ceilLeftPath : ceilRightPath);
    el.style.display = show;
  });
  ['decayOuter','decayInner'].forEach(id => $(id).setAttribute('d', dPath));

  const drawZeroRelease = $('drawReleaseWhenZero').checked;
  const drawReleasePath = pts.e.releaseOn || drawZeroRelease;
  let rEnd;
  if(overrange && e.releaseOn){
    const f_attack = (1 - e.floor) / e.scale;
    const ceilAttackX = pts.p0.x + (pts.p1.x - pts.p0.x) * f_attack;
    const f_decay = (e.floor + e.scale - 1) / e.scale;
    let ceilDecayX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f_decay;
    if (ceilDecayX > pts.pS.x) ceilDecayX = pts.pS.x;
    const peakForSlope = (showClipped && overrange)
      ? { x: ceilDecayX, y: yFor(1) }
      : overrange
        ? { x: pts.p1.x, y: yFor(1) }
        : pts.p1;
    const slopeX = pts.pS.x - peakForSlope.x;
    const slopeY = pts.pS.y - peakForSlope.y;
    const remainingY = yFor(e.floor) - pts.pS.y;
    const t = (slopeY !== 0) ? remainingY / slopeY : 1;
    rEnd = { x: pts.pS.x + slopeX * t, y: yFor(e.floor) };
  } else {
    let pEndForRelease = pts.pEnd;
    if(textbookAdsr && e.releaseOn){
      const rT_r = mapTime(state.r);
      const rwFull = timeToPixels(rT_r, linearTimeOn);
      pEndForRelease = { x: pts.pEnd.x + rwFull, y: yFor(e.floor) };
    }
    rEnd = e.releaseOn ? pEndForRelease : { x: drawPS.x, y: pts.p0.y };
  }
  const rSF = linearTimeOn
    ? Math.min(1, (rEnd.x - drawPS.x) / (graph.w * 0.3))
    : Math.min(1, e.rT * 1000 / 500);

  if(!textbookAdsr){
    // Model D: C1 continuity at pS using natural decay slope
    const dPeakY = showClipped ? ceilY : drawP1.y;
    const h_decay   = curveAmt * Math.abs(drawPS.y - dPeakY)   * 0.5 * dSF;
    const h_release = curveAmt * Math.abs(rEnd.y   - drawPS.y) * 0.5 * rSF;
    const maxH      = (drawPS.x - pts.p1.x) * 0.3;
    const h_join    = Math.min(h_decay, h_release, maxH);
    const slopeDX = drawPS.x - pts.p1.x;
    const slopeDY = drawPS.y - pts.p1.y;
    const slopeLen = Math.sqrt(slopeDX * slopeDX + slopeDY * slopeDY) || 1;
    const decayEndHandle   = { x: drawPS.x - (slopeDX / slopeLen) * h_join,
                                y: drawPS.y - (slopeDY / slopeLen) * h_join };
    const releaseStartHandle = { x: drawPS.x + (slopeDX / slopeLen) * h_join,
                                  y: drawPS.y + (slopeDY / slopeLen) * h_join };
    const dStartX = showClipped
      ? pts.p1.x + (pts.pEnd.x - pts.p1.x) * ((e.floor + e.scale - 1) / e.scale)
      : drawP1.x;
    const dStartY = showClipped ? ceilY : drawP1.y;
    if(curveAmt){
      dPath = `M ${dStartX} ${dStartY} C ${dStartX + h_decay} ${dStartY} ${decayEndHandle.x} ${decayEndHandle.y} ${drawPS.x} ${drawPS.y}`;
    } else {
      dPath = `M ${dStartX} ${dStartY} L ${drawPS.x} ${drawPS.y}`;
    }
    ['decayOuter','decayInner'].forEach(id => $(id).setAttribute('d', dPath));
    const releaseEndHandle = { x: rEnd.x - h_release, y: rEnd.y };
    const rStart = state.releaseFromDecay ? pts.p1 : (releaseStartPoint || drawPS);
    const rPath = drawReleasePath
      ? (curveAmt
          ? `M ${rStart.x} ${rStart.y} C ${releaseStartHandle.x} ${releaseStartHandle.y} ${releaseEndHandle.x} ${releaseEndHandle.y} ${rEnd.x} ${rEnd.y}`
          : `M ${rStart.x} ${rStart.y} L ${rEnd.x} ${rEnd.y}`)
      : '';
    ['releaseOuter','releaseInner'].forEach(id => $(id).setAttribute('d', rPath));
    ['sustainSegOuter','sustainSegInner'].forEach(id => { const el=$(id); if(el){ el.setAttribute('d',''); el.style.display='none'; } });
    const tbSusMarkerMD=$('tbSustainMarker'); if(tbSusMarkerMD) tbSusMarkerMD.style.display='none';
    const tbMDLineMD=$('tbModelDSustainLine'); if(tbMDLineMD) tbMDLineMD.style.display='none';
    const tbSusLblMD=$('tbSustainLabel'); if(tbSusLblMD) tbSusLblMD.style.display='none';
  } else {
    renderTextbookPaths({ pts, drawPS, drawP1, ceilY, showClipped, drawReleasePath, curveAmt, dSF, rSF, linearTimeOn });
  }

  // Show/hide outer lines based on showOuterLine checkbox
  const showOuterLine = !$('showOuterLine') || $('showOuterLine').checked;
  ['attackOuter','decayOuter','releaseOuter','sustainSegOuter','ceilLeftOuter','ceilRightOuter'].forEach(id => {
    const el = $(id); if(el) el.style.opacity = showOuterLine ? '' : '0';
  });

  // Sustain as a horizontal level guide extending to the right from
  // the decay/release intersection. This reads as an indefinite held level,
  // rather than something that reaches back into the earlier decay phase.
  // Meter geometry
  const meterX = METER_X;
  const meterW = METER_W;
  const meterAbsTop = graph.y0 - graph.h;  // yFor(1) = 85
  const meterAbsBottom = graph.y0;          // yFor(0) = 445

  const markerEndX = meterX;
  $('sustainMarker').setAttribute('x1', drawPS.x);
  $('sustainMarker').setAttribute('y1', drawPS.y);
  $('sustainMarker').setAttribute('x2', markerEndX);
  $('sustainMarker').setAttribute('y2', drawPS.y);
  $('sustainMarker').style.display = textbookAdsr ? 'none' : '';
  $('sustainPoint').setAttribute('cx', drawPS.x);
  $('sustainPoint').setAttribute('cy', drawPS.y);
  $('sustainPoint').style.display = textbookAdsr ? 'none' : '';

  const kcOn = $('keyboardControl') && $('keyboardControl').checked;
  let statedSustainX = drawPS.x; // uncapped sustain x; equals drawPS.x when kc OFF
  const statedSustainLineEl = $('statedSustainLine');
  if(statedSustainLineEl){
    if(kcOn && !textbookAdsr){
      const floorY = yFor(pts.e.floor);
      const statedY = floorY - (floorY - drawPS.y) * 1.25;
      const decayPathEl = document.getElementById('decayOuter');
      statedSustainX = pts.p1.x + (drawPS.x - pts.p1.x) * 1.25; // geometric fallback
      if(decayPathEl){
        let lo = pts.p1.x, hi = drawPS.x;
        for(let i = 0; i < 32; i++){
          const mid = (lo + hi) / 2;
          const y = getYFromPath(decayPathEl, mid);
          if(y === null || y < statedY) lo = mid; else hi = mid;
        }
        statedSustainX = (lo + hi) / 2;
      }
      statedSustainLineEl.setAttribute('x1', statedSustainX);
      statedSustainLineEl.setAttribute('y1', statedY);
      statedSustainLineEl.setAttribute('x2', markerEndX);
      statedSustainLineEl.setAttribute('y2', statedY);
      statedSustainLineEl.style.display = '';
      const sslEl=$('statedSustainLabel');
      if(sslEl){ sslEl.setAttribute('x', pts.pEnd.x); sslEl.setAttribute('y', statedY - 8); sslEl.setAttribute('text-anchor', 'start'); sslEl.setAttribute('style', 'fill:#00ffff;'); }
    } else {
      statedSustainLineEl.style.display = 'none';
      const sslEl=$('statedSustainLabel');
      if(sslEl) sslEl.style.display = 'none';
    }
  }

  { const el=$('sLabel'), bg=$('sLabelBg');
    el.setAttribute('x', METER_X - 30); el.setAttribute('y', drawPS.y); el.setAttribute('dominant-baseline', 'middle'); el.removeAttribute('stroke'); el.removeAttribute('stroke-width'); el.removeAttribute('paint-order'); el.style.fill = '#000000'; el.style.display = textbookAdsr ? 'none' : ''; el.textContent = ($('keyboardControl') && $('keyboardControl').checked) ? 'MODEL D SUSTAIN' : 'SUSTAIN';
    if(bg){ const bbox=el.getBBox(); bg.setAttribute('x',bbox.x-4); bg.setAttribute('y',bbox.y-2); bg.setAttribute('width',bbox.width+8); bg.setAttribute('height',bbox.height+4); bg.setAttribute('fill','#ffffff'); bg.style.display=el.style.display; }
  }

  // Bounds lines — fixed at absolute graph top/bottom, full SVG width
  const showBounds = $('showBounds') && $('showBounds').checked;
  const floorBound=$('floorBound'), ceilingBound=$('ceilingBound');
  if(floorBound){ floorBound.style.display = showBounds ? '' : 'none'; }
  if(ceilingBound){ ceilingBound.style.display = showBounds ? '' : 'none'; }

  // Meter box — fixed full graph height
  const meterBox=$('meterBox');
  if(meterBox){
    meterBox.setAttribute('x',meterX); meterBox.setAttribute('y',meterAbsTop);
    meterBox.setAttribute('width',meterW); meterBox.setAttribute('height',graph.h);
    meterBox.style.strokeWidth = METER_STROKE_W;
  }
  const meterClipRect=$('meterClipRect');
  if(meterClipRect){
    meterClipRect.setAttribute('x',meterX); meterClipRect.setAttribute('y',meterAbsTop);
    meterClipRect.setAttribute('width',meterW); meterClipRect.setAttribute('height',graph.h);
  }
  const meterFillEl=$('meterFill');
  if(meterFillEl) meterFillEl.setAttribute('clip-path','url(#meterClip)');
  const meterScanlinesEl=$('meterScanlinesRect');
  if(meterScanlinesEl){
    meterScanlinesEl.setAttribute('x',meterX); meterScanlinesEl.setAttribute('y',meterAbsTop);
    meterScanlinesEl.setAttribute('width',meterW); meterScanlinesEl.setAttribute('height',graph.h);
    meterScanlinesEl.style.display=($('meterScanlinesVisible')&&$('meterScanlinesVisible').checked)?'':'none';
  }

  // Floor line and Amount line
  const freqMode = $('frequencyMode') && $('frequencyMode').checked;
  const meterLeftX = meterX;
  const floorLine = $('floorLine');
  const amountLine = $('amountLine');
  const floorY = yFor(pts.e.floor);
  const amountY = Math.max(yFor(pts.e.floor + pts.e.scale), yFor(1));
  const showContour = freqMode && $('showContour') && $('showContour').checked;
  if(floorLine){
    floorLine.setAttribute('x1', graph.x0);
    floorLine.setAttribute('y1', floorY);
    floorLine.setAttribute('x2', meterLeftX);
    floorLine.setAttribute('y2', floorY);
    floorLine.style.display = showContour ? '' : 'none';
  }
  if(amountLine){
    amountLine.setAttribute('x1', pts.p1.x);
    amountLine.setAttribute('y1', amountY);
    amountLine.setAttribute('x2', meterLeftX);
    amountLine.setAttribute('y2', amountY);
    amountLine.style.display = showContour ? '' : 'none';
  }
  // Contour line labels
  const contourLabelX = METER_X - 30;
  const contourAmountLabelEl = $('contourAmountLabel');
  if(contourAmountLabelEl){
    contourAmountLabelEl.setAttribute('x', contourLabelX);
    contourAmountLabelEl.setAttribute('y', amountY);
    contourAmountLabelEl.setAttribute('dominant-baseline', 'middle');
    contourAmountLabelEl.removeAttribute('stroke'); contourAmountLabelEl.removeAttribute('stroke-width'); contourAmountLabelEl.removeAttribute('paint-order');
    contourAmountLabelEl.style.fill = '#000000';
    contourAmountLabelEl.style.display = showContour ? '' : 'none';
    const caBg=$('contourAmountLabelBg'); if(caBg){ const bbox=contourAmountLabelEl.getBBox(); caBg.setAttribute('x',bbox.x-4); caBg.setAttribute('y',bbox.y-2); caBg.setAttribute('width',bbox.width+8); caBg.setAttribute('height',bbox.height+4); caBg.setAttribute('fill','#ffffff'); caBg.style.display=contourAmountLabelEl.style.display; }
  }
  const cutoffFreqLabelEl = $('cutoffFreqLabel');
  if(cutoffFreqLabelEl){
    cutoffFreqLabelEl.setAttribute('x', contourLabelX);
    cutoffFreqLabelEl.setAttribute('y', floorY);
    cutoffFreqLabelEl.setAttribute('dominant-baseline', 'middle');
    cutoffFreqLabelEl.removeAttribute('stroke'); cutoffFreqLabelEl.removeAttribute('stroke-width'); cutoffFreqLabelEl.removeAttribute('paint-order');
    cutoffFreqLabelEl.style.fill = '#000000';
    cutoffFreqLabelEl.style.display = showContour ? '' : 'none';
    const cfBg=$('cutoffFreqLabelBg'); if(cfBg){ const bbox=cutoffFreqLabelEl.getBBox(); cfBg.setAttribute('x',bbox.x-4); cfBg.setAttribute('y',bbox.y-2); cfBg.setAttribute('width',bbox.width+8); cfBg.setAttribute('height',bbox.height+4); cfBg.setAttribute('fill','#ffffff'); cfBg.style.display=cutoffFreqLabelEl.style.display; }
  }
  // Show Contour checkbox: only meaningful in filter mode
  const showContourLabel = $('showContour') && $('showContour').closest('label');
  if(showContourLabel){
    showContourLabel.style.opacity = freqMode ? '' : UI_DISABLED_OPACITY;
    showContourLabel.style.pointerEvents = freqMode ? '' : 'none';
  }

  // Meter labels
  const isHP = $('hpMode') && $('hpMode').checked;
  const meterCX = meterX + meterW/2;
  const titleEl=$('meterLabelTitle');
  if(titleEl){ titleEl.textContent=freqMode?'FREQ':'VOL'; titleEl.setAttribute('x',meterCX); titleEl.setAttribute('y',meterAbsTop-18); titleEl.style.display=''; }
  const modeLabelEl=$('modeLabel');
  if(modeLabelEl){ modeLabelEl.textContent=freqMode?'FILTER CONTOUR':'LOUDNESS CONTOUR'; modeLabelEl.setAttribute('x',10); modeLabelEl.setAttribute('y',yFor(1)-90); modeLabelEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }
  const toolTitleEl=$('toolTitle');
  if(toolTitleEl){ toolTitleEl.setAttribute('x',VB_WIDTH/2); toolTitleEl.setAttribute('y',yFor(1)-173); toolTitleEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }
  updateTimeAxis(pts, overrange, showClipped, textbookAdsr, freqMode, linearTimeOn, drawPS, statedSustainX);

  const segY = yFor(1) - 45;
  const segStart = 10;
  const segEnd = METER_X;
  const segSpacing = (segEnd - segStart) / 5;
  const segFontSize = 'calc(var(--labelSize) * var(--h2Scale) * 1px)';
  ['segDisplay','segSustain','segClipping','segDecay','segFilterMode'].forEach((id, i) => {
    const el = document.getElementById(id);
    if(el){ el.setAttribute('x', segStart + segSpacing * i); el.style.fontSize = segFontSize; }
  });
  const segFilterModeEl=$('segFilterMode');
  if(segFilterModeEl){ segFilterModeEl.setAttribute('y',segY); segFilterModeEl.style.display=freqMode?'':'none'; segFilterModeEl.textContent=isHP?'FILTER MODE: HI':'FILTER MODE: LO'; segFilterModeEl.style.opacity=1; }
  const segDecayEl=$('segDecay');
  if(segDecayEl){ const ldOn=$('loudDecay')&&$('loudDecay').checked; segDecayEl.setAttribute('y',segY); segDecayEl.style.display=''; segDecayEl.textContent=(freqMode?'FILTER DECAY':'LOUD DECAY')+(ldOn?': ON':': OFF'); segDecayEl.style.opacity=ldOn?1:STATUS_DIM_OPACITY; }
  const segDisplayEl=$('segDisplay');
  if(segDisplayEl){ segDisplayEl.setAttribute('y',segY); segDisplayEl.style.display=''; segDisplayEl.textContent=textbookAdsr?'DISPLAY: TEXTBOOK':analogueOn?'DISPLAY: RC MODELLED':'DISPLAY: SCHEMATIC'; segDisplayEl.style.opacity=(textbookAdsr||analogueOn)?1:STATUS_DIM_OPACITY; }
  const segSustainEl=$('segSustain');
  if(segSustainEl){ const kcOn=$('keyboardControl')&&$('keyboardControl').checked; const tbCollapse=$('tbSustainCollapse')&&$('tbSustainCollapse').checked; segSustainEl.setAttribute('y',segY); segSustainEl.style.display=''; segSustainEl.textContent=(textbookAdsr&&!tbCollapse)?'SUSTAIN: TEXTBOOK':kcOn?'SUSTAIN: CORRECTED':'SUSTAIN: SCHEMATIC'; segSustainEl.style.opacity=((textbookAdsr&&!tbCollapse)||kcOn)?1:STATUS_DIM_OPACITY; }
  const segClippingEl=$('segClipping');
  if(segClippingEl){ segClippingEl.setAttribute('y',segY); segClippingEl.style.display=freqMode?'':'none'; if(textbookAdsr){ segClippingEl.textContent='PEAK: TEXTBOOK'; segClippingEl.style.opacity=1; } else if(showClipped){ segClippingEl.textContent='PEAK: CORRECTED'; segClippingEl.style.opacity=1; } else { segClippingEl.textContent='PEAK: SCHEMATIC'; segClippingEl.style.opacity=STATUS_DIM_OPACITY; } }
  // Cutoff/Amount knobs: active only in Filter Mode
  const floorBox=$('floorKnobBox'), scaleBox=$('scaleKnobBox');
  if(floorBox) floorBox.style.opacity=freqMode?'':UI_DISABLED_OPACITY;
  if(scaleBox) scaleBox.style.opacity=freqMode?'':UI_DISABLED_OPACITY;
  const cutoffLegendEl=$('cutoffLegend'); if(cutoffLegendEl) cutoffLegendEl.style.opacity=freqMode?'1':UI_DISABLED_OPACITY;
  const amountLegendEl=$('amountLegend'); if(amountLegendEl) amountLegendEl.style.opacity=freqMode?'1':UI_DISABLED_OPACITY;
  // Dynamic loud/filter decay label
  const loudDecayLabel = $('loudDecayLabel');
  if(loudDecayLabel) loudDecayLabel.textContent = freqMode ? 'Filter Decay' : 'Loud Decay';
  // Knob colours
  syncKnobColours(freqMode);

  // Keep resting meter fill in sync whenever no animation is running
  if(state.currentPhase === 'idle') hideDot();

  syncControls();
  updateButtonStates();
  setTimeout(refreshNumericInputs, 0); // keep numeric inputs in sync after every render
}
