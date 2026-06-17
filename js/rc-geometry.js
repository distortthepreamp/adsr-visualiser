// ---- rc-geometry.js — pure geometry; depends on rc-physics.js ----

// Returns SVG path string approximating RC charge or discharge curve
// x0,y0 = start point, x1,y1 = end point (in SVG pixel coordinates)
// isCharge: true = charge (attack), false = discharge (decay/release)
// nSamples: number of polyline segments (default 50)
// nTau: time constants to span (default 3)
function rcPolyline(x0, y0, x1, y1, isCharge, nSamples = 50, nTau = 3) {
  const parts = [];
  for (let i = 0; i <= nSamples; i++) {
    const t = i / nSamples;
    const v = isCharge ? rcCharge(t, nTau) : rcDischarge(t, nTau);
    // Normalise v to 0..1 range (scale so endpoints map exactly to x0,y0 and x1,y1)
    const vNorm = isCharge
      ? v / rcCharge(1, nTau)                                      // charge: v(1) = 1
      : (v - rcDischarge(1, nTau)) / (1 - rcDischarge(1, nTau));   // discharge: v(0)=1, v(1)=0
    const x = x0 + t * (x1 - x0);
    const y = isCharge
      ? y0 + vNorm * (y1 - y0)    // charge: y0=floor, y1=peak
      : y0 + (1 - vNorm) * (y1 - y0); // discharge: y0=peak, y1=sustain/floor
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(' ');
}

// Returns an SVG path string for only the x0..x1 portion of an RC curve whose FULL time
// span is fullX0..fullX1. Because t is taken from where x0/x1 fall within the full span,
// the segment carries the same time scaling (hence the same shape) as the full curve —
// e.g. the drawPS→rEnd slice of a peak→floor discharge is the flatter *tail*, not a fresh
// fast discharge. The slice is then anchored to pass through (x0,y0) at its start and
// (x1,y1) at its end.
function rcPolylineSegment(x0, y0, x1, y1, fullX0, fullX1, isCharge, nSamples = 50, nTau = 3) {
  const fullSpan = (fullX1 - fullX0) || 1;
  const tStart = (x0 - fullX0) / fullSpan;
  const tEnd   = (x1 - fullX0) / fullSpan;
  const norm = (t) => isCharge
    ? rcCharge(t, nTau) / rcCharge(1, nTau)
    : (rcDischarge(t, nTau) - rcDischarge(1, nTau)) / (1 - rcDischarge(1, nTau));
  const vStart = norm(tStart);
  const vRange = (norm(tEnd) - vStart) || 1;
  const parts = [];
  for (let i = 0; i <= nSamples; i++) {
    const f = i / nSamples;
    const t = tStart + f * (tEnd - tStart);
    const x = x0 + f * (x1 - x0);
    // Re-map the curve value from [vStart..vEnd] onto [y0..y1] so the slice hits both
    // endpoints exactly while keeping the full curve's local shape between them.
    const yNorm = (norm(t) - vStart) / vRange;
    const y = y0 + yNorm * (y1 - y0);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(' ');
}

function rcPolylineXAtY(x0, y0, x1, y1, targetY, isCharge, nSamples=200, nTau=3) {
  // Returns the x position on the RC curve where y = targetY
  // Uses linear interpolation between samples
  let prevX = x0, prevY = y0;
  for (let i = 1; i <= nSamples; i++) {
    const t = i / nSamples;
    const v = isCharge ? rcCharge(t, nTau) / rcCharge(1, nTau)
                       : (rcDischarge(t, nTau) - rcDischarge(1, nTau)) / (1 - rcDischarge(1, nTau));
    const x = x0 + t * (x1 - x0);
    const y = y0 + (1 - v) * (y1 - y0);
    if (y >= targetY) {
      // Interpolate between prevX/prevY and x/y
      const frac = (targetY - prevY) / (y - prevY);
      return prevX + frac * (x - prevX);
    }
    prevX = x; prevY = y;
  }
  return x1; // fallback
}
