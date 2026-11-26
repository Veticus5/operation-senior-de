/* Silnik symulatora lazy evaluation: imperatywna animacja DOM na 9 wierszach.
   Przeniesiony 1:1 z zaakceptowanego artefaktu i opakowany komponentem LazySim.tsx.
   PLANS (content/spark/lazy-evaluation/plans.json) to plany po optymalizacji z prawdziwego explain(). */
export function createLazySim(els, PLANS) {
  const { scene, sayEl, factsEl, dock, ticks, missionEl } = els;
  let dead = false;
  const ROWS = [[1,'A','active','9.99'],[2,'B','active','4.99'],[3,'C','cancelled','9.99'],[4,'B','active','9.99'],[5,'C','active','4.99'],
                [6,'A','cancelled','9.99'],[7,'C','active','9.99'],[8,'A','active','4.99'],[9,'B','cancelled','9.99']]
    .map(r => ({ id: r[0], pub: r[1], status: r[2], price: r[3] }));
  const COLS = ['id', 'pub', 'status', 'price'];
  const FULL = { id: 'subscription_id', pub: 'publisher_id', status: 'status', price: 'price' };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, reduced || dead ? 0 : ms));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const rowY = i => 62 + i * 30, T0 = 236, TW = 540, RES = 800;
  const st = { ops: [], cache: false, cacheData: null, busy: false, planRuns: 0, everRan: false, reran: false, cacheUsed: false, showCache: false, mission: 0, firstOp: true };

  /* ---------- stałe elementy sceny ---------- */
  const src = el('div', 'src'); scene.appendChild(src);
  const t1 = el('div', 'zone-t'); t1.style.left = '16px'; t1.innerHTML = 'źródło &nbsp;<b>subs.parquet</b>'; src.appendChild(t1);
  const heads = {}, srcCells = {};
  COLS.forEach((c, i) => { const h = el('div', 'colh', c); h.style.left = (16 + i * 44) + 'px'; src.appendChild(h); heads[c] = h; srcCells[c] = []; });
  const cellEl = (c, r) => { const d = el('div', 'cell'); d.dataset.c = c; if (c === 'status') d.className = 'cell dot' + (r.status === 'active' ? ' on' : ''); else d.textContent = r[c]; return d; };
  ROWS.forEach((r, i) => { const row = el('div', 'srow'); row.style.top = rowY(i) + 'px'; COLS.forEach(c => { const d = cellEl(c, r); srcCells[c].push(d); row.appendChild(d); }); src.appendChild(row); });
  const readTag = el('div', 'src-tag'); readTag.innerHTML = '<span>odczyty pliku</span><span class="dots"></span><span class="none">jeszcze żadnego</span>'; scene.appendChild(readTag);
  const pushTag = el('div', 'push-tag', 'filtr przekazany do czytnika'); scene.appendChild(pushTag);
  scene.appendChild(el('div', 'rail'));
  const t2 = el('div', 'zone-t', 'wynik'); t2.style.left = RES + 'px'; scene.appendChild(t2);
  const resLayer = el('div'); scene.appendChild(resLayer);
  const cacheBox = el('div', 'cachebox'); cacheBox.appendChild(el('span', '', 'pusty')); scene.appendChild(cacheBox);
  const nodeEls = new Map();
  let items = [], ghosts = [];

  /* ---------- teksty prowadzące ---------- */
  const say = (t, keep) => { sayEl.textContent = t; if (!keep) factsEl.innerHTML = ''; };
  const fact = t => factsEl.appendChild(el('li', '', t));
  const MISSIONS = ['Zbuduj plan', 'Uruchom akcję', 'Uruchom ją jeszcze raz', 'Dodaj cache()', 'Uruchom dwa razy z cache', 'Gotowe. Eksperymentuj dalej'];
  function mission() {
    let m = 0;
    if (st.ops.length) m = 1; if (st.everRan) m = 2; if (st.reran) m = 3; if (st.reran && st.cache) m = 4; if (st.cacheUsed) m = 5;
    st.mission = Math.max(st.mission, m);
    [...ticks.children].forEach((t, i) => t.classList.toggle('done', i < st.mission));
    missionEl.textContent = MISSIONS[st.mission];
  }

  /* ---------- plan: pigułki na torze ---------- */
  const written = () => st.ops.map(o => o === 'f' ? { key: 'f', label: 'filter', sub: 'status = "active"' }
    : o === 's' ? { key: 's', label: 'select', sub: 'publisher_id, status, price' } : { key: 'g', label: 'groupBy', sub: 'publisher_id → subs, mrr' })
    .concat(st.cache ? [{ key: 'c', label: 'cache', t: 'cache' }] : []);
  function optimized(plan, withCount) {
    const out = [];
    plan.n.forEach(n => {
      if (n.t === 'filter') out.push({ key: 'f', t: 'filter', label: 'Filter', sub: 'status = active', cls: 'opt' });
      else if (n.t === 'project') { const mine = st.ops.includes('s'); out.push({ key: mine ? 's' : 'p', t: 'project', cols: n.cols, label: 'Project', sub: n.cols.length ? n.cols.map(c => FULL[c]).join(', ') : 'bez kolumn', cls: mine ? 'opt' : 'opt auto' }); }
      else if (n.t === 'agg') out.push({ key: 'g', t: 'agg', label: 'Aggregate', sub: 'subs, mrr wg publisher_id', cls: 'opt' });
      else if (n.t === 'keys') out.push({ key: 'g', t: 'keys', label: 'Aggregate', sub: 'same klucze publisher_id', cls: 'opt' });
      else if (n.t === 'count') out.push({ key: 'n', t: 'count', label: 'count', sub: 'liczy wiersze', cls: 'opt' });
    });
    if (st.cache) { const c = { key: 'c', t: 'cache', label: 'cache', cls: 'opt' }; const i = out.findIndex(n => n.t === 'count'); if (i < 0) out.push(c); else out.splice(i, 0, c); if (withCount && i < 0) out.push({ key: 'n', t: 'count', label: 'count', sub: 'liczy wiersze', cls: 'opt' }); }
    return out;
  }
  function drawNodes(list) {
    const n = list.length, seen = new Set();
    list.forEach((nd, i) => {
      nd.x = T0 + (i + 0.5) * TW / n; seen.add(nd.key);
      let e = nodeEls.get(nd.key);
      if (!e) { e = el('div', 'node'); e.append(el('span', 'pill'), el('span', 'sub')); e.style.left = nd.x + 'px'; scene.appendChild(e); nodeEls.set(nd.key, e); requestAnimationFrame(() => requestAnimationFrame(() => e.classList.add('in'))); }
      e.className = 'node in ' + (nd.cls || '') + (nd.t === 'cache' ? ' cache' : '') + (nd.skip ? ' skip' : '');
      e.style.left = nd.x + 'px'; e.style.opacity = nd.skip ? '.28' : '';
      e.children[0].textContent = nd.label; e.children[1].textContent = nd.sub || '';
      nd.el = e;
      if (nd.t === 'cache') { cacheBox.style.left = nd.x + 'px'; cacheBox.classList.add('in'); ghosts.forEach(g => { g.style.left = (nd.x - g._w * 0.36) + 'px'; }); }
    });
    nodeEls.forEach((e, k) => { if (!seen.has(k)) { e.classList.remove('in'); e.style.opacity = '0'; nodeEls.delete(k); setTimeout(() => e.remove(), 450); } });
    if (!seen.has('c')) cacheBox.classList.remove('in');
    return list;
  }

  /* ---------- wiersze w locie ---------- */
  const width = it => it.cells.length ? it.cells.length * 44 - 4 : 26;
  function makeItem(data, x, y) {
    const e = el('div', 'item' + (data.kind === 'grp' ? ' grp' : '') + (data.cells.length ? '' : ' bare'));
    data.cells.forEach(c => { let d; if (data.kind === 'grp') { d = el('div', 'cell', data.vals[c]); d.dataset.c = c; } else d = cellEl(c, data.row); e.appendChild(d); });
    e.style.left = x + 'px'; e.style.top = y + 'px';
    scene.appendChild(e);
    return Object.assign({ el: e }, data, { cells: data.cells.slice() });
  }
  async function moveTo(x, lane) {
    items.forEach((it, i) => setTimeout(() => { it.el.style.left = (x - width(it) / 2) + 'px'; if (lane) it.el.style.top = lane(it, i) + 'px'; }, reduced ? 0 : i * 32));
    await sleep(660 + items.length * 32);
  }
  const clearItems = () => { items.forEach(i => i.el.remove()); items = []; resLayer.innerHTML = ''; };
  const clearGhosts = () => { ghosts.forEach(g => g.remove()); ghosts = []; cacheBox.classList.remove('full'); cacheBox.firstChild.textContent = 'pusty'; };
  function resetSource() { COLS.forEach(c => { heads[c].classList.remove('pruned'); srcCells[c].forEach(d => d.classList.remove('pruned')); }); pushTag.classList.remove('on'); src.classList.remove('asleep'); }
  function planChanged() { clearItems(); clearGhosts(); st.cacheData = null; st.planRuns = 0; resetSource(); drawNodes(written()); mission(); drawDock(); }

  /* ---------- kroki wykonania ---------- */
  const APPLY = {
    async filter() { const out = items.filter(i => i.row.status !== 'active'); out.forEach(i => i.el.classList.add('drop')); await sleep(480); out.forEach(i => i.el.remove()); items = items.filter(i => i.row.status === 'active'); },
    async project(nd) {
      items.forEach(it => { [...it.el.children].forEach(c => { if (!nd.cols.includes(c.dataset.c)) c.classList.add('gone'); }); it.cells = it.cells.filter(c => nd.cols.includes(c)); it.el.style.left = (nd.x - width(it) / 2) + 'px'; });
      await sleep(520);
      items.forEach(it => { [...it.el.children].forEach(c => c.classList.contains('gone') && c.remove()); if (!it.cells.length) it.el.classList.add('bare'); });
    },
    async agg(nd) { await group(nd, true); },
    async keys(nd) { await group(nd, false); },
    async cache(nd) {
      clearGhosts();
      st.cacheData = items.map(it => ({ kind: it.kind, row: it.row, vals: it.vals, cells: it.cells.slice() }));
      items.forEach((it, k) => { const g = it.el.cloneNode(true); g.classList.add('ghost'); g._w = width(it); g.style.left = (nd.x - width(it) * 0.36) + 'px'; g.style.top = (70 + k * 25) + 'px'; scene.appendChild(g); ghosts.push(g); });
      cacheBox.classList.add('full'); cacheBox.firstChild.textContent = items.length + (items[0] && items[0].kind === 'grp' ? ' grupy' : ' wierszy');
      await sleep(620);
    },
    async count() {}
  };
  async function group(nd, full) {
    const keys = [...new Set(items.map(i => i.row.pub))].sort();
    items.forEach(it => { it.el.style.top = rowY(3 + keys.indexOf(it.row.pub)) + 'px'; });
    await sleep(680);
    const next = keys.map((k, gi) => {
      const rows = items.filter(i => i.row.pub === k).map(i => i.row);
      const vals = { pub: k, subs: String(rows.length), mrr: rows.reduce((s, r) => s + +r.price, 0).toFixed(2) };
      const cells = full ? ['pub', 'subs', 'mrr'] : ['pub'];
      return makeItem({ kind: 'grp', vals, cells, row: { pub: k } }, nd.x - (cells.length * 44 - 4) / 2, rowY(3 + gi));
    });
    items.forEach(i => i.el.remove()); items = next;
    await sleep(380);
  }
  async function land(action) {
    if (action === 'count') {
      const n = items.length;
      items.forEach(it => { it.el.style.left = (RES + 70) + 'px'; it.el.style.top = '150px'; it.el.style.opacity = '0'; });
      await sleep(620); items.forEach(i => i.el.remove()); items = [];
      const b = el('div', 'bignum', String(n)); b.appendChild(el('small', '', 'count()')); resLayer.appendChild(b);
    } else {
      await moveTo(RES, null);
      items.forEach((it, k) => { it.el.style.left = RES + 'px'; it.el.style.top = rowY(k) + 'px'; });
      const h = el('div', 'res-h'); h.style.left = RES + 'px'; (items[0] ? items[0].cells : []).forEach(c => h.appendChild(el('span', '', c))); resLayer.appendChild(h);
      await sleep(640);
    }
  }
  async function through(nodes, action) {
    for (const nd of nodes) {
      if (nd.skip) continue;
      nd.el.classList.add('hot');
      if (nd.t !== 'count') { await moveTo(nd.x, null); await APPLY[nd.t](nd); await sleep(160); }
      else { await moveTo(nd.x, null); await sleep(200); }
      nd.el.classList.remove('hot');
    }
    await land(action);
  }
  function facts(plan, action) {
    const out = [], ops = st.ops, n = plan.read.length;
    if (st.cache) out.push('Z cache() Spark musi policzyć cały DataFrame, bo ma go zapamiętać w całości. Nawet jeśli akcją jest count().');
    if (n === 0) out.push('Nie czyta żadnej kolumny. Do policzenia wierszy wystarczy mu ich liczba.');
    else if (n < 4) out.push('Czyta ' + n + ' z 4 kolumn: ' + plan.read.map(c => FULL[c]).join(', ') + '. Reszty nie dotyka.');
    if (ops.indexOf('s') > -1 && ops.indexOf('f') > ops.indexOf('s') && plan.n[0] && plan.n[0].t === 'filter') out.push('Przestawił kolejność. Filter idzie przed select, żeby jak najwcześniej odrzucić wiersze.');
    if (plan.pushed) out.push('Warunek filtra przekazał do czytnika Parquet, który może dzięki temu pomijać całe bloki pliku.');
    if (!ops.includes('s') && plan.n.some(x => x.t === 'project' && x.cols.length)) out.push('Dopisał własny Project, żeby dalej nie nieść zbędnych kolumn.');
    if (ops.includes('s') && action === 'count' && !st.cache && plan.n.some(x => x.t === 'project' && !x.cols.length)) out.push('Twój select okazał się zbędny dla count(), więc nic po nim nie zostało.');
    if (!out.length) out.push('Tu nie było czego upraszczać. Plan zostaje taki, jak go napisałeś.');
    return out.slice(0, 3);
  }

  async function run(action) {
    if (st.busy) return;
    st.busy = true; drawDock(); clearItems();
    const key = st.ops.join('>');
    if (st.cache && st.cacheData) {
      say('Źródło śpi. Dane wychodzą prosto z cache.');
      src.classList.add('asleep');
      const nodes = drawNodes(optimized(PLANS[key + '|show'], action === 'count'));
      nodes.forEach(n => { if (n.t !== 'count') n.skip = true; }); drawNodes(nodes);
      const cx = nodes.find(n => n.t === 'cache').x;
      items = st.cacheData.map((d, k) => makeItem(d, cx - (d.cells.length * 44 - 4) * 0.36, 70 + k * 25));
      await sleep(500);
      await through(nodes, action);
      st.cacheUsed = true;
      say('Plik nietknięty, żadnego liczenia. Wynik wyszedł z pamięci.');
      fact('Tak samo zadziała każda kolejna akcja na tym DataFrame, dopóki cache istnieje.');
    } else {
      const plan = PLANS[key + '|' + (st.cache ? 'show' : action)];
      say('Akcja. Spark pierwszy raz widzi całe zapytanie, więc zanim ruszy dane, upraszcza plan.');
      await sleep(1000);
      const nodes = drawNodes(optimized(plan, action === 'count'));
      resetSource();
      COLS.forEach(c => { if (!plan.read.includes(c)) { heads[c].classList.add('pruned'); srcCells[c].forEach(d => d.classList.add('pruned')); } });
      pushTag.classList.toggle('on', plan.pushed);
      for (const f of facts(plan, action)) { fact(f); await sleep(1250); }
      say('Dopiero teraz płyną dane.', true);
      readTag.querySelector('.none').textContent = ''; readTag.querySelector('.dots').appendChild(el('i'));
      items = ROWS.map((r, i) => makeItem({ kind: 'row', row: r, cells: plan.read.slice() }, 16 + (plan.read.length ? COLS.indexOf(plan.read[0]) * 44 : 0), rowY(i)));
      await sleep(420);
      await through(nodes, action);
      st.planRuns++;
      if (st.cache) { say('Policzone, a wynik został też w cache. Uruchom akcję jeszcze raz i patrz na źródło.', true); }
      else if (st.planRuns === 1 && !st.everRan) { say('Jedno przejście po danych i tylko po tym, co potrzebne. Uruchom akcję jeszcze raz i patrz na źródło.', true); }
      else if (st.planRuns === 1) { say('Nowy plan, nowe przejście po danych. Uruchom akcję ponownie, żeby zobaczyć powtórkę.', true); }
      else { st.reran = true; st.showCache = true; say('Spark niczego nie zapamiętał. Przeczytał plik jeszcze raz i policzył wszystko od zera.'); fact('Każda kropka pod źródłem to jeden pełny odczyt.'); fact('Jeśli wynik ma posłużyć kilku akcjom, możesz go zatrzymać w pamięci. Dodaj cache().'); }
    }
    st.everRan = true; st.busy = false; mission(); drawDock();
  }

  /* ---------- sterowanie ---------- */
  function addOp(o) {
    st.ops.push(o);
    say(st.firstOp ? 'Plan urósł o jeden krok. Spójrz na dane po lewej: ani drgnęły.' : 'Kolejny krok zapisany. Nadal żadnej pracy.');
    if (o === 'g') fact('Po groupBy zostają tylko publisher_id, subs i mrr, więc filter i select już tu nie pasują.');
    if (st.firstOp) fact('To jest transformacja: opis, nie wykonanie.');
    st.firstOp = false; planChanged();
  }
  function drawDock() {
    dock.innerHTML = '';
    const group = (title, btns) => { const g = el('div', 'grp-c'); g.appendChild(el('span', '', title)); const d = el('div'); btns.forEach(b => d.appendChild(b)); g.appendChild(d); dock.appendChild(g); };
    const b = (label, fn, cls, off, tip) => { const x = el('button', 'op' + (cls ? ' ' + cls : ''), label); x.type = 'button'; x.disabled = !!off || st.busy; if (tip) x.title = tip; x.addEventListener('click', fn); return x; };
    const hasG = st.ops.includes('g'), lock = st.cache;
    group('Transformacje', [
      b('.filter(status == "active")', () => addOp('f'), '', st.ops.includes('f') || hasG || lock, hasG ? 'Po groupBy nie ma już kolumny status' : lock ? 'Najpierw usuń cache()' : ''),
      b('.select(3 kolumny)', () => addOp('s'), '', st.ops.includes('s') || hasG || lock, hasG ? 'Po groupBy nie ma już tych kolumn' : lock ? 'Najpierw usuń cache()' : ''),
      b('.groupBy(publisher_id)', () => addOp('g'), '', hasG || lock, lock ? 'Najpierw usuń cache()' : '') ]);
    if (st.ops.length || st.everRan) group('Akcje', [b('.show()', () => run('show'), 'act'), b('.count()', () => run('count'), 'act')]);
    if (st.showCache) group('Pamięć', [b(st.cache ? '✓ .cache()' : '.cache()', () => {
      st.cache = !st.cache;
      say(st.cache ? 'cache() to też tylko wpis w planie. Pojemnik jest pusty, dopóki nie uruchomisz akcji.' : 'cache() usunięty. Każda akcja znów liczy od zera.');
      planChanged();
    })]);
    if (st.ops.length || st.cache) group(' ', [
      b('cofnij', () => { if (st.cache) st.cache = false; else st.ops.pop(); say('Cofnięte. Plan krótszy o jeden krok.'); planChanged(); }, 'ghostb'),
      b('od nowa', () => { st.ops = []; st.cache = false; say('Czysty plan. Dodaj operację.'); readTag.querySelector('.dots').innerHTML = ''; readTag.querySelector('.none').textContent = 'jeszcze żadnego'; planChanged(); }, 'ghostb') ]);
  }

  say('Po lewej plik z 9 subskrypcjami. Dodaj pierwszą operację i obserwuj, co stanie się z danymi.');
  drawNodes(written()); mission(); drawDock();
  return { destroy() { dead = true; scene.innerHTML = ''; dock.innerHTML = ''; factsEl.innerHTML = ''; } };
}
