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
