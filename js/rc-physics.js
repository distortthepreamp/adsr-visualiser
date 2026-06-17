// ---- rc-physics.js — pure RC physics functions, no SVG knowledge ----

// RC discharge: returns normalised voltage (1→0) at normalised time t (0→1)
// nTau = how many time constants the segment spans (default 3)
// At t=1: V = e^(-nTau) ≈ 0.05 for nTau=3 (95% complete)
function rcDischarge(t, nTau = 3) {
  return Math.exp(-nTau * t);
}

// RC charge: returns normalised voltage (0→1) at normalised time t (0→1)
function rcCharge(t, nTau = 3) {
  return 1 - Math.exp(-nTau * t);
}

// Normalised so that t=1 maps to exactly the endpoint (scale to fit)
// rcDischarge(0) = 1, rcDischarge(1) = e^(-nTau)
// rcCharge(0) = 0, rcCharge(1) = 1 - e^(-nTau)
