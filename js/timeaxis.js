// ---- Time axis labels and drop lines ----
// Called from render() with pre-computed geometry values.
const TIME_AXIS_EFF_OFFSET_Y    = 40; // px below graph.y0 for the effective-times row
const TIME_AXIS_STATED_OFFSET_Y = 80; // px below graph.y0 for the stated-times row
function updateTimeAxis(pts, overrange, showClipped, textbookAdsr, freqMode, linearTimeOn, drawPS, statedSustainX) {
  const e = pts.e;
  const timeAxis0El=$('timeAxis0');
  const showEffective=!!($('showEffectiveTimes')&&$('showEffectiveTimes').checked);
  const showStated=!!($('showStatedTimes')&&$('showStatedTimes').checked);
  const taY=graph.y0+TIME_AXIS_EFF_OFFSET_Y;
  const showEffectiveVisible=showEffective&&!textbookAdsr;
  if(timeAxis0El){ timeAxis0El.setAttribute('x',graph.x0); timeAxis0El.setAttribute('y',taY); timeAxis0El.style.display=showEffectiveVisible?'':'none'; timeAxis0El.style.opacity=showEffectiveVisible?'1':''; }
  const timeAxis0StatedEl=$('timeAxis0Stated');
  if(timeAxis0StatedEl){ timeAxis0StatedEl.setAttribute('x',graph.x0); timeAxis0StatedEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y); timeAxis0StatedEl.style.display=showStated?'':'none'; timeAxis0StatedEl.style.opacity=showStated?'1':''; }
  const taEffLabelEl=$('timeAxisEffectiveLabel');
  if(taEffLabelEl){ taEffLabelEl.setAttribute('x',10); taEffLabelEl.setAttribute('y',taY); taEffLabelEl.style.display=showEffectiveVisible?'':'none'; taEffLabelEl.style.opacity=showEffectiveVisible?'1':''; }
  const taStatedLabelEl=$('timeAxisStatedLabel');
  if(taStatedLabelEl){ taStatedLabelEl.setAttribute('x',10); taStatedLabelEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y); taStatedLabelEl.style.display=showStated?'':'none'; taStatedLabelEl.style.opacity=showStated?'1':''; }
  const timeAxisAttackEl=$('timeAxisAttack');
  if(timeAxisAttackEl){
    let taAttackX, taAttackMs;
    if(textbookAdsr){
      taAttackX=pts.p1.x;
      taAttackMs=Math.round(e.aT*1000);
    } else if(freqMode && showClipped && overrange){
      const f_a=(1-e.floor)/e.scale; // e.scale > 0 guaranteed: overrange condition implies e.scale > 1-e.floor ≥ 0
      taAttackX=pts.p0.x+(pts.p1.x-pts.p0.x)*f_a;
      taAttackMs=Math.round(e.aT*f_a*1000);
    } else {
      taAttackX=pts.p1.x;
      taAttackMs=Math.round(e.aT*1000);
    }
    timeAxisAttackEl.setAttribute('x',taAttackX); timeAxisAttackEl.setAttribute('y',taY);
    timeAxisAttackEl.textContent=taAttackMs+' ms';
    timeAxisAttackEl.style.display=showEffectiveVisible?'':'none'; timeAxisAttackEl.style.opacity=showEffectiveVisible?'1':'';
  }
  const timeAxisAttackStatedEl=$('timeAxisAttackStated');
  if(timeAxisAttackStatedEl){
    if(showStated){
      timeAxisAttackStatedEl.setAttribute('x',pts.p1.x); timeAxisAttackStatedEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y);
      timeAxisAttackStatedEl.textContent=Math.round(e.aT*1000)+' ms';
      timeAxisAttackStatedEl.style.display=''; timeAxisAttackStatedEl.style.opacity='1';
    } else {
      timeAxisAttackStatedEl.style.display='none'; timeAxisAttackStatedEl.style.opacity='';
    }
  }
  const taDecayStartEl=$('timeAxisDecayStart');
  const taDecayEndEl=$('timeAxisDecayEnd');
  if(taDecayStartEl&&taDecayEndEl){
    const showClipLabels=showEffectiveVisible&&freqMode&&showClipped&&overrange;
    // timeAxisDecayStart: clipping mode only — right edge of flat top (effective row)
    if(showClipLabels){
      const f_d=(e.floor+e.scale-1)/e.scale; // e.scale > 0 guaranteed: overrange condition implies e.scale > 1-e.floor ≥ 0
      const ceilDecayX=pts.p1.x+(pts.pEnd.x-pts.p1.x)*f_d;
      taDecayStartEl.setAttribute('x',ceilDecayX); taDecayStartEl.setAttribute('y',taY);
      taDecayStartEl.textContent=Math.round((e.aT+e.dT*f_d)*1000)+' ms';
      taDecayStartEl.style.display=''; taDecayStartEl.style.opacity='1';
    } else {
      taDecayStartEl.style.display='none'; taDecayStartEl.style.opacity='';
    }
    // timeAxisDecayEnd: stated row — textbook always; Model D only when Loud Decay ON
    const showDecayEnd=showStated&&(textbookAdsr||e.releaseOn);
    if(showDecayEnd){
      const decayEndX=pts.pEnd.x;
      taDecayEndEl.setAttribute('x',decayEndX); taDecayEndEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y);
      taDecayEndEl.textContent=Math.round((e.aT+e.dT)*1000)+' ms';
      taDecayEndEl.style.display=''; taDecayEndEl.style.opacity='1';
    } else {
      taDecayEndEl.style.display='none'; taDecayEndEl.style.opacity='';
    }
  }
  // timeAxisDecayEndEffective: effective row, drawPS.x in Model D, pts.pEnd.x in textbook
  const taDecayEndEffEl=$('timeAxisDecayEndEffective');
  if(taDecayEndEffEl){
    const showDecayEndEff=showEffectiveVisible&&e.releaseOn;
    if(showDecayEndEff){
      const effDecayEndX=textbookAdsr?pts.pEnd.x:drawPS.x;
      const effDecayFraction=textbookAdsr?1:Math.max(0,(drawPS.x-pts.p1.x)/(pts.dwFull||1));
      const effDecayEndMs=Math.round((e.aT+e.dT*effDecayFraction)*1000);
      taDecayEndEffEl.setAttribute('x',effDecayEndX); taDecayEndEffEl.setAttribute('y',taY);
      taDecayEndEffEl.textContent=effDecayEndMs+' ms';
      taDecayEndEffEl.style.display=''; taDecayEndEffEl.style.opacity='1';
    } else {
      taDecayEndEffEl.style.display='none'; taDecayEndEffEl.style.opacity='';
    }
  }
  // timeAxisDecayEndStated: stated row, same x as effective — controlled by showStatedTimes
  const taDecayEndStatedEl=$('timeAxisDecayEndStated');
  if(taDecayEndStatedEl){
    const showDecayEndSt=showStated&&e.releaseOn;
    if(showDecayEndSt){
      const stDecayEndX=textbookAdsr?pts.pEnd.x:statedSustainX;
      const stDecayFraction=textbookAdsr?1:Math.max(0,(statedSustainX-pts.p1.x)/(pts.dwFull||1));
      const stDecayEndMs=Math.round((e.aT+e.dT*stDecayFraction)*1000);
      taDecayEndStatedEl.setAttribute('x',stDecayEndX); taDecayEndStatedEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y);
      taDecayEndStatedEl.textContent=stDecayEndMs+' ms';
      taDecayEndStatedEl.style.display=''; taDecayEndStatedEl.style.opacity='1';
    } else {
      taDecayEndStatedEl.style.display='none'; taDecayEndStatedEl.style.opacity='';
    }
  }
  const taReleaseEndEl=$('timeAxisReleaseEnd');
  const taReleaseEndStatedEl=$('timeAxisReleaseEndStated');
  {
    let releaseEndX, releaseEndMs;
    if(textbookAdsr){
      const sustainGap=graph.w*state.tbSustainGap;
      const tbSusEndX=pts.pEnd.x+sustainGap;
      const rT_r=mapTime(state.r);
      const rwFull=timeToPixels(rT_r,linearTimeOn);
      releaseEndX=tbSusEndX+rwFull;
      releaseEndMs=Math.round((e.aT+e.dT+rT_r)*1000);
    } else {
      releaseEndX=pts.pEnd.x;
      releaseEndMs=Math.round((e.aT+e.dT)*1000);
    }
    if(taReleaseEndEl){
      const showReleaseEnd=showEffectiveVisible&&e.releaseOn;
      if(showReleaseEnd){
        taReleaseEndEl.setAttribute('x',releaseEndX); taReleaseEndEl.setAttribute('y',taY);
        taReleaseEndEl.textContent=releaseEndMs+' ms';
        taReleaseEndEl.style.display=''; taReleaseEndEl.style.opacity='1';
      } else { taReleaseEndEl.style.display='none'; taReleaseEndEl.style.opacity=''; }
    }
    if(taReleaseEndStatedEl){
      if(showStated){
        taReleaseEndStatedEl.setAttribute('x',releaseEndX); taReleaseEndStatedEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y);
        taReleaseEndStatedEl.textContent=releaseEndMs+' ms';
        taReleaseEndStatedEl.style.display=''; taReleaseEndStatedEl.style.opacity='1';
      } else { taReleaseEndStatedEl.style.display='none'; taReleaseEndStatedEl.style.opacity=''; }
    }
  }
  const taReleaseStartEl=$('timeAxisReleaseStart');
  const taReleaseStartStatedEl=$('timeAxisReleaseStartStated');
  if(taReleaseStartEl||taReleaseStartStatedEl){
    const tbSusEndX=textbookAdsr ? pts.pEnd.x+graph.w*state.tbSustainGap : 0;
    const releaseStartMs=Math.round((e.aT+e.dT)*1000);
    if(taReleaseStartEl){ taReleaseStartEl.style.display='none'; taReleaseStartEl.style.opacity=''; }
    if(taReleaseStartStatedEl){
      if(showStated&&textbookAdsr){
        taReleaseStartStatedEl.setAttribute('x',tbSusEndX); taReleaseStartStatedEl.setAttribute('y',graph.y0+TIME_AXIS_STATED_OFFSET_Y);
        taReleaseStartStatedEl.textContent=releaseStartMs+' ms';
        taReleaseStartStatedEl.style.display=''; taReleaseStartStatedEl.style.opacity='1';
      } else { taReleaseStartStatedEl.style.display='none'; taReleaseStartStatedEl.style.opacity=''; }
    }
  }
  // Drop lines
  const showEffLines=!!($('showEffectiveLines')&&$('showEffectiveLines').checked);
  const showStLines=!!($('showStatedLines')&&$('showStatedLines').checked);
  function updateDropLineGroup(groupId, elIds, show, colorClass){
    const g=$(groupId); if(!g) return;
    while(g.firstChild) g.removeChild(g.firstChild);
    if(!show) return;
    const NS='http://www.w3.org/2000/svg';
    elIds.forEach(id=>{
      const el=$(id);
      if(el&&el.style.display!=='none'){
        const x=parseFloat(el.getAttribute('x'));
        if(!isNaN(x)){
          const ln=document.createElementNS(NS,'line');
          ln.setAttribute('x1',x); ln.setAttribute('x2',x);
          ln.setAttribute('y1',yFor(1)); ln.setAttribute('y2',graph.y0);
          ln.setAttribute('stroke-width','1');
          ln.setAttribute('vector-effect','non-scaling-stroke');
          ln.setAttribute('opacity','1');
          ln.setAttribute('class',colorClass);
          g.appendChild(ln);
        }
      }
    });
  }
  updateDropLineGroup('dropLinesEffective',['timeAxisAttack','timeAxisDecayStart','timeAxisDecayEndEffective','timeAxisReleaseStart'],showEffLines,'drop-line-effective');
  updateDropLineGroup('dropLinesStated',['timeAxisAttackStated','timeAxisDecayEndStated','timeAxisReleaseStartStated'],showStLines,'drop-line-stated');
  // Dim drop line rows when their time axis equivalent is off
  const effLinesRow=$('showEffectiveLinesRow'), statedLinesRow=$('showStatedLinesRow');
  if(effLinesRow){ effLinesRow.style.opacity=showEffective?'':UI_DISABLED_OPACITY; effLinesRow.style.pointerEvents=showEffective?'':'none'; }
  if(statedLinesRow){ statedLinesRow.style.opacity=showStated?'':UI_DISABLED_OPACITY; statedLinesRow.style.pointerEvents=showStated?'':'none'; }
}
