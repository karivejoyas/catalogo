(() => {
  'use strict';

  const STORAGE_KEY = 'karive_catalog_v1';

  const ACCENTS = {
    oro:   { color: '#E3C572', glow: 'rgba(201,162,75,0.42)' },
    plata: { color: '#D9E1EC', glow: 'rgba(196,208,224,0.38)' },
    perla: { color: '#F2A9D6', glow: 'rgba(233,120,190,0.40)' }
  };

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }

  function persist(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products: state.products, cardStyle: state.cardStyle }));
    } catch (e) { console.warn('No se pudo guardar el catálogo (almacenamiento lleno).', e); }
  }

  function defaultProducts() {
    const tipos = [
      ['Argollas', 'argollas'], ['Aros colgantes', 'colgantes'], ['Topos', 'topos'],
      ['Ear cuff', 'ear cuff'], ['Aros perla', 'perla'], ['Aros gota', 'gota'],
      ['Aros circón', 'circón'], ['Aros corazón', 'corazón'], ['Aros estrella', 'estrella'], ['Huggies', 'huggie']
    ];
    const mats = ['Acero quirúrgico dorado', 'Plata 925', 'Baño de oro 18k', 'Oro laminado', 'Acero blanco'];
    const adjs = ['minimalistas', 'elegantes', 'delicados', 'statement', 'románticos', 'clásicos'];
    const precios = [4990, 5990, 6990, 7990, 8990, 9990, 11990, 12990, 14990, 16990, 18990, 22990];
    const out = [];
    for (let i = 0; i < 50; i++) {
      const t = tipos[i % tipos.length];
      const m = mats[i % mats.length];
      const a = adjs[i % adjs.length];
      out.push({
        id: 'p' + (i + 1) + '-' + Math.random().toString(36).slice(2, 7),
        code: 'AR-' + String(i + 1).padStart(3, '0'),
        name: t[0] + ' ' + a,
        desc: m + ' · hipoalergénico · ' + t[1],
        price: precios[i % precios.length],
        photo: null
      });
    }
    return out;
  }

  function formatCLP(n) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString('es-CL');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const saved = loadSaved();
  const state = {
    products: (saved && saved.products) ? saved.products : defaultProducts(),
    cardStyle: (saved && saved.cardStyle) || 'marco',
    editing: false,
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
    editToggle: document.getElementById('kv-edit-toggle'),
    editTools: document.getElementById('kv-edit-tools'),
    tabs: Array.from(document.querySelectorAll('.kv-tab')),
    add: document.getElementById('kv-add'),
    reset: document.getElementById('kv-reset'),
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

  // ---- edit mode toggle ----
  el.editToggle.addEventListener('click', () => {
    state.editing = !state.editing;
    render();
  });

  // ---- card style tabs ----
  el.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.cardStyle = tab.dataset.style;
      persist(state);
      render();
    });
  });

  // ---- add / reset ----
  el.add.addEventListener('click', () => {
    const n = {
      id: 'p' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      code: 'AR-' + String(state.products.length + 1).padStart(3, '0'),
      name: 'Nuevo aro', desc: 'Escribe aquí la descripción', price: 0, photo: null
    };
    state.products.unshift(n);
    persist(state);
    render();
  });
  el.reset.addEventListener('click', () => {
    if (!window.confirm('Esto reemplazará todo tu catálogo por los 50 ejemplos. ¿Continuar?')) return;
    state.products = defaultProducts();
    persist(state);
    render();
  });

  function updateField(id, field, value) {
    const p = state.products.find(p => p.id === id);
    if (!p) return;
    p[field] = value;
    persist(state);
  }

  function deleteProduct(id) {
    if (!window.confirm('¿Eliminar este producto del catálogo?')) return;
    state.products = state.products.filter(p => p.id !== id);
    persist(state);
    render();
  }

  function uploadPhoto(id, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 560;
        let w = img.width, h = img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        let data;
        try { data = c.toDataURL('image/jpeg', 0.82); } catch (err) { data = ev.target.result; }
        updateField(id, 'photo', data);
        render();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  const noPhotoBg = 'repeating-linear-gradient(45deg, rgba(201,162,75,0.10) 0 11px, transparent 11px 22px)';

  function cardHtml(p) {
    const cls = 'kv-card kv-card--' + state.cardStyle;
    const photoStyle = 'background-image:' + (p.photo ? "url('" + p.photo + "')" : noPhotoBg) + ';';

    let photoInner;
    if (state.editing) {
      photoInner =
        (!p.photo ? '<div class="kv-photo-placeholder"><span class="kv-photo-mark">✦</span><span class="kv-photo-text">FOTO PRODUCTO</span></div>' : '') +
        '<div class="kv-photo-edit">' +
          '<label class="kv-photo-btn">' + (p.photo ? 'Cambiar foto' : 'Agregar foto') +
            '<input type="file" accept="image/*" data-role="upload" data-id="' + p.id + '" style="display:none;" />' +
          '</label>' +
          (p.photo ? '<button type="button" class="kv-photo-btn-ghost" data-role="remove-photo" data-id="' + p.id + '">Quitar</button>' : '') +
        '</div>';
    } else {
      photoInner = !p.photo ? '<div class="kv-photo-placeholder"><span class="kv-photo-mark">✦</span><span class="kv-photo-text">FOTO PRODUCTO</span></div>' : '';
    }

    let body;
    if (state.editing) {
      body =
        '<div class="kv-card-toprow">' +
          '<input class="kv-ed-input kv-ed-code" data-role="code" data-id="' + p.id + '" value="' + escapeHtml(p.code) + '" />' +
          '<button type="button" class="kv-delete-btn" data-role="delete" data-id="' + p.id + '">Eliminar</button>' +
        '</div>' +
        '<input class="kv-ed-input kv-ed-name" data-role="name" data-id="' + p.id + '" value="' + escapeHtml(p.name) + '" />' +
        '<textarea class="kv-ed-textarea kv-ed-desc" data-role="desc" data-id="' + p.id + '" rows="2">' + escapeHtml(p.desc) + '</textarea>' +
        '<div class="kv-ed-price-row"><span class="kv-ed-peso">$</span>' +
          '<input class="kv-ed-input kv-ed-price" data-role="price" data-id="' + p.id + '" value="' + p.price + '" inputmode="numeric" />' +
        '</div>';
    } else {
      body =
        '<div class="kv-card-toprow"><span class="kv-code">' + escapeHtml(p.code) + '</span></div>' +
        '<h3 class="kv-name">' + escapeHtml(p.name) + '</h3>' +
        '<p class="kv-desc">' + escapeHtml(p.desc) + '</p>' +
        '<div class="kv-price">' + formatCLP(p.price) + '</div>';
    }

    return (
      '<div class="' + cls + '" data-id="' + p.id + '">' +
        '<div class="kv-photo" style="' + photoStyle + '">' + photoInner + '</div>' +
        '<div class="kv-card-body">' + body + '</div>' +
      '</div>'
    );
  }

  function bindCardEvents() {
    el.grid.querySelectorAll('[data-role="name"]').forEach(n => n.addEventListener('change', e => updateField(e.target.dataset.id, 'name', e.target.value)));
    el.grid.querySelectorAll('[data-role="desc"]').forEach(n => n.addEventListener('change', e => updateField(e.target.dataset.id, 'desc', e.target.value)));
    el.grid.querySelectorAll('[data-role="code"]').forEach(n => n.addEventListener('change', e => updateField(e.target.dataset.id, 'code', e.target.value)));
    el.grid.querySelectorAll('[data-role="price"]').forEach(n => n.addEventListener('change', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      updateField(e.target.dataset.id, 'price', isNaN(num) ? 0 : num);
      render();
    }));
    el.grid.querySelectorAll('[data-role="delete"]').forEach(n => n.addEventListener('click', e => deleteProduct(e.target.dataset.id)));
    el.grid.querySelectorAll('[data-role="remove-photo"]').forEach(n => n.addEventListener('click', e => { updateField(e.target.dataset.id, 'photo', null); render(); }));
    el.grid.querySelectorAll('[data-role="upload"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      uploadPhoto(e.target.dataset.id, file);
      e.target.value = '';
    }));
  }

  function render() {
    el.editToggle.textContent = state.editing ? '✓ Listo' : '✎ Editar catálogo';
    el.editToggle.classList.toggle('is-editing', state.editing);
    el.editTools.hidden = !state.editing;

    el.tabs.forEach(tab => tab.classList.toggle('is-active', tab.dataset.style === state.cardStyle));

    const q = state.query.trim().toLowerCase();
    const filtered = q
      ? state.products.filter(p => (p.name + ' ' + p.code + ' ' + p.desc).toLowerCase().includes(q))
      : state.products;

    el.count.textContent = filtered.length + ' de ' + state.products.length + ' aros';

    el.grid.innerHTML = filtered.map(cardHtml).join('');
    bindCardEvents();

    const noResults = filtered.length === 0;
    el.noResults.hidden = !noResults;
    if (noResults) el.noResultsText.textContent = 'No encontramos aros para “' + state.query + '”. Prueba con otra palabra.';
  }

  applyAccent();
  render();
})();
