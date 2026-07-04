(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const page = $('fb-page');
  const counter = $('fb-counter');
  const nav = $('fb-nav');
  const menuBtn = $('fb-menu-btn');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let products = [];
  let settings = {};
  let slides = [];
  let idx = 0;
  let pend1 = null, pend2 = null;

  // ---------- construir las páginas del flipbook ----------
  function pushCategoria(cat, items) {
    if (!items.length) return;
    slides.push({ type: 'hero', cat });
    for (let i = 0; i < items.length; i += 4) {
      slides.push({ type: 'products', cat, items: items.slice(i, i + 4), pageNum: Math.floor(i / 4) + 1, pageTotal: Math.ceil(items.length / 4) });
    }
  }

  function buildSlides() {
    slides = [{ type: 'cover' }, { type: 'info' }];
    const cats = kvCategorias(settings);
    cats.forEach(cat => pushCategoria(cat, products.filter(p => p.category === cat.id)));
    // productos cuya colección fue eliminada: se muestran en "Otros"
    const huerfanos = products.filter(p => !cats.some(c => c.id === p.category));
    if (huerfanos.length) {
      pushCategoria({ id: '__otros__', nombre: 'Otros', sub: 'Otros accesorios de la colección', imagen: huerfanos[0].photo || cats[0] && cats[0].imagen || '' }, huerfanos);
    }
    slides.push({ type: 'howto' });
    slides.push({ type: 'bye' });
    idx = Math.max(0, Math.min(idx, slides.length - 1));
  }

  // ---------- render de cada tipo de página ----------
  function renderSlide(s) {
    if (s.type === 'cover') {
      const cover = Object.assign({}, KV_COVER_DEFAULT, settings.cover || {});
      return (
        '<div class="fb-cover">' +
          '<div class="fb-cover-blur" style="background-image:url(\'' + cover.image + '\');"></div>' +
          '<div class="fb-cover-img" style="background-image:url(\'' + cover.image + '\');"></div>' +
          '<div class="fb-cover-velo"></div>' +
          '<div class="fb-cover-inner">' +
            '<div class="fb-logo-circulo"><img src="assets/logo-karive-crop.png" alt="Karivé Joyas" /></div>' +
            '<h1 class="fb-titulo">Catálogo</h1>' +
            '<div class="fb-sub">· De productos ·</div>' +
            '<div class="fb-corazon">♥</div>' +
            '<p class="fb-tagline">' + escapeHtml(cover.tagline) + '</p>' +
            '<p class="fb-siguenos">Síguenos</p>' +
            kvContactoRow(settings, ['instagram', 'facebook']) +
          '</div>' +
        '</div>'
      );
    }
    if (s.type === 'info') {
      const info = Object.assign({}, KV_INFO_DEFAULT, settings.info || {});
      const bullets = [info.b1, info.b2, info.b3, info.b4].filter(Boolean).map(b => '<li>' + escapeHtml(b) + '</li>').join('');
      return (
        '<div class="fb-info">' +
          '<div class="fb-info-divisor"><span></span>✦<span></span></div>' +
          '<h2 class="fb-info-titulo">' + escapeHtml(info.titulo) + '</h2>' +
          '<ul class="fb-info-lista">' + bullets + '</ul>' +
          kvContactoRow(settings) +
          '<div class="fb-corazon">♥</div>' +
        '</div>'
      );
    }
    if (s.type === 'hero') {
      return (
        '<div class="fb-hero">' +
          '<div class="fb-hero-blur" style="background-image:url(\'' + s.cat.imagen + '\');"></div>' +
          '<div class="fb-hero-img" style="background-image:url(\'' + s.cat.imagen + '\');"></div>' +
          '<div class="fb-hero-velo"></div>' +
          '<div class="fb-hero-inner">' +
            '<div class="fb-hero-linea"></div>' +
            '<h2 class="fb-hero-titulo">' + escapeHtml(s.cat.nombre) + '</h2>' +
            '<p class="fb-hero-sub">' + escapeHtml(s.cat.sub || '') + '</p>' +
          '</div>' +
        '</div>'
      );
    }
    if (s.type === 'howto') {
      const h = Object.assign({}, KV_HOWTO_DEFAULT, settings.howto || {});
      let pasos = '';
      for (let i = 1; i <= 6; i++) {
        const t = h['p' + i + 't'], d = h['p' + i + 'd'];
        if (!t && !d) continue;
        pasos += '<div class="fb-paso"><h3>' + escapeHtml(t || '') + '</h3><p>' + escapeHtml(d || '') + '</p></div>';
      }
      return (
        '<div class="fb-howto">' +
          '<div class="fb-info-divisor"><span></span>✦<span></span></div>' +
          '<h2 class="fb-info-titulo">' + escapeHtml(h.titulo) + '</h2>' +
          '<div class="fb-pasos">' + pasos + '</div>' +
          kvContactoRow(settings) +
        '</div>'
      );
    }
    if (s.type === 'bye') {
      const d = Object.assign({}, KV_DESPEDIDA_DEFAULT, settings.despedida || {});
      return (
        '<div class="fb-bye">' +
          '<div class="fb-logo-circulo"><img src="assets/logo-karive-crop.png" alt="Karivé Joyas" /></div>' +
          '<h2 class="fb-bye-titulo">' + escapeHtml(d.titulo) + '</h2>' +
          '<p class="fb-bye-msg">' + escapeHtml(d.mensaje) + '</p>' +
          '<div class="fb-corazon">♥</div>' +
          kvContactoRow(settings) +
          '<p class="fb-bye-marca">Karivé <span class="cat-dorado">·</span> Joyas</p>' +
        '</div>'
      );
    }
    // products
    const cards = s.items.map(kvCardHtml).join('');
    const paginacion = s.pageTotal > 1 ? '<span class="fb-prod-pag">' + s.pageNum + ' / ' + s.pageTotal + '</span>' : '';
    const fp = kvFondoProd(settings);
    return (
      '<div class="fb-prod" style="' + fp.base + '">' +
        (fp.imgUrl ? '<div class="fb-prod-bg" style="background-image:url(\'' + fp.imgUrl + '\');opacity:' + fp.imgOp + ';"></div>' : '') +
        '<div class="fb-prod-inner">' +
          '<div class="fb-prod-head"><span class="fb-prod-eyebrow">Colección</span><h2 class="fb-prod-titulo">' + escapeHtml(s.cat.nombre) + '</h2>' + paginacion + '</div>' +
          '<div class="fb-grid">' + cards + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function pintar() {
    if (slides.length === 0) return;
    page.innerHTML = renderSlide(slides[idx]);
    counter.textContent = (idx + 1) + ' / ' + slides.length;
    const cur = slides[idx];
    const curCat = cur && cur.cat ? cur.cat.id : null;
    nav.querySelectorAll('a').forEach(a => a.classList.toggle('is-active', a.dataset.cat === curCat));
  }

  // ---------- navegación con transición suave de página ----------
  function go(n, dir) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === idx) return;
    const d = dir || (n > idx ? 'next' : 'prev');
    idx = n;
    cerrarMenu();
    if (reduce) { pintar(); return; }
    clearTimeout(pend1); clearTimeout(pend2);
    page.classList.remove('fb-out-next', 'fb-out-prev', 'fb-in-next', 'fb-in-prev');
    page.style.transition = '';
    const salida = d === 'next' ? 'fb-out-next' : 'fb-out-prev';
    const entrada = d === 'next' ? 'fb-in-next' : 'fb-in-prev';
    void page.offsetWidth;
    page.classList.add(salida);                    // se desvanece hacia afuera
    pend1 = setTimeout(() => {
      pintar();                                     // cambia el contenido mientras está oculto
      page.classList.remove(salida);
      page.style.transition = 'none';               // salto instantáneo al estado de entrada
      page.classList.add(entrada);
      void page.offsetWidth;
      page.style.transition = '';                   // y transiciona suavemente al reposo
      page.classList.remove(entrada);
    }, 300);
  }

  // ---------- menú de categorías (se arma desde las páginas hero) ----------
  function buildNav() {
    let html = '';
    slides.forEach((s, i) => {
      if (s.type === 'hero') html += '<a href="#" data-i="' + i + '" data-cat="' + s.cat.id + '">' + escapeHtml(s.cat.nombre) + '</a>';
    });
    nav.innerHTML = html;
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      go(parseInt(a.dataset.i, 10));
    }));
  }
  function cerrarMenu() { nav.classList.remove('abierto'); menuBtn.classList.remove('abierto'); }
  menuBtn.addEventListener('click', () => { nav.classList.toggle('abierto'); menuBtn.classList.toggle('abierto'); });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !menuBtn.contains(e.target)) cerrarMenu();
  });

  // ---------- lightbox (producto ampliado) ----------
  const lb = $('fb-lightbox');
  function abrirLightbox(p) {
    if (!p) return;
    $('fb-lb-foto').style.backgroundImage = p.photo ? "url('" + p.photo + "')" : KV_SIN_FOTO;
    $('fb-lb-foto').classList.toggle('sin-foto', !p.photo);
    $('fb-lb-codigo').textContent = p.code || '';
    $('fb-lb-nombre').textContent = p.name || '';
    $('fb-lb-detalle').textContent = p.detail || '';
    $('fb-lb-detalle').style.display = p.detail ? '' : 'none';
    $('fb-lb-precio').textContent = formatCLP(p.price);
    lb.hidden = false;
    document.body.classList.add('fb-lb-open');
  }
  function cerrarLightbox() { lb.hidden = true; document.body.classList.remove('fb-lb-open'); }
  const lbAbierto = () => !lb.hidden;
  lb.querySelectorAll('[data-role="close"]').forEach(n => n.addEventListener('click', cerrarLightbox));

  // click / teclado sobre una tarjeta -> abrir lightbox
  page.addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card-click');
    if (!card) return;
    const p = products.find(x => x.id === card.dataset.id);
    abrirLightbox(p);
  });
  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest && e.target.closest('.cat-card-click');
    if (!card) return;
    e.preventDefault();
    abrirLightbox(products.find(x => x.id === card.dataset.id));
  });

  // ---------- controles ----------
  $('fb-prev').addEventListener('click', () => go(idx - 1, 'prev'));
  $('fb-next').addEventListener('click', () => go(idx + 1, 'next'));
  $('fb-prev2').addEventListener('click', () => go(idx - 1, 'prev'));
  $('fb-next2').addEventListener('click', () => go(idx + 1, 'next'));
  $('fb-logo').addEventListener('click', (e) => { e.preventDefault(); go(0, 'prev'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lbAbierto()) { cerrarLightbox(); return; }
    if (lbAbierto()) return;                       // no navegar mientras el lightbox está abierto
    if (e.key === 'ArrowLeft') go(idx - 1, 'prev');
    else if (e.key === 'ArrowRight') go(idx + 1, 'next');
  });

  let tx = 0, ty = 0;
  const stage = document.querySelector('.fb-stage');
  stage.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (lbAbierto()) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) go(idx + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
  }, { passive: true });

  // precarga de imágenes: al cargar los datos, descarga todas las fotos en
  // segundo plano para que aparezcan al instante al pasar las páginas.
  const yaPrecargadas = new Set();
  function precargar() {
    const urls = new Set();
    products.forEach(p => { if (p.photo) urls.add(p.photo); });
    kvCategorias(settings).forEach(cat => { if (cat.imagen) urls.add(cat.imagen); });
    const cover = Object.assign({}, KV_COVER_DEFAULT, settings.cover || {});
    if (cover.image) urls.add(cover.image);
    urls.forEach(u => { if (!yaPrecargadas.has(u)) { yaPrecargadas.add(u); const im = new Image(); im.src = u; } });
  }

  function rebuild() {
    kvApplyTheme(Object.assign({}, KV_THEME_DEFAULT, settings.theme || {}));
    buildSlides();
    buildNav();
    pintar();
    precargar();
  }

  // pinta la portada de inmediato (con valores por defecto) para no esperar
  // a que Firestore responda; luego se actualiza al llegar los datos.
  slides = [{ type: 'cover' }];
  idx = 0;
  pintar();

  // ---------- datos en vivo ----------
  kvDb.collection('catalog').doc('products').collection('items').orderBy('order').onSnapshot((snap) => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rebuild();
  }, (err) => console.error('Error leyendo el catálogo:', err));

  kvDb.collection('catalog').doc('settings').onSnapshot((doc) => {
    settings = doc.data() || {};
    rebuild();
  }, (err) => console.error('Error leyendo la configuración:', err));
})();
