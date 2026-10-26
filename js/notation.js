// Converts cube notation (face turns, wide turns, slices, rotations) into plain
// face turns relative to fixed centers, which is what the solver understands.
(function (root) {
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

  // How each rotation moves faces around: after the rotation, the face that
  // was at position `from` now sits at position `to`.
  const ROTATION_CYCLES = {
    x: [['F', 'U'], ['U', 'B'], ['B', 'D'], ['D', 'F']],
    y: [['F', 'L'], ['L', 'B'], ['B', 'R'], ['R', 'F']],
    z: [['U', 'R'], ['R', 'D'], ['D', 'L'], ['L', 'U']],
  };

  // Wide turns and slices expressed as (outer face turn, rotation).
  const COMPOSITE = {
    r: [['L', 1], ['x', 1]],
    l: [['R', 1], ['x', 3]],
    u: [['D', 1], ['y', 1]],
    d: [['U', 1], ['y', 3]],
    f: [['B', 1], ['z', 1]],
    b: [['F', 1], ['z', 3]],
    M: [['R', 1], ['L', 3], ['x', 3]],
    E: [['U', 1], ['D', 3], ['y', 3]],
    S: [['F', 3], ['B', 1], ['z', 1]],
  };

  const TOKEN = /^([URFDLBurfdlbMESxyz])(w?)(\d*)('?)(\d*)$/;

  function parseAmount(digits, prime, trailing) {
    let n = 1;
    const d = digits || trailing;
    if (d) n = parseInt(d, 10);
    if (prime) n = -n;
    return ((n % 4) + 4) % 4;
  }

  function tokenize(alg) {
    return alg
      .replace(/[()[\]{},]/g, ' ')
      .replace(/[’`´]/g, "'")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  // Returns an array of {face, amount} (amount 1..3) in the fixed frame.
  function toFaceMoves(alg) {
    let map = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };
    const out = [];

    const rotate = (axis, amount) => {
      for (let i = 0; i < amount; i++) {
        const next = Object.assign({}, map);
        for (const [from, to] of ROTATION_CYCLES[axis]) next[to] = map[from];
        map = next;
      }
    };
    const turn = (face, amount) => {
      if (amount % 4) out.push({ face: map[face], amount: amount % 4 });
    };

    for (const tok of tokenize(alg)) {
      const m = TOKEN.exec(tok);
      if (!m) throw new Error('Unknown move "' + tok + '"');
      let letter = m[1];
      const amount = parseAmount(m[3], m[4] === "'", m[5]);
      if (m[2] === 'w') {
        if (!FACES.includes(letter)) throw new Error('Unknown move "' + tok + '"');
        letter = letter.toLowerCase();
      }
      if (amount === 0) continue;

      if (FACES.includes(letter)) {
        turn(letter, amount);
      } else if (ROTATION_CYCLES[letter]) {
        rotate(letter, amount);
      } else {
        for (const [part, mult] of COMPOSITE[letter]) {
          const a = (mult * amount) % 4;
          if (ROTATION_CYCLES[part]) rotate(part, a);
          else turn(part, a);
        }
      }
    }
    return simplify(out);
  }

  // Merge consecutive turns of the same face, and of opposite faces that commute.
  const OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  function simplify(moves) {
    const out = [];
    for (const mv of moves) {
      let merged = false;
      for (let i = out.length - 1; i >= 0 && i >= out.length - 2; i--) {
        const prev = out[i];
        if (prev.face === mv.face) {
          prev.amount = (prev.amount + mv.amount) % 4;
          if (prev.amount === 0) out.splice(i, 1);
          merged = true;
          break;
        }
        if (OPPOSITE[prev.face] !== mv.face) break;
      }
      if (!merged) out.push({ face: mv.face, amount: mv.amount });
    }
    return out;
  }

  function invert(moves) {
    return moves
      .slice()
      .reverse()
      .map((m) => ({ face: m.face, amount: (4 - m.amount) % 4 }));
  }

  function format(moves) {
    return moves.map((m) => m.face + ['', '', '2', "'"][m.amount]).join(' ');
  }

  function parseFaceString(str) {
    return toFaceMoves(str || '');
  }

  const api = { toFaceMoves, simplify, invert, format, parseFaceString, FACES, OPPOSITE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Notation = api;
})(this);
