# Cue Shot — Language Reference

*A scripting language for the ADSR Visualiser. Cue Shot scripts drive the tool's controls and animation playback so sequences can be authored, stepped through, and played back for video production.*

*Reference version: reflects the build as of v0.9.172. This document covers the language, grammar, and command set only — architecture is documented separately. (The command set is unchanged since v0.9.169; v170–172 were UI/editing improvements — button placement and Edit-dialog line numbering — not language changes.)*

---

## 1. Overview

A Cue Shot script is a plain-text list of commands, one per line, executed top to bottom. Commands either:

- **set** a control to a value or state (immediate),
- **transition** a knob smoothly to a new value over a duration,
- **play** an animation excursion (tap, hold, release),
- **wait** for a duration (timed playback only).

Scripts can be **played** (timed, honouring `wait`s) or **stepped** (manual, one step at a time, ignoring `wait`s). The **Copy State** button emits the tool's current state as a script line you can paste into a script.

---

## 2. Syntax

| Element | Rule |
|---|---|
| **Comment** | A line beginning with `#` is ignored. |
| **Blank line** | Ignored. |
| **One command per line** | Each line is normally one command. |
| **Semicolons** | Multiple commands on one line, separated by `;`, execute as a **single step** when stepping (and fire simultaneously in timed playback). |
| **Timecode** | `HH:MM:SS:FF` at 24 fps (`FF` = 0–23). Example: `00:00:02:12` = 2 s + 12 frames = 2500 ms. |

**Stepping vs playback.** When stepping, `wait` commands are skipped and each line (including a semicolon-grouped line) is one step. In timed playback, `wait`s are honoured and commands with no `wait` between them fire together.

**Copy State** emits the full current state as one semicolon-joined line — i.e. a single step that restores the whole setup. Useful as a script's opening "initial state" line.

---

## 3. Commands

### 3.1 `wait`

```
wait HH:MM:SS:FF
```

Pauses timed playback for the given duration. Skipped when stepping.

---

### 3.2 `set` — knob values

Immediate; operates the control's real commit path.

| Command | Range / units | Control |
|---|---|---|
| `set attack NNNms` | 0–12000 ms | Attack time |
| `set decay NNNms` | 0–12000 ms | Decay time |
| `set release NNNms` | 0–12000 ms | Release time |
| `set sustain N` | 0–10 (0.1 steps) | Sustain level |
| `set cutoff N` | 0–10 | Cutoff / floor |
| `set amount N` | 0–10 | Amount / scale |
| `set gate NNNms` | 20–5000 ms | Gate time |
| `set persist-time NNNms` | 0–10000 ms | Persist dwell time |

---

### 3.3 `set` — toggles

Boolean; `on` or `off`.

| Command | Control |
|---|---|
| `set loud-decay on\|off` | Loud Decay |
| `set filter-decay on\|off` | *Alias for Loud Decay* |
| `set filter-mode on\|off` | Filter Mode |
| `set hp-mode on\|off` | LP/HP Mode |
| `set mimic-sustain on\|off` | Mimic Model D Sustain |
| `set analogue on\|off` | Analogue curve |
| `set show-clipped on\|off` | Show Clipped Shape |
| `set show-contour on\|off` | Show Contour |
| `set show-gate-time on\|off` | Show Gate Time |
| `set clip-at-gate on\|off` | Clip at Gate |
| `set show-peak-discharge on\|off` | Show Peak Discharge |
| `set link-r-to-d on\|off` | Link Textbook R to D |
| `set show-effective-lines on\|off` | Show Effective Drop Lines |
| `set show-stated-lines on\|off` | Show Stated Drop Lines |
| `set slomo on\|off` | Slo-mo |
| `set persist on\|off` | Persist Blobs After Release |

---

### 3.4 `set` — zoom

Zoom is a single numeric **zoom factor** (a multiplier on the baseline timeline length; the baseline at factor 1 is 8 s, so the visible window = 8 / factor seconds). Fractional values and values below 1 (zoom out) are allowed.

| Command | Range | Effect |
|---|---|---|
| `set zoom N` | 0.1–48 | Set the zoom factor (e.g. `set zoom 3` ≈ 2.7 s window; `set zoom 0.5` = 16 s). Eases via the transition path. |
| `zoom-fit` | — | Compute the zoom that frames all currently-visible curves (to the configured Fit margin) and apply it instantly. Reads whatever is visible at the moment it fires. |

`set zoom N` can also be animated — see `transition zoom` and `transition zoom-fit` in §3.7.

---

### 3.5 `set` — subtitle

| Command | Effect |
|---|---|
| `set subtitle "text"` | Show `text` in the subtitle box (a full-width debug readout above the console). Persists until replaced. |
| `set subtitle ""` | Clear the subtitle (the box then reads `EMPTY`). |

The text is the quoted string; everything between the first `"` and the next `"` is the subtitle (spaces preserved). Subtitles should not contain `;` (the line splitter splits on `;` first).

---

### 3.6 `set` — leg visibility

Per-leg visibility for each layer. `textbook` = underlay layer; `actual` = Model D layer.

| Command | Effect |
|---|---|
| `set textbook attack\|decay\|sustain\|release on\|off` | Show/hide a textbook (underlay) leg |
| `set textbook show-all` | Show all textbook legs |
| `set textbook hide-all` | Hide all textbook legs |
| `set actual attack\|decay\|sustain\|release on\|off` | Show/hide a Model D leg |
| `set actual show-all` | Show all Model D legs |
| `set actual hide-all` | Hide all Model D legs |

---

### 3.7 `transition` — animated knob change

```
transition <param> <value> HH:MM:SS:FF
```

Animates a knob from its current value to `<value>` over the timecode duration.

| Parameter | Value | 
|---|---|
| `transition attack NNNms HH:MM:SS:FF` | 0–12000 ms |
| `transition decay NNNms HH:MM:SS:FF` | 0–12000 ms |
| `transition release NNNms HH:MM:SS:FF` | 0–12000 ms |
| `transition gate NNNms HH:MM:SS:FF` | 20–5000 ms |
| `transition sustain N HH:MM:SS:FF` | 0–10 |
| `transition cutoff N HH:MM:SS:FF` | 0–10 |
| `transition amount N HH:MM:SS:FF` | 0–10 |
| `transition zoom N HH:MM:SS:FF` | 0.1–48 |
| `transition zoom-fit HH:MM:SS:FF` | — (animates to the computed Fit zoom over the duration) |

`attack`/`decay`/`release`/`gate` take `NNNms`; `sustain`/`cutoff`/`amount`/`zoom` take a bare number. `transition zoom-fit` takes no value — it computes the Fit zoom (from the visible curves at the moment it fires) and eases to it. The final timecode is the **duration of the animation**.

---

### 3.8 `play` — trigger excursions

| Command | Effect |
|---|---|
| `play-tap NNNms` | Tap with the given gate time (ms). |
| `play-tap NNNms <note>` | Tap with a note (sets note mode, then taps). |
| `play-hold` | Hold (sustain indefinitely). |
| `play-hold <note>` | Hold with a note. |
| `play-release` | Release from the current hold/sustain. |
| `play-clear` | Clear the current excursion (stop and reset to idle — e.g. end a hold resting at sustain). |

**Notes.** The parser accepts any `letter+digit` note (e.g. `E1`, `C4`), but only four have registered frequencies:

| Note | Frequency |
|---|---|
| `E1` | 41.2 Hz |
| `E2` | 82.4 Hz |
| `C4` | 261.6 Hz |
| `A4` | 440 Hz |

---

## 4. Copy State output

The **Copy State** button emits the current static state as a single semicolon-joined line (one step). It captures every settable parameter:

```
set attack NNNms; set decay NNNms; set sustain N; set release NNNms;
set cutoff N; set amount N; set gate NNNms;
set loud-decay on|off; set filter-mode on|off; set hp-mode on|off;
set mimic-sustain on|off; set analogue on|off;
set show-clipped on|off; set show-contour on|off; set show-gate-time on|off;
set clip-at-gate on|off; set show-peak-discharge on|off; set link-r-to-d on|off;
set show-effective-lines on|off; set show-stated-lines on|off;
set slomo on|off; set persist on|off; set persist-time NNNms;
set zoom N;
set textbook attack on|off; set textbook decay on|off;
set textbook sustain on|off; set textbook release on|off;
set actual attack on|off; set actual decay on|off;
set actual sustain on|off; set actual release on|off;
set subtitle "..."
```

**Copy State does not emit:** `wait`, `transition`, `play-*` (including `play-clear`), `zoom-fit`, `filter-decay` (the alias), or the `show-all` / `hide-all` bulk actions — it captures static state only, not timing, animation, or actions. (`set zoom N` carries the current zoom; `set subtitle "..."` carries the current subtitle, or `""` if empty.)

---

## 5. Recording (record-by-doing)

Cue Shot scripts can be **recorded by operating the tool** rather than hand-authored. As you turn knobs, click quick-sets, flip toggles, zoom, change leg visibility, or play taps/holds/releases, each action is captured as a Cue Shot command with a timestamp. The recorder uses the same command formatting as Copy State, so recorded commands match the language exactly.

Buttons (in the console):
- **Cue Log** — view the recorded script (commands with `wait`s computed from the gaps between actions; the first line is a full-state snapshot).
- **Clear Cues** — clear the recording and re-seed it with the current state snapshot as the new baseline.
- **Load Cue Log** — load the recorded script straight into the cue script for playback (warns before replacing a non-empty script).

The cue log auto-seeds the current state on page load, so a recording always begins with an accurate initial-state line. Each command after the snapshot is preceded by its real recorded wait (floored to one frame), so playback reproduces the performance's timing.

The **Edit** dialog shows a line-number gutter (numbering by logical lines — a long semicolon-joined line such as the initial-state snapshot soft-wraps but counts as one numbered line), and when opened while stepped to a position, it scrolls to and selects the current line — useful for locating your place in a long script. The console script view also shows line numbers.

How actions are recorded:
- **Knob drag** → `set <param> <final value>` (instant; the value follows your hand, so it records as a set).
- **Quick-set button** → `transition <param> <value> <duration>` using the current transition time — or a plain `set` if the transition time is instant. This matches what plays on screen (an eased move records as a transition).
- **Toggles, zoom, leg visibility** → their `set` command. (Zoom records the destination value.)
- **Fit** → records the resulting `set zoom N` (the concrete fitted value).
- **Taps / holds / releases / clears** → `play-tap`/`play-hold`/`play-release`/`play-clear`, with the active note appended where relevant.

---

## 6. Example

```
# --- Initial state (one step) ---
set attack 200ms; set decay 500ms; set sustain 7; set release 800ms; set cutoff 2; set amount 6; set filter-mode on; set show-contour on

# --- Sequence ---
play-tap 400ms                          # tap
wait 00:00:02:00                        # hold 2 s
transition cutoff 8 00:00:03:00         # sweep cutoff open over 3 s
wait 00:00:03:00
play-hold A4                            # hold a note
wait 00:00:01:12
play-release                            # release
```

---

## 7. Quick reference

```
wait HH:MM:SS:FF

set attack|decay|release NNNms        (0–12000)
set gate NNNms                        (20–5000)
set persist-time NNNms                (0–10000)
set sustain|cutoff|amount N           (0–10)
set zoom N                            (0.1–48, factor; window = 8/N s)
set subtitle "text"                   ("" clears → EMPTY)

set <toggle> on|off
  toggles: loud-decay filter-decay filter-mode hp-mode mimic-sustain
           analogue show-clipped show-contour show-gate-time
           clip-at-gate show-peak-discharge link-r-to-d
           show-effective-lines show-stated-lines slomo persist

set textbook|actual attack|decay|sustain|release on|off
set textbook|actual show-all|hide-all

transition attack|decay|release|gate NNNms HH:MM:SS:FF
transition sustain|cutoff|amount|zoom N HH:MM:SS:FF

zoom-fit                              (instant fit to visible curves)
transition zoom-fit HH:MM:SS:FF       (animated fit)

play-tap NNNms [note]
play-hold [note]
play-release
play-clear

# comment      ;  = multi-command / single step      Copy State = full state, one line
```
