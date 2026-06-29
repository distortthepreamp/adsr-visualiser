// ---- paths.js — SVG path building, knob sync, and the render() coordinator ----
// Depends on geometry.js (clamp, yFor, computePoints, etc.) being loaded first.

const KC_SUSTAIN_SCALE = MIMIC_SUSTAIN_INV; // inverse of the mimic-sustain cap

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
  const bs = parseFloat(($('blobScale') && $('blobScale').value) || 3);
  document.getElementById('dot').setAttribute('r', Math.round(lw * bs));
  const dotStated = document.getElementById('dotStated');
  if(dotStated) dotStated.setAttribute('r', Math.round(lw * bs));
  document.getElementById('sustainPoint').setAttribute('r', Math.round(lw * 0.57));
}

function render(){
  try {
  const DB_GUTTER_W = 60;  // dB-scale gutter width (user units); mirror-ready for right side
  // Keep viewBox and VB_WIDTH-dependent elements in sync
  const svgEl = document.getElementById('svg');
  if(svgEl) svgEl.setAttribute('viewBox', `0 ${VB_Y_ORIGIN} ${VB_WIDTH} ${VB_HEIGHT_EFF}`);
  const floorBoundEl = document.getElementById('floorBound');
  if(floorBoundEl){ floorBoundEl.setAttribute('x2', VB_WIDTH); floorBoundEl.setAttribute('y1', graph.y0); floorBoundEl.setAttribute('y2', graph.y0); }
  const ceilingBoundEl = document.getElementById('ceilingBound');
  if(ceilingBoundEl) ceilingBoundEl.setAttribute('x2', VB_WIDTH);

  // Link R to D: force state.r to mirror state.d so all downstream reads see D's value
  if($('linkRToD') && $('linkRToD').checked){ state.r = state.d; state.target.r = state.target.d; }

  syncRadii();
  const pts=computePoints();
  // Draw the envelope as separate A/D/R segments. Each segment is drawn twice:
  // a thick white outer stroke, then a softer coloured inner stroke.
  const e = pts.e;
  const ceilY = yFor(1);
  const overrange = e.scale > 0.0001 && e.floor + e.scale > 1.0001;
  const legA = $('modelA') ? $('modelA').checked : true;
  const legD = $('modelD') ? $('modelD').checked : true;
  const legS = $('modelS') ? $('modelS').checked : true;
  const legR = $('modelR') ? $('modelR').checked : true;
  const showClipped = overrange && $('showClipped') && $('showClipped').checked;

  // Gate-close x and clip-at-gate flag — hoisted so both the Model D block and the
  // post-block loose elements can use them.
  const showGateTime = $('showGateTime') && $('showGateTime').checked;
  const clipAtGateOn = showGateTime && $('clipAtGate') && $('clipAtGate').checked;
  const gateTapMs = Math.round(gateMsFromPosition(state.gate));
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

  const linkRToD = $('linkRToD') && $('linkRToD').checked;
  const releaseBox = $('releaseKnobBox');
  if(releaseBox){ releaseBox.style.opacity = linkRToD ? UI_DISABLED_OPACITY : '1'; releaseBox.style.pointerEvents = linkRToD ? 'none' : 'auto'; }
  const releaseLegendEl=$('releaseLegend'); if(releaseLegendEl) releaseLegendEl.style.opacity=linkRToD?UI_DISABLED_OPACITY:'1';
  const analogueOn = $('analogueCurve') && $('analogueCurve').checked;
  const curveAmt = analogueOn ? (Number($('curveAmount').value) / 100) : 0;

  const aSF = Math.min(1, pts.aw / (graph.w * 0.3));
  const dSF = Math.min(1, pts.dwFull / (graph.w * 0.3));

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
  { const el=$('attackInner'); if(el){ el.setAttribute('d', aPath); el.style.opacity = legA ? '' : '0'; } }
  { const el=$('ceilLeftInner'); if(el){ el.setAttribute('d', ceilLeftPath); el.style.opacity = (showClipped && legA) ? '' : '0'; } }
  { const el=$('ceilRightInner'); if(el){ el.setAttribute('d', ceilRightPath); el.style.opacity = (showClipped && legD) ? '' : '0'; } }
  { const el=$('decayInner'); if(el){ el.setAttribute('d', dPath); el.style.opacity = legD ? '' : '0'; } }

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
    rEnd = e.releaseOn ? pts.pEnd : { x: drawPS.x, y: pts.p0.y };
  }
  const rSF = Math.min(1, (rEnd.x - drawPS.x) / (graph.w * 0.3));

  // Rightmost visible curve x — accumulated across blocks for Fit
  let rightmostX = pts.p0.x;
  if(showGateTime) rightmostX = Math.max(rightmostX, gateCloseX);

  // Textbook ADSR underlay — faint straight-line A/D/S/R behind the main curves.
  // Each leg is independently gated by its own checkbox (underlayA/D/S/R).
  {
    const showA = $('underlayA') && $('underlayA').checked;
    const showD = $('underlayD') && $('underlayD').checked;
    const showS = $('underlayS') && $('underlayS').checked;
    const showR = $('underlayR') && $('underlayR').checked;
    const ua=$('underlayAttack'), ud=$('underlayDecay'), us=$('underlaySustain'), ur=$('underlayRelease');
    // Always compute and set real d; toggle opacity for visibility
    const tbSusGapPx = graph.w * state.tbSustainGap;
    const tbDecayEndX = pts.pEnd.x;
    const tbSusEndX   = pts.pEnd.x + tbSusGapPx;
    const tbRelEndX   = tbSusEndX + timeToPixels(mapTime(state.r));
    const tbFloorY    = yFor(e.floor);
    // Textbook proportional ceiling: amount scales the headroom above the floor (never exceeds 1)
    const textbookCeiling = e.floor + (1 - e.floor) * e.scale;
    const ulP1Y = yFor(textbookCeiling);
    const ulPSY = yFor(e.floor + state.s * (1 - e.floor) * e.scale);
    const ulColor = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
    if(ua){ ua.setAttribute('d', `M ${pts.p0.x} ${pts.p0.y} L ${pts.p1.x} ${ulP1Y}`); ua.style.opacity = showA ? '' : '0'; }
    if(ud){ ud.setAttribute('d', `M ${pts.p1.x} ${ulP1Y} L ${tbDecayEndX} ${ulPSY}`); ud.style.opacity = showD ? '' : '0'; }
    if(us){ us.setAttribute('d', `M ${tbDecayEndX} ${ulPSY} L ${tbSusEndX} ${ulPSY}`); us.style.opacity = showS ? '' : '0'; }
    if(ur){ ur.setAttribute('d', drawReleasePath ? `M ${tbSusEndX} ${ulPSY} L ${tbRelEndX} ${tbFloorY}` : `M ${tbSusEndX} ${ulPSY} L ${tbSusEndX} ${ulPSY}`); ur.style.opacity = (showR && drawReleasePath) ? '' : '0'; }
    [ua,ud,us,ur].forEach(el=>{ if(el) el.style.stroke=ulColor; });
    // Accumulate rightmost visible textbook x for Fit
    if(showR && drawReleasePath) rightmostX = Math.max(rightmostX, tbRelEndX);
    else if(showS) rightmostX = Math.max(rightmostX, tbSusEndX);
    else if(showD) rightmostX = Math.max(rightmostX, tbDecayEndX);
  }

  {
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
    let effReleaseEndX = rEnd.x;
    if(drawReleasePath){
      if(curveAmt){
        const magentaXAtSustain = rcPolylineXAtY(pts.p1.x, pts.p1.y, rEnd.x, rEnd.y, releaseStartY, false, 200, 3);
        const greenOffset = releaseStartX - magentaXAtSustain;
        rPath = rcPolyline(pts.p1.x + greenOffset, pts.p1.y, rEnd.x + greenOffset, rEnd.y, false, 50, 3);
        effReleaseEndX = rEnd.x + greenOffset;
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
      el.style.opacity = legR ? '' : '0';
      // clip-path is set later by the Clip at Gate block (handles both gateEnvClip and sustainReleaseClip)
    } }
    // #fullReferenceRelease: full peak→floor reference curve (cyan, unclipped). Only shown
    // when Show Peak Discharge is checked.
    const showPeakDischarge = $('showPeakDischarge') && $('showPeakDischarge').checked;
    const fullReferenceReleaseEl = $('fullReferenceRelease');
    if(fullReferenceReleaseEl){
      // Always compute d so the path stays sample-able; toggle opacity for visibility
      if(curveAmt && drawReleasePath){
        fullReferenceReleaseEl.setAttribute('d', rcPolyline(pts.p1.x, pts.p1.y, rEnd.x, rEnd.y, false, 50, 3));
      }
      fullReferenceReleaseEl.removeAttribute('clip-path');
      fullReferenceReleaseEl.style.stroke = '#00ffff';
      fullReferenceReleaseEl.style.opacity = (showPeakDischarge && curveAmt && drawReleasePath) ? '' : '0';
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
    // Gate RC geometry — always populated when drawReleasePath && curveAmt (sample-able by blobs).
    // Visibility gated additionally by showGateTime.
    const gateRCPopulated = !!(drawReleasePath && curveAmt);
    const gateRCVisible = !!(gateRCPopulated && showGateTime);
    let orangeDischargeEndX = 0;
    if(gateRCPopulated){
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
        tapReleaseOrangeEl.style.opacity = (gateRCVisible && legR) ? '' : '0';
      }
    } else {
      const tapReleaseOrangeEl = $('tapReleaseOrange');
      if(tapReleaseOrangeEl) tapReleaseOrangeEl.style.opacity = '0';
    }
    // Effective GR descender: vertical at the RC discharge floor-crossing, from floor to graph.y0
    const gateEffReleaseDropEl = $('gateEffectiveReleaseDrop');
    const gateEffReleaseTimeEl = $('gateEffectiveReleaseTime');
    if(gateRCVisible && legR){
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
        gateEffReleaseTimeEl.textContent = 'GR = ' + Math.round(pixelsToTimeSec(orangeDischargeEndX - gateCloseX) * 1000) + 'ms';
        gateEffReleaseTimeEl.style.display = '';
      }
    } else {
      if(gateEffReleaseDropEl) gateEffReleaseDropEl.style.display = 'none';
      if(gateEffReleaseTimeEl) gateEffReleaseTimeEl.style.display = 'none';
    }
    // Textbook (stated) gate-release line + ascender drop line and GR label.
    // Stated gate-release — coords always populated when drawReleasePath (sample-able by blobs).
    // Visibility gated additionally by showGateTime.
    const statedGatePopulated = !!(drawReleasePath && $('underlayR') && $('underlayR').checked);
    const showStatedGateRelease = !!(statedGatePopulated && showGateTime);
    const gateRelEndX = gateCloseX + timeToPixels(mapTime(state.r));
    const gateRelEndY = yFor(pts.e.floor);
    const ulCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
    const gateStatedReleaseEl = $('gateStatedRelease');
    if(gateStatedReleaseEl){
      // Sample the stated (underlay) curve y at gateCloseX
      const gsRelPathEl = statedGatePopulated ? document.getElementById(gateCloseX < pts.p1.x ? 'underlayAttack' : 'underlayDecay') : null;
      const gateStatedStartY = gsRelPathEl ? getYFromPath(gsRelPathEl, gateCloseX) : null;
      if(statedGatePopulated && gateStatedStartY !== null){
        gateStatedReleaseEl.setAttribute('x1', gateCloseX);
        gateStatedReleaseEl.setAttribute('y1', gateStatedStartY);
        gateStatedReleaseEl.setAttribute('x2', gateRelEndX);
        gateStatedReleaseEl.setAttribute('y2', gateRelEndY);
        gateStatedReleaseEl.style.stroke = ulCol;
        gateStatedReleaseEl.style.display = showStatedGateRelease ? '' : 'none';
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
        ? ($('underlayA') && $('underlayA').checked)
        : ($('underlayD') && $('underlayD').checked);
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
      // Gate meter ticks — short horizontal arrows beside the meter at the gate-close level.
      // markerEndX / sustainTickLen are defined later, so compute locally from globals.
      const _gateLabelSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--labelSize')) || 17;
      const gateTickLen = Math.round(_gateLabelSize * 1.5);
      const _gateLabelGap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sustainLabelGap')) || 6;
      const _freqMode = !!($('frequencyMode') && $('frequencyMode').checked);
      const gateEffCol = _freqMode ? (($('filterDecayColor') && $('filterDecayColor').value) || '#ffff00') : (($('loudnessDecayColor') && $('loudnessDecayColor').value) || '#ff0000');
      const gateStatedCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
      const gateEffLblEl = $('gateEffLabel');
      const gateStatedLblEl = $('gateStatedLabel');
      if(gateEffHorizEl){
        if(effVisible){
          gateEffHorizEl.setAttribute('x1', METER_X - DB_GUTTER_W - gateTickLen); gateEffHorizEl.setAttribute('y1', gateCloseY);
          gateEffHorizEl.setAttribute('x2', METER_X - DB_GUTTER_W);               gateEffHorizEl.setAttribute('y2', gateCloseY);
          gateEffHorizEl.style.stroke = gateEffCol;
          gateEffHorizEl.style.display = '';
        } else {
          gateEffHorizEl.style.display = 'none';
        }
      }
      if(gateEffLblEl){
        if(effVisible){
          const pct = Math.round(((graph.y0 - gateCloseY) / graph.h) * 100);
          gateEffLblEl.setAttribute('x', METER_X - DB_GUTTER_W - gateTickLen - _gateLabelGap);
          gateEffLblEl.setAttribute('y', gateCloseY);
          gateEffLblEl.setAttribute('text-anchor', 'end');
          gateEffLblEl.setAttribute('dominant-baseline', 'middle');
          gateEffLblEl.setAttribute('fill', gateEffCol);
          gateEffLblEl.textContent = pct + '%';
          gateEffLblEl.style.display = '';
        } else {
          gateEffLblEl.style.display = 'none';
        }
      }
      if(gateStatedHorizEl){
        if(statedVisible){
          gateStatedHorizEl.setAttribute('x1', METER_X + METER_W);                gateStatedHorizEl.setAttribute('y1', gateStatedYRaw);
          gateStatedHorizEl.setAttribute('x2', METER_X + METER_W + gateTickLen);  gateStatedHorizEl.setAttribute('y2', gateStatedYRaw);
          gateStatedHorizEl.style.stroke = gateStatedCol;
          gateStatedHorizEl.style.display = '';
        } else {
          gateStatedHorizEl.style.display = 'none';
        }
      }
      if(gateStatedLblEl){
        if(statedVisible){
          const pct = Math.round(((graph.y0 - gateStatedYRaw) / graph.h) * 100);
          gateStatedLblEl.setAttribute('x', METER_X + METER_W + gateTickLen + _gateLabelGap);
          gateStatedLblEl.setAttribute('y', gateStatedYRaw);
          gateStatedLblEl.setAttribute('text-anchor', 'start');
          gateStatedLblEl.setAttribute('dominant-baseline', 'middle');
          gateStatedLblEl.setAttribute('fill', gateStatedCol);
          gateStatedLblEl.textContent = pct + '%';
          gateStatedLblEl.style.display = '';
        } else {
          gateStatedLblEl.style.display = 'none';
        }
      }
    } else {
      if(gateTimeLineEl) gateTimeLineEl.style.display = 'none';
      if(gateTimeLabelEl) gateTimeLabelEl.style.display = 'none';
      if(gateEffHorizEl) gateEffHorizEl.style.display = 'none';
      if(gateStatedHorizEl) gateStatedHorizEl.style.display = 'none';
      const _gEL = $('gateEffLabel'); if(_gEL) _gEL.style.display = 'none';
      const _gSL = $('gateStatedLabel'); if(_gSL) _gSL.style.display = 'none';
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
      const susSegPath = `M ${drawPS.x} ${drawPS.y} L ${releaseStartX} ${drawPS.y}`;
      { const el=$('sustainSegInner'); if(el){ el.setAttribute('d', susSegPath); el.style.opacity = legS ? '' : '0'; } }
    }
    const tbSusMarkerMD=$('tbSustainMarker'); if(tbSusMarkerMD) tbSusMarkerMD.style.display='none';
    const tbMDLineMD=$('tbModelDSustainLine'); if(tbMDLineMD) tbMDLineMD.style.display='none';
    const tbSusLblMD=$('tbSustainLabel'); if(tbSusLblMD) tbSusLblMD.style.display='none';
    // Accumulate rightmost visible effective x for Fit
    if(legR && drawReleasePath) rightmostX = Math.max(rightmostX, effReleaseEndX);
    if(gateRCVisible && legR) rightmostX = Math.max(rightmostX, orangeDischargeEndX);
    if(showStatedGateRelease) rightmostX = Math.max(rightmostX, gateRelEndX);
    if(!drawReleasePath) rightmostX = Math.max(rightmostX, drawPS.x);
    if(clipAtGateOn){
      let gateReleaseMax = gateCloseX;
      if(gateRCVisible && legR) gateReleaseMax = Math.max(gateReleaseMax, orangeDischargeEndX);
      if(showStatedGateRelease) gateReleaseMax = Math.max(gateReleaseMax, gateRelEndX);
      rightmostX = gateReleaseMax;
    }
  }
  state._fitRightmostX = rightmostX;

  // Sustain as a horizontal level guide extending to the right from
  // the decay/release intersection. This reads as an indefinite held level,
  // rather than something that reaches back into the earlier decay phase.
  // Meter geometry
  const meterX = METER_X;
  const meterW = METER_W;
  const meterAbsTop = graph.y0 - graph.h;  // yFor(1) = 85
  const meterAbsBottom = graph.y0;          // yFor(0) = 445

  const markerEndX = meterX - DB_GUTTER_W;  // left-side ticks end at the gutter's left edge
  const markerRightX = meterX + meterW;      // right-side ticks start at the meter's right edge
  const _labelSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--labelSize')) || 17;
  const arrowSize = Math.round(_labelSize * 0.72);
  const sustainTickLen = Math.round(_labelSize * 1.5);
  const sustainLabelGap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sustainLabelGap')) || 6;
  // Size arrowhead markers to match label cap height
  const arrowR = document.getElementById('sustainArrowRight');
  const arrowL = document.getElementById('sustainArrowLeft');
  if(arrowR){ arrowR.setAttribute('markerWidth', arrowSize); arrowR.setAttribute('markerHeight', arrowSize); }
  if(arrowL){ arrowL.setAttribute('markerWidth', arrowSize); arrowL.setAttribute('markerHeight', arrowSize); }
  $('sustainMarker').setAttribute('x1', markerEndX - sustainTickLen);
  $('sustainMarker').setAttribute('y1', drawPS.y);
  $('sustainMarker').setAttribute('x2', markerEndX);
  $('sustainMarker').setAttribute('y2', drawPS.y);
  $('sustainMarker').style.stroke = ($('frequencyMode') && $('frequencyMode').checked) ? (($('filterDecayColor') && $('filterDecayColor').value) || '#ffff00') : (($('loudnessDecayColor') && $('loudnessDecayColor').value) || '#ff0000');
  const showEffLines = !!($('showNewEffectiveLines') && $('showNewEffectiveLines').checked);
  const showModelDSusTick = (legD || legR || legS) && !showGateTime && showEffLines;
  $('sustainMarker').style.display = showModelDSusTick ? '' : 'none';
  { const lbl=$('sustainMarkerLabel'); if(lbl){
    lbl.setAttribute('x', markerEndX - sustainTickLen - sustainLabelGap);
    lbl.setAttribute('y', drawPS.y);
    lbl.setAttribute('text-anchor', 'end');
    lbl.setAttribute('dominant-baseline', 'middle');
    lbl.setAttribute('fill', $('sustainMarker').style.stroke);
    lbl.textContent = 'S = ' + Math.round((e.floor + drawPS.level * e.scale) * 100) + '%';
    lbl.style.display = showModelDSusTick ? '' : 'none';
  } }
  $('sustainPoint').setAttribute('cx', drawPS.x);
  $('sustainPoint').setAttribute('cy', drawPS.y);
  $('sustainPoint').style.display = legS ? '' : 'none';

  const kcOn = $('keyboardControl') && $('keyboardControl').checked;
  let statedSustainX = drawPS.x; // uncapped sustain x; equals drawPS.x when kc OFF
  let _statedY = null; // elevated for geometry logging
  const statedSustainLineEl = $('statedSustainLine');
  if(statedSustainLineEl){
    const showStatedLines = !!($('showNewStatedLines') && $('showNewStatedLines').checked);
    const ulD = !!($('underlayD') && $('underlayD').checked);
    const ulR = !!($('underlayR') && $('underlayR').checked);
    const ulS = !!($('underlayS') && $('underlayS').checked);
    const tbSusVis = (ulD || ulR || ulS) && !showGateTime && showStatedLines;
    const statedY = yFor(e.floor + state.s * (1 - e.floor) * e.scale);
    _statedY = statedY;
    statedSustainX = pts.pEnd.x + graph.w * state.tbSustainGap;
    const underlayCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
    statedSustainLineEl.setAttribute('x1', markerRightX);
    statedSustainLineEl.setAttribute('y1', statedY);
    statedSustainLineEl.setAttribute('x2', markerRightX + sustainTickLen);
    statedSustainLineEl.setAttribute('y2', statedY);
    statedSustainLineEl.style.stroke = underlayCol;
    statedSustainLineEl.style.display = tbSusVis ? '' : 'none';
    const ssl=$('statedSustainLabel'); if(ssl){
      ssl.setAttribute('x', markerRightX + sustainTickLen + sustainLabelGap);
      ssl.setAttribute('y', statedY);
      ssl.setAttribute('text-anchor', 'start');
      ssl.setAttribute('dominant-baseline', 'middle');
      ssl.setAttribute('fill', underlayCol);
      ssl.textContent = 'S = ' + Math.round((e.floor + state.s * (1 - e.floor) * e.scale) * 100) + '%';
      ssl.style.display = tbSusVis ? '' : 'none';
    }
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
  }

  // Meter box — fixed full graph height
  const meterBox=$('meterBox');
  if(meterBox){
    meterBox.setAttribute('x',meterX); meterBox.setAttribute('y',meterAbsTop);
    meterBox.setAttribute('width',meterW); meterBox.setAttribute('height',graph.h);
    meterBox.style.strokeWidth = METER_STROKE_W;
  }
  // dB scale labels — computed reference numbers in the gutter column, inset to the fill range
  const gutterX = meterX - DB_GUTTER_W;
  const dbLabels = $('dbScaleLabels');
  if(dbLabels){
    // Loudness mode → dB scale; filter mode → Hz scale. Same gutter, same styling.
    const _dbFreqMode = $('frequencyMode') && $('frequencyMode').checked;
    while(dbLabels.firstChild) dbLabels.removeChild(dbLabels.firstChild);
    dbLabels.style.display = '';
    const _svgForPx = document.getElementById('svg');
    const _pxToUser = _svgForPx ? (VB_WIDTH / _svgForPx.getBoundingClientRect().width) : 1;
    const strokeInset = (METER_STROKE_W / 2) * _pxToUser;
    const innerTop = meterAbsTop + strokeInset;
    const innerH = graph.h - 2 * strokeInset;
    const labelX = gutterX + DB_GUTTER_W / 2;
    const _addLabel = (text, frac) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', labelX); t.setAttribute('y', innerTop + innerH * (1 - frac));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('style', 'dominant-baseline:middle;font-size:'+DB_LABEL_SIZE+'px;fill:#fff;font-family:\'UniversCondensed\',Arial,Helvetica,sans-serif;');
      t.textContent = text;
      dbLabels.appendChild(t);
    };
    if(!_dbFreqMode){
      // dB labels positioned by linear-amplitude mapping: frac = 10^(dB/20)
      const DB_MARKS = [0, -3, -6, -9, -12, -18];
      for(const D of DB_MARKS) _addLabel(String(D), Math.pow(10, D / 20));
    } else {
      // Hz labels at fixed calibration fractions (independent of the audio cutoff curve).
      // Keyboard tracking shifts the scale up by a measured octave amount (0.1 frac/octave).
      const kb1 = $('keyboardTrack1') && $('keyboardTrack1').checked;
      const kb2 = $('keyboardTrack2') && $('keyboardTrack2').checked;
      const octShift = (kb1 && kb2) ? 3.12 : kb2 ? 2.29 : kb1 ? 1.41 : 0;  // measured
      const fracShift = octShift * 0.1;
      const HZ_MARKS = [['10k', 0.832], ['1k', 0.5], ['100', 0.168]];
      for(const [txt, baseFrac] of HZ_MARKS){
        const newFrac = baseFrac - fracShift;
        if(newFrac >= 0 && newFrac <= 1) _addLabel(txt, newFrac);
      }
    }
  }
  const meterClipRect=$('meterClipRect');
  if(meterClipRect){
    meterClipRect.setAttribute('x',meterX); meterClipRect.setAttribute('y',meterAbsTop);
    meterClipRect.setAttribute('width',meterW); meterClipRect.setAttribute('height',graph.h);
  }
  // Split meter: left half = stated, right half = effective
  const halfW = meterW / 2;
  const meterClipLeftRect=$('meterClipLeftRect');
  if(meterClipLeftRect){
    meterClipLeftRect.setAttribute('x',meterX); meterClipLeftRect.setAttribute('y',meterAbsTop);
    meterClipLeftRect.setAttribute('width',halfW); meterClipLeftRect.setAttribute('height',graph.h);
  }
  const meterClipRightRect=$('meterClipRightRect');
  if(meterClipRightRect){
    meterClipRightRect.setAttribute('x',meterX+halfW); meterClipRightRect.setAttribute('y',meterAbsTop);
    meterClipRightRect.setAttribute('width',halfW); meterClipRightRect.setAttribute('height',graph.h);
  }
  const meterFillEl=$('meterFill');
  if(meterFillEl){ meterFillEl.setAttribute('x',meterX); meterFillEl.setAttribute('width',halfW); meterFillEl.setAttribute('clip-path','url(#meterClipLeft)'); }
  const meterFillStatedEl=$('meterFillStated');
  if(meterFillStatedEl){ meterFillStatedEl.setAttribute('x',meterX+halfW); meterFillStatedEl.setAttribute('width',halfW); meterFillStatedEl.setAttribute('clip-path','url(#meterClipRight)'); }
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
  const anyModelLeg = legA || legD || legS || legR;
  const anyUnderlayLeg = !!( ($('underlayA')&&$('underlayA').checked) || ($('underlayD')&&$('underlayD').checked) || ($('underlayS')&&$('underlayS').checked) || ($('underlayR')&&$('underlayR').checked) );
  const showContourLeft = showContour && anyModelLeg;
  const showContourRight = showContour && anyUnderlayLeg;
  const contourTickCol = ($('filterDecayColor') && $('filterDecayColor').value) || '#ffff00';
  const contourTickColRight = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
  // Contour ticks — left stubs (meter left edge) and right stubs (meter right edge)
  const riserLen = Math.round(sustainTickLen * 0.65);
  // Half stroke width in user units (non-scaling-stroke is in CSS px; convert via viewBox/screen ratio)
  const markerLW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--markerLineWidth')) || 1;
  const svgEl2 = document.getElementById('svg');
  const pxToUser = svgEl2 ? (VB_WIDTH / svgEl2.getBoundingClientRect().width) : 1;
  const halfStroke = (markerLW / 2) * pxToUser;
  if(floorLine){
    floorLine.setAttribute('x1', markerEndX - sustainTickLen);
    floorLine.setAttribute('y1', floorY);
    floorLine.setAttribute('x2', markerEndX);
    floorLine.setAttribute('y2', floorY);
    floorLine.style.stroke = contourTickCol;
    floorLine.style.display = showContourLeft ? '' : 'none';
  }
  const floorRiser = $('floorRiser');
  if(floorRiser){
    const rx = markerEndX - sustainTickLen + halfStroke;
    floorRiser.setAttribute('x1', rx); floorRiser.setAttribute('y1', floorY + riserLen);
    floorRiser.setAttribute('x2', rx); floorRiser.setAttribute('y2', floorY);
    floorRiser.style.stroke = contourTickCol;
    floorRiser.style.display = showContourLeft ? '' : 'none';
  }
  const floorLineR = $('floorLineRight');
  if(floorLineR){
    floorLineR.setAttribute('x1', markerRightX);
    floorLineR.setAttribute('y1', floorY);
    floorLineR.setAttribute('x2', markerRightX + sustainTickLen);
    floorLineR.setAttribute('y2', floorY);
    floorLineR.style.stroke = contourTickColRight;
    floorLineR.style.display = showContourRight ? '' : 'none';
  }
  const floorRiserR = $('floorRiserRight');
  if(floorRiserR){
    const rx = markerRightX + sustainTickLen - halfStroke;
    floorRiserR.setAttribute('x1', rx); floorRiserR.setAttribute('y1', floorY + riserLen);
    floorRiserR.setAttribute('x2', rx); floorRiserR.setAttribute('y2', floorY);
    floorRiserR.style.stroke = contourTickColRight;
    floorRiserR.style.display = showContourRight ? '' : 'none';
  }
  if(amountLine){
    amountLine.setAttribute('x1', markerEndX - sustainTickLen);
    amountLine.setAttribute('y1', amountY);
    amountLine.setAttribute('x2', markerEndX);
    amountLine.setAttribute('y2', amountY);
    amountLine.style.stroke = contourTickCol;
    amountLine.style.display = showContourLeft ? '' : 'none';
  }
  const amountRiser = $('amountRiser');
  if(amountRiser){
    const rx = markerEndX - sustainTickLen + halfStroke;
    amountRiser.setAttribute('x1', rx); amountRiser.setAttribute('y1', amountY - riserLen);
    amountRiser.setAttribute('x2', rx); amountRiser.setAttribute('y2', amountY);
    amountRiser.style.stroke = contourTickCol;
    amountRiser.style.display = showContourLeft ? '' : 'none';
  }
  const amountLineR = $('amountLineRight');
  const textbookAmountY = yFor(e.floor + (1 - e.floor) * e.scale);
  if(amountLineR){
    amountLineR.setAttribute('x1', markerRightX);
    amountLineR.setAttribute('y1', textbookAmountY);
    amountLineR.setAttribute('x2', markerRightX + sustainTickLen);
    amountLineR.setAttribute('y2', textbookAmountY);
    amountLineR.style.stroke = contourTickColRight;
    amountLineR.style.display = showContourRight ? '' : 'none';
  }
  const amountRiserR = $('amountRiserRight');
  if(amountRiserR){
    const rx = markerRightX + sustainTickLen - halfStroke;
    amountRiserR.setAttribute('x1', rx); amountRiserR.setAttribute('y1', textbookAmountY - riserLen);
    amountRiserR.setAttribute('x2', rx); amountRiserR.setAttribute('y2', textbookAmountY);
    amountRiserR.style.stroke = contourTickColRight;
    amountRiserR.style.display = showContourRight ? '' : 'none';
  }
  // ---- CF / AOC contour labels ----
  const capHeight = _labelSize * 0.72;
  const contourLabelGap = sustainLabelGap;
  const _hp = $('hpMode') && $('hpMode').checked;
  const cfPct = Math.round(e.floor * 100);
  const cfText = (_hp ? 'Min ' : '') + cfPct + '%';
  const aocPctL = Math.round(Math.min(e.floor + e.scale, 1) * 100);
  const aocTextLeft = (_hp ? '' : 'Max ') + aocPctL + '%';
  const aocPctR = Math.round((e.floor + (1 - e.floor) * e.scale) * 100);
  const aocTextRight = (_hp ? '' : 'Max ') + aocPctR + '%';
  const leftX = markerEndX - sustainTickLen - sustainLabelGap;
  const rightX = markerRightX + sustainTickLen + sustainLabelGap;
  // CF left (Model D) — below cutoff arrow's free bottom end
  const cfLbl = $('cfLabel');
  if(cfLbl){
    cfLbl.setAttribute('x', leftX);
    cfLbl.setAttribute('y', floorY + riserLen + contourLabelGap + capHeight);
    cfLbl.setAttribute('text-anchor', 'end');
    cfLbl.setAttribute('fill', contourTickCol);
    cfLbl.textContent = cfText;
    cfLbl.style.display = showContourLeft ? '' : 'none';
  }
  // CF right (textbook) — below cutoff arrow's free bottom end
  const cfLblR = $('cfLabelRight');
  if(cfLblR){
    cfLblR.setAttribute('x', rightX);
    cfLblR.setAttribute('y', floorY + riserLen + contourLabelGap + capHeight);
    cfLblR.setAttribute('text-anchor', 'start');
    cfLblR.setAttribute('fill', contourTickColRight);
    cfLblR.textContent = cfText;
    cfLblR.style.display = showContourRight ? '' : 'none';
  }
  // AOC left (Model D) — above amount arrow's free top end
  const aocLbl = $('aocLabel');
  if(aocLbl){
    aocLbl.setAttribute('x', leftX);
    aocLbl.setAttribute('y', (amountY - riserLen) - contourLabelGap);
    aocLbl.setAttribute('text-anchor', 'end');
    aocLbl.setAttribute('fill', contourTickCol);
    aocLbl.textContent = aocTextLeft;
    aocLbl.style.display = showContourLeft ? '' : 'none';
  }
  // AOC right (textbook) — above amount arrow's free top end
  const aocLblR = $('aocLabelRight');
  if(aocLblR){
    aocLblR.setAttribute('x', rightX);
    aocLblR.setAttribute('y', (textbookAmountY - riserLen) - contourLabelGap);
    aocLblR.setAttribute('text-anchor', 'start');
    aocLblR.setAttribute('fill', contourTickColRight);
    aocLblR.textContent = aocTextRight;
    aocLblR.style.display = showContourRight ? '' : 'none';
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
  if(modeLabelEl){ modeLabelEl.textContent=freqMode?'FILTER CONTOUR':'LOUDNESS CONTOUR'; modeLabelEl.setAttribute('x',10); modeLabelEl.setAttribute('text-anchor','start'); modeLabelEl.setAttribute('y',VB_Y_ORIGIN + 30); modeLabelEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }  // left-aligned top header (sits just below the tightened viewBox top)
  const svgTimecodesEl=$('svgTimecodes');
  if(svgTimecodesEl){ svgTimecodesEl.setAttribute('x',METER_X-10); svgTimecodesEl.setAttribute('y',GRAPH_TOP_BASE-90); svgTimecodesEl.style.fontSize='calc(var(--labelSize) * var(--h1Scale) * 1px)'; }
  updateTimeAxis(pts, overrange, showClipped, freqMode, drawPS, statedSustainX, {legA, legD, legR}, clipAtGateOn ? gateCloseX : null);

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
  if(state.currentPhase === 'idle'){
    hideDot();
    hideDotStated();
    // Resting meter: filter mode → cutoff floor; loudness mode → empty
    const restingY = freqMode ? yFor(e.floor) : graph.y0;
    // "Empty" is mode-dependent: LP empties at the floor (graph.y0), HP at the ceiling (yFor(1))
    const emptyY = ($('hpMode') && $('hpMode').checked) ? yFor(1) : graph.y0;
    setMeterLevel(anyModelLeg ? restingY : emptyY);
    setMeterLevelStated(anyUnderlayLeg ? restingY : emptyY);
    // Reset fill opacity so resting fills are visible (may have been hidden by leg-off during play)
    if($('meterFill')) $('meterFill').style.opacity = '';
    if($('meterFillStated')) $('meterFillStated').style.opacity = '';
  }

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
