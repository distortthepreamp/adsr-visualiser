// ---- Time axis drop lines ----
// Called from render() with pre-computed geometry values.
const TIME_LABEL_STATED_Y_OFFSET    = -10; // px above the graph top (stated labels)
const TIME_LABEL_EFFECTIVE_Y_OFFSET =  18; // px below the time axis (effective labels)

function updateTimeAxis(pts, overrange, showClipped, textbookAdsr, freqMode, linearTimeOn, drawPS, statedSustainX, modelLegs) {
  // Drop lines (individual elements, gated by the new drop-line checkboxes)
  // Per-leg effective flags: false when textbook mode is active OR when the leg is hidden.
  const effA = !textbookAdsr && (modelLegs ? modelLegs.legA !== false : true);
  const effD = !textbookAdsr && (modelLegs ? modelLegs.legD !== false : true);
  const effR = !textbookAdsr && (modelLegs ? modelLegs.legR !== false : true);
  const timeLabelGutter = Math.max(0, Number(($('timeLabelGutter') && $('timeLabelGutter').value) || 0));
  const statedLabelY    = graph.y0 - graph.h + TIME_LABEL_STATED_Y_OFFSET - timeLabelGutter;
  const effectiveLabelY = graph.y0 + TIME_LABEL_EFFECTIVE_Y_OFFSET + timeLabelGutter;
  const newStatedCol = ($('underlayColor') && $('underlayColor').value) || '#ffffff';
  const newEffAttackCol = (freqMode ? ($('filterAttackColor') && $('filterAttackColor').value) : ($('loudnessAttackColor') && $('loudnessAttackColor').value)) || '#ffffff';
  const newEffDecayCol = (freqMode ? ($('filterDecayColor') && $('filterDecayColor').value) : ($('loudnessDecayColor') && $('loudnessDecayColor').value)) || '#ffffff';
  const newEffReleaseCol = (freqMode ? ($('filterReleaseColor') && $('filterReleaseColor').value) : ($('loudnessReleaseColor') && $('loudnessReleaseColor').value)) || '#ffffff';
  const showNewStated=!!($('showNewStatedLines')&&$('showNewStatedLines').checked);
  // Stated decay drop line: vertical from the decay/sustain junction (pts.pEnd.x, drawPS.y) to the time axis
  const newStatedDecayDropEl=$('newStatedDecayDrop');
  const newStatedDecayTimeLabelEl=$('newStatedDecayTime');
  if(newStatedDecayDropEl){
    const showStatedDecayDrop = showNewStated && (($('underlayD') && $('underlayD').checked) || $('textbookAdsr').checked);
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
        newStatedDecayTimeLabelEl.textContent = 'D = ' + Math.round(msFromPosition(state.d)) + 'ms';
        newStatedDecayTimeLabelEl.style.display='';
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
    const showStatedAttackDrop = showNewStated && (($('underlayA') && $('underlayA').checked) || $('textbookAdsr').checked);
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
        newStatedAttackTimeLabelEl.textContent = 'A = ' + Math.round(msFromPosition(state.a)) + 'ms';
        newStatedAttackTimeLabelEl.style.display='';
      }
    } else {
      newStatedAttackDropEl.style.display='none';
      if(newStatedAttackTimeLabelEl) newStatedAttackTimeLabelEl.style.display='none';
    }
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
        newEffectiveDecayTimeLabelEl.setAttribute('x', drawPS.x);
        newEffectiveDecayTimeLabelEl.setAttribute('y', effectiveLabelY);
        newEffectiveDecayTimeLabelEl.setAttribute('text-anchor', 'middle');
        newEffectiveDecayTimeLabelEl.setAttribute('fill', newEffDecayCol);
        newEffectiveDecayTimeLabelEl.textContent = 'D = ' + Math.round(pixelsToTimeSec(drawPS.x - pts.p1.x, linearTimeOn) * 1000) + 'ms';
        newEffectiveDecayTimeLabelEl.style.display='';
      }
    } else {
      newEffectiveDecayDropEl.style.display='none';
      if(newEffectiveDecayTimeLabelEl) newEffectiveDecayTimeLabelEl.style.display='none';
    }
  }
  // Effective attack drop line(s): descend from the attack peak (or ceiling crossings when clipped) to the time axis
  const newEffAttackDropEl=$('newEffectiveAttackDrop');
  const newEffAttackDropEndEl=$('newEffectiveAttackDropEnd');
  const showNewEffAttack = ($('showNewEffectiveLines') && $('showNewEffectiveLines').checked) && effA && freqMode && overrange && showClipped;
  if(showNewEffAttack){
    const ceilY = yFor(1);
    if(showClipped && overrange){
      // Case 2: clipping active — two lines, at the attack→ceiling and ceiling→decay crossings
      const f_a = (1 - pts.e.floor) / pts.e.scale;
      const f_d = (pts.e.floor + pts.e.scale - 1) / pts.e.scale;
      const ceilAttackX = pts.p0.x + (pts.p1.x - pts.p0.x) * f_a;
      let ceilDecayX = pts.p1.x + (pts.pEnd.x - pts.p1.x) * f_d;
      if(ceilDecayX > pts.pS.x) ceilDecayX = pts.pS.x;
      if(newEffAttackDropEl){
        newEffAttackDropEl.setAttribute('x1',ceilAttackX); newEffAttackDropEl.setAttribute('y1',ceilY);
        newEffAttackDropEl.setAttribute('x2',ceilAttackX); newEffAttackDropEl.setAttribute('y2',graph.y0); newEffAttackDropEl.setAttribute('stroke',newEffAttackCol);
        newEffAttackDropEl.style.display='';
      }
      if(newEffAttackDropEndEl){
        newEffAttackDropEndEl.setAttribute('x1',ceilDecayX); newEffAttackDropEndEl.setAttribute('y1',ceilY);
        newEffAttackDropEndEl.setAttribute('x2',ceilDecayX); newEffAttackDropEndEl.setAttribute('y2',graph.y0); newEffAttackDropEndEl.setAttribute('stroke',newEffAttackCol);
        newEffAttackDropEndEl.style.display='';
      }
    } else {
      // Case 1: no clipping — single line at the attack peak
      const drawP1Y = Math.max(pts.p1.y, ceilY);
      if(newEffAttackDropEl){
        newEffAttackDropEl.setAttribute('x1',pts.p1.x); newEffAttackDropEl.setAttribute('y1',drawP1Y);
        newEffAttackDropEl.setAttribute('x2',pts.p1.x); newEffAttackDropEl.setAttribute('y2',graph.y0); newEffAttackDropEl.setAttribute('stroke',newEffAttackCol);
        newEffAttackDropEl.style.display='';
      }
      if(newEffAttackDropEndEl) newEffAttackDropEndEl.style.display='none';
    }
  } else {
    if(newEffAttackDropEl) newEffAttackDropEl.style.display='none';
    if(newEffAttackDropEndEl) newEffAttackDropEndEl.style.display='none';
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
      if(relEl && relEl.getTotalLength() > 0){ const p=relEl.getPointAtLength(relEl.getTotalLength()); fx=p.x; fy=p.y; }
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
        newEffectiveReleaseTimeLabelEl.textContent = 'R = ' + Math.round(pixelsToTimeSec(effRelPx, linearTimeOn) * 1000) + 'ms';
        newEffectiveReleaseTimeLabelEl.style.display='';
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
    const showStatedRelease = pts.e.releaseOn && showNewStated && (($('underlayR') && $('underlayR').checked) || $('textbookAdsr').checked);
    if(showStatedRelease){
      const stRelX = pts.pEnd.x + graph.w * state.tbSustainGap + timeToPixels(mapTime(state.r), linearTimeOn);
      const stRelY = yFor(pts.e.floor);
      newStatedReleaseDropEl.setAttribute('x1',stRelX); newStatedReleaseDropEl.setAttribute('y1',stRelY);
      newStatedReleaseDropEl.setAttribute('x2',stRelX); newStatedReleaseDropEl.setAttribute('y2',graph.y0-graph.h); newStatedReleaseDropEl.setAttribute('stroke',newStatedCol);
      newStatedReleaseDropEl.style.display='';
      if(newStatedReleaseTimeLabelEl){
        newStatedReleaseTimeLabelEl.setAttribute('x', stRelX);
        newStatedReleaseTimeLabelEl.setAttribute('y', statedLabelY);
        newStatedReleaseTimeLabelEl.setAttribute('text-anchor', 'middle');
        newStatedReleaseTimeLabelEl.setAttribute('fill', newStatedCol);
        newStatedReleaseTimeLabelEl.textContent = 'R = ' + Math.round(msFromPosition(state.r)) + 'ms';
        newStatedReleaseTimeLabelEl.style.display='';
      }
    } else {
      newStatedReleaseDropEl.style.display='none';
      if(newStatedReleaseTimeLabelEl) newStatedReleaseTimeLabelEl.style.display='none';
    }
  }
}
