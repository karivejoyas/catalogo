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
    const visibles = products.filter(kvEnStock);
    cats.forEach(cat => pushCategoria(cat, visibles.filter(p => p.category === cat.id)));
    // productos cuya colección fue eliminada: se muestran en "Otros"
    const huerfanos = visibles.filter(p => !cats.some(c => c.id === p.category));
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
      const fi = kvFondoInfo(settings);
      return (
        '<div class="fb-info" style="' + fi.base + '">' +
          (fi.imgUrl ? '<div class="fb-txt-bg" style="background-image:url(\'' + fi.imgUrl + '\');opacity:' + fi.imgOp + ';"></div>' : '') +
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
      const fih = kvFondoInfo(settings);
      return (
        '<div class="fb-howto" style="' + fih.base + '">' +
          (fih.imgUrl ? '<div class="fb-txt-bg" style="background-image:url(\'' + fih.imgUrl + '\');opacity:' + fih.imgOp + ';"></div>' : '') +
          '<div class="fb-info-divisor"><span></span>✦<span></span></div>' +
          '<h2 class="fb-info-titulo">' + escapeHtml(h.titulo) + '</h2>' +
          '<div class="fb-pasos">' + pasos + '</div>' +
          kvContactoRow(settings) +
        '</div>'
      );
    }
    if (s.type === 'bye') {
      const d = Object.assign({}, KV_DESPEDIDA_DEFAULT, settings.despedida || {});
      const fib = kvFondoInfo(settings);
      return (
        '<div class="fb-bye" style="' + fib.base + '">' +
          (fib.imgUrl ? '<div class="fb-txt-bg" style="background-image:url(\'' + fib.imgUrl + '\');opacity:' + fib.imgOp + ';"></div>' : '') +
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
    const foto = $('fb-lb-foto');
    foto.innerHTML = kvFotoInner(p);
    foto.classList.toggle('sin-foto', !p.photo);
    $('fb-lb-codigo').textContent = p.code || '';
    $('fb-lb-nombre').textContent = p.name || '';
    $('fb-lb-detalle').textContent = p.detail || '';
    $('fb-lb-detalle').style.display = p.detail ? '' : 'none';
    const of = kvPrecioOferta(p);
    $('fb-lb-precio').innerHTML = of
      ? '<span class="fb-lb-precio-old">' + formatCLP(p.price) + '</span>' +
        '<span class="fb-lb-precio-of">' + formatCLP(of) + '</span>' +
        '<span class="fb-lb-oferta-pill">Oferta</span>'
      : formatCLP(p.price);
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
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;  // escribiendo (ej: chat)
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

  // ==========================================================
  //  Asistente del catálogo para clientas: responde con los
  //  datos REALES del catálogo (sin IA externa: gratis e ilimitado)
  // ==========================================================
  function chNorm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function chPrecio(p) { return kvPrecioOferta(p) || p.price || 0; }
  function chNombreCat(id) { return (kvCat(id, settings) || {}).nombre || 'Otros'; }
  function chItem(p) {
    const of = kvPrecioOferta(p);
    return '• <b>' + escapeHtml(p.name || '') + '</b> — ' + formatCLP(chPrecio(p)) +
      (of ? ' <i>(¡en oferta! antes ' + formatCLP(p.price) + ')</i>' : '') +
      ' · ' + escapeHtml(chNombreCat(p.category)) + (p.code ? ' · cód. ' + escapeHtml(p.code) : '');
  }
  function chContacto() {
    const cs = kvContactos(settings);
    if (!cs.length) return '';
    return cs.map(c => '<a href="' + c.url + '" target="_blank" rel="noopener">' + escapeHtml(c.texto) + '</a>').join(' · ');
  }
  function chPedidos() {
    return 'Para encargar, escríbenos por DM 💌 (' + chContacto() + '). Hacemos envíos a todo Chile 🚚 — no tenemos retiros.';
  }
  // entiende "5 mil", "5.000", "$5000", "5 lucas"
  function chPresupuesto(t) {
    let m = t.match(/(\d+)\s*(mil|lucas?)/);
    if (m) return parseInt(m[1], 10) * 1000;
    m = t.replace(/(\d)\.(?=\d{3}\b)/g, '$1').match(/\$?\s*(\d{3,7})/);
    if (m) return parseInt(m[1], 10);
    return null;
  }
  function chResponder(pregunta) {
    const t = chNorm(pregunta);
    const visibles = products.filter(kvEnStock);
    if (!visibles.length) return 'Estamos renovando el catálogo ✨ ' + chPedidos();
    const cats = kvCategorias(settings);

    // presupuesto: "ando buscando algo de aprox 5 mil pesos"
    const plata = chPresupuesto(t);
    if (plata && plata >= 500) {
      const dentro = visibles.filter(p => chPrecio(p) <= plata * 1.15).sort((a, b) => chPrecio(b) - chPrecio(a)).slice(0, 6);
      if (dentro.length) {
        return 'Con ' + formatCLP(plata) + ' tienes estas opciones lindas 💜<br><br>' + dentro.map(chItem).join('<br>') +
          '<br><br>' + chPedidos();
      }
      const baratos = visibles.sort((a, b) => chPrecio(a) - chPrecio(b)).slice(0, 3);
      return 'Por ahora nuestras joyitas parten un poquito más arriba de ' + formatCLP(plata) + '. Las más accesibles son:<br><br>' +
        baratos.map(chItem).join('<br>') + '<br><br>' + chPedidos();
    }

    // ¿qué venden? / tipos de joyas
    if (/(que (tipo|clase|estilo)|que vendes|que venden|que tienes|que tienen|hablame|cuentame|catalogo|coleccion|tipos de joya|que joyas|que productos|que ofrecen)/.test(t)) {
      const resumen = cats.map(cat => {
        const items = visibles.filter(p => p.category === cat.id);
        if (!items.length) return null;
        const precios = items.map(chPrecio);
        return '• <b>' + escapeHtml(cat.nombre) + '</b>: ' + items.length + ' modelos, desde ' + formatCLP(Math.min.apply(null, precios)) + ' hasta ' + formatCLP(Math.max.apply(null, precios));
      }).filter(Boolean).join('<br>');
      return 'Somos <b>Karivé Joyas</b> 💜 — joyas artesanales hechas a mano con arcilla polimérica, miyuki y mostacillas. Nuestras colecciones:<br><br>' + resumen +
        '<br><br>Puedes verlas todas pasando las páginas de este catálogo ✨ ' + chPedidos();
    }

    // ofertas
    if (/(oferta|descuento|rebaja|promo)/.test(t)) {
      const ofs = visibles.filter(p => kvPrecioOferta(p));
      return ofs.length
        ? '¡Sí! Estas joyitas están en oferta 🎉<br><br>' + ofs.slice(0, 6).map(chItem).join('<br>') + '<br><br>' + chPedidos()
        : 'Por ahora no tenemos ofertas activas, pero síguenos en redes (' + chContacto() + ') para enterarte primero 💜';
    }

    // más barato / más caro
    if (/(mas barat|mas economic|menor precio|mas accesible)/.test(t)) {
      const b = visibles.slice().sort((a, b2) => chPrecio(a) - chPrecio(b2)).slice(0, 3);
      return 'Las más accesibles del catálogo 💜<br><br>' + b.map(chItem).join('<br>') + '<br><br>' + chPedidos();
    }
    if (/(mas car|mayor precio|premium)/.test(t)) {
      const c = visibles.slice().sort((a, b2) => chPrecio(b2) - chPrecio(a)).slice(0, 3);
      return 'Nuestras piezas más especiales ✨<br><br>' + c.map(chItem).join('<br>') + '<br><br>' + chPedidos();
    }

    // envíos / cómo comprar
    if (/(envio|enviu|despacho|retiro|region|entrega|llega|demora)/.test(t)) {
      return 'Hacemos <b>envíos a todo Chile</b> 🚚 (por ahora no tenemos retiros). Nos escribes por DM, coordinamos el pago y te lo enviamos donde estés 💜<br><br>' + chContacto();
    }
    if (/(comprar|compro|pedido|pedir|encargar|pagar|pago|transferencia|reservar)/.test(t)) {
      return 'Comprar es facilito 💜<br><br>1️⃣ Elige tus joyas favoritas del catálogo (anota el código).<br>2️⃣ Escríbenos por DM: ' + chContacto() + '<br>3️⃣ Coordinamos pago por transferencia y el envío a todo Chile 🚚';
    }

    // cuidados
    if (/(cuid|limpi|moja|al agua|con agua|perfume|crema|fragil|frajil|se echa a perder|duran?\b)/.test(t)) {
      return 'Para que tu joyita Karivé te dure muchísimo 💜<br><br>• Guárdala en un lugar seco.<br>• Evita el contacto con agua, perfumes y cremas.<br>• Límpiala suavecito con un paño seco.<br>• Al ser hecha a mano, trátala con cariño ✨';
    }

    // búsqueda por colección o nombre de producto
    const coincide = [];
    cats.forEach(cat => { if (t.indexOf(chNorm(cat.nombre)) >= 0) visibles.filter(p => p.category === cat.id).forEach(p => coincide.push(p)); });
    if (!coincide.length) {
      const palabras = t.split(/[^a-z0-9ñ]+/).filter(w => w.length >= 4);
      visibles.forEach(p => { const n = chNorm(p.name); if (palabras.some(w => n.indexOf(w) >= 0)) coincide.push(p); });
    }
    if (coincide.length) {
      return '¡Tenemos esto que te puede encantar! 💜<br><br>' + coincide.slice(0, 6).map(chItem).join('<br>') + '<br><br>' + chPedidos();
    }

    // saludo
    if (/(^| )(hola|buenas|buenos dias|buenas tardes|alo)/.test(t)) {
      return '¡Hola! 💜 Soy la asistente de Karivé Joyas. Puedo contarte qué joyas tenemos, precios, ofertas, envíos y cuidados. Por ejemplo, pregúntame: <i>«busco algo de 5 mil pesos»</i> o <i>«¿qué tipos de joyas venden?»</i>';
    }

    return 'Te puedo ayudar con: nuestros <b>tipos de joyas</b>, <b>precios</b> (dime tu presupuesto, ej: «algo de 5 mil»), <b>ofertas</b>, <b>envíos</b> y <b>cuidados</b> ✨ Y para cualquier otra cosa, escríbenos por DM 💌 ' + chContacto();
  }

  // ---------- interfaz del chat ----------
  (function montarAsistente() {
    const btn = document.createElement('button');
    btn.className = 'kv-chat-btn';
    btn.id = 'kv-chat-btn';
    btn.innerHTML = '💬';
    btn.title = '¿Buscas algo? ¡Pregúntame!';
    btn.setAttribute('aria-label', 'Abrir asistente');
    const panel = document.createElement('div');
    panel.className = 'kv-chat';
    panel.id = 'kv-chat';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="kv-chat-top"><span>Asistente Karivé 💜</span><button class="kv-chat-x" id="kv-chat-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="kv-chat-msgs" id="kv-chat-msgs">' +
        '<div class="kv-chat-m kv-chat-bot">¡Hola! 💜 Pregúntame por nuestras joyas: <i>«¿qué tipos de joyas venden?»</i>, <i>«busco algo de 5 mil pesos»</i>, <i>«¿hacen envíos?»</i>…</div>' +
      '</div>' +
      '<div class="kv-chat-fila"><input id="kv-chat-in" type="text" placeholder="Escribe tu pregunta…" autocomplete="off" /><button id="kv-chat-send" aria-label="Enviar">➤</button></div>';
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    const msgs = panel.querySelector('#kv-chat-msgs');
    const input = panel.querySelector('#kv-chat-in');
    function agregar(html, cls) {
      const d = document.createElement('div');
      d.className = 'kv-chat-m ' + cls;
      d.innerHTML = html;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
    }
    function enviar() {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      agregar(escapeHtml(q), 'kv-chat-user');
      setTimeout(() => agregar(chResponder(q), 'kv-chat-bot'), 250);
    }
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) input.focus(); });
    panel.querySelector('#kv-chat-x').addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('#kv-chat-send').addEventListener('click', enviar);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  })();

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
