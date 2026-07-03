// ---- Time axis drop lines ----
// Called from render() with pre-computed geometry values.
const TIME_LABEL_STATED_Y_OFFSET    = -10; // px above the graph top (stated labels)
const TIME_LABEL_EFFECTIVE_Y_OFFSET =  18; // px below the time axis (effective labels)

function updateTimeAxis(pts, overrange, showClipped, freqMode, drawPS, statedSustainX, modelLegs, clipGateX) {
  // Drop lines (individual elements, gated by the new drop-line checkboxes)
  const effA = modelLegs ? modelLegs.legA !== false : true;
  const effD = modelLegs ? modelLegs.legD !== false : true;
  const effR = modelLegs ? modelLegs.legR !== false : true;
  const timeLabelGutterTop    = Math.max(0, Number(($('timeLabelGutterTop') && $('timeLabelGutterTop').value) || 0));
  const timeLabelGutterBottom = Math.max(0, Number(($('timeLabelGutterBottom') && $('timeLabelGutterBottom').value) || 0));
  const statedLabelY    = graph.y0 - graph.h + TIME_LABEL_STATED_Y_OFFSET - timeLabelGutterTop;
  const effectiveLabelY = graph.y0 + TIME_LABEL_EFFECTIVE_Y_OFFSET + timeLabelGutterBottom;
  // Span mode: dimension line (startX→endX at the label's y) with outward arrowhead triangles; label re-centred to the midpoint, nudged above the line.
  const _spanGroup = document.getElementById('timeSpans');
  if(_spanGroup){ while(_spanGroup.firstChild) _spanGroup.removeChild(_spanGroup.firstChild); }
  const _spanLabelSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--labelSize')) || 17;
  const _spanSize  = Math.round(_spanLabelSize * 0.72);
  const _spanNudge = Math.round(_spanLabelSize * 0.7);
  const applySpan = (el, startX, endX, y, color) => {
    if(!showTimesAsSpans || !el || !_spanGroup) return;
    el.setAttribute('x', (startX + endX) / 2);
    // Top band (stated, above the graph) nudges up; bottom band (effective, below graph.y0) nudges down to clear the line + arrowheads
    el.setAttribute('y', (y > graph.y0) ? (y + _spanNudge + _spanSize) : (y - _spanNudge));
    const NS = 'http://www.w3.org/2000/svg';
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', startX); ln.setAttribute('y1', y);
    ln.setAttribute('x2', endX);   ln.setAttribute('y2', y);
    ln.setAttribute('stroke', color);
    ln.setAttribute('style', 'stroke-width:var(--markerLineWidth);vector-effect:non-scaling-stroke');
    _spanGroup.appendChild(ln);
    const tri = (tipX, pointsRight) => {
      const baseX = pointsRight ? (tipX - _spanSize) : (tipX + _spanSize);
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', tipX+','+y+' '+baseX+','+(y - _spanSize/2)+' '+baseX+','+(y + _spanSize/2));
      p.setAttribute('fill', color);
      _spanGroup.appendChild(p);
    };
    tri(startX, false);  // left end → points left (outward)
    tri(endX, true);     // right end → points right (outward)
  };
  const newStatedCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
  const newEffAttackCol = (freqMode ? ($('filterAttackColor') && $('filterAttackColor').value) : ($('loudnessAttackColor') && $('loudnessAttackColor').value)) || '#ffffff';
  const newEffDecayCol = (freqMode ? ($('filterDecayColor') && $('filterDecayColor').value) : ($('loudnessDecayColor') && $('loudnessDecayColor').value)) || '#ffffff';
  const newEffReleaseCol = (freqMode ? ($('filterReleaseColor') && $('filterReleaseColor').value) : ($('loudnessReleaseColor') && $('loudnessReleaseColor').value)) || '#ffffff';
  const showNewStated=!!($('showNewStatedLines')&&$('showNewStatedLines').checked);
  // Stated decay drop line: vertical from the decay/sustain junction (pts.pEnd.x, drawPS.y) to the time axis
  const newStatedDecayDropEl=$('newStatedDecayDrop');
  const newStatedDecayTimeLabelEl=$('newStatedDecayTime');
  if(newStatedDecayDropEl){
    const showStatedDecayDrop = showNewStated && ($('underlayD') && $('underlayD').checked);
    if(showStatedDecayDrop){
      const ulPSY = overrange ? Math.max(yFor(pts.e.floor + state.s * pts.e.scale), yFor(1)) : yFor(pts.e.floor + state.s * pts.e.scale); // textbook (uncapped) sustain y
      newStatedDecayDropEl.setAttribute('x1',pts.pEnd.x); newStatedDecayDropEl.setAttribute('y1',graph.y0-graph.h);
      newStatedDecayDropEl.setAttribute('x2',pts.pEnd.x); newStatedDecayDropEl.setAttribute('y2',ulPSY); newStatedDecayDropEl.setAttribute('stroke',newStatedCol);
      newStatedDecayDropEl.style.display='';
      if(newStatedDecayTimeLabelEl){
        newStatedDecayTimeLabelEl.setAttribute('x', pts.pEnd.x);
        newStatedDecayTimeLabelEl.setAttribute('y', statedLabelY);
        newStatedDecayTimeLabelEl.setAttribute('text-anchor', 'middle');
        newStatedDecayTimeLabelEl.setAttribute('fill', newStatedCol);
        newStatedDecayTimeLabelEl.textContent = 'D' + (useShortLabels ? ': ' : ' = ') + Math.round(msFromPosition(state.d)) + (useShortLabels ? '' : 'ms');
        newStatedDecayTimeLabelEl.style.display='';
        applySpan(newStatedDecayTimeLabelEl, pts.p1.x, pts.pEnd.x, statedLabelY, newStatedCol);
      }
    } else {
      newStatedDecayDropEl.style.display='none';
      if(newStatedDecayTimeLabelEl) newStatedDecayTimeLabelEl.style.display='none';
    }
  }
  // Stated attack drop line: vertical from the (textbook/underlay) attack peak to the time axis
  const newStatedAttackDropEl=$('newStatedAttackDrop');
  const newStatedAttackTimeLabelEl=$('newStatedAttackTime');
  if(newStatedAttackDropEl){
    const showStatedAttackDrop = showNewStated && ($('underlayA') && $('underlayA').checked);
    if(showStatedAttackDrop){
      const tbPeakY = Math.max(pts.p1.y, yFor(1)); // attack peak y (= drawP1.y in non-clipped mode)
      newStatedAttackDropEl.setAttribute('x1',pts.p1.x); newStatedAttackDropEl.setAttribute('y1',graph.y0-graph.h);
      newStatedAttackDropEl.setAttribute('x2',pts.p1.x); newStatedAttackDropEl.setAttribute('y2',tbPeakY); newStatedAttackDropEl.setAttribute('stroke',newStatedCol);
      newStatedAttackDropEl.style.display='';
      if(newStatedAttackTimeLabelEl){
        newStatedAttackTimeLabelEl.setAttribute('x', pts.p1.x);
        newStatedAttackTimeLabelEl.setAttribute('y', statedLabelY);
        newStatedAttackTimeLabelEl.setAttribute('text-anchor', 'middle');
        newStatedAttackTimeLabelEl.setAttribute('fill', newStatedCol);
        newStatedAttackTimeLabelEl.textContent = 'A' + (useShortLabels ? ': ' : ' = ') + Math.round(msFromPosition(state.a)) + (useShortLabels ? '' : 'ms');
        newStatedAttackTimeLabelEl.style.display='';
        applySpan(newStatedAttackTimeLabelEl, pts.p0.x, pts.p1.x, statedLabelY, newStatedCol);
      }
    } else if(($('showNewEffectiveLines') && $('showNewEffectiveLines').checked) && effA){
      // Textbook hidden but Model D attack shown: keep the attack time label at the same
      // (textbook) position, coloured like the Model D attack. Drop LINE stays hidden.
      newStatedAttackDropEl.style.display='none';
      if(newStatedAttackTimeLabelEl){
        newStatedAttackTimeLabelEl.setAttribute('x', pts.p1.x);
        newStatedAttackTimeLabelEl.setAttribute('y', statedLabelY);
        newStatedAttackTimeLabelEl.setAttribute('text-anchor', 'middle');
        newStatedAttackTimeLabelEl.setAttribute('fill', newEffAttackCol);
        newStatedAttackTimeLabelEl.textContent = 'A' + (useShortLabels ? ': ' : ' = ') + Math.round(msFromPosition(state.a)) + (useShortLabels ? '' : 'ms');
        newStatedAttackTimeLabelEl.style.display='';
        applySpan(newStatedAttackTimeLabelEl, pts.p0.x, pts.p1.x, statedLabelY, newEffAttackCol);
      }
    } else {
      newStatedAttackDropEl.style.display='none';
      if(newStatedAttackTimeLabelEl) newStatedAttackTimeLabelEl.style.display='none';
    }
  }
  // Hoisted clipping geometry — used by the effective decay label and attack drop lines/labels.
  const isClipped = showClipped && overrange && freqMode;
  let ceilAttackX = 0, ceilDecayX = 0;
  if(isClipped){
    const f_a = (1 - pts.e.floor) / pts.e.scale;
    const f_d = (pts.e.floor + pts.e.scale - 1) / pts.e.scale;
    ceilAttackX = pts.p0.x + (pts.p1.x - pts.p0.x) * f_a;
    ceilDecayX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f_d;
    if(ceilDecayX > pts.pS.x) ceilDecayX = pts.pS.x;
  }
  // Effective decay drop line: vertical from the Model D decay/sustain intercept (drawPS) to the time axis
  const newEffectiveDecayDropEl=$('newEffectiveDecayDrop');
  const newEffectiveDecayTimeLabelEl=$('newEffectiveDecayTime');
  if(newEffectiveDecayDropEl){
    const showEffectiveDecayDrop = ($('showNewEffectiveLines') && $('showNewEffectiveLines').checked) && effD;
    if(showEffectiveDecayDrop){
      newEffectiveDecayDropEl.setAttribute('x1',drawPS.x); newEffectiveDecayDropEl.setAttribute('y1',drawPS.y);
      newEffectiveDecayDropEl.setAttribute('x2',drawPS.x); newEffectiveDecayDropEl.setAttribute('y2',graph.y0); newEffectiveDecayDropEl.setAttribute('stroke',newEffDecayCol);
      newEffectiveDecayDropEl.style.display='';
      if(newEffectiveDecayTimeLabelEl){
        const decayStartX = isClipped ? ceilDecayX : pts.p1.x;
        newEffectiveDecayTimeLabelEl.setAttribute('x', drawPS.x);
        newEffectiveDecayTimeLabelEl.setAttribute('y', effectiveLabelY);
        newEffectiveDecayTimeLabelEl.setAttribute('text-anchor', 'middle');
        newEffectiveDecayTimeLabelEl.setAttribute('fill', newEffDecayCol);
        newEffectiveDecayTimeLabelEl.textContent = 'D' + (useShortLabels ? ': ' : ' = ') + Math.round(pixelsToTimeSec(drawPS.x - decayStartX) * 1000) + (useShortLabels ? '' : 'ms');
        newEffectiveDecayTimeLabelEl.style.display='';
        applySpan(newEffectiveDecayTimeLabelEl, decayStartX, drawPS.x, effectiveLabelY, newEffDecayCol);
      }
    } else {
      newEffectiveDecayDropEl.style.display='none';
      if(newEffectiveDecayTimeLabelEl) newEffectiveDecayTimeLabelEl.style.display='none';
    }
  }
  // Effective clipping drop lines and labels — left pair (attack leg), right pair (decay leg).
  // Both pairs require the common clipping condition; only the leg flag differs.
  const newEffAttackDropEl=$('newEffectiveAttackDrop');
  const newEffAttackTimeLabelEl=$('newEffectiveAttackTime');
  const newEffAttackDropEndEl=$('newEffectiveAttackDropEnd');
  const newEffClipTimeLabelEl=$('newEffectiveClipTime');
  const effLinesOn = ($('showNewEffectiveLines') && $('showNewEffectiveLines').checked);
  const clipBase = effLinesOn && freqMode && overrange && showClipped && isClipped;
  const ceilY = yFor(1);
  // Left pair: attack line + A label (modelA leg)
  const showLeftClip = clipBase && effA;
  if(showLeftClip){
    if(newEffAttackDropEl){
      newEffAttackDropEl.setAttribute('x1',ceilAttackX); newEffAttackDropEl.setAttribute('y1',ceilY);
      newEffAttackDropEl.setAttribute('x2',ceilAttackX); newEffAttackDropEl.setAttribute('y2',graph.y0); newEffAttackDropEl.setAttribute('stroke',newEffAttackCol);
      newEffAttackDropEl.style.display='';
    }
    if(newEffAttackTimeLabelEl){
      newEffAttackTimeLabelEl.setAttribute('x', ceilAttackX);
      newEffAttackTimeLabelEl.setAttribute('y', effectiveLabelY);
      newEffAttackTimeLabelEl.setAttribute('text-anchor', 'middle');
      newEffAttackTimeLabelEl.setAttribute('fill', newEffAttackCol);
      newEffAttackTimeLabelEl.textContent = 'A' + (useShortLabels ? ': ' : ' = ') + Math.round(pixelsToTimeSec(ceilAttackX - pts.p0.x) * 1000) + (useShortLabels ? '' : 'ms');
      newEffAttackTimeLabelEl.style.display='';
      applySpan(newEffAttackTimeLabelEl, pts.p0.x, ceilAttackX, effectiveLabelY, newEffAttackCol);
    }
  } else {
    if(newEffAttackDropEl) newEffAttackDropEl.style.display='none';
    if(newEffAttackTimeLabelEl) newEffAttackTimeLabelEl.style.display='none';
  }
  // Right pair: decay-side clipping line + C label (modelD leg)
  const showRightClip = clipBase && effD;
  if(showRightClip){
    if(newEffAttackDropEndEl){
      newEffAttackDropEndEl.setAttribute('x1',ceilDecayX); newEffAttackDropEndEl.setAttribute('y1',ceilY);
      newEffAttackDropEndEl.setAttribute('x2',ceilDecayX); newEffAttackDropEndEl.setAttribute('y2',graph.y0); newEffAttackDropEndEl.setAttribute('stroke',newEffAttackCol);
      newEffAttackDropEndEl.style.display='';
    }
    if(newEffClipTimeLabelEl){
      newEffClipTimeLabelEl.setAttribute('x', ceilDecayX);
      newEffClipTimeLabelEl.setAttribute('y', effectiveLabelY);
      newEffClipTimeLabelEl.setAttribute('text-anchor', 'middle');
      newEffClipTimeLabelEl.setAttribute('fill', newEffAttackCol);
      newEffClipTimeLabelEl.textContent = 'C' + (useShortLabels ? ': ' : ' = ') + Math.round(pixelsToTimeSec(ceilDecayX - ceilAttackX) * 1000) + (useShortLabels ? '' : 'ms');
      newEffClipTimeLabelEl.style.display='';
      applySpan(newEffClipTimeLabelEl, ceilAttackX, ceilDecayX, effectiveLabelY, newEffAttackCol);
    }
  } else {
    if(newEffAttackDropEndEl) newEffAttackDropEndEl.style.display='none';
    if(newEffClipTimeLabelEl) newEffClipTimeLabelEl.style.display='none';
  }
  // Non-clipped attack line (single line at attack peak, no labels — only when attack leg on + clipping conditions met but not actually clipped)
  if(effLinesOn && effA && freqMode && overrange && showClipped && !isClipped){
    const drawP1Y = Math.max(pts.p1.y, ceilY);
    if(newEffAttackDropEl){
      newEffAttackDropEl.setAttribute('x1',pts.p1.x); newEffAttackDropEl.setAttribute('y1',drawP1Y);
      newEffAttackDropEl.setAttribute('x2',pts.p1.x); newEffAttackDropEl.setAttribute('y2',graph.y0); newEffAttackDropEl.setAttribute('stroke',newEffAttackCol);
      newEffAttackDropEl.style.display='';
    }
  }
  // Effective release drop line: descends from the green release curve's floor point to the time axis
  const newEffReleaseDropEl=$('newEffectiveReleaseDrop');
  const newEffectiveReleaseTimeLabelEl=$('newEffectiveReleaseTime');
  if(newEffReleaseDropEl){
    const showEffRelease = pts.e.releaseOn && ($('showNewEffectiveLines') && $('showNewEffectiveLines').checked) && effR;
    if(showEffRelease){
      // green curve floor = last point of the drawn releaseInner path (= rEnd.x + greenOffset, rEnd.y)
      const relEl=document.getElementById('releaseInner');
      let fx=pts.pEnd.x, fy=yFor(pts.e.floor);
      if(effR && relEl && relEl.getTotalLength() > 0){ const p=relEl.getPointAtLength(relEl.getTotalLength()); fx=p.x; fy=p.y; }
      newEffReleaseDropEl.setAttribute('x1',fx); newEffReleaseDropEl.setAttribute('y1',fy);
      newEffReleaseDropEl.setAttribute('x2',fx); newEffReleaseDropEl.setAttribute('y2',graph.y0); newEffReleaseDropEl.setAttribute('stroke',newEffReleaseCol);
      newEffReleaseDropEl.style.display='';
      if(newEffectiveReleaseTimeLabelEl){
        const releaseStartX = pts.pEnd.x + graph.w * state.tbSustainGap;
        const effRelPx = fx - releaseStartX;
        newEffectiveReleaseTimeLabelEl.setAttribute('x', fx);
        newEffectiveReleaseTimeLabelEl.setAttribute('y', effectiveLabelY);
        newEffectiveReleaseTimeLabelEl.setAttribute('text-anchor', 'middle');
        newEffectiveReleaseTimeLabelEl.setAttribute('fill', newEffReleaseCol);
        newEffectiveReleaseTimeLabelEl.textContent = 'R' + (useShortLabels ? ': ' : ' = ') + Math.round(pixelsToTimeSec(effRelPx) * 1000) + (useShortLabels ? '' : 'ms');
        newEffectiveReleaseTimeLabelEl.style.display='';
        applySpan(newEffectiveReleaseTimeLabelEl, releaseStartX, fx, effectiveLabelY, newEffReleaseCol);
      }
    } else {
      newEffReleaseDropEl.style.display='none';
      if(newEffectiveReleaseTimeLabelEl) newEffectiveReleaseTimeLabelEl.style.display='none';
    }
  }
  // Stated release drop line: ascends from the textbook release floor point to the graph top
  const newStatedReleaseDropEl=$('newStatedReleaseDrop');
  const newStatedReleaseTimeLabelEl=$('newStatedReleaseTime');
  if(newStatedReleaseDropEl){
    const showStatedRelease = pts.e.releaseOn && showNewStated && ($('underlayR') && $('underlayR').checked);
    if(showStatedRelease){
      const stRelX = pts.pEnd.x + graph.w * state.tbSustainGap + timeToPixels(mapTime(state.r));
      const stRelY = yFor(pts.e.floor);
      newStatedReleaseDropEl.setAttribute('x1',stRelX); newStatedReleaseDropEl.setAttribute('y1',stRelY);
      newStatedReleaseDropEl.setAttribute('x2',stRelX); newStatedReleaseDropEl.setAttribute('y2',graph.y0-graph.h); newStatedReleaseDropEl.setAttribute('stroke',newStatedCol);
      newStatedReleaseDropEl.style.display='';
      if(newStatedReleaseTimeLabelEl){
        newStatedReleaseTimeLabelEl.setAttribute('x', stRelX);
        newStatedReleaseTimeLabelEl.setAttribute('y', statedLabelY);
        newStatedReleaseTimeLabelEl.setAttribute('text-anchor', 'middle');
        newStatedReleaseTimeLabelEl.setAttribute('fill', newStatedCol);
        newStatedReleaseTimeLabelEl.textContent = 'R' + (useShortLabels ? ': ' : ' = ') + Math.round(msFromPosition(state.r)) + (useShortLabels ? '' : 'ms');
        newStatedReleaseTimeLabelEl.style.display='';
        applySpan(newStatedReleaseTimeLabelEl, pts.pEnd.x + graph.w * state.tbSustainGap, stRelX, statedLabelY, newStatedCol);
      }
    } else {
      newStatedReleaseDropEl.style.display='none';
      if(newStatedReleaseTimeLabelEl) newStatedReleaseTimeLabelEl.style.display='none';
    }
  }
  // Clip at Gate: hide drop lines and time labels whose anchor x >= clipGateX.
  // Applied as a post-pass after all normal visibility logic.
  if(clipGateX !== null){
    ['newStatedDecayDrop','newStatedDecayTime','newStatedAttackDrop','newStatedAttackTime',
     'newStatedReleaseDrop','newStatedReleaseTime',
     'newEffectiveDecayDrop','newEffectiveDecayTime',
     'newEffectiveAttackDrop','newEffectiveAttackTime',
     'newEffectiveAttackDropEnd','newEffectiveClipTime',
     'newEffectiveReleaseDrop','newEffectiveReleaseTime'].forEach(id => {
      const el=$(id); if(!el || el.style.display==='none') return;
      const x = parseFloat(el.getAttribute('x') || el.getAttribute('x1'));
      if(x >= clipGateX) el.style.display='none';
    });
  }
}
