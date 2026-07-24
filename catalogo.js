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
    // portada, info y "¿cómo comprar?" van primero (páginas 1, 2 y 3), antes de las colecciones
    slides = [{ type: 'cover' }, { type: 'info' }, { type: 'howto' }];
    const cats = kvCategorias(settings);
    const visibles = products.filter(kvEnStock);
    cats.forEach(cat => pushCategoria(cat, visibles.filter(p => p.category === cat.id)));
    // productos cuya colección fue eliminada: se muestran en "Otros"
    const huerfanos = visibles.filter(p => !cats.some(c => c.id === p.category));
    if (huerfanos.length) {
      pushCategoria({ id: '__otros__', nombre: 'Otros', sub: 'Otros accesorios de la colección', imagen: huerfanos[0].photo || cats[0] && cats[0].imagen || '' }, huerfanos);
    }
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
    nivelarTarjetas();
  }

  /* iguala las barras moradas de la página a la más alta real (barra mínima y pareja) */
  function nivelarTarjetas() {
    const ets = page.querySelectorAll('.fb-grid .cat-card-etiqueta');
    if (!ets.length) return;
    const aplicar = () => {
      let max = 0;
      ets.forEach(e => { e.style.minHeight = ''; max = Math.max(max, e.getBoundingClientRect().height); });
      const m = Math.ceil(max);
      ets.forEach(e => { e.style.minHeight = m + 'px'; });
      // le avisa a la foto cuánto mide la etiqueta, para que ocupe justo el espacio de arriba
      page.querySelectorAll('.fb-grid .cat-card').forEach(c => c.style.setProperty('--kv-etiq', m + 'px'));
    };
    aplicar();
    requestAnimationFrame(aplicar);      // por si el texto se reacomodó al pintar
    setTimeout(aplicar, 380);            // y tras la transición de entrada de la página
  }
  let nivelarPend;
  window.addEventListener('resize', () => { clearTimeout(nivelarPend); nivelarPend = setTimeout(nivelarTarjetas, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => nivelarTarjetas());

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
  let lbProd = null;   // producto mostrado (para "Agregar al carrito")
  function abrirLightbox(p) {
    if (!p) return;
    lbProd = p;
    const foto = $('fb-lb-foto');
    // la foto se muestra completa y el recuadro se adapta a la proporción REAL
    // de la imagen, así no quedan bordes/barras alrededor
    foto.innerHTML = p.photo ? '<div class="kv-fbg" style="background-image:url(\'' + p.photo + '\')"></div>' : '';
    foto.style.aspectRatio = '1 / 1';
    if (p.photo) {
      const im = new Image();
      im.onload = () => {
        if (lbProd !== p || !im.naturalWidth) return;
        const r = im.naturalWidth / im.naturalHeight;
        foto.style.aspectRatio = Math.max(0.7, Math.min(1.4, r)).toFixed(4);  // acotado para que el recuadro no quede exagerado
      };
      im.src = p.photo;
    }
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

  // click / teclado sobre una tarjeta -> agregar al carrito o abrir lightbox
  page.addEventListener('click', (e) => {
    const add = e.target.closest('[data-role="cart-add"]');
    if (add) { e.stopPropagation(); carroAgregar(add.dataset.id); return; }
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

  // ============================================================
  //  CARRITO DE COMPRAS
  // ============================================================
  const CARRO_KEY = 'kv_carrito';
  let carro = {};
  try { carro = JSON.parse(localStorage.getItem(CARRO_KEY) || '{}') || {}; } catch (e) { carro = {}; }
  let carroVista = 'carro';          // 'carro' | 'checkout' | 'ok'
  let carroComprobante = null;       // dataURL del comprobante adjunto
  let carroPedidoOk = null;          // {num, total} tras enviar
  let carroEnviando = false;
  const carroForm = { nombre: '', correo: '', telefono: '', direccion: '', comuna: '', region: '', notas: '' };

  function carroGuardar() {
    try { localStorage.setItem(CARRO_KEY, JSON.stringify(carro)); } catch (e) {}
    carroBadge();
  }
  function carroCantidad() { return Object.values(carro).reduce((a, b) => a + (b || 0), 0); }
  function carroItems() {
    // solo productos que siguen existiendo y con stock
    return Object.keys(carro).map(id => {
      const p = products.find(x => x.id === id && kvEnStock(x));
      return p ? { p: p, qty: carro[id] } : null;
    }).filter(Boolean);
  }
  function carroSubtotal() { return carroItems().reduce((s, it) => s + (kvPrecioOferta(it.p) || it.p.price || 0) * it.qty, 0); }
  function carroBadge() {
    const el = $('kv-cart-count'); if (!el) return;
    const n = carroCantidad();
    el.textContent = n > 99 ? '99+' : n;
    el.hidden = n === 0;
  }
  function carroAgregar(id, n) {
    const p = products.find(x => x.id === id && kvEnStock(x));
    if (!p) return;
    carro[id] = (carro[id] || 0) + (n || 1);
    carroGuardar();
    carroToast('✓ ' + (p.name || 'Producto') + ' agregado al carrito');
    if (!carritoEl.hidden) carroRender();
  }
  let toastTimer = null;
  function carroToast(txt) {
    let t = $('kv-toast');
    if (!t) { t = document.createElement('div'); t.id = 'kv-toast'; t.className = 'kv-toast'; document.body.appendChild(t); }
    t.textContent = txt;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 2200);
  }

  // ---- panel del carrito ----
  const carritoEl = document.createElement('div');
  carritoEl.className = 'kv-cart';
  carritoEl.id = 'kv-cart';
  carritoEl.hidden = true;
  document.body.appendChild(carritoEl);

  function carroAbrir() { carritoEl.hidden = false; carroVista = carroPedidoOk ? 'ok' : 'carro'; carroRender(); carroAjustarVisor(); }
  function carroCerrar() { carritoEl.hidden = true; carritoEl.style.transform = ''; }
  $('kv-cart-btn').addEventListener('click', () => { if (carritoEl.hidden) carroAbrir(); else carroCerrar(); });
  $('fb-lb-cart').addEventListener('click', () => { if (lbProd) { carroAgregar(lbProd.id); cerrarLightbox(); } });

  // como el chat: en celular ocupa el área visible real (se acomoda al teclado)
  function carroAjustarVisor() {
    if (carritoEl.hidden) return;
    if (window.innerWidth > 640) { carritoEl.style.transform = ''; return; }
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty('--kv-vvh', vv.height + 'px');
    carritoEl.style.transform = 'translateY(' + vv.offsetTop + 'px)';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', carroAjustarVisor);
    window.visualViewport.addEventListener('scroll', carroAjustarVisor);
  }

  function carroMiniFoto(p) {
    return p.photo ? '<div class="kv-cart-mini" style="background-image:url(\'' + p.photo + '\')"></div>' : '<div class="kv-cart-mini sin">✦</div>';
  }

  function carroRender() {
    const items = carroItems();
    let html = '<div class="kv-cart-top"><span>' +
      (carroVista === 'checkout' ? '📋 Finalizar compra' : carroVista === 'ok' ? '💜 ¡Pedido recibido!' : '🛒 Tu carrito') +
      '</span><button class="kv-cart-x" data-role="cart-close" aria-label="Cerrar">✕</button></div>';

    if (carroVista === 'ok' && carroPedidoOk) {
      html += carroHtmlOk();
    } else if (carroVista === 'checkout') {
      html += carroHtmlCheckout(items);
    } else {
      html += carroHtmlLista(items);
    }
    carritoEl.innerHTML = html;
    carroConectar();
  }

  function carroHtmlLista(items) {
    if (!items.length) {
      return '<div class="kv-cart-vacio">Tu carrito está vacío 🛒<br><span>Toca el botón 🛒 de cualquier joya para agregarla.</span></div>' +
        '<div class="kv-cart-pie"><button class="kv-cart-btn2 sec" data-role="cart-close">Seguir mirando</button></div>';
    }
    let h = '<div class="kv-cart-lista">';
    items.forEach(it => {
      const precio = kvPrecioOferta(it.p) || it.p.price || 0;
      h += '<div class="kv-cart-item">' + carroMiniFoto(it.p) +
        '<div class="kv-cart-item-info"><b>' + escapeHtml(it.p.name) + '</b><span>' + escapeHtml(it.p.code || '') + ' · ' + formatCLP(precio) + '</span></div>' +
        '<div class="kv-cart-qty">' +
          '<button data-role="qty" data-id="' + it.p.id + '" data-d="-1" aria-label="Quitar uno">−</button>' +
          '<span>' + it.qty + '</span>' +
          '<button data-role="qty" data-id="' + it.p.id + '" data-d="1" aria-label="Agregar uno">+</button>' +
        '</div></div>';
    });
    h += '</div>';
    h += '<div class="kv-cart-pie">' +
      '<div class="kv-cart-tot"><span>Subtotal</span><b>' + formatCLP(carroSubtotal()) + '</b></div>' +
      '<div class="kv-cart-envio-nota">+ envío: $2.990 RM · $3.990 resto de Chile</div>' +
      '<button class="kv-cart-btn2" data-role="cart-checkout">Continuar con la compra →</button>' +
      '<button class="kv-cart-btn2 sec" data-role="cart-close">Seguir mirando</button>' +
      '</div>';
    return h;
  }

  function carroHtmlCheckout(items) {
    const sub = carroSubtotal();
    const envio = carroForm.region ? kvEnvioCosto(carroForm.region) : null;
    const total = sub + (envio || 0);
    const t = kvTransferencia(settings);
    const f = carroForm;
    const inp = (campo, ph, tipo, extra) =>
      '<input class="kv-cart-inp" data-campo="' + campo + '" type="' + (tipo || 'text') + '" placeholder="' + ph + '" value="' + escapeHtml(f[campo] || '') + '"' + (extra || '') + ' />';
    let h = '<div class="kv-cart-scroll">';
    h += '<div class="kv-cart-sec-tit">Tus datos</div>' +
      inp('nombre', 'Nombre y apellido *') +
      inp('correo', 'Correo electrónico *', 'email') +
      inp('telefono', 'Teléfono (ej: +56 9 1234 5678) *', 'tel') +
      '<div class="kv-cart-sec-tit">Envío</div>' +
      inp('direccion', 'Dirección (calle y número, depto…) *') +
      inp('comuna', 'Comuna *') +
      '<div class="kv-cart-selwrap"><select class="kv-cart-inp kv-cart-sel' + (f.region ? '' : ' vacio') + '" data-campo="region">' +
        '<option value="" disabled' + (f.region ? '' : ' selected') + '>Región *</option>' +
        KV_REGIONES.map(r => '<option value="' + r + '"' + (f.region === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select><span class="kv-cart-selflecha">▾</span></div>' +
      inp('notas', 'Nota para tu pedido (opcional)');
    // resumen
    h += '<div class="kv-cart-sec-tit">Resumen</div><div class="kv-cart-resumen">';
    items.forEach(it => {
      const precio = kvPrecioOferta(it.p) || it.p.price || 0;
      h += '<div><span>' + it.qty + '× ' + escapeHtml(it.p.name) + '</span><span>' + formatCLP(precio * it.qty) + '</span></div>';
    });
    h += '<div><span>Envío' + (f.region ? ' (' + escapeHtml(f.region === KV_REGION_RM ? 'RM' : f.region) + ')' : '') + '</span><span>' + (envio != null ? formatCLP(envio) : 'elige región') + '</span></div>';
    h += '<div class="kv-cart-resumen-tot"><span>Total a transferir</span><span>' + formatCLP(total) + '</span></div></div>';
    // transferencia
    h += '<div class="kv-cart-sec-tit">Transfiere a</div><div class="kv-cart-transf">';
    if (kvTransferenciaLista(settings)) {
      h += '<div><b>' + escapeHtml(t.titular) + '</b></div>' +
        (t.rut ? '<div>RUT: ' + escapeHtml(t.rut) + '</div>' : '') +
        '<div>' + escapeHtml(t.banco) + (t.tipo ? ' · ' + escapeHtml(t.tipo) : '') + '</div>' +
        '<div>N° de cuenta: <b>' + escapeHtml(t.numero) + '</b></div>' +
        (t.correo ? '<div>' + escapeHtml(t.correo) + '</div>' : '') +
        '<button type="button" class="kv-cart-copiartodo" data-role="copiar-transf">📋 Copiar todos los datos</button>';
    } else {
      h += '<div>Escríbenos por WhatsApp o DM y te damos los datos de transferencia 💜</div>';
    }
    h += '</div>';
    // comprobante
    h += '<div class="kv-cart-sec-tit">Comprobante de transferencia *</div>' +
      '<label class="kv-cart-file' + (carroComprobante ? ' listo' : '') + '">' +
        (carroComprobante ? '✓ Comprobante adjunto — tocar para cambiar' : '📎 Adjuntar foto o captura del comprobante') +
        '<input type="file" accept="image/*" id="kv-cart-comp" style="display:none;" />' +
      '</label>' +
      (carroComprobante ? '<div class="kv-cart-comp-mini" style="background-image:url(\'' + carroComprobante + '\')"></div>' : '');
    h += '<div class="kv-cart-error" id="kv-cart-error" hidden></div>';
    h += '</div>';   // fin scroll
    h += '<div class="kv-cart-pie">' +
      '<button class="kv-cart-btn2" data-role="cart-enviar"' + (carroEnviando ? ' disabled' : '') + '>' + (carroEnviando ? 'Enviando pedido…' : '✨ Enviar pedido') + '</button>' +
      '<button class="kv-cart-btn2 sec" data-role="cart-volver">← Volver al carrito</button>' +
      '</div>';
    return h;
  }

  function carroHtmlOk() {
    const ok = carroPedidoOk;
    const waNum = carroWhatsappNum();
    return '<div class="kv-cart-ok">' +
      '<div class="kv-cart-ok-num">Pedido #' + ok.num + '</div>' +
      '<p>¡Gracias por tu compra! 💜<br>Te enviamos un correo de confirmación.<br>Cuando verifiquemos tu pago, prepararemos tu pedido y te avisaremos cuando vaya en camino.</p>' +
      (waNum ? '<a class="kv-cart-btn2 wa" target="_blank" rel="noopener" href="' + carroWhatsappLink(ok) + '">Enviar mi pedido también por WhatsApp</a>' : '') +
      '<button class="kv-cart-btn2 sec" data-role="cart-fin">Listo</button>' +
      '</div>';
  }

  function carroWhatsappNum() {
    const c = kvContactos(settings).find(x => x.tipo === 'whatsapp');
    if (!c || !c.url) return null;
    const m = String(c.url).match(/(\d{8,15})/);
    return m ? m[1] : null;
  }
  function carroWhatsappLink(ok) {
    const num = carroWhatsappNum();
    const txt = 'Hola Karivé 💜 Soy ' + carroForm.nombre + ', acabo de hacer el pedido #' + ok.num + ' por ' + formatCLP(ok.total) + ' en el catálogo. ¡Quedo atenta!';
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(txt);
  }

  function carroConectar() {
    carritoEl.querySelectorAll('[data-role="cart-close"]').forEach(n => n.addEventListener('click', carroCerrar));
    carritoEl.querySelectorAll('[data-role="qty"]').forEach(n => n.addEventListener('click', () => {
      const id = n.dataset.id, d = parseInt(n.dataset.d, 10);
      carro[id] = (carro[id] || 0) + d;
      if (carro[id] <= 0) delete carro[id];
      carroGuardar(); carroRender();
    }));
    const chk = carritoEl.querySelector('[data-role="cart-checkout"]');
    if (chk) chk.addEventListener('click', () => { carroVista = 'checkout'; carroRender(); });
    const vol = carritoEl.querySelector('[data-role="cart-volver"]');
    if (vol) vol.addEventListener('click', () => { carroVista = 'carro'; carroRender(); });
    const fin = carritoEl.querySelector('[data-role="cart-fin"]');
    if (fin) fin.addEventListener('click', () => { carroPedidoOk = null; carroCerrar(); });
    carritoEl.querySelectorAll('.kv-cart-inp').forEach(n => {
      const ev = n.tagName === 'SELECT' ? 'change' : 'input';
      n.addEventListener(ev, () => {
        carroForm[n.dataset.campo] = n.value;
        if (n.dataset.campo === 'region') carroRender();   // recalcula el envío
      });
    });
    const cpt = carritoEl.querySelector('[data-role="copiar-transf"]');
    if (cpt) cpt.addEventListener('click', () => {
      // todos los datos juntos: las apps de los bancos los reconocen y rellenan solos
      const t = kvTransferencia(settings);
      const txt = [t.titular, t.rut ? 'RUT: ' + t.rut : '', t.banco, t.tipo, t.numero, t.correo].filter(Boolean).join('\n');
      try { navigator.clipboard.writeText(txt); cpt.textContent = '✓ Datos copiados — pégalos en tu banco'; } catch (e) {}
    });
    const comp = carritoEl.querySelector('#kv-cart-comp');
    if (comp) comp.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, data => { carroComprobante = data; carroRender(); }, 1100, 0.8);
    });
    const env = carritoEl.querySelector('[data-role="cart-enviar"]');
    if (env) env.addEventListener('click', carroEnviarPedido);
  }

  function carroError(msg) {
    const el = carritoEl.querySelector('#kv-cart-error');
    if (el) { el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); }
  }

  async function carroEnviarPedido() {
    if (carroEnviando) return;
    const items = carroItems();
    const f = carroForm;
    if (!items.length) { carroError('Tu carrito quedó vacío.'); return; }
    if (!f.nombre.trim()) { carroError('Escribe tu nombre.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo.trim())) { carroError('Revisa tu correo electrónico.'); return; }
    if (!f.telefono.trim()) { carroError('Escribe tu teléfono.'); return; }
    if (!f.direccion.trim() || !f.comuna.trim()) { carroError('Completa tu dirección y comuna.'); return; }
    if (!f.region) { carroError('Elige tu región para calcular el envío.'); return; }
    if (!carroComprobante) { carroError('Adjunta el comprobante de tu transferencia para confirmar el pedido.'); return; }
    const url = String(settings.igPubUrl || '').trim();
    if (!url) { carroError('La tienda aún no puede recibir pedidos en línea. Escríbenos por WhatsApp 💜'); return; }

    const envio = kvEnvioCosto(f.region);
    const pedido = {
      cliente: { nombre: f.nombre.trim(), correo: f.correo.trim(), telefono: f.telefono.trim() },
      direccion: { calle: f.direccion.trim(), comuna: f.comuna.trim(), region: f.region },
      items: items.map(it => ({ id: it.p.id, code: it.p.code || '', name: it.p.name || '', precio: kvPrecioOferta(it.p) || it.p.price || 0, qty: it.qty })),
      subtotal: carroSubtotal(),
      envio: { region: f.region, costo: envio },
      total: carroSubtotal() + envio,
      notas: f.notas.trim()
    };
    carroEnviando = true; carroRender();
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'pedido', pedido: pedido, comprobante: (carroComprobante.split(',')[1] || '') })
      });
      const d = await r.json();
      if (!d || !d.ok || !d.num) throw new Error((d && d.error) || 'No se pudo registrar el pedido');
      // registrar en la base para el panel de admin (si las reglas lo permiten)
      try {
        await kvDb.collection('catalog').doc('pedidos').collection('items').add(Object.assign({}, pedido, {
          num: d.num, estado: 'nuevo', fecha: new Date().toISOString(), comprobante: carroComprobante,
          courier: '', tracking: '', trackingUrl: ''
        }));
      } catch (e2) { console.warn('Pedido enviado por correo; no se pudo registrar en la base:', e2); }
      carroPedidoOk = { num: d.num, total: pedido.total };
      carro = {}; carroComprobante = null; carroGuardar();
      carroVista = 'ok'; carroEnviando = false; carroRender();
    } catch (err) {
      carroEnviando = false; carroRender();
      carroError('No pudimos enviar tu pedido (' + err.message + '). Revisa tu conexión e intenta de nuevo, o escríbenos por WhatsApp 💜');
    }
  }
  carroBadge();

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

  let waActualizar = null;
  function rebuild() {
    kvSetDescuento(settings);
    kvApplyTheme(Object.assign({}, KV_THEME_DEFAULT, settings.theme || {}));
    buildSlides();
    buildNav();
    pintar();
    precargar();
    if (waActualizar) waActualizar();
    carroBadge();
    if (!carritoEl.hidden) carroRender();   // refresca precios/stock si cambia el catálogo
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

    // contacto / redes / teléfono
    if (/(instagram|facebook|face\b|whatsapp|wsp|wasap|telefono|fono|numero|celular|contact|redes|escribir)/.test(t)) {
      return 'Puedes encontrarnos y escribirnos aquí 💜<br><br>' + chContacto() + '<br><br>Los pedidos se coordinan por DM y hacemos envíos a todo Chile 🚚';
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

    // saludo (solo si el mensaje es corto y no traía otra pregunta)
    if (t.length < 30 && /(^| )(hola|buenas|buenos dias|buenas tardes|alo|hey)/.test(t)) {
      return '¡Hola! Bienvenida a Karivé Joyas 💜 Cuéntame qué andas buscando: ¿unos aros para un regalo, algo dentro de un presupuesto, o quieres conocer nuestras colecciones?';
    }

    return 'Te puedo ayudar con: nuestros <b>tipos de joyas</b>, <b>precios</b> (dime tu presupuesto, ej: «algo de 5 mil»), <b>ofertas</b>, <b>envíos</b> y <b>cuidados</b> ✨ Y para cualquier otra cosa, escríbenos por DM 💌 ' + chContacto();
  }

  // ---------- IA remota (clave escondida en el publicador de Google) con respaldo local ----------
  const chHist = [];   // historial {role:'user'|'assistant', content:texto plano}
  // catálogo compacto (solo texto, sin fotos) para que la IA responda con datos reales
  function chContexto() {
    const visibles = products.filter(kvEnStock);
    const lineas = visibles.slice(0, 120).map(p => {
      const of = kvPrecioOferta(p);
      return '- ' + (p.name || '') + ' | ' + formatCLP(chPrecio(p)) + (of ? ' (oferta, antes ' + formatCLP(p.price) + ')' : '') +
        ' | colección ' + chNombreCat(p.category) + (p.code ? ' | código ' + p.code : '') + (p.detail ? ' | ' + p.detail : '');
    });
    const cs = kvContactos(settings).map(c => c.tipo + ': ' + c.texto).join(' · ');
    return 'PRODUCTOS DISPONIBLES:\n' + lineas.join('\n') + '\n\nCONTACTO: ' + cs +
      '\nPedidos: por DM. Envíos a todo Chile. NO hay retiros.';
  }
  async function chIA() {
    const url = String(settings.igPubUrl || '').trim();
    if (!url) return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'chat', historial: chHist.slice(-8), catalogo: chContexto() }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const d = await r.json();
      if (d && d.ok && d.texto) return String(d.texto);
    } catch (e) {}
    return null;   // sin conexión, sin clave o límite agotado -> respaldo local
  }
  // convierte la respuesta de la IA (texto/markdown simple) a HTML seguro
  function chFormatear(txt) {
    let h = escapeHtml(txt.trim());
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return h.replace(/\n/g, '<br>');
  }

  // ---------- interfaz del chat ----------
  (function montarAsistente() {
    const btn = document.createElement('button');
    btn.className = 'kv-chat-btn';
    btn.id = 'kv-chat-btn';
    btn.innerHTML = '💬';
    btn.title = 'Asesora virtual Karivé';
    btn.setAttribute('aria-label', 'Abrir asistente');
    const panel = document.createElement('div');
    panel.className = 'kv-chat';
    panel.id = 'kv-chat';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="kv-chat-top"><span>Karivé · Asesora virtual</span><button class="kv-chat-x" id="kv-chat-x" aria-label="Cerrar">✕</button></div>' +
      '<div class="kv-chat-msgs" id="kv-chat-msgs">' +
        '<div class="kv-chat-m kv-chat-bot">¡Bienvenida a Karivé Joyas! 💜 Soy tu asesora virtual y conozco todo nuestro catálogo.<br><br>Puedo ayudarte a encontrar la joya perfecta, recomendarte según tu presupuesto, contarte de nuestras colecciones, ofertas, envíos y cómo comprar.<br><br>¿Qué andas buscando hoy? ✨</div>' +
      '</div>' +
      '<div class="kv-chat-fila"><input id="kv-chat-in" type="text" placeholder="Escribe tu pregunta…" autocomplete="off" /><button id="kv-chat-send" aria-label="Enviar">➤</button></div>';
    // burbuja de invitación para que el chat se note
    const globo = document.createElement('button');
    globo.className = 'kv-chat-globo';
    globo.id = 'kv-chat-globo';
    globo.hidden = true;
    globo.innerHTML = '¿Buscas algo especial?<br><b>Pregúntame, te ayudo</b> 💜';
    // ---- botón flotante de WhatsApp (al lado del chat) ----
    const wa = document.createElement('a');
    wa.className = 'kv-wa-btn';
    wa.id = 'kv-wa-btn';
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    wa.hidden = true;
    wa.innerHTML =
      '<span class="kv-wa-halo"></span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.67-.51-.17 0-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.98L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm0 22a9.9 9.9 0 0 1-5.1-1.4l-.36-.22-3.79 1 1.01-3.7-.24-.38A9.9 9.9 0 0 1 2 12a10 10 0 1 1 10 10z"/></svg>' +
      '<span class="kv-wa-tip">Escríbenos 💬</span>';
    // mantiene el enlace y la visibilidad según el número configurado
    waActualizar = function () {
      const c = kvContactos(settings).find(x => x.tipo === 'whatsapp');
      if (c) { wa.href = c.url; wa.hidden = false; }
      else { wa.hidden = true; }
    };
    waActualizar();

    document.body.appendChild(btn);
    document.body.appendChild(wa);
    document.body.appendChild(globo);
    document.body.appendChild(panel);
    const msgs = panel.querySelector('#kv-chat-msgs');
    const input = panel.querySelector('#kv-chat-in');
    const send = panel.querySelector('#kv-chat-send');
    function agregar(html, cls) {
      const d = document.createElement('div');
      d.className = 'kv-chat-m ' + cls;
      d.innerHTML = html;
      msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight;
      return d;
    }
    let ocupado = false;
    async function enviar() {
      const q = input.value.trim();
      if (!q || ocupado) return;
      ocupado = true; send.disabled = true;
      input.value = '';
      agregar(escapeHtml(q), 'kv-chat-user');
      chHist.push({ role: 'user', content: q });
      const escribiendo = agregar('<span class="kv-chat-dots"><span></span><span></span><span></span></span>', 'kv-chat-bot');
      const ia = await chIA();
      escribiendo.remove();
      const html = ia ? chFormatear(ia) : chResponder(q);
      agregar(html, 'kv-chat-bot');
      // el historial guarda texto plano para la próxima pregunta
      chHist.push({ role: 'assistant', content: ia || html.replace(/<br\s*\/?>(\s*)/gi, '\n').replace(/<[^>]+>/g, '') });
      if (chHist.length > 16) chHist.splice(0, chHist.length - 16);
      ocupado = false; send.disabled = false; input.focus();
    }
    // en celular el panel es pantalla completa: se ancla al área visible real
    // (cuando aparece el teclado, el panel se encoge y el escribir queda a la vista)
    function ajustarVisor() {
      if (panel.hidden) return;
      if (window.innerWidth > 640) { panel.style.transform = ''; document.documentElement.style.removeProperty('--kv-vvh'); return; }
      const vv = window.visualViewport;
      if (!vv) return;
      document.documentElement.style.setProperty('--kv-vvh', vv.height + 'px');
      panel.style.transform = 'translateY(' + vv.offsetTop + 'px)';
      msgs.scrollTop = msgs.scrollHeight;
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', ajustarVisor);
      window.visualViewport.addEventListener('scroll', ajustarVisor);
    }
    function abrir() {
      panel.hidden = false; globo.hidden = true; btn.classList.remove('kv-chat-pulso');
      try { sessionStorage.setItem('kv_chat_visto', '1'); } catch (e) {}
      ajustarVisor();
      input.focus();
      msgs.scrollTop = msgs.scrollHeight;
    }
    function cerrar() { input.blur(); panel.hidden = true; panel.style.transform = ''; }
    btn.addEventListener('click', () => { if (panel.hidden) abrir(); else cerrar(); });
    globo.addEventListener('click', abrir);
    panel.querySelector('#kv-chat-x').addEventListener('click', cerrar);
    send.addEventListener('click', enviar);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
    // invitación: aparece a los 6 segundos (una vez por visita) y el botón late suavecito
    let visto = false;
    try { visto = sessionStorage.getItem('kv_chat_visto') === '1'; } catch (e) {}
    if (!visto) {
      setTimeout(() => {
        if (panel.hidden) { globo.hidden = false; btn.classList.add('kv-chat-pulso'); }
      }, 6000);
      setTimeout(() => { globo.hidden = true; }, 26000);
    }
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
