// ---- paths.js — SVG path building, knob sync, and the render() coordinator ----
// Depends on geometry.js (clamp, yFor, computePoints, etc.) being loaded first.

const KC_SUSTAIN_SCALE = 1.25; // inverse of the 0.8 keyboard-control sustain cap (1/0.8)

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
  const lw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--innerLineWidth')) || 6;
  document.getElementById('dot').setAttribute('r', Math.round(lw * 1.0));
  document.getElementById('tapMarker').setAttribute('r', Math.round(lw * 0.8));
  document.getElementById('sustainPoint').setAttribute('r', Math.round(lw * 0.57));
}

function render(){
  try {
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
  const legA = $('modelA') ? $('modelA').checked : true;
  const legD = $('modelD') ? $('modelD').checked : true;
  const legS = $('modelS') ? $('modelS').checked : true;
  const legR = $('modelR') ? $('modelR').checked : true;
  const showClipped = !textbookAdsr && overrange && $('showClipped') && $('showClipped').checked;

  // Gate-close x and clip-at-gate flag — hoisted so both the Model D block and the
  // post-block loose elements can use them.
  const showGateTime = $('showGateTime') && $('showGateTime').checked;
  const clipAtGateOn = showGateTime && $('clipAtGate') && $('clipAtGate').checked;
  const gateTapMs = ($('tapCustomMs') && Number($('tapCustomMs').value)) || 200;
  const gateTSec = gateTapMs / 1000;
  let gateCloseX;
  if(e.aT > 0 && gateTSec <= e.aT){
    gateCloseX = pts.p0.x + (pts.p1.x - pts.p0.x) * (gateTSec / e.aT);
  } else {
    const gfd = e.dT > 0 ? Math.min(1, (gateTSec - e.aT) / e.dT) : 1;
    gateCloseX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * gfd;
  }
  if(gateCloseX > pts.pS.x) gateCloseX = pts.pS.x;
  // Update the gate envelope clip rect
  const gateEnvClipRect = $('gateEnvClipRect');
  if(gateEnvClipRect){
    gateEnvClipRect.setAttribute('x', graph.x0);
    gateEnvClipRect.setAttribute('y', graph.y0 - graph.h - 200);
    gateEnvClipRect.setAttribute('width', gateCloseX - graph.x0);
    gateEnvClipRect.setAttribute('height', graph.h + 400);
  }

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
    aPath        = curveAmt ? rcPolyline(pts.p0.x, pts.p0.y, ceilAttackX, ceilY, true, 50, 3) : buildPath(pts.p0.x, pts.p0.y, ceilAttackX, ceilY, 0, aSF);
    ceilLeftPath = `M ${ceilAttackX} ${ceilY} L ${p1x} ${ceilY}`;
    ceilRightPath= `M ${p1x} ${ceilY} L ${ceilDecayX} ${ceilY}`;
    dPath        = buildPath(ceilDecayX, ceilY, drawPS.x, drawPS.y, curveAmt, dSF);
  } else {
    aPath         = curveAmt
      ? rcPolyline(pts.p0.x, pts.p0.y, drawP1.x, drawP1.y, true, 50, 3)
      : buildPath(pts.p0.x, pts.p0.y, drawP1.x, drawP1.y, curveAmt, aSF);
    ceilLeftPath  = '';
    ceilRightPath = '';
    dPath         = buildPath(drawP1.x, drawP1.y, drawPS.x, drawPS.y, curveAmt, dSF);
  }

  const show = showClipped ? '' : 'none';
  { const el=$('attackInner'); if(el){ el.setAttribute('d', aPath); el.style.display = legA ? '' : 'none'; } }
  { const el=$('ceilLeftInner'); if(el){ el.setAttribute('d', ceilLeftPath); el.style.display = (showClipped && legA) ? '' : 'none'; } }
  { const el=$('ceilRightInner'); if(el){ el.setAttribute('d', ceilRightPath); el.style.display = (showClipped && legD) ? '' : 'none'; } }
  { const el=$('decayInner'); if(el){ el.setAttribute('d', dPath); el.style.display = legD ? '' : 'none'; } }

  const drawReleasePath = pts.e.releaseOn;
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

  // Textbook ADSR underlay — faint straight-line A/D/S/R behind the main curves.
  // Each leg is independently gated by its own checkbox (underlayA/D/S/R).
  {
    const showA = !textbookAdsr && $('underlayA') && $('underlayA').checked;
    const showD = !textbookAdsr && $('underlayD') && $('underlayD').checked;
    const showS = !textbookAdsr && $('underlayS') && $('underlayS').checked;
    const showR = !textbookAdsr && $('underlayR') && $('underlayR').checked;
    const ua=$('underlayAttack'), ud=$('underlayDecay'), us=$('underlaySustain'), ur=$('underlayRelease');
    const anyLeg = showA || showD || showS || showR;
    if(anyLeg){
      const tbSusGapPx = graph.w * state.tbSustainGap;
      const tbDecayEndX = pts.pEnd.x;
      const tbSusEndX   = pts.pEnd.x + tbSusGapPx;
      const tbRelEndX   = tbSusEndX + timeToPixels(mapTime(state.r), linearTimeOn);
      const tbFloorY    = yFor(e.floor);
      const ulP1Y = Math.max(pts.p1.y, ceilY);
      const ulPSY = overrange ? Math.max(yFor(e.floor + state.s * e.scale), ceilY) : yFor(e.floor + state.s * e.scale);
      const ulColor = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
      if(ua){ if(showA){ ua.setAttribute('d', `M ${pts.p0.x} ${pts.p0.y} L ${pts.p1.x} ${ulP1Y}`); ua.style.display=''; } else { ua.setAttribute('d',''); ua.style.display='none'; } }
      if(ud){ if(showD){ ud.setAttribute('d', `M ${pts.p1.x} ${ulP1Y} L ${tbDecayEndX} ${ulPSY}`); ud.style.display=''; } else { ud.setAttribute('d',''); ud.style.display='none'; } }
      if(us){ if(showS){ us.setAttribute('d', `M ${tbDecayEndX} ${ulPSY} L ${tbSusEndX} ${ulPSY}`); us.style.display=''; } else { us.setAttribute('d',''); us.style.display='none'; } }
      if(ur){ if(showR && drawReleasePath){ ur.setAttribute('d', `M ${tbSusEndX} ${ulPSY} L ${tbRelEndX} ${tbFloorY}`); ur.style.display=''; } else { ur.setAttribute('d',''); ur.style.display='none'; } }
      [ua,ud,us,ur].forEach(el=>{ if(el) el.style.stroke=ulColor; });
    } else {
      [ua,ud,us,ur].forEach(el => { if(el){ el.setAttribute('d',''); el.style.display='none'; } });
    }
  }

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
      dPath = rcPolyline(dStartX, dStartY, drawPS.x, drawPS.y, false, 50, 3);
    } else {
      dPath = `M ${dStartX} ${dStartY} L ${drawPS.x} ${drawPS.y}`;
    }
    $('decayInner').setAttribute('d', dPath);
    const releaseEndHandle = { x: rEnd.x - h_release, y: rEnd.y };
    const rStart = state.releaseFromDecay ? pts.p1 : (releaseStartPoint || drawPS);
    // releaseInner: green RC discharge from drawPS — the full peak→floor curve
    // shifted right so its sustain-level crossing lands at drawPS.x, clipped to below sustain.
    const greenAnalogueRelease = !!(curveAmt && drawReleasePath);
    // Release starts at the end of the textbook sustain gap (matching the underlay), not at drawPS.x.
    const releaseStartX = pts.pEnd.x + graph.w * state.tbSustainGap;
    const releaseStartY = drawPS.y;
    let rPath = '';
    if(drawReleasePath){
      if(curveAmt){
        const magentaXAtSustain = rcPolylineXAtY(pts.p1.x, pts.p1.y, rEnd.x, rEnd.y, releaseStartY, false, 200, 3);
        const greenOffset = releaseStartX - magentaXAtSustain;
        rPath = rcPolyline(pts.p1.x + greenOffset, pts.p1.y, rEnd.x + greenOffset, rEnd.y, false, 50, 3);
      } else {
        rPath = `M ${rStart.x} ${rStart.y} L ${rEnd.x} ${rEnd.y}`;
      }
    }
    const sustainReleaseClipRect = $('sustainReleaseClipRect');
    if(sustainReleaseClipRect){
      sustainReleaseClipRect.setAttribute('x', releaseStartX);
      sustainReleaseClipRect.setAttribute('y', drawPS.y);
      sustainReleaseClipRect.setAttribute('width', graph.w);
      sustainReleaseClipRect.setAttribute('height', graph.y0 - drawPS.y);
    }
    const _relColorEl = ($('frequencyMode') && $('frequencyMode').checked) ? $('filterReleaseColor') : $('loudnessReleaseColor');
    const relColor = _relColorEl ? _relColorEl.value : '';
    { const el = $('releaseInner'); if(el){
      el.setAttribute('d', rPath);
      el.style.stroke = relColor;
      el.style.display = legR ? '' : 'none';
      // clip-path is set later by the Clip at Gate block (handles both gateEnvClip and sustainReleaseClip)
    } }
    // #fullReferenceRelease: full peak→floor reference curve (cyan, unclipped). Only shown
    // when Show Peak Discharge is checked.
    const showPeakDischarge = $('showPeakDischarge') && $('showPeakDischarge').checked;
    const fullReferenceReleaseEl = $('fullReferenceRelease');
    if(fullReferenceReleaseEl){
      if(showPeakDischarge && curveAmt && drawReleasePath){
        fullReferenceReleaseEl.setAttribute('d', rcPolyline(pts.p1.x, pts.p1.y, rEnd.x, rEnd.y, false, 50, 3));
        fullReferenceReleaseEl.removeAttribute('clip-path');
        fullReferenceReleaseEl.style.stroke = '#00ffff';
        fullReferenceReleaseEl.style.display = '';
      } else {
        fullReferenceReleaseEl.setAttribute('d', '');
        fullReferenceReleaseEl.style.display = 'none';
      }
    }
    // gateCloseX is hoisted above the Model D block; sample the effective curve y here.
    // y at gateCloseX, sampled from the drawn attack or decay curve (top of the orange release curve)
    const gcPathEl = document.getElementById(gateCloseX < pts.p1.x ? 'attackInner' : 'decayInner');
    let gateCloseY = gcPathEl ? getYFromPath(gcPathEl, gateCloseX) : null;
    if(gateCloseY === null) gateCloseY = drawPS.y;

    // #tapReleaseOrange: RC release trajectory from the tap gate-close point. Built exactly
    // like the green release (releaseInner): the full peak→floor RC curve shifted so its
    // crossing at the gate-close level lands at gateCloseX, then clipped below that level.
    // When the gate closes at the sustain level this coincides with the green curve.
    // Gate RC discharge geometry — computed once, used by tapReleaseOrange and the effective GR descender.
    const gateRCActive = !!(drawReleasePath && curveAmt);
    let orangeDischargeEndX = 0;
    if(gateRCActive){
      const magentaXAtGate = rcPolylineXAtY(pts.p1.x, pts.p1.y, rEnd.x, rEnd.y, gateCloseY, false, 200, 3);
      const orangeOffset = gateCloseX - magentaXAtGate;
      orangeDischargeEndX = rEnd.x + orangeOffset;
      const gateReleaseClipRect = $('gateReleaseClipRect');
      if(gateReleaseClipRect){
        gateReleaseClipRect.setAttribute('x', graph.x0);
        gateReleaseClipRect.setAttribute('y', gateCloseY);
        gateReleaseClipRect.setAttribute('width', graph.w);
        gateReleaseClipRect.setAttribute('height', graph.y0 - gateCloseY);
      }
      const tapReleaseOrangeEl = $('tapReleaseOrange');
      if(tapReleaseOrangeEl){
        tapReleaseOrangeEl.setAttribute('d', rcPolyline(pts.p1.x + orangeOffset, pts.p1.y, rEnd.x + orangeOffset, rEnd.y, false, 50, 3));
        tapReleaseOrangeEl.setAttribute('clip-path', 'url(#gateReleaseClip)');
        tapReleaseOrangeEl.style.stroke = relColor;
        tapReleaseOrangeEl.style.display = '';
      }
    } else {
      const tapReleaseOrangeEl = $('tapReleaseOrange');
      if(tapReleaseOrangeEl) tapReleaseOrangeEl.style.display = 'none';
    }
    // Effective GR descender: vertical at the RC discharge floor-crossing, from floor to graph.y0
    const gateEffReleaseDropEl = $('gateEffectiveReleaseDrop');
    const gateEffReleaseTimeEl = $('gateEffectiveReleaseTime');
    if(gateRCActive && legR){
      const timeLabelGutter = Math.max(0, Number(($('timeLabelGutter') && $('timeLabelGutter').value) || 0));
      if(gateEffReleaseDropEl){
        gateEffReleaseDropEl.setAttribute('x1', orangeDischargeEndX); gateEffReleaseDropEl.setAttribute('y1', rEnd.y);
        gateEffReleaseDropEl.setAttribute('x2', orangeDischargeEndX); gateEffReleaseDropEl.setAttribute('y2', graph.y0);
        gateEffReleaseDropEl.setAttribute('stroke', relColor);
        gateEffReleaseDropEl.style.display = '';
      }
      if(gateEffReleaseTimeEl){
        gateEffReleaseTimeEl.setAttribute('x', orangeDischargeEndX);
        gateEffReleaseTimeEl.setAttribute('y', graph.y0 + TIME_LABEL_EFFECTIVE_Y_OFFSET + timeLabelGutter);
        gateEffReleaseTimeEl.setAttribute('text-anchor', 'middle');
        gateEffReleaseTimeEl.setAttribute('fill', relColor);
        gateEffReleaseTimeEl.textContent = 'GR = ' + Math.round(pixelsToTimeSec(orangeDischargeEndX - gateCloseX, linearTimeOn) * 1000) + 'ms';
        gateEffReleaseTimeEl.style.display = '';
      }
    } else {
      if(gateEffReleaseDropEl) gateEffReleaseDropEl.style.display = 'none';
      if(gateEffReleaseTimeEl) gateEffReleaseTimeEl.style.display = 'none';
    }
    // Textbook (stated) gate-release line + ascender drop line and GR label.
    const showStatedGateRelease = drawReleasePath && $('underlayR') && $('underlayR').checked;
    const gateRelEndX = gateCloseX + timeToPixels(mapTime(state.r), linearTimeOn);
    const gateRelEndY = yFor(pts.e.floor);
    const ulCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
    const gateStatedReleaseEl = $('gateStatedRelease');
    if(gateStatedReleaseEl){
      // Sample the stated (underlay) curve y at gateCloseX
      const gsRelPathEl = showStatedGateRelease ? document.getElementById(gateCloseX < pts.p1.x ? 'underlayAttack' : 'underlayDecay') : null;
      const gateStatedStartY = gsRelPathEl ? getYFromPath(gsRelPathEl, gateCloseX) : null;
      if(showStatedGateRelease && gateStatedStartY !== null){
        gateStatedReleaseEl.setAttribute('x1', gateCloseX);
        gateStatedReleaseEl.setAttribute('y1', gateStatedStartY);
        gateStatedReleaseEl.setAttribute('x2', gateRelEndX);
        gateStatedReleaseEl.setAttribute('y2', gateRelEndY);
        gateStatedReleaseEl.style.stroke = ulCol;
        gateStatedReleaseEl.style.display = '';
      } else {
        gateStatedReleaseEl.style.display = 'none';
      }
    }
    // Stated GR ascender: vertical at gateRelEndX from floor to graph top
    const gateStatedReleaseDropEl = $('gateStatedReleaseDrop');
    const gateStatedReleaseTimeEl = $('gateStatedReleaseTime');
    if(showStatedGateRelease){
      const gateTopY = graph.y0 - graph.h;
      const timeLabelGutter = Math.max(0, Number(($('timeLabelGutter') && $('timeLabelGutter').value) || 0));
      if(gateStatedReleaseDropEl){
        gateStatedReleaseDropEl.setAttribute('x1', gateRelEndX); gateStatedReleaseDropEl.setAttribute('y1', gateRelEndY);
        gateStatedReleaseDropEl.setAttribute('x2', gateRelEndX); gateStatedReleaseDropEl.setAttribute('y2', gateTopY);
        gateStatedReleaseDropEl.setAttribute('stroke', ulCol);
        gateStatedReleaseDropEl.style.display = '';
      }
      if(gateStatedReleaseTimeEl){
        gateStatedReleaseTimeEl.setAttribute('x', gateRelEndX);
        gateStatedReleaseTimeEl.setAttribute('y', gateTopY + TIME_LABEL_STATED_Y_OFFSET - timeLabelGutter);
        gateStatedReleaseTimeEl.setAttribute('text-anchor', 'middle');
        gateStatedReleaseTimeEl.setAttribute('fill', ulCol);
        gateStatedReleaseTimeEl.textContent = 'GR = ' + Math.round(mapTime(state.r) * 1000) + 'ms';
        gateStatedReleaseTimeEl.style.display = '';
      }
    } else {
      if(gateStatedReleaseDropEl) gateStatedReleaseDropEl.style.display = 'none';
      if(gateStatedReleaseTimeEl) gateStatedReleaseTimeEl.style.display = 'none';
    }
    // Show Gate Time: vertical dotted line + label at the gate-close x,
    // with crossings on both effective and stated curves and horizontals to the meter.
    // (showGateTime and gateCloseX are hoisted above the Model D block.)
    const gateTimeLineEl = $('gateTimeLine');
    const gateTimeLabelEl = $('gateTimeLabel');
    const gateEffHorizEl = $('gateEffectiveHoriz');
    const gateStatedHorizEl = $('gateStatedHoriz');
    if(showGateTime){
      const gateTopY = graph.y0 - graph.h;
      // Stated-curve y at gateCloseX (mirrors effective sampling but on underlay paths)
      const isAttackPhase = gateCloseX < pts.p1.x;
      const gsPathEl = document.getElementById(isAttackPhase ? 'underlayAttack' : 'underlayDecay');
      const gateStatedYRaw = gsPathEl ? getYFromPath(gsPathEl, gateCloseX) : null;
      // Per-leg visibility for each crossing
      const effLegOn = isAttackPhase ? legA : legD;
      const statedLegOn = isAttackPhase
        ? (!textbookAdsr && $('underlayA') && $('underlayA').checked)
        : (!textbookAdsr && $('underlayD') && $('underlayD').checked);
      const effVisible = effLegOn && (gateCloseY !== null);
      const statedVisible = statedLegOn && (gateStatedYRaw !== null);
      // Vertical bottom extent
      let gateBottomY;
      if(effVisible && statedVisible) gateBottomY = Math.max(gateCloseY, gateStatedYRaw);
      else if(effVisible) gateBottomY = gateCloseY;
      else if(statedVisible) gateBottomY = gateStatedYRaw;
      else gateBottomY = graph.y0;
      if(gateTimeLineEl){
        gateTimeLineEl.setAttribute('x1', gateCloseX);
        gateTimeLineEl.setAttribute('x2', gateCloseX);
        gateTimeLineEl.setAttribute('y1', gateTopY);
        gateTimeLineEl.setAttribute('y2', gateBottomY);
        gateTimeLineEl.style.display = '';
      }
      if(gateTimeLabelEl){
        const timeLabelGutter = Math.max(0, Number(($('timeLabelGutter') && $('timeLabelGutter').value) || 0));
        gateTimeLabelEl.setAttribute('x', gateCloseX);
        gateTimeLabelEl.setAttribute('y', gateTopY + TIME_LABEL_STATED_Y_OFFSET - timeLabelGutter);
        gateTimeLabelEl.setAttribute('text-anchor', 'middle');
        gateTimeLabelEl.textContent = 'Gate = ' + gateTapMs + 'ms';
        gateTimeLabelEl.style.display = '';
      }
      // Horizontal from effective crossing to the meter
      if(gateEffHorizEl){
        if(effVisible){
          gateEffHorizEl.setAttribute('x1', gateCloseX); gateEffHorizEl.setAttribute('y1', gateCloseY);
          gateEffHorizEl.setAttribute('x2', METER_X);    gateEffHorizEl.setAttribute('y2', gateCloseY);
          gateEffHorizEl.style.display = '';
        } else {
          gateEffHorizEl.style.display = 'none';
        }
      }
      // Horizontal from stated crossing to the meter
      if(gateStatedHorizEl){
        if(statedVisible){
          gateStatedHorizEl.setAttribute('x1', gateCloseX);     gateStatedHorizEl.setAttribute('y1', gateStatedYRaw);
          gateStatedHorizEl.setAttribute('x2', METER_X);        gateStatedHorizEl.setAttribute('y2', gateStatedYRaw);
          gateStatedHorizEl.style.display = '';
        } else {
          gateStatedHorizEl.style.display = 'none';
        }
      }
    } else {
      if(gateTimeLineEl) gateTimeLineEl.style.display = 'none';
      if(gateTimeLabelEl) gateTimeLabelEl.style.display = 'none';
      if(gateEffHorizEl) gateEffHorizEl.style.display = 'none';
      if(gateStatedHorizEl) gateStatedHorizEl.style.display = 'none';
    }
    // Clip at Gate: apply/remove gateEnvClip on individual curve elements (not the group).
    // tapReleaseOrange is intentionally excluded — it renders the release from the gate point.
    // releaseInner is handled separately since it may already carry sustainReleaseClip.
    ['attackInner','decayInner','ceilLeftInner','ceilRightInner','sustainSegInner',
     'underlayAttack','underlayDecay','underlaySustain','underlayRelease','fullReferenceRelease'].forEach(id => {
      const el=$(id); if(!el) return;
      if(clipAtGateOn) el.setAttribute('clip-path','url(#gateEnvClip)');
      else el.removeAttribute('clip-path');
    });
    { const el=$('releaseInner'); if(el){
      if(clipAtGateOn) el.setAttribute('clip-path','url(#gateEnvClip)');
      else if(greenAnalogueRelease) el.setAttribute('clip-path','url(#sustainReleaseClip)');
      else el.removeAttribute('clip-path');
    } }
    {
      const susSegPath = drawReleasePath ? `M ${drawPS.x} ${drawPS.y} L ${releaseStartX} ${drawPS.y}` : '';
      { const el=$('sustainSegInner'); if(el){ el.setAttribute('d', susSegPath); el.style.display = (drawReleasePath && legS) ? '' : 'none'; } }
    }
    const tbSusMarkerMD=$('tbSustainMarker'); if(tbSusMarkerMD) tbSusMarkerMD.style.display='none';
    const tbMDLineMD=$('tbModelDSustainLine'); if(tbMDLineMD) tbMDLineMD.style.display='none';
    const tbSusLblMD=$('tbSustainLabel'); if(tbSusLblMD) tbSusLblMD.style.display='none';
  } else {
    renderTextbookPaths({ pts, drawPS, drawP1, ceilY, showClipped, drawReleasePath, curveAmt, dSF, rSF, linearTimeOn });
    $('tapReleaseOrange').setAttribute('d', '');
    $('fullReferenceRelease').setAttribute('d', '');
  }

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
  $('sustainMarker').style.stroke = ($('frequencyMode') && $('frequencyMode').checked) ? (($('filterDecayColor') && $('filterDecayColor').value) || '#ffff00') : (($('loudnessDecayColor') && $('loudnessDecayColor').value) || '#ff0000');
  $('sustainMarker').style.display = (textbookAdsr || !legS) ? 'none' : '';
  $('sustainPoint').setAttribute('cx', drawPS.x);
  $('sustainPoint').setAttribute('cy', drawPS.y);
  $('sustainPoint').style.display = (textbookAdsr || !legS) ? 'none' : '';

  const kcOn = $('keyboardControl') && $('keyboardControl').checked;
  let statedSustainX = drawPS.x; // uncapped sustain x; equals drawPS.x when kc OFF
  let _statedY = null; // elevated for geometry logging
  const statedSustainLineEl = $('statedSustainLine');
  if(statedSustainLineEl){
    if(kcOn && !textbookAdsr && !clipAtGateOn){
      const floorY = yFor(pts.e.floor);
      const statedY = floorY - (floorY - drawPS.y) * KC_SUSTAIN_SCALE;
      _statedY = statedY;
      statedSustainX = pts.pEnd.x + graph.w * state.tbSustainGap;
      const underlayCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
      statedSustainLineEl.setAttribute('x1', statedSustainX);
      statedSustainLineEl.setAttribute('y1', statedY);
      statedSustainLineEl.setAttribute('x2', markerEndX);
      statedSustainLineEl.setAttribute('y2', statedY);
      statedSustainLineEl.style.stroke = underlayCol;
      statedSustainLineEl.style.display = '';
      const sslEl=$('statedSustainLabel');
      if(sslEl){ sslEl.setAttribute('x', pts.pEnd.x + 5); sslEl.setAttribute('y', statedY - 8); sslEl.setAttribute('text-anchor', 'start'); sslEl.setAttribute('style', 'fill:' + underlayCol + ';'); }
    } else {
      statedSustainLineEl.style.display = 'none';
      const sslEl=$('statedSustainLabel');
      if(sslEl) sslEl.style.display = 'none';
    }
  }

  { const el=$('sLabel'), bg=$('sLabelBg');
    el.setAttribute('x', METER_X - 30); el.setAttribute('y', drawPS.y); el.setAttribute('dominant-baseline', 'middle'); el.removeAttribute('stroke'); el.removeAttribute('stroke-width'); el.removeAttribute('paint-order'); el.style.fill = '#000000'; el.style.display = (textbookAdsr || !legS) ? 'none' : ''; el.textContent = ($('keyboardControl') && $('keyboardControl').checked) ? 'MODEL D SUSTAIN' : 'SUSTAIN';
    if(bg){ const bbox=el.getBBox(); bg.setAttribute('x',bbox.x-4); bg.setAttribute('y',bbox.y-2); bg.setAttribute('width',bbox.width+8); bg.setAttribute('height',bbox.height+4); const decayCol = ($('frequencyMode') && $('frequencyMode').checked) ? (($('filterDecayColor') && $('filterDecayColor').value) || '#ffff00') : (($('loudnessDecayColor') && $('loudnessDecayColor').value) || '#ff0000'); bg.setAttribute('fill', decayCol); bg.style.display=el.style.display; }
  }

  // Clip at Gate: hide loose elements whose anchor x >= gateCloseX.
  // Applied as a post-pass so normal visibility logic runs first; this only adds display:none.
  if(clipAtGateOn){
    // Elements with a single x anchor — hide if that x >= gateCloseX
    [['sustainMarker','x1'],['sustainPoint','cx']].forEach(([id,attr]) => {
      const el=$(id); if(!el) return;
      const x = parseFloat(el.getAttribute(attr));
      if(x >= gateCloseX) el.style.display='none';
    });
    // sLabel/sLabelBg — anchor x is METER_X-30, always right of gate
    { const el=$('sLabel'); if(el && parseFloat(el.getAttribute('x')) >= gateCloseX) el.style.display='none'; }
    { const el=$('sLabelBg'); if(el && el.style.display !== 'none'){ const lbl=$('sLabel'); if(lbl && lbl.style.display==='none') el.style.display='none'; } }
  }

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
    amountLine.setAttribute('x1', (showGateTime && gateCloseX < pts.p1.x) ? gateCloseX : pts.p1.x);
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
  // These text anchors are intentionally fixed to GRAPH_TOP_BASE (the top of the staging area).
  // They do NOT follow GRAPH_TOP_EXTRA — only the graph and its time labels move with the gutter.
  const modeLabelEl=$('modeLabel');
  if(modeLabelEl){ modeLabelEl.textContent=freqMode?'FILTER CONTOUR':'LOUDNESS CONTOUR'; modeLabelEl.setAttribute('x',10); modeLabelEl.setAttribute('y',GRAPH_TOP_BASE-90); modeLabelEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }
  const svgTimecodesEl=$('svgTimecodes');
  if(svgTimecodesEl){ svgTimecodesEl.setAttribute('x',METER_X-10); svgTimecodesEl.setAttribute('y',GRAPH_TOP_BASE-90); svgTimecodesEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }
  const toolTitleEl=$('toolTitle');
  if(toolTitleEl){ toolTitleEl.setAttribute('x',VB_WIDTH/2); toolTitleEl.setAttribute('y',GRAPH_TOP_BASE-173); toolTitleEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }
  updateTimeAxis(pts, overrange, showClipped, textbookAdsr, freqMode, linearTimeOn, drawPS, statedSustainX, {legA, legD, legR}, clipAtGateOn ? gateCloseX : null);

  const segY = GRAPH_TOP_BASE - 45;
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
  // A/D/R inner line colours — switch per mode
  const _aEl = freqMode ? $('filterAttackColor')  : $('loudnessAttackColor');
  const _dEl = freqMode ? $('filterDecayColor')   : $('loudnessDecayColor');
  const _rEl = freqMode ? $('filterReleaseColor') : $('loudnessReleaseColor');
  const _gEl = freqMode ? $('filterGateColor')    : $('loudnessGateColor');
  const _root = document.documentElement;
  if(_aEl) _root.style.setProperty('--attackColor',  _aEl.value);
  if(_dEl) _root.style.setProperty('--decayColor',   _dEl.value);
  if(_rEl) _root.style.setProperty('--releaseColor', _rEl.value);
  if(_gEl) _root.style.setProperty('--gateColor',    _gEl.value);

  // Keep resting meter fill in sync whenever no animation is running
  if(state.currentPhase === 'idle') hideDot();

  syncControls();
  updateButtonStates();
  setTimeout(refreshNumericInputs, 0); // keep numeric inputs in sync after every render
  window._lastRenderGeometry = {
    drawPS:        { x: drawPS.x, y: drawPS.y, level: drawPS.level },
    drawP1:        { x: drawP1.x, y: drawP1.y },
    p1:            { x: pts.p1.x, y: pts.p1.y },
    pEnd:          { x: pts.pEnd.x, y: pts.pEnd.y },
    ceilY,
    statedSustainX,
    statedY:       _statedY,
    overrange,
    showClipped
  };
  if(window.kioskDrawIfOpen) window.kioskDrawIfOpen();
  } catch(err) {
    logEvent('RENDER_ERROR', { message: err && err.message, state: { a: state.a, d: state.d, s: state.s, r: state.r, floor: state.floor, scale: state.scale } });
    throw err;
  }
}
