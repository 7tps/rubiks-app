// SVG drawings of cube states and color/orientation helpers.
(function (root) {
  const STICKER = {
    white: '#ffffff',
    yellow: '#ffd500',
    green: '#00a651',
    blue: '#0051ba',
    red: '#c41e3a',
    orange: '#ff6a00',
  };

  const COLOR_VEC = {
    white: [0, 1, 0],
    yellow: [0, -1, 0],
    green: [0, 0, 1],
    blue: [0, 0, -1],
    red: [1, 0, 0],
    orange: [-1, 0, 0],
  };
  const COLORS = Object.keys(COLOR_VEC);

  const colorAt = (v) => COLORS.find((c) => COLOR_VEC[c].every((x, i) => x === v[i]));
  const neg = (v) => v.map((x) => -x);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  function validFront(top, front) {
    const dot = COLOR_VEC[top].reduce((s, x, i) => s + x * COLOR_VEC[front][i], 0);
    return dot === 0;
  }

  // Colors of each face position for a cube held with `top` up and `front` facing you.
  function frameColors(top, front) {
    const u = COLOR_VEC[top];
    const f = COLOR_VEC[front];
    const r = cross(u, f);
    return { U: top, F: front, R: colorAt(r), D: colorAt(neg(u)), B: colorAt(neg(f)), L: colorAt(neg(r)) };
  }

  // Rewrites solving-frame face moves for a cube held in another frame.
  function translateMoves(moves, fromColors, toColors) {
    const faceOfColor = {};
    for (const face in toColors) faceOfColor[toColors[face]] = face;
    return moves.map((m) => ({ face: faceOfColor[fromColors[m.face]], amount: m.amount }));
  }

  // Facelet string: U1-9 R1-9 F1-9 D1-9 L1-9 B1-9 (Kociemba order).
  const facelet = (s, face, i) => s['URFDLB'.indexOf(face) * 9 + i - 1];

  function topGrid(s) {
    const U = (i) => facelet(s, 'U', i);
    const R = (i) => facelet(s, 'R', i);
    const F = (i) => facelet(s, 'F', i);
    const L = (i) => facelet(s, 'L', i);
    const B = (i) => facelet(s, 'B', i);
    return [
      [null, B(3), B(2), B(1), null],
      [L(1), U(1), U(2), U(3), R(3)],
      [L(2), U(4), U(5), U(6), R(2)],
      [L(3), U(7), U(8), U(9), R(1)],
      [null, F(1), F(2), F(3), null],
    ];
  }

  // Top-down view of the last layer with the side stickers around it.
  // mode 'orientation' greys out every sticker that isn't the top color.
  function topView(s, colors, mode) {
    const grid = topGrid(s);
    const cell = 20;
    const side = 7;
    const gap = 2;
    const pos = [0, side + gap, side + gap + cell + gap, side + gap + 2 * (cell + gap), side + gap + 3 * (cell + gap)];
    const size = [side, cell, cell, cell, side];
    const total = pos[4] + side;
    const fill = (letter) => {
      if (mode === 'orientation') return letter === 'U' ? STICKER[colors.U] : 'var(--sticker-off)';
      return STICKER[colors[letter]];
    };
    let rects = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const letter = grid[r][c];
        if (!letter) continue;
        rects += `<rect x="${pos[c]}" y="${pos[r]}" width="${size[c]}" height="${size[r]}" rx="2.5" fill="${fill(letter)}"/>`;
      }
    }
    return `<svg class="cube-svg" viewBox="-1 -1 ${total + 2} ${total + 2}" role="img" aria-hidden="true">${rects}</svg>`;
  }

  // Unfolded cube: U on top, L F R B across, D below.
  function net(s, colors) {
    const layout = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };
    const cell = 12;
    const gap = 1.5;
    const faceGap = 4;
    let rects = '';
    for (const face of 'URFDLB') {
      const [fx, fy] = layout[face];
      const ox = (fx / 3) * (3 * cell + 2 * gap + faceGap);
      const oy = (fy / 3) * (3 * cell + 2 * gap + faceGap);
      for (let i = 0; i < 9; i++) {
        const x = ox + (i % 3) * (cell + gap);
        const y = oy + Math.floor(i / 3) * (cell + gap);
        rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${STICKER[colors[facelet(s, face, i + 1)]]}"/>`;
      }
    }
    const faceSize = 3 * cell + 2 * gap + faceGap;
    return `<svg class="cube-svg" viewBox="-1 -1 ${4 * faceSize - faceGap + 2} ${3 * faceSize - faceGap + 2}" role="img" aria-hidden="true">${rects}</svg>`;
  }

  root.Render = { STICKER, COLORS, frameColors, validFront, translateMoves, topView, net };
})(this);
