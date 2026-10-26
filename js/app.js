(function () {
  const N = window.Notation;
  const S = window.Scrambler;
  const R = window.Render;
  const $ = (id) => document.getElementById(id);

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable; settings just won't persist */
      }
    },
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- settings ----------

  const OPTION_DEFS = {
    preAuf: {
      label: 'Random angle',
      help: 'The case shows up rotated, so you may need a U turn before the algorithm.',
    },
    randomizeLL: {
      label: 'Random permutation afterwards',
      help: 'After the algorithm the top is oriented but the pieces are in a random PLL, like a real solve.',
    },
    postAuf: {
      label: 'Random final U turn',
      help: 'After the algorithm the top layer may still need a U turn to finish.',
    },
  };
  const SET_OPTIONS = {
    pll: ['preAuf', 'postAuf'],
    oll: ['preAuf', 'randomizeLL', 'postAuf'],
    custom: ['preAuf', 'postAuf', 'randomizeLL'],
  };
  const SET_LABELS = { pll: 'PLL', oll: 'OLL', custom: 'Custom' };

  const DEFAULTS = {
    set: 'pll',
    excluded: { pll: [], oll: [], custom: [] },
    options: {
      pll: { preAuf: true, postAuf: true, randomizeLL: false },
      oll: { preAuf: true, postAuf: false, randomizeLL: true },
      custom: { preAuf: true, postAuf: false, randomizeLL: false },
    },
    topColor: 'yellow',
    frontColor: 'green',
    scrambleFrame: 'wca',
    order: 'random',
    revealMode: 'hidden',
    preview: false,
  };

  function loadSettings() {
    const saved = store.get('caseScrambler.settings', {});
    const s = Object.assign({}, DEFAULTS, saved);
    s.excluded = Object.assign({}, DEFAULTS.excluded, saved.excluded);
    s.options = {};
    for (const k of Object.keys(DEFAULTS.options)) {
      s.options[k] = Object.assign({}, DEFAULTS.options[k], (saved.options || {})[k]);
    }
    if (!SET_LABELS[s.set]) s.set = 'pll';
    if (!R.validFront(s.topColor, s.frontColor)) {
      s.topColor = DEFAULTS.topColor;
      s.frontColor = DEFAULTS.frontColor;
    }
    return s;
  }

  const settings = loadSettings();
  let customCases = store.get('caseScrambler.custom', []);
  let times = store.get('caseScrambler.times', []);

  const saveSettings = () => store.set('caseScrambler.settings', settings);
  const saveCustom = () => store.set('caseScrambler.custom', customCases);
  const saveTimes = () => store.set('caseScrambler.times', times);

  // ---------- cases ----------

  function getSet(key) {
    if (key === 'custom') {
      return {
        label: 'Custom',
        kind: 'full',
        cases: customCases.map((c) => Object.assign({ group: 'Custom' }, c)),
      };
    }
    const set = window.AlgSets.SETS[key];
    return { label: set.label, kind: set.kind === 'oll' ? 'orientation' : 'full', cases: set.cases };
  }

  function selectedCases(key) {
    const k = key || settings.set;
    const excluded = new Set(settings.excluded[k]);
    return getSet(k).cases.filter((c) => !excluded.has(c.id));
  }

  const caseStateCache = new Map();
  function caseState(alg) {
    if (!caseStateCache.has(alg)) caseStateCache.set(alg, S.buildCaseCube(alg, {}).cube.asString());
    return caseStateCache.get(alg);
  }

  const solvingColors = () => R.frameColors(settings.topColor, settings.frontColor);
  const scrambleColors = () =>
    settings.scrambleFrame === 'wca' ? R.frameColors('white', 'green') : solvingColors();

  function caseDiagram(c, setKey) {
    return R.topView(caseState(c.alg), solvingColors(), getSet(setKey || settings.set).kind);
  }

  // ---------- scramble generation ----------

  let version = 0;
  let deck = [];
  let lastCaseId = null;
  let current = null;
  let prefetched = null;
  let prefetchTimer = null;

  function pickCase() {
    const pool = selectedCases();
    if (!pool.length) return null;
    if (settings.order === 'deck') {
      if (!deck.length) {
        deck = S.shuffle(pool.map((c) => c.id));
        if (deck.length > 1 && deck[0] === lastCaseId) deck.push(deck.shift());
      }
      const id = deck.shift();
      lastCaseId = id;
      return pool.find((c) => c.id === id) || pool[0];
    }
    const c = pool[Math.floor(Math.random() * pool.length)];
    lastCaseId = c.id;
    return c;
  }

  function generate() {
    const c = pickCase();
    if (!c) return null;
    const opts = settings.options[settings.set];
    const built = S.buildCaseCube(c.alg, {
      preAuf: opts.preAuf,
      postAuf: opts.postAuf && !opts.randomizeLL,
      randomizeLL: opts.randomizeLL,
    });
    return {
      version,
      setKey: settings.set,
      caseRef: c,
      state: built.cube.asString(),
      preAuf: built.preAuf,
      postAuf: built.postAuf,
      moves: S.scrambleFor(built.cube),
      revealed: settings.revealMode === 'shown',
    };
  }

  function nextScramble() {
    clearTimeout(prefetchTimer);
    current = prefetched && prefetched.version === version ? prefetched : generate();
    prefetched = null;
    renderScramble();
    renderCase();
    if (current) {
      prefetchTimer = setTimeout(() => {
        prefetched = generate();
      }, 60);
    }
  }

  function settingsChanged() {
    version++;
    deck = [];
    prefetched = null;
    saveSettings();
    renderSummary();
  }

  // ---------- main view ----------

  const AUF_TEXT = ['', 'U', 'U2', "U'"];

  function renderSummary() {
    const total = getSet(settings.set).cases.length;
    const chosen = selectedCases().length;
    $('scenarioSummary').textContent = `${SET_LABELS[settings.set]} · ${chosen} of ${total} case${total === 1 ? '' : 's'}`;
  }

  function renderScramble() {
    const solving = solvingColors();
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    $('orientationHint').innerHTML =
      settings.scrambleFrame === 'wca' &&
      !(settings.topColor === 'white' && settings.frontColor === 'green')
        ? `Scramble with <b>white</b> on top and <b>green</b> in front, then turn the cube so <b>${cap(solving.U)}</b> is on top and <b>${cap(solving.F)}</b> is in front.`
        : `Hold <b>${cap(solving.U)}</b> on top and <b>${cap(solving.F)}</b> in front while scrambling and solving.`;

    const el = $('scrambleText');
    if (!current) {
      el.innerHTML = '<span class="empty">No cases selected. Open the scenario setup to pick some.</span>';
      $('scrambleMeta').textContent = '';
      $('preview').hidden = true;
      return;
    }
    const moves = R.translateMoves(current.moves, solving, scrambleColors());
    el.innerHTML = N.format(moves)
      .split(' ')
      .map((m) => `<span class="mv">${escapeHtml(m)}</span>`)
      .join(' ');
    $('scrambleMeta').textContent = `${moves.length} moves`;
    renderPreview();
  }

  function renderPreview() {
    const on = settings.preview && current;
    $('previewBtn').setAttribute('aria-pressed', String(!!settings.preview));
    $('preview').hidden = !on;
    if (!on) return;
    $('previewNet').innerHTML = R.net(current.state, solvingColors());
    $('previewCaption').textContent = 'How the cube should look after scrambling, held in your solving orientation.';
  }

  function solutionHtml(item) {
    const parts = [];
    if (item.preAuf) parts.push(`<span class="auf">${AUF_TEXT[item.preAuf]}</span>`);
    parts.push(`<span>${escapeHtml(item.caseRef.alg)}</span>`);
    if (item.postAuf) parts.push(`<span class="auf">${AUF_TEXT[item.postAuf]}</span>`);
    return parts.join('<span class="sep">·</span>');
  }

  // Shows either the current case (once revealed) or the case from the last timed solve.
  let lastSolve = null;
  function renderCase() {
    const body = $('caseBody');
    let item = null;
    let timeMs = null;
    if (current && current.revealed) {
      item = current;
      $('caseHeading').textContent = 'Current case';
    } else if (lastSolve) {
      item = lastSolve.item;
      timeMs = lastSolve.ms;
      $('caseHeading').textContent = 'Last solve';
    } else {
      $('caseHeading').textContent = 'Current case';
    }
    $('revealBtn').disabled = !current || current.revealed;
    if (!item) {
      body.innerHTML = current
        ? '<p class="muted">Hidden until you reveal it or finish the solve.</p>'
        : '<p class="muted">Nothing to show yet.</p>';
      return;
    }
    const c = item.caseRef;
    body.innerHTML = `
      <div class="case-diagram">${caseDiagram(c, item.setKey)}</div>
      <div class="case-info">
        <div class="case-name">${escapeHtml(c.name)}${timeMs != null ? `<span class="case-time">${formatTime(timeMs)}</span>` : ''}</div>
        <div class="muted small">${escapeHtml(SET_LABELS[item.setKey])} · ${escapeHtml(c.group)}</div>
        <div class="solution">${solutionHtml(item)}</div>
      </div>`;
  }

  function reveal() {
    if (!current || current.revealed) return;
    current.revealed = true;
    renderCase();
  }

  // ---------- timer ----------

  const timerEl = $('timer');
  let timerState = 'idle'; // idle | holding | ready | running | stopped
  let holdTimeout = null;
  let startTime = 0;
  let rafId = null;

  function formatTime(ms) {
    const total = Math.floor(ms / 10);
    const cs = total % 100;
    const secs = Math.floor(total / 100);
    const m = Math.floor(secs / 60);
    const sStr = m ? String(secs % 60).padStart(2, '0') : String(secs);
    return (m ? m + ':' : '') + sStr + '.' + String(cs).padStart(2, '0');
  }

  function setTimerState(state) {
    timerState = state;
    timerEl.dataset.state = state;
    document.body.classList.toggle('timing', state === 'running');
  }

  function tick() {
    timerEl.textContent = formatTime(performance.now() - startTime);
    rafId = requestAnimationFrame(tick);
  }

  function timerPress() {
    if (!current) return;
    if (timerState === 'running') {
      cancelAnimationFrame(rafId);
      const ms = performance.now() - startTime;
      timerEl.textContent = formatTime(ms);
      setTimerState('stopped');
      recordSolve(ms);
      return;
    }
    if (timerState === 'idle') {
      setTimerState('holding');
      holdTimeout = setTimeout(() => setTimerState('ready'), 300);
    }
  }

  function timerRelease() {
    clearTimeout(holdTimeout);
    if (timerState === 'ready') {
      startTime = performance.now();
      setTimerState('running');
      tick();
    } else if (timerState === 'holding' || timerState === 'stopped') {
      setTimerState('idle');
    }
  }

  function recordSolve(ms) {
    const c = current.caseRef;
    times.push({ set: current.setKey, caseId: c.id, name: c.name, ms: Math.round(ms), at: Date.now() });
    saveTimes();
    lastSolve = { item: current, ms };
    nextScramble();
    renderStats();
  }

  timerEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    timerPress();
  });
  timerEl.addEventListener('pointerup', timerRelease);
  timerEl.addEventListener('pointercancel', timerRelease);

  // ---------- stats ----------

  function renderStats() {
    const el = $('stats');
    if (!times.length) {
      el.innerHTML = '<p class="muted">No solves yet. Time a few to see which cases are slowest.</p>';
      $('clearTimes').hidden = true;
      return;
    }
    $('clearTimes').hidden = false;
    const byCase = new Map();
    for (const t of times) {
      const key = t.set + '|' + t.caseId;
      if (!byCase.has(key)) byCase.set(key, { name: t.name, set: t.set, list: [] });
      byCase.get(key).list.push(t.ms);
    }
    const rows = [...byCase.values()]
      .map((r) => ({
        name: r.name,
        set: r.set,
        count: r.list.length,
        mean: r.list.reduce((a, b) => a + b, 0) / r.list.length,
        best: Math.min(...r.list),
      }))
      .sort((a, b) => b.mean - a.mean);

    const recent = times
      .map((t, i) => ({ t, i }))
      .slice(-12)
      .reverse();

    el.innerHTML = `
      <div class="stats-grid">
        <div>
          <h3>By case <span class="muted small">(slowest first)</span></h3>
          <table class="table">
            <thead><tr><th>Case</th><th class="num">Solves</th><th class="num">Mean</th><th class="num">Best</th></tr></thead>
            <tbody>${rows
              .map(
                (r) => `<tr><td>${escapeHtml(r.name)} <span class="muted small">${escapeHtml(SET_LABELS[r.set] || '')}</span></td>
                <td class="num">${r.count}</td><td class="num">${formatTime(r.mean)}</td><td class="num">${formatTime(r.best)}</td></tr>`
              )
              .join('')}</tbody>
          </table>
        </div>
        <div>
          <h3>Recent</h3>
          <ul class="recent">${recent
            .map(
              ({ t, i }) => `<li><span class="num">${formatTime(t.ms)}</span><span class="recent-name">${escapeHtml(t.name)}</span>
              <button class="icon-btn" type="button" data-del="${i}" aria-label="Delete this time">×</button></li>`
            )
            .join('')}</ul>
        </div>
      </div>`;
  }

  $('stats').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    times.splice(Number(btn.dataset.del), 1);
    saveTimes();
    renderStats();
  });

  $('clearTimes').addEventListener('click', () => {
    if (!confirm('Clear all recorded times?')) return;
    times = [];
    saveTimes();
    renderStats();
  });

  // ---------- setup dialog ----------

  const dialog = $('setup');
  let groupFilter = null;

  function renderSetup() {
    // set tabs
    $('setTabs').innerHTML = Object.keys(SET_LABELS)
      .map(
        (k) =>
          `<button type="button" role="tab" class="seg${k === settings.set ? ' active' : ''}" aria-selected="${k === settings.set}" data-set="${k}">
            ${SET_LABELS[k]}<span class="seg-count">${getSet(k).cases.length}</span></button>`
      )
      .join('');

    // options
    const opts = settings.options[settings.set];
    $('caseOptions').innerHTML = SET_OPTIONS[settings.set]
      .map((key) => {
        const def = OPTION_DEFS[key];
        const disabled = key === 'postAuf' && opts.randomizeLL;
        return `<label class="check${disabled ? ' disabled' : ''}">
          <input type="checkbox" data-opt="${key}" ${opts[key] && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
          <span><b>${def.label}</b><span class="muted small">${def.help}${disabled ? ' (Not needed with a random permutation.)' : ''}</span></span>
        </label>`;
      })
      .join('');

    // orientation
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    $('topColor').innerHTML = R.COLORS.map(
      (c) => `<option value="${c}"${c === settings.topColor ? ' selected' : ''}>${cap(c)}</option>`
    ).join('');
    $('frontColor').innerHTML = R.COLORS.filter((c) => R.validFront(settings.topColor, c))
      .map((c) => `<option value="${c}"${c === settings.frontColor ? ' selected' : ''}>${cap(c)}</option>`)
      .join('');
    $('scrambleFrame').value = settings.scrambleFrame;
    $('order').value = settings.order;
    $('revealMode').value = settings.revealMode;

    renderCaseGrid();
  }

  function renderCaseGrid() {
    const set = getSet(settings.set);
    const excluded = new Set(settings.excluded[settings.set]);
    const groups = [...new Set(set.cases.map((c) => c.group))];
    if (groupFilter && !groups.includes(groupFilter)) groupFilter = null;

    $('customForm').hidden = settings.set !== 'custom';
    $('groupChips').innerHTML =
      groups.length > 1
        ? [`<button type="button" class="chip${groupFilter ? '' : ' active'}" data-group="">All groups</button>`]
            .concat(
              groups.map((g) => {
                const inGroup = set.cases.filter((c) => c.group === g);
                const on = inGroup.filter((c) => !excluded.has(c.id)).length;
                return `<button type="button" class="chip${groupFilter === g ? ' active' : ''}" data-group="${escapeHtml(g)}">${escapeHtml(g)} <span class="chip-count">${on}/${inGroup.length}</span></button>`;
              })
            )
            .join('')
        : '';

    const visible = set.cases.filter((c) => !groupFilter || c.group === groupFilter);
    const scope = groupFilter ? ` in ${groupFilter}` : '';
    $('selectAll').textContent = `Select all${scope}`;
    $('selectNone').textContent = `Select none${scope}`;
    $('onlyGroup').hidden = !groupFilter;
    $('selectedCount').textContent = `— ${set.cases.filter((c) => !excluded.has(c.id)).length} of ${set.cases.length} selected`;

    if (!set.cases.length) {
      $('caseGrid').innerHTML =
        '<p class="muted">Add an algorithm above. The scramble will set up the case that your algorithm solves.</p>';
      return;
    }

    $('caseGrid').innerHTML = visible
      .map((c) => {
        const on = !excluded.has(c.id);
        return `<div class="case-tile${on ? ' on' : ''}">
          <button type="button" class="case-toggle" data-case="${escapeHtml(c.id)}" aria-pressed="${on}" title="${escapeHtml(c.alg)}">
            <span class="tile-check" aria-hidden="true"></span>
            ${caseDiagram(c)}
            <span class="tile-name">${escapeHtml(c.name)}</span>
            <span class="tile-alg">${escapeHtml(c.alg)}</span>
          </button>
          ${settings.set === 'custom' ? `<button type="button" class="icon-btn tile-del" data-remove="${escapeHtml(c.id)}" aria-label="Remove ${escapeHtml(c.name)}">×</button>` : ''}
        </div>`;
      })
      .join('');
  }

  function setExcluded(ids, exclude) {
    const ex = new Set(settings.excluded[settings.set]);
    for (const id of ids) {
      if (exclude) ex.add(id);
      else ex.delete(id);
    }
    settings.excluded[settings.set] = [...ex];
    settingsChanged();
    renderCaseGrid();
  }

  $('setTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set]');
    if (!btn || btn.dataset.set === settings.set) return;
    settings.set = btn.dataset.set;
    groupFilter = null;
    settingsChanged();
    renderSetup();
  });

  $('caseOptions').addEventListener('change', (e) => {
    const key = e.target.dataset.opt;
    if (!key) return;
    settings.options[settings.set][key] = e.target.checked;
    settingsChanged();
    renderSetup();
  });

  $('topColor').addEventListener('change', (e) => {
    settings.topColor = e.target.value;
    if (!R.validFront(settings.topColor, settings.frontColor)) {
      settings.frontColor = R.COLORS.find((c) => R.validFront(settings.topColor, c));
    }
    settingsChanged();
    renderSetup();
  });
  $('frontColor').addEventListener('change', (e) => {
    settings.frontColor = e.target.value;
    settingsChanged();
    renderSetup();
  });
  for (const id of ['scrambleFrame', 'order', 'revealMode']) {
    $(id).addEventListener('change', (e) => {
      settings[id] = e.target.value;
      settingsChanged();
    });
  }

  $('groupChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-group]');
    if (!chip) return;
    groupFilter = chip.dataset.group || null;
    renderCaseGrid();
  });

  const visibleIds = () =>
    getSet(settings.set)
      .cases.filter((c) => !groupFilter || c.group === groupFilter)
      .map((c) => c.id);
  $('selectAll').addEventListener('click', () => setExcluded(visibleIds(), false));
  $('selectNone').addEventListener('click', () => setExcluded(visibleIds(), true));
  $('onlyGroup').addEventListener('click', () => {
    const keep = new Set(visibleIds());
    settings.excluded[settings.set] = getSet(settings.set)
      .cases.map((c) => c.id)
      .filter((id) => !keep.has(id));
    settingsChanged();
    renderCaseGrid();
  });

  $('caseGrid').addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      customCases = customCases.filter((c) => c.id !== remove.dataset.remove);
      saveCustom();
      settingsChanged();
      renderSetup();
      return;
    }
    const toggle = e.target.closest('[data-case]');
    if (!toggle) return;
    const id = toggle.dataset.case;
    setExcluded([id], !settings.excluded[settings.set].includes(id));
  });

  function addCustom() {
    const name = $('customName').value.trim();
    const alg = $('customAlg').value.trim();
    const err = $('customError');
    err.textContent = '';
    if (!alg) {
      err.textContent = 'Enter the algorithm you want to practice.';
      return;
    }
    try {
      N.toFaceMoves(alg);
    } catch (e) {
      err.textContent = e.message + '. Use standard notation, e.g. R U R\' U\', wide moves (r, Rw), slices (M E S) and rotations (x y z).';
      return;
    }
    customCases.push({ id: 'c' + Date.now().toString(36), name: name || alg, alg });
    saveCustom();
    $('customName').value = '';
    $('customAlg').value = '';
    settingsChanged();
    renderSetup();
    $('customName').focus();
  }
  $('customAdd').addEventListener('click', addCustom);
  for (const id of ['customName', 'customAlg']) {
    $(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustom();
      }
    });
  }

  let versionAtOpen = 0;
  function openSetup() {
    versionAtOpen = version;
    renderSetup();
    dialog.showModal();
  }
  dialog.addEventListener('close', () => {
    if (version !== versionAtOpen) nextScramble();
  });
  $('openSetup').addEventListener('click', openSetup);

  // ---------- buttons & keyboard ----------

  $('nextBtn').addEventListener('click', nextScramble);
  $('revealBtn').addEventListener('click', reveal);
  $('previewBtn').addEventListener('click', () => {
    settings.preview = !settings.preview;
    saveSettings();
    renderPreview();
  });

  const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');

  document.addEventListener('keydown', (e) => {
    if (dialog.open || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) timerPress();
      return;
    }
    if (timerState === 'running') {
      timerPress();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'enter' || key === 'n') {
      if (e.target.tagName === 'BUTTON' && key === 'enter') return;
      e.preventDefault();
      nextScramble();
    } else if (key === 'r') reveal();
    else if (key === 'p') $('previewBtn').click();
    else if (key === 's') {
      e.preventDefault();
      openSetup();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (dialog.open || isTyping(e.target)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      timerRelease();
    }
  });

  // ---------- start ----------

  renderSummary();
  renderStats();
  renderCase();
  setTimerState('idle');
  // Let the page paint before the solver builds its tables (about a second).
  setTimeout(() => {
    S.initSolver();
    nextScramble();
  }, 50);
})();
