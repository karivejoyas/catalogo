(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const page = $('fb-page');
  const counter = $('fb-counter');
  const nav = $('fb-nav');

  let products = [];
  let settings = {};
  let slides = [];
  let idx = 0;

  // ---------- construir las páginas del flipbook ----------
  function buildSlides() {
    slides = [{ type: 'cover' }, { type: 'info' }];
    KV_CATEGORIAS.forEach(catBase => {
      const cat = kvCat(catBase.id, settings);
      const items = products.filter(p => p.category === catBase.id);
      if (items.length === 0) return;
      slides.push({ type: 'hero', cat });
      for (let i = 0; i < items.length; i += 4) {
        slides.push({ type: 'products', cat, items: items.slice(i, i + 4), pageNum: Math.floor(i / 4) + 1, pageTotal: Math.ceil(items.length / 4) });
      }
    });
    if (idx > slides.length - 1) idx = slides.length - 1;
    if (idx < 0) idx = 0;
  }

  function contacto() {
    return {
      ig: settings.instagram || '@karive.joyas',
      wa: settings.whatsapp || '+56 9 XXXX XXXX'
    };
  }

  // ---------- render de cada tipo de página ----------
  function renderSlide(s) {
    if (s.type === 'cover') {
      const cover = Object.assign({}, KV_COVER_DEFAULT, settings.cover || {});
      const c = contacto();
      return (
        '<div class="fb-cover" style="background-image:url(\'' + cover.image + '\');">' +
          '<div class="fb-cover-velo"></div>' +
          '<div class="fb-cover-inner">' +
            '<div class="fb-logo-circulo"><img src="assets/logo-karive-crop.png" alt="Karivé Joyas" /></div>' +
            '<h1 class="fb-titulo">Catálogo</h1>' +
            '<div class="fb-sub">· De productos ·</div>' +
            '<div class="fb-corazon">♥</div>' +
            '<p class="fb-tagline">' + escapeHtml(cover.tagline) + '</p>' +
            '<p class="fb-siguenos">Síguenos en <span class="cat-dorado">♥</span> ' + escapeHtml(c.ig) + '</p>' +
          '</div>' +
        '</div>'
      );
    }
    if (s.type === 'info') {
      const info = Object.assign({}, KV_INFO_DEFAULT, settings.info || {});
      const c = contacto();
      const bullets = [info.b1, info.b2, info.b3, info.b4].filter(Boolean)
        .map(b => '<li>' + escapeHtml(b) + '</li>').join('');
      return (
        '<div class="fb-info">' +
          '<div class="fb-info-divisor"><span></span>✦<span></span></div>' +
          '<h2 class="fb-info-titulo">' + escapeHtml(info.titulo) + '</h2>' +
          '<ul class="fb-info-lista">' + bullets + '</ul>' +
          '<div class="fb-info-contacto"><span>♥ ' + escapeHtml(c.ig) + '</span><span>✆ ' + escapeHtml(c.wa) + '</span></div>' +
          '<div class="fb-corazon">♥</div>' +
        '</div>'
      );
    }
    if (s.type === 'hero') {
      return (
        '<div class="fb-hero" style="background-image:url(\'' + s.cat.imagen + '\');">' +
          '<div class="fb-hero-velo"></div>' +
          '<div class="fb-hero-inner">' +
            '<div class="fb-hero-linea"></div>' +
            '<h2 class="fb-hero-titulo">' + escapeHtml(s.cat.nombre) + '</h2>' +
            '<p class="fb-hero-sub">' + escapeHtml(s.cat.sub || '') + '</p>' +
          '</div>' +
        '</div>'
      );
    }
    // products
    const cards = s.items.map(kvCardHtml).join('');
    const paginacion = s.pageTotal > 1 ? '<span class="fb-prod-pag">' + s.pageNum + ' / ' + s.pageTotal + '</span>' : '';
    return (
      '<div class="fb-prod">' +
        '<div class="fb-prod-head"><span class="fb-prod-eyebrow">Colección</span><h2 class="fb-prod-titulo">' + escapeHtml(s.cat.nombre) + '</h2>' + paginacion + '</div>' +
        '<div class="fb-grid">' + cards + '</div>' +
      '</div>'
    );
  }

  function render() {
    if (slides.length === 0) return;
    page.classList.remove('fb-anim');
    void page.offsetWidth;
    page.innerHTML = renderSlide(slides[idx]);
    page.classList.add('fb-anim');
    counter.textContent = (idx + 1) + ' / ' + slides.length;
    // nav activo
    const cur = slides[idx];
    const curCat = cur && cur.cat ? cur.cat.id : null;
    nav.querySelectorAll('a').forEach(a => a.classList.toggle('is-active', a.dataset.cat === curCat));
  }

  function go(n) {
    idx = Math.max(0, Math.min(slides.length - 1, n));
    render();
    window.scrollTo(0, 0);
  }

  // ---------- navegación por categorías ----------
  function buildNav() {
    let html = '';
    KV_CATEGORIAS.forEach(catBase => {
      if (products.filter(p => p.category === catBase.id).length === 0) return;
      const cat = kvCat(catBase.id, settings);
      html += '<a href="#" data-cat="' + catBase.id + '">' + escapeHtml(cat.nombre) + '</a>';
    });
    nav.innerHTML = html;
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const i = slides.findIndex(s => s.type === 'hero' && s.cat.id === a.dataset.cat);
      if (i >= 0) go(i);
    }));
  }

  // ---------- eventos de navegación ----------
  $('fb-prev').addEventListener('click', () => go(idx - 1));
  $('fb-next').addEventListener('click', () => go(idx + 1));
  $('fb-prev2').addEventListener('click', () => go(idx - 1));
  $('fb-next2').addEventListener('click', () => go(idx + 1));
  $('fb-logo').addEventListener('click', (e) => { e.preventDefault(); go(0); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(idx - 1);
    else if (e.key === 'ArrowRight') go(idx + 1);
  });

  // swipe en móvil
  let tx = 0, ty = 0;
  const stage = document.querySelector('.fb-stage');
  stage.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) go(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });

  function rebuild() {
    kvApplyTheme(Object.assign({}, KV_THEME_DEFAULT, settings.theme || {}));
    buildSlides();
    buildNav();
    render();
  }

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
