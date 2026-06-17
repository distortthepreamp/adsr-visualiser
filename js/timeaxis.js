// ---- Time axis drop lines ----
// Called from render() with pre-computed geometry values.
function updateTimeAxis(pts, overrange, showClipped, textbookAdsr, freqMode, linearTimeOn, drawPS, statedSustainX) {
  // Drop lines (individual elements, gated by the new drop-line checkboxes)
  const showNewStated=!!($('showNewStatedLines')&&$('showNewStatedLines').checked);
  // Stated decay drop line: vertical from the decay/sustain junction (pts.pEnd.x, drawPS.y) to the time axis
  const newStatedDecayDropEl=$('newStatedDecayDrop');
  if(newStatedDecayDropEl){
    const showStatedDecayDrop = showNewStated && ($('showTextbookUnderlay').checked || $('textbookAdsr').checked);
    if(showStatedDecayDrop){
      newStatedDecayDropEl.setAttribute('x1',pts.pEnd.x); newStatedDecayDropEl.setAttribute('y1',graph.y0-graph.h);
      newStatedDecayDropEl.setAttribute('x2',pts.pEnd.x); newStatedDecayDropEl.setAttribute('y2',graph.y0);
      newStatedDecayDropEl.style.display='';
    } else {
      newStatedDecayDropEl.style.display='none';
    }
  }
  // Stated attack drop line: vertical from the (textbook/underlay) attack peak to the time axis
  const newStatedAttackDropEl=$('newStatedAttackDrop');
  if(newStatedAttackDropEl){
    const showStatedAttackDrop = showNewStated && ($('showTextbookUnderlay').checked || $('textbookAdsr').checked);
    if(showStatedAttackDrop){
      const tbPeakY = Math.max(pts.p1.y, yFor(1)); // attack peak y (= drawP1.y in non-clipped mode)
      newStatedAttackDropEl.setAttribute('x1',pts.p1.x); newStatedAttackDropEl.setAttribute('y1',tbPeakY);
      newStatedAttackDropEl.setAttribute('x2',pts.p1.x); newStatedAttackDropEl.setAttribute('y2',graph.y0);
      newStatedAttackDropEl.style.display='';
    } else {
      newStatedAttackDropEl.style.display='none';
    }
  }
  // Effective decay drop line: vertical from the Model D decay/sustain intercept (drawPS) to the time axis
  const newEffectiveDecayDropEl=$('newEffectiveDecayDrop');
  if(newEffectiveDecayDropEl){
    const showEffectiveDecayDrop = ($('showNewEffectiveLines') && $('showNewEffectiveLines').checked) && !textbookAdsr;
    if(showEffectiveDecayDrop){
      newEffectiveDecayDropEl.setAttribute('x1',drawPS.x); newEffectiveDecayDropEl.setAttribute('y1',drawPS.y);
      newEffectiveDecayDropEl.setAttribute('x2',drawPS.x); newEffectiveDecayDropEl.setAttribute('y2',graph.y0);
      newEffectiveDecayDropEl.style.display='';
    } else {
      newEffectiveDecayDropEl.style.display='none';
    }
  }
}
