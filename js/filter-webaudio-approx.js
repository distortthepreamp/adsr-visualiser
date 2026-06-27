// ---- filter-webaudio-approx.js — approximate filter cutoff transfer function, no DOM ----
// Approximate filter cutoff transfer function for the Web Audio filter sweep ONLY.
// NOT the authoritative filter calibration — an audio-path approximation.
// Maps filter envelope position p (0..1) to cutoff frequency (Hz).
// Calibrated to the measured Model D: p=0 -> 0 Hz, p=0.5 -> 1000 Hz, p=1 -> 32000 Hz.
// Exponential (volt/octave-like): y = (1000/30) * (31^(2p) - 1).
function filterCutoffHz(p){
  return (1000/30) * (Math.pow(31, 2*p) - 1);
}
