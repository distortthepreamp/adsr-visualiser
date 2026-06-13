// ---- shortcuts.js — keyboard shortcuts and help modal wiring ----
// showHelp/hideHelp and toggleCheckbox/toggleMode are top-level globals
// so they can be called from other files and from the keydown handler.
// Event listener registration is deferred to initShortcuts(), called from init.

function showHelp(){ $('helpOverlay').style.display='flex'; }
function hideHelp(){ $('helpOverlay').style.display='none'; }

function toggleCheckbox(id){
  const el=$(id); if(!el) return;
  el.checked=!el.checked;
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
function toggleMode(){
  const live=document.querySelector('input[name="mode"][value="live"]');
  const anim=document.querySelector('input[name="mode"][value="animate"]');
  if(!live||!anim) return;
  if(live.checked){ anim.checked=true; anim.dispatchEvent(new Event('change',{bubbles:true})); }
  else            { live.checked=true; live.dispatchEvent(new Event('change',{bubbles:true})); }
}

// ---- initShortcuts — registers help modal and keyboard listeners; called from init ----
function initShortcuts(){
  // Help modal
  $('helpBtn').addEventListener('click', showHelp);
  $('helpClose').addEventListener('click', hideHelp);
  $('helpOverlay').addEventListener('click', e => { if(e.target===$('helpOverlay')) hideHelp(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if(['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
    if($('helpOverlay').style.display !== 'none'){
      if(e.key === 'Escape') hideHelp();
      return;
    }
    if(isAdvancedOpen()){ if(e.key === 'Escape') closeAdvanced(); return; }
    if(e.key === 'Escape') return;
    if(e.key === '?'){ showHelp(); return; }
    if(e.key === ' '){
      e.preventDefault();
      if(tapMode === 'hold'){
        if(state.currentPhase === 'hold' || state.currentPhase === 'sustain'){ releaseFromCurrent(); }
        else { hold(); }
      } else {
        const ms = tapMode === 'tap50' ? 50 : tapMode === 'tap100' ? 100 : tapMode === 'tap500' ? 500 : tapMode === 'tap1000' ? 1000 : tapMode === 'tapCustom' ? (Number($('tapCustomMs').value)||200) : 200;
        tap(ms);
      }
    } else if(e.key === '1' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap50','tapMode50Btn');
    } else if(e.key === '2' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap100','tapMode100Btn');
    } else if(e.key === '3' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap200','tapMode200Btn');
    } else if(e.key === '4' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap500', 'tap500Btn');
    } else if(e.key === '5' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey){ setTapMode('tap1000', 'tap1sBtn');
    } else if(e.key === 'h' || e.key === 'H'){ setTapMode('hold','tapModeHoldBtn');
    } else if(e.key === 'Enter'){
      e.preventDefault();
      transition(currentTransitionSec);
    } else if((e.key === 'c' || e.key === 'C') && e.altKey){ clearBlobAndMarker();
    } else if(e.key === 'c' || e.key === 'C'){ toggleCheckbox('showClipped');
    } else if(e.key === 'l' || e.key === 'L'){ toggleMode();
    } else if(e.key === 'a' || e.key === 'A'){ toggleCheckbox('audioEnabled');
    } else if(e.key === 'd' || e.key === 'D'){ toggleCheckbox('loudDecay');
    } else if(e.key === 'r' || e.key === 'R'){ toggleCheckbox('drawReleaseWhenZero');
    } else if(e.key === 'z' || e.key === 'Z'){ toggleCheckbox('timelineZoom3x');
    } else if(e.key === ','){ toggleCheckbox('showBounds');
    } else if(e.key === '.'){ toggleCheckbox('showContour');
    } else if(e.key === ';'){ toggleCheckbox('showEffectiveTimes');
    } else if(e.key === ':'){ toggleCheckbox('showEffectiveLines');
    } else if(e.key === "'"){ toggleCheckbox('showStatedTimes');
    } else if(e.key === '"'){ toggleCheckbox('showStatedLines');
    } else if(e.key === 'f' || e.key === 'F'){ toggleCheckbox('frequencyMode');
    } else if(e.key === 'm' || e.key === 'M'){ toggleCheckbox('hpMode');
    } else if(e.key === 's' || e.key === 'S'){ toggleCheckbox('keyboardControl');
    } else if(e.key === 'x' || e.key === 'X'){ toggleCheckbox('linearTime');
    } else if(e.key === 't' || e.key === 'T'){ toggleCheckbox('textbookAdsr');
    } else if(e.key === '['){ toggleCheckbox('tbSustainDotted');
    } else if(e.key === ']'){ toggleCheckbox('tbSustainCollapse');
    } else if(e.key === '\\'){ toggleCheckbox('tbShowModelDSustain');
    } else if(e.key === 'b' || e.key === 'B'){ toggleCheckbox('analogueCurve');
    } else if(/^Digit[1-6]$/.test(e.code) && (e.shiftKey||e.altKey||e.metaKey)){
      const idx = parseInt(e.code.replace('Digit', '')) - 1;
      const qs = k => { const b=document.querySelectorAll(`.quickset-btn[data-knob="${k}"]`)[idx]; return b?Number(b.dataset.value):null; };
      if(e.shiftKey && e.altKey && e.metaKey && !e.ctrlKey){ const v=qs('release'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.r=positionFromMs(v); transition(currentTransitionSec); } }
      else if(e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey){ const v=qs('attack'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.a=positionFromMs(v); transition(currentTransitionSec); } }
      else if(e.shiftKey && e.altKey && !e.metaKey && !e.ctrlKey){ const v=qs('decay'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.d=positionFromMs(v); transition(currentTransitionSec); } }
      else if(e.altKey && e.metaKey && !e.shiftKey && !e.ctrlKey){ const v=qs('amount'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.scale=v/10; transition(currentTransitionSec); } }
      else if(e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey){ const v=qs('sustain'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.s=v/10; transition(currentTransitionSec); } }
      else if(e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey){ const v=qs('cutoff'); if(v!==null){ state.target.tbSustainGap=state.tbSustainGap; state.target.floor=v/10; transition(currentTransitionSec); } }
      e.preventDefault();
    }
  });
}
