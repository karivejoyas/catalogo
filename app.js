(() => {
  'use strict';

  const ACCENTS = {
    oro:   { color: '#E3C572', glow: 'rgba(201,162,75,0.42)' },
    plata: { color: '#D9E1EC', glow: 'rgba(196,208,224,0.38)' },
    perla: { color: '#F2A9D6', glow: 'rgba(233,120,190,0.40)' }
  };

  const state = {
    products: [],
    cardStyle: 'marco',
    query: '',
    accent: 'oro'
  };

  const el = {
    hero: document.getElementById('kv-hero'),
    b1: document.getElementById('kv-b1'),
    b2: document.getElementById('kv-b2'),
    b3: document.getElementById('kv-b3'),
    spark: document.getElementById('kv-spark'),
    moodBtns: Array.from(document.querySelectorAll('.kv-mood-btn')),
    query: document.getElementById('kv-query'),
    count: document.getElementById('kv-count'),
    grid: document.getElementById('kv-grid'),
    noResults: document.getElementById('kv-noresults'),
    noResultsText: document.getElementById('kv-noresults-text')
  };

  // ---- accent ----
  function applyAccent() {
    const acc = ACCENTS[state.accent] || ACCENTS.oro;
    document.documentElement.style.setProperty('--kv-accent-color', acc.color);
    document.documentElement.style.setProperty('--kv-accent-glow', acc.glow);
    el.moodBtns.forEach(btn => btn.classList.toggle('is-active', btn.dataset.accent === state.accent));
  }
  el.moodBtns.forEach(btn => {
    btn.addEventListener('click', () => { state.accent = btn.dataset.accent; applyAccent(); });
  });

  // ---- hero parallax ----
  el.hero.addEventListener('mousemove', (e) => {
    const r = el.hero.getBoundingClientRect();
    const tx = (e.clientX - r.left) / r.width - 0.5;
    const ty = (e.clientY - r.top) / r.height - 0.5;
    const set = (node, m) => { if (node) node.style.transform = 'translate(' + (tx * m) + 'px,' + (ty * m) + 'px)'; };
    set(el.b1, 38); set(el.b2, -30); set(el.b3, 26); set(el.spark, 16);
  });
  el.hero.addEventListener('mouseleave', () => {
    [el.b1, el.b2, el.b3, el.spark].forEach(n => { if (n) n.style.transform = ''; });
  });

  // ---- entrance reveal ----
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.kv-reveal-up, .kv-reveal-right').forEach(n => n.classList.add('kv-entered'));
    }, 60);
  });

  // ---- search ----
  el.query.addEventListener('input', (e) => { state.query = e.target.value; render(); });

  function render() {
    const q = state.query.trim().toLowerCase();
    const filtered = q
      ? state.products.filter(p => (p.name + ' ' + p.code + ' ' + p.desc).toLowerCase().includes(q))
      : state.products;

    el.count.textContent = filtered.length + ' de ' + state.products.length + ' aros';
    el.grid.innerHTML = filtered.map(p => kvCardHtml(p, state.cardStyle, false)).join('');

    const noResults = filtered.length === 0;
    el.noResults.hidden = !noResults;
    if (noResults) el.noResultsText.textContent = 'No encontramos aros para “' + state.query + '”. Prueba con otra palabra.';
  }

  applyAccent();
  render();

  // ---- datos en vivo desde Firestore (solo lectura) ----
  const itemsCol = kvDb.collection('catalog').doc('products').collection('items');
  itemsCol.orderBy('order').onSnapshot((snap) => {
    state.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => console.error('Error leyendo el catálogo:', err));

  kvDb.collection('catalog').doc('settings').onSnapshot((doc) => {
    const data = doc.data();
    if (data && data.cardStyle) { state.cardStyle = data.cardStyle; render(); }
    if (data && data.instagram) {
      document.getElementById('kv-ig-handle-footer').textContent = data.instagram;
    }
    if (data && data.whatsapp) {
      document.getElementById('kv-wa-number-footer').textContent = data.whatsapp;
    }
    const steps = (data && Array.isArray(data.howtoSteps) && data.howtoSteps.length === 6) ? data.howtoSteps : KV_DEFAULT_HOWTO;
    document.getElementById('kv-howto-steps').innerHTML = steps.map(kvHowtoStepHtml).join('');
  }, (err) => console.error('Error leyendo la configuración:', err));
})();
