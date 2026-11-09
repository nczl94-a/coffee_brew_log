# coffee_brew_log

A coffee brew log that installs on your phone like an app (PWA). No build step. Works offline on its own, and syncs between your phone and computer when you sign in.

## Features

- **Log brews** for Pour-over, AeroPress and ROK Presso GC Pro. Each logs dose, water/yield, auto ratio, temperature, grinder and setting, time, a 1–5 star rating and tasting notes, plus method-specific details (dripper, bloom, steep, orientation, pre-infusion, pressure, milk…).
- **Beans**: roaster, origin, process, roast level, roast date (shows days off roast), brew count and average rating.
- **Favourites**: star any brew or bean; there's a dedicated Favourites tab.
- **Brew again / Copy last brew**: reuse the parameters of any brew you've logged.
- **Pour-over recipe generator**: Hoffmann Ultimate V60, Hoffmann 1-Cup V60, Kasuya 4:6 (with taste and strength options), Rao Spin, Kalita Wave pulse, Chemex and a two-pour flat bed. Each one scales to your dose and ratio and adjusts temperature for the roast. **Surprise me** picks one at random.
- **AeroPress dice**: six dice (temperature, ratio, grind & steep, bloom, agitation, setup) inspired by James Hoffmann's AeroPress dice. Lock any dice you like and re-roll the rest. Hoffmann's Ultimate AeroPress and an Adler-style recipe are also included.
- **Brew timer**: steps through any recipe with a beep and vibration at each step and keeps the screen awake. When you finish, it logs the brew with the elapsed time.
- **Grinder details**: grinder (DF64V Gen3 or 1Zpresso Q), numeric grind setting and grind speed (RPM).
- **Analytics**: chart of grind setting over time, filterable by brew method and grinder, with hover details and a data table.
- **Sync across devices**: sign in (Google, or email and password) on each device to share one log via Firebase. Works offline and uploads changes when you reconnect.
- **Export / Import** as JSON, for backups.

## Install on your phone

The app must be served over **https** to be installable. GitHub Pages does this for free:

1. Push this repo to GitHub, then go to **Settings → Pages → Build and deployment**, set Source to *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. Open `https://<your-username>.github.io/coffee_brew_log/` on your phone.
3. **iPhone (Safari):** Share → *Add to Home Screen*. **Android (Chrome):** ⋮ menu → *Install app*.

It then opens full-screen from its icon and works offline.

## Run locally

Serve the folder (`npx serve .`) and open `http://localhost:3000`. Sign-in needs http(s), so double-clicking `index.html` only works signed out.

## Notes

- Signed out, data lives only in that browser (`localStorage`). Signed in, it's stored in Firestore under `users/{uid}/` and mirrored locally; the first sign-in on a device uploads what was already there. Signing out clears the device's copy, not the account's.
- Firebase setup: the web config is in `js/firebase-config.js`; Firestore rules must restrict `users/{uid}/**` to that user, and your Pages domain must be in Authentication → Authorized domains.
- The Firebase SDK (compat build) is vendored in `js/vendor/` so the app loads offline.
- Export now and then as a backup.
- On iPhone, the home-screen app has its own storage, separate from Safari.
- After changing app files, bump `CACHE` in `sw.js` so installed copies pick up the update.
