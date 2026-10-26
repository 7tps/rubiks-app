// Builds the cube state for a case and turns it into a random-looking scramble
// using the two-phase solver, so the scramble never just reveals the algorithm.
(function (root) {
  const Cube = root.Cube || require('./vendor/cube.js');
  if (!Cube.prototype.solve) require('./vendor/solve.js');
  const N = root.Notation || require('./notation.js');

  let solverReady = false;
  function initSolver() {
    if (!solverReady) {
      Cube.initSolver();
      solverReady = true;
    }
  }

  const randInt = (n) => Math.floor(Math.random() * n);

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function parity(perm) {
    let swaps = 0;
    const p = perm.slice();
    for (let i = 0; i < p.length; i++) {
      while (p[i] !== i) {
        const j = p[i];
        [p[i], p[j]] = [p[j], p[i]];
        swaps++;
      }
    }
    return swaps % 2;
  }

  // Random permutation of the last-layer pieces, orientation untouched.
  function randomizeLastLayerPermutation(cube) {
    let cp, ep;
    do {
      cp = shuffle([0, 1, 2, 3]);
      ep = shuffle([0, 1, 2, 3]);
    } while (parity(cp) !== parity(ep));
    for (let i = 0; i < 4; i++) {
      cube.cp[i] = cp[i];
      cube.ep[i] = ep[i];
    }
  }

  const U_TURNS = [[], [{ face: 'U', amount: 1 }], [{ face: 'U', amount: 2 }], [{ face: 'U', amount: 3 }]];

  // The state the solver will see: the solver does (preAuf) alg (postAuf) and
  // ends on `end` (solved, or an oriented last layer with random permutation).
  // options: { preAuf, postAuf, randomizeLL } (booleans)
  function buildCaseCube(alg, options) {
    const opts = options || {};
    const cube = new Cube();
    if (opts.randomizeLL) randomizeLastLayerPermutation(cube);
    const pre = opts.preAuf ? randInt(4) : 0;
    const post = opts.postAuf ? randInt(4) : 0;
    const algMoves = N.toFaceMoves(alg);
    const moves = N.simplify([].concat(N.invert(U_TURNS[post]), N.invert(algMoves), N.invert(U_TURNS[pre])));
    if (moves.length) cube.move(N.format(moves));
    return { cube, preAuf: pre, postAuf: post };
  }

  // A random prefix gives each state many different scrambles.
  function randomPrefix(length) {
    const out = [];
    while (out.length < length) {
      const face = N.FACES[randInt(6)];
      const prev = out[out.length - 1];
      const prev2 = out[out.length - 2];
      if (prev && prev.face === face) continue;
      if (prev && prev2 && N.OPPOSITE[prev.face] === face && prev2.face === face) continue;
      out.push({ face, amount: 1 + randInt(3) });
    }
    return out;
  }

  const MIN_LENGTH = 16;

  // Returns face moves that take a solved cube to `target`. Easy states get a
  // longer random prefix so the scramble doesn't just spell out the algorithm.
  function scrambleFor(target) {
    initSolver();
    let best = null;
    for (let prefixLength = 2; prefixLength <= 12; prefixLength += 2) {
      const prefix = randomPrefix(prefixLength);
      const work = new Cube();
      work.move(N.format(N.invert(prefix)));
      work.multiply(target);
      const solution = work.isSolved() ? [] : N.parseFaceString(work.solve());
      best = N.simplify(prefix.concat(N.invert(solution)));
      if (best.length >= MIN_LENGTH) break;
    }
    return best;
  }

  function stateAfter(moves) {
    const c = new Cube();
    if (moves.length) c.move(N.format(moves));
    return c;
  }

  const api = { initSolver, buildCaseCube, scrambleFor, stateAfter, shuffle, Cube };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scrambler = api;
})(this);
