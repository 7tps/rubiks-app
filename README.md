# Case Scrambler

Generates Rubik's cube scrambles that leave you on a specific case, so you can drill an algorithm.

## Run

Open `index.html` in a browser. No build step or install needed.
(Or serve the folder, e.g. `python -m http.server 5173`.)

## Using it

1. Click **Edit** next to *Scenario* (or press `S`) to set it up:
   - **Algorithm set:** PLL (21), OLL (57), or **Custom**. Under Custom you type in any algorithm and the scramble sets up the case it solves.
   - **Cases:** click the cases to include. Group chips filter the grid, and you can select all, none, or only the current group.
   - **What the scramble leaves you with:** a random angle (pre-AUF), a random final U turn (post-AUF), or, for OLL, a random PLL afterwards.
   - **Orientation:** the top and front colors you solve with, and whether you scramble from WCA orientation (white top, green front) or from your solving orientation.
   - **Practice:** random order, or each case once per round. You can also show or hide the case name.
2. Do the scramble, then solve the case. `Space` runs the timer (hold, release to start, press to stop).
   Each solve is recorded per case, so the slowest cases show up first.

Keys: `Enter`/`N` next scramble · `R` reveal case · `P` preview the scrambled cube · `S` scenario setup.

## How the scrambles work

The app builds the cube state for the case. For OLL with a random permutation, it first scrambles the
last-layer permutation. It then uses a two-phase (Kociemba) solver to find a fresh 16–25 move scramble
that reaches that state, so a scramble never just spells out the inverse of the algorithm.

- `js/notation.js`: parses notation (wide moves, slices, rotations) into face turns
- `js/algs.js`: PLL and OLL algorithm sets
- `js/scrambler.js`: builds case states and scrambles
- `js/render.js`: SVG diagrams and color orientation
- `js/app.js`: UI
- `js/vendor/`: [cubejs](https://github.com/ldez/cubejs) solver (MIT, see `cubejs-LICENSE`)
