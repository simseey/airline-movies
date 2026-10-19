# Flight Films

Inflight movie lists for Air New Zealand and British Airways, with a watch list and watched marks. Works offline once opened.

## Put it on GitHub Pages
1. Create a new public repository on github.com (e.g. `flight-films`).
2. Upload every file in this folder to the repository root (Add file > Upload files).
3. Settings > Pages > Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`. Save.
4. After a minute your site is at `https://<your-username>.github.io/flight-films/`.

## Add to your iPhone Home Screen
1. Open the site in Safari while online.
2. Open both airline pages once so they are saved for offline use.
3. Tap Share > Add to Home Screen.
4. Use the Home Screen icon from then on. Your watch list lives inside that icon's storage (it is separate from Safari's).

## Updating the movie lists
Edit `airnz.txt` or `ba.txt` (one film per line: `Title|Year|Rating|Genres|Description|Cast|IMDb|RT|N`, where `N` marks a new release), run `python3 convert.py ba.txt ba-data.js`, then bump `CACHE` in `sw.js` (e.g. `flight-films-v2`) and upload the changed files.
