# Zoom Fit under-zoom — parked regression

**Status:** parked (not yet fixed as of v0.9.222)

## Symptom
After the meter overhaul, **Zoom Fit under-zooms** in some states — e.g. it computes ~2.7–2.8 when the visually-correct fit is ~3.7. The envelope is framed smaller than it should be, leaving a large blank gap between the release end and the meter.

## How Zoom Fit works
`computeFitZoom()` (js/ui-controls.js) and the cue `zoom-fit` handler (js/cue-list.js) both use the **same single-ended formula**:

```
z = state.zoomFactor * (graph.w * margin) / (rx - graph.x0)
```

- **Left bound is fixed at `graph.x0`** — there is no leftmost detection.
- `rx = state._fitRightmostX`, finalized in js/paths.js (~line 176–534) as a `Math.max` chain over envelope candidates:
  `pts.p0.x`, `gateCloseX`, `tbRelEndX`, `tbSusEndX`, `tbDecayEndX`, `effReleaseEndX`, `orangeDischargeEndX`, `gateRelEndX`, `drawPS.x`.
- The meter markers/labels are **not** in this chain, so the meter overhaul did not directly change the fit.

## What we know
- All extents scale with zoom via `timeToPixels ∝ zoom`, **except** the textbook sustain-gap spacer `graph.w * state.tbSustainGap`, which is **zoom-independent** and is baked into `releaseStartX` → `tbRelEndX` / `effReleaseEndX`.
- The prominent Model D release curve ends near `pEnd.x` (a short RC tail); the fit's `rx` is dominated by the gap-shifted / textbook release ends, which extend well past the visible curve — inflating `rx` and under-zooming.
- **v0.9.222 fixed a related bug** (the "Textbook sustain gap max" control set `SUSTAIN_GAP_MAX` but never wrote `state.tbSustainGap`, which the drawing *and* fit read), so the drawn gap now follows the control live. This tightens the drawn gap but does **not** fully resolve the fit under-zoom, which is why it stays parked.

## Ruled out (do not re-investigate)
- No leftmost / min-x term feeds the fit (verified exhaustively); the left is provably `graph.x0`.
- No `TB_SUSTAIN_GAP_MAX`, no `Math.min` gap cap, no `state.tbSustainGapMax` property — these do not exist. The gap is a single multiply `graph.w * state.tbSustainGap`.

## To diagnose / fix
Re-add a temporary log just before `state._fitRightmostX = rightmostX;` (inside the Model D block, where the release candidates are in scope) printing every candidate + `rightmostX`; hit Fit and read the last pre-Fit line. Whichever candidate `=== rightmostX` is the culprit. Likely `tbRelEndX` (textbook release: gap + full release-time width) or the gap-shifted `effReleaseEndX`. The fix is a design decision: whether the fit should frame to the *visible Model D curve end* rather than the gap-shifted / textbook release end.
