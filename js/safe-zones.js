// ---- Safe zones — HD (1920x1080) framing guide + FCPX safe zones overlay ----
// Standalone overlay above all content (SVG graph, HTML console, kiosk canvas).
// A direct child of <body> (no transformed ancestor) so position:fixed is viewport-relative.
(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElement('div');
  overlay.id = 'safeZoneOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;z-index:10000;pointer-events:none;display:none;transform-origin:top left;';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '1920');
  svg.setAttribute('height', '1080');
  svg.setAttribute('viewBox', '0 0 1920 1080');
  svg.style.cssText = 'width:1920px;height:1080px;display:block';  // inline outranks the global svg{width:100%} rule → true 1920px, overflows a <1920 screen
  const addRect = (x, y, w, h) => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('fill', 'none'); r.setAttribute('stroke', 'yellow'); r.setAttribute('stroke-width', '2');
    svg.appendChild(r);
  };
  addRect(1, 1, 1918, 1078);      // HD frame (inset 1 so the 2px border isn't edge-clipped)
  addRect(96, 54, 1728, 972);     // Action-safe: inner 90% (5% inset)
  addRect(192, 108, 1536, 864);   // Title-safe: inner 80% (10% inset)
  overlay.appendChild(svg);
  document.body.appendChild(overlay);

  // Reads the 4 globals at CALL TIME (they live in the end-of-body inline script).
  function applySafeZones(){
    overlay.style.display = showSafeZones ? '' : 'none';
    overlay.style.left = safeZoneLeftMargin + 'px';
    overlay.style.top = safeZoneTopMargin + 'px';
    overlay.style.transform = 'scale(' + safeZoneScale + ')';
  }
  window.applySafeZones = applySafeZones;
})();
