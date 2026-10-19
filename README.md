# Shot Timer

A single-file web app shot timer for the Orbeez / gel-blaster rifle and pistol.
Press **Start**, wait through a random delay, a loud beep fires, and the microphone
picks up each shot. You get reaction time to the first shot, split times for
multi-shot strings, an optional par-time beep, and a history with stats.

Everything is in `index.html` — no build step, no dependencies, no server-side code.
History and settings live in the browser's localStorage.

## Run it

The mic API only works on `localhost` or HTTPS, so serve the folder instead of
double-clicking the file:

```bash
cd "/Users/saifalmosalam/app idea/shot-timer" && python3 -m http.server 8787
```

Then open <http://localhost:8787>. (Chrome and Safari both work.)

## On the phone (same Wi-Fi as the Mac)

Phones only allow the microphone on HTTPS, so use the bundled HTTPS server
instead of the Python one:

```bash
cd "/Users/saifalmosalam/app idea/shot-timer" && node serve.js
```

It prints an address like `https://192.168.100.207:8443`. Open that on the
phone. The first time, Safari warns that the certificate isn't trusted (it is
self-signed, created in `certs/` on the first run): tap **Show Details →
visit this website**, confirm, then allow the microphone. If macOS asks whether
`node` may accept incoming connections, click **Allow**. The Mac has to stay
awake while you use it.

If the Mac's IP changes (different Wi-Fi), delete `certs/` and start the server
again so the certificate covers the new address.

## As a real app on the phone (anywhere, laptop off)

The folder is a complete installable web app (manifest, icon, offline cache in
`sw.js`). It only needs to live on a free HTTPS host. This folder is already a
git repo with everything committed (`certs/` and logs are ignored).

**Option A — GitHub Pages** (best: updates are a `git push` away)
1. On github.com create a new **public** repository called `shot-timer`
   (Pages on a private repo needs a paid plan). Don't add a README.
2. In Terminal:
   ```bash
   cd "/Users/saifalmosalam/app idea/shot-timer" && git remote add origin https://github.com/<your-username>/shot-timer.git && git push -u origin main
   ```
   (Git asks for your GitHub username and a personal access token the first time.)
3. On the repo page: Settings → Pages → Build and deployment → Source "Deploy
   from a branch", branch `main`, folder `/ (root)` → Save. A minute later the
   app is at `https://<your-username>.github.io/shot-timer/`.

**Option B — Netlify Drop** (fastest, no git): sign in at
https://app.netlify.com/drop and drag this folder onto the page. You get a
`https://<something>.netlify.app` address immediately. Drag again to update.

**Then on the phone:** open the address in Safari, allow the mic, and use
Share → **Add to Home Screen**. It gets its own icon, runs full-screen and keeps
working without signal. If the microphone ever misbehaves in the home-screen
version (iOS has had bugs there), open the same address in Safari instead.

## First-time setup

1. Press **Start** once so the browser asks for microphone permission.
2. **Settings → Calibrate**: stand where you normally shoot, fire 3–5 shots
   during the 8 s countdown. The threshold is set ~7 dB below your quietest
   shot, and the "times above background" gate is learned from the same shots.
3. **Settings → Beep check** once per device/speaker setup: it measures the
   speaker→mic delay (subtracted from every time) and confirms the beep can't
   count as a shot.
4. Watch the meter at the bottom: the red tick is the threshold, the bar is the
   loudest level since the last update. Each shot should push it past the tick.

If shots are missed: lower the threshold. If it counts things that aren't shots
(motor whine, talking): raise it, or increase **Minimum split**.

## How timing works

- The beep is scheduled on the Web Audio clock, but the clock for your times
  starts when the **microphone hears the beep** — the detector spots its own
  beep arriving and timestamps it to the sample. That is the moment you hear
  it too, so no speaker or microphone delay (iPhones add a large one once the
  mic is open) can leak into a reaction time. Shots are timestamped the same
  way, in the same AudioWorklet, so JavaScript timer jitter never enters.
- The app cannot hear itself as a shot, three ways:
  1. the detector listens through a notch filter tuned to the beep's pitch
     (a shot is broadband, the beep is one tone), plus a high-pass that drops
     handling rumble;
  2. detection is blanked from the instant the beep is heard, for the beep's
     length plus a margin — anchored to the real arrival, not the schedule;
  3. after the blank, the detector keeps ignoring until the mic is actually
     quiet again (room ringing), for at most 400 ms. The background envelope is
     frozen the whole time so the beep can't raise it.
  **Settings → Beep check** plays the beep and tells you how loud it is versus
  your threshold, the measured delay, and when the mic goes quiet — i.e. the
  earliest shot that can be timed. Calibration never plays the beep.
- Nothing heard before the beep counts (charging the blaster, motor spin-up,
  bumps). If you want match-style strictness, Settings → **Flag false starts**
  makes a shot before the beep end the run as a false start instead.
- If the mic never hears the beep (headphones, muted speaker, silent switch),
  the run still goes live 0.8 s after the schedule and says so; those times
  are approximate. **Beep check** tells you how loud the beep is at the mic.
  **Timing offset** is only for a constant you've verified against a reference
  timer.
- If the mic track dies (iOS does this when the phone locks or the app goes to
  the background), the meter says so and the next **Start** re-asks for it.

## Tuning on a recording (no gun needed at the laptop)

Record a Voice Memo from where the device will sit: a few seconds of motor
only, ~10 pistol shots, ~10 rifle shots, one burst. Then
**Settings → Testing → Analyze a recording**: it runs the exact same filters and
detector over the file (nothing is uploaded), lists every impulse with its level
and how far it stood above the background, marks which ones would count with
your current settings, and suggests a threshold. Pass mark: 9/10 shots count,
nothing counts during motor-only, and the burst resolves into separate shots
(lower **Minimum split** to ~50 ms for bursts).

## Keys (laptop)

- `Space` — start / stop
- `Esc` — stop, or close a panel

## Testing without the gun

Settings → Testing → **Dry run** starts a run that needs no microphone; once it
is live, the same button fakes a shot. False starts, splits and history behave
exactly as with real shots.

## Drill settings worth knowing

- **Get-ready time**: with false starts on, a fixed pause before the random
  delay during which sounds are ignored.
- **Auto-repeat**: starts the next string by itself N seconds after one ends, so
  you can run 20 reps without touching the device (Esc / Stop cancels).
- **Minimum split**: ~80 ms for semi-auto, ~50 ms for a burst.
- **Beep length**: nothing can be timed while the beep plays, so keep it short;
  the Settings row shows the resulting floor.
- History exports and imports as JSON. Safari drops a site's data after 7 days
  without a visit, so export now and then if you use Safari.
