// ---- Textbook ADSR geometry and rendering ----

// Textbook ADSR animation geometry — mirrors render()'s textbook coordinate logic.
function tbComputeAnimPoints(){
  const e=getEffective();
  const linearTimeOn=$('linearTime')&&$('linearTime').checked;
  let aw,dwFull,rwFull;
  if(linearTimeOn){
    const totalMs=getLinearTotalMs();
    aw=e.aT*1000*(graph.w/totalMs);
    dwFull=e.dT*1000*(graph.w/totalMs);
    rwFull=mapTime(state.r)*1000*(graph.w/totalMs);
  } else {
    aw=displayTimeWidth(e.aT);
    dwFull=displayTimeWidth(e.dT);
    rwFull=displayTimeWidth(mapTime(state.r));
  }
  const sustainGap=graph.w*state.tbSustainGap;
  const floorY=yFor(e.floor);
  const peakY=yFor(e.floor+e.scale);
  const sustainY=yFor(e.floor+e.s*e.scale);
  const decayEndX=graph.x0+aw+dwFull;
  const sustainEndX=decayEndX+sustainGap;
  const releaseEndX=sustainEndX+rwFull;
  return {
    tbAttackEnd: {x:graph.x0+aw,   y:peakY},
    tbDecayEnd:  {x:decayEndX,      y:sustainY},
    tbSustainEnd:{x:sustainEndX,    y:sustainY},
    tbReleaseEnd:{x:releaseEndX,    y:floorY},
    e
  };
}

// Called from render() when textbookAdsr is true.
// Handles decay/sustain/release path drawing, tbSustainMarker, tbModelDSustainLine,
// tbSustainLabel positioning, and the sustain gap target update.
function renderTextbookPaths({ pts, drawPS, drawP1, ceilY, showClipped, drawReleasePath, curveAmt, dSF, rSF, linearTimeOn }) {
  const e = pts.e;
  // Textbook sustain gap target update
  const collapse = $('tbSustainCollapse') && $('tbSustainCollapse').checked;
  state.target.tbSustainGap = collapse ? 0 : SUSTAIN_GAP_MAX;
  // Textbook ADSR: decay ends at fixed x (pts.pEnd.x), y-only varies with sustain level
  const tbDecayEnd = { x: pts.pEnd.x, y: drawPS.y };
  const tbDPath = showClipped
    ? buildPath(pts.p1.x + (pts.pEnd.x - pts.p1.x) * ((e.floor + e.scale - 1) / e.scale), ceilY, tbDecayEnd.x, tbDecayEnd.y, curveAmt, dSF)
    : buildPath(drawP1.x, drawP1.y, tbDecayEnd.x, tbDecayEnd.y, curveAmt, dSF);
  ['decayOuter','decayInner'].forEach(id => $(id).setAttribute('d', tbDPath));
  // Sustain segment: fixed-width horizontal line at sustain level y
  const sustainGap = graph.w * state.tbSustainGap;
  const tbSusEnd = { x: pts.pEnd.x + sustainGap, y: drawPS.y };
  const tbSusDotted = $('tbSustainDotted') && $('tbSustainDotted').checked;
  if(tbSusDotted){
    ['sustainSegOuter','sustainSegInner'].forEach(id => { const el=$(id); if(el){ el.setAttribute('d',''); el.style.display='none'; } });
    const tbSusMarker=$('tbSustainMarker');
    if(tbSusMarker){
      const smSrc=$('sustainMarker');
      if(smSrc){
        tbSusMarker.style.stroke         = smSrc.style.stroke;
        tbSusMarker.style.strokeWidth    = smSrc.style.strokeWidth;
        tbSusMarker.style.strokeDasharray= smSrc.style.strokeDasharray;
        tbSusMarker.style.strokeLinecap  = smSrc.style.strokeLinecap;
        tbSusMarker.style.strokeOpacity  = smSrc.style.strokeOpacity;
      }
      if(drawReleasePath){
        tbSusMarker.setAttribute('x1',pts.pEnd.x); tbSusMarker.setAttribute('y1',drawPS.y);
        tbSusMarker.setAttribute('x2',tbSusEnd.x);  tbSusMarker.setAttribute('y2',drawPS.y);
        tbSusMarker.style.display='';
      } else {
        tbSusMarker.style.display='none';
      }
    }
  } else {
    const tbSusPath = drawReleasePath ? `M ${pts.pEnd.x} ${drawPS.y} L ${tbSusEnd.x} ${drawPS.y}` : '';
    ['sustainSegOuter','sustainSegInner'].forEach(id => { const el=$(id); if(el){ el.setAttribute('d', tbSusPath); el.style.display=''; } });
    const tbSusMarker=$('tbSustainMarker'); if(tbSusMarker) tbSusMarker.style.display='none';
  }
  // Release: starts from end of sustain segment, spans rwFull to the right
  const rT_r2 = mapTime(state.r);
  let rwFull2;
  if(linearTimeOn){
    const totalMs2 = getLinearTotalMs();
    rwFull2 = rT_r2 * 1000 * (graph.w / totalMs2);
  } else {
    rwFull2 = displayTimeWidth(rT_r2);
  }
  const tbREnd = { x: tbSusEnd.x + rwFull2, y: yFor(e.floor) };
  const tbRPath = drawReleasePath ? buildPath(tbSusEnd.x, tbSusEnd.y, tbREnd.x, tbREnd.y, curveAmt, rSF) : '';
  ['releaseOuter','releaseInner'].forEach(id => $(id).setAttribute('d', tbRPath));
  // Model D style sustain line in textbook mode
  const tbMDLine=$('tbModelDSustainLine');
  if(tbMDLine){
    if($('tbShowModelDSustain')&&$('tbShowModelDSustain').checked){
      const smSrc=$('sustainMarker');
      if(smSrc){
        tbMDLine.style.stroke         = smSrc.style.stroke;
        tbMDLine.style.strokeWidth    = smSrc.style.strokeWidth;
        tbMDLine.style.strokeDasharray= smSrc.style.strokeDasharray;
        tbMDLine.style.strokeLinecap  = smSrc.style.strokeLinecap;
        tbMDLine.style.strokeOpacity  = smSrc.style.strokeOpacity;
      }
      tbMDLine.setAttribute('x1',tbSusEnd.x); tbMDLine.setAttribute('y1',drawPS.y);
      tbMDLine.setAttribute('x2',graph.x0+graph.w); tbMDLine.setAttribute('y2',drawPS.y);
      tbMDLine.style.display='';
    } else {
      tbMDLine.style.display='none';
    }
  }
  // tbSustainLabel: shown only when Model D sustain line is active
  const tbSustainLabelEl=$('tbSustainLabel');
  if(tbSustainLabelEl){
    if($('tbShowModelDSustain')&&$('tbShowModelDSustain').checked){
      tbSustainLabelEl.setAttribute('x',tbSusEnd.x+28); tbSustainLabelEl.setAttribute('y',drawPS.y-18);
      tbSustainLabelEl.style.display='';
    } else {
      tbSustainLabelEl.style.display='none';
    }
  }
}
