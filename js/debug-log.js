// ---- Debug log system ----
const pageLoadTime = Date.now();
let debugLog = [];

window.logEvent = function(type, data) {
  debugLog.push({ t: Date.now() - pageLoadTime, type, ...data });
};

(function(){
  // Inject modal
  const overlay = document.createElement('div');
  overlay.id = 'debugLogOverlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:500;align-items:center;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:rgba(18,18,18,.97);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:22px 28px 24px;width:600px;max-width:95vw;display:flex;flex-direction:column;color:#fff;font-family:Arial,Helvetica,sans-serif;position:relative;">' +
      '<button id="debugLogClose" style="position:absolute;top:10px;right:14px;background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;font-weight:800;cursor:pointer;line-height:1;padding:0">\xd7</button>' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.55;margin-bottom:12px">Debug Log</div>' +
      '<textarea id="debugLogText" readonly style="width:100%;box-sizing:border-box;height:360px;background:#0a0a0a;color:#ccc;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:10px;font-family:monospace;font-size:12px;resize:vertical;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">' +
        '<button id="debugLogCopy" style="padding:5px 14px;">Copy</button>' +
        '<button id="debugLogClose2" style="padding:5px 14px;">Close</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  function closeModal(){ overlay.style.display = 'none'; }
  document.getElementById('debugLogClose').addEventListener('click', closeModal);
  document.getElementById('debugLogClose2').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  document.getElementById('debugLogCopy').addEventListener('click', () => {
    const ta = document.getElementById('debugLogText');
    if(navigator.clipboard){
      navigator.clipboard.writeText(ta.value).catch(() => { ta.select(); document.execCommand('copy'); });
    } else {
      ta.select(); document.execCommand('copy');
    }
  });

  // Wire open button
  const openBtn = document.getElementById('debugLogBtn');
  if(openBtn) openBtn.addEventListener('click', () => {
    document.getElementById('debugLogText').value = JSON.stringify(debugLog, null, 2);
    overlay.style.display = 'flex';
  });
})();

