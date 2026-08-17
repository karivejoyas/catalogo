(() => {
  'use strict';

  const ADMIN_EMAIL = 'karive.joyas@gmail.com';
  const $ = (id) => document.getElementById(id);

  let products = [];
  let settings = {};

  const itemsCol = kvDb.collection('catalog').doc('products').collection('items');
  const settingsRef = kvDb.collection('catalog').doc('settings');
  const pedidosCol = kvDb.collection('catalog').doc('pedidos').collection('items');
  const visitasCol = kvDb.collection('catalog').doc('visitas').collection('items');
  const suscritosCol = kvDb.collection('catalog').doc('suscriptores').collection('items');
  const resenasCol = kvDb.collection('catalog').doc('resenas').collection('items');
  let unsubItems = null, unsubSettings = null, unsubPedidos = null, unsubVisitas = null, unsubSuscritos = null, unsubResenas = null;
  let pedidos = [];
  let visitas = [];
  let suscritos = [];
  let resenas = [];

  const guardado = (id) => { const n = $(id); if (!n) return; n.hidden = false; setTimeout(() => { n.hidden = true; }, 2000); };
  const activo = () => document.activeElement;

  // ---------- login ----------
  $('adm-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('adm-login-error').hidden = true;
    kvAuth.signInWithEmailAndPassword(ADMIN_EMAIL, $('adm-pass').value)
      .then(() => { $('adm-pass').value = ''; })
      .catch(() => { $('adm-login-error').hidden = false; });
  });
  $('adm-salir').addEventListener('click', () => kvAuth.signOut());

  kvAuth.onAuthStateChanged((user) => {
    if (user) { $('adm-login').hidden = true; $('adm-app').hidden = false; escuchar(); }
    else { $('adm-app').hidden = true; $('adm-login').hidden = false; dejarDeEscuchar(); }
  });

  // ---------- menú lateral (hamburguesa) ----------
  const drawer = $('adm-drawer'), drawerBack = $('adm-drawer-back'), burger = $('adm-burger');
  function abrirDrawer(v) {
    if (!drawer) return;
    drawer.classList.toggle('abierto', v);
    if (burger) burger.classList.toggle('abierto', v);
    if (drawerBack) drawerBack.hidden = !v;
  }
  if (burger) burger.addEventListener('click', () => abrirDrawer(!drawer.classList.contains('abierto')));
  if (drawerBack) drawerBack.addEventListener('click', () => abrirDrawer(false));
  if ($('adm-drawer-x')) $('adm-drawer-x').addEventListener('click', () => abrirDrawer(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') abrirDrawer(false); });

  // ---------- pestañas ----------
  document.querySelectorAll('.adm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.adm-tab').forEach(t => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.adm-panel').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      abrirDrawer(false);
      window.scrollTo({ top: 0 });
    });
  });

  // ---------- compartir el catálogo (por WhatsApp / menú nativo / copiar link) ----------
  const btnCompartir = $('adm-compartir');
  if (btnCompartir) btnCompartir.addEventListener('click', async () => {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '');   // carpeta del catálogo (index.html)
    const texto = '✨ Mira el catálogo de Karivé Joyas 💜 Joyas artesanales hechas a mano.\n' + url;
    if (navigator.share) {
      try { await navigator.share({ title: 'Karivé Joyas', text: '✨ Mira el catálogo de Karivé Joyas 💜', url: url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); } catch (e) {}
    const txt = $('adm-compartir-txt');
    if (txt) { const prev = txt.textContent; btnCompartir.classList.add('ok'); txt.textContent = '✓ Link copiado'; setTimeout(() => { txt.textContent = prev; btnCompartir.classList.remove('ok'); }, 2200); }
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  });

  // mantiene el menú superior fijo: mide su alto para que las barras internas se peguen justo debajo
  (function ajustarHeader() {
    const h = document.getElementById('adm-header');
    const set = () => { if (h) document.documentElement.style.setProperty('--adm-header-h', h.offsetHeight + 'px'); };
    set();
    window.addEventListener('resize', set);
    if (window.ResizeObserver && h) new ResizeObserver(set).observe(h);
  })();

  // ---------- datos ----------
  function escuchar() {
    if (unsubItems) return;
    unsubItems = itemsCol.orderBy('order').onSnapshot((snap) => {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // ⚠ NUNCA se escriben productos solos. Antes, si la lista llegaba vacía
      // (aunque fuera un parpadeo de conexión) se "sembraba" el catálogo de
      // ejemplo ENCIMA de los productos reales, cambiándoles nombre y precio.
      if (products.length === 0) avisarCatalogoVacio();
      if (window.__focogenRefrescar) window.__focogenRefrescar();
      renderProductosGuarded();
      renderMasVistos();        // el ranking necesita los datos de los productos
      renderIG();
    }, (err) => console.error('Error leyendo productos:', err));
    unsubSettings = settingsRef.onSnapshot((doc) => {
      settings = doc.data() || {};
      kvSetDescuento(settings);
      kvSetFocoMovilGeneral(settings);
      if (window.__focogenRefrescar) window.__focogenRefrescar();
      poblarMarketing();
      poblarPagos();
      renderMasVistos();
      poblarCampos();
      renderCatsEditorGuarded();
      renderProductosGuarded();
      renderIG();
    }, (err) => console.error('Error leyendo configuración:', err));
    unsubPedidos = pedidosCol.onSnapshot((snap) => {
      pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPedidos();
      renderCupones();          // los usos de cada cupón se cuentan desde los pedidos
      renderSuscritos();        // marca quién ya compró
      renderMasVistos();        // las compras pesan en el ranking
    }, (err) => console.error('Error leyendo pedidos:', err));
    unsubVisitas = visitasCol.orderBy('ultima', 'desc').limit(300).onSnapshot((snap) => {
      visitas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderVisitas();
      renderMasVistos();
    }, (err) => console.error('Error leyendo visitas:', err));
    unsubSuscritos = suscritosCol.orderBy('fecha', 'desc').limit(500).onSnapshot((snap) => {
      suscritos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderSuscritos();
    }, (err) => console.error('Error leyendo suscriptores:', err));
    unsubResenas = resenasCol.orderBy('fecha', 'desc').limit(300).onSnapshot((snap) => {
      resenas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderResenas();
    }, (err) => console.error('Error leyendo reseñas:', err));
  }
  function dejarDeEscuchar() {
    if (unsubItems) { unsubItems(); unsubItems = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    if (unsubPedidos) { unsubPedidos(); unsubPedidos = null; }
    if (unsubVisitas) { unsubVisitas(); unsubVisitas = null; }
    if (unsubSuscritos) { unsubSuscritos(); unsubSuscritos = null; }
    if (unsubResenas) { unsubResenas(); unsubResenas = null; }
    products = [];
  }
  /* Si no llega ningún producto solo se avisa: jamás se escribe nada solo.
     (Si de verdad tu catálogo quedó vacío, restaura desde tu archivo de respaldo.) */
  function avisarCatalogoVacio() {
    const cont = $('adm-categorias');
    if (cont) cont.innerHTML = '<p class="adm-seccion-sub">No llegó ningún producto. Puede ser un problema momentáneo de conexión: <b>recarga la página</b>. ' +
      'Si tu catálogo quedó vacío de verdad, restáuralo desde tu archivo de respaldo — <b>no se creará nada solo</b>.</p>';
  }

  // ---------- PRODUCTOS ----------
  // Los cambios NO se publican al instante: quedan en un BORRADOR local por producto
  // y solo llegan al catálogo público cuando se toca "Guardar" en esa tarjeta.
  const borradores = {};
  function actualizar(id, campo, valor) {   // escritura directa (para acciones internas como reordenar)
    itemsCol.doc(id).update({ [campo]: valor }).catch(err => console.error('Error guardando:', err));
  }
  function vista(p) { return p ? Object.assign({}, p, borradores[p.id] || {}) : p; }
  function tieneBorrador(id) { return !!(borradores[id] && Object.keys(borradores[id]).length); }
  function setBorrador(id, campo, valor) {
    borradores[id] = borradores[id] || {};
    borradores[id][campo] = valor;
    marcarDirty(id);
    actualizarBannerPend();
  }
  function marcarDirty(id) {
    const cont = $('adm-categorias');
    const card = cont && cont.querySelector('.cat-card-edit[data-id="' + id + '"]');
    if (card) card.classList.toggle('ed-dirty', tieneBorrador(id));
  }
  // aviso de cambios sin guardar: chip en la barra de colecciones, con desplegable de códigos
  function actualizarBannerPend() {
    const slot = $('adm-pend-slot'); if (!slot) return;
    const ids = Object.keys(borradores).filter(tieneBorrador);
    const ddPrevio = slot.querySelector('details');
    const abierto = !!(ddPrevio && ddPrevio.open);
    if (!ids.length) { slot.innerHTML = ''; return; }
    const cats = kvCategorias(settings);
    const grupos = {};
    ids.forEach(id => {
      const p = products.find(x => x.id === id); if (!p) return;
      const m = vista(p);
      const cat = cats.find(c => c.id === m.category);
      const nom = cat ? cat.nombre : 'Sin colección';
      (grupos[nom] = grupos[nom] || []).push({ id: id, code: m.code || '(sin código)' });
    });
    const noms = Object.keys(grupos);
    let panel = '';
    noms.forEach(n => {
      panel += '<div class="adm-pend-grupo"><b>' + escapeHtml(n) + ':</b> ' +
        grupos[n].map(x => '<span class="adm-pend-cod" data-goto-card="' + x.id + '">' + escapeHtml(x.code) + '</span>').join('') + '</div>';
    });
    slot.innerHTML =
      '<details class="adm-pend-dd"' + (abierto ? ' open' : '') + '>' +
        '<summary>⚠ Sin guardar en ' + noms.map(escapeHtml).join(', ') + ' <b>(' + ids.length + ')</b></summary>' +
        '<div class="adm-pend-panel">' +
          '<div class="adm-pend-hint">Toca un código para ir al producto:</div>' + panel +
          '<button type="button" id="adm-pend-todo" class="adm-btn-solido adm-btn-mini">💾 Guardar todo</button>' +
        '</div>' +
      '</details>';
    const btn = $('adm-pend-todo'); if (btn) btn.addEventListener('click', guardarTodo);
    slot.querySelectorAll('[data-goto-card]').forEach(n => n.addEventListener('click', () => {
      const card = document.querySelector('.cat-card-edit[data-id="' + n.dataset.gotoCard + '"]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  }

  // valida un producto ya combinado con su borrador -> {errores:[], avisos:[]}
  function validarProducto(m, id) {
    const errores = [], avisos = [];
    const nombre = String(m.name || '').trim();
    if (!nombre || /^nuevo producto$/i.test(nombre)) errores.push('falta el nombre');
    if (!(Number(m.price) > 0)) errores.push('falta el precio');
    if (!m.photo) errores.push('falta la foto');
    const code = String(m.code || '').trim();
    if (!code) errores.push('falta el código');
    else if (!/^[A-Za-zÑñ]{2,4}-?\d{1,4}$/.test(code)) avisos.push('el código «' + code + '» se ve raro (lo normal es como AG-014)');
    const dup = products.find(x => x.id !== id && String(vista(x).code || '').toLowerCase() === code.toLowerCase());
    if (code && dup) avisos.push('el código «' + code + '» ya lo usa otro producto');
    const of = Number(m.priceOffer) || 0;
    if (of > 0 && of >= Number(m.price)) avisos.push('la oferta debería ser menor que el precio normal');
    if (!String(m.detail || '').trim()) avisos.push('no pusiste el detalle (ej: los cm)');
    return { errores: errores, avisos: avisos };
  }

  function guardarProducto(id, silencioso) {
    const b = borradores[id], p = products.find(x => x.id === id);
    if (!b || !p) return false;
    const m = Object.assign({}, p, b);
    const v = validarProducto(m, id);
    if (m.stock && v.errores.length) {   // si queda visible, los datos deben estar completos
      if (!silencioso) window.alert('Para dejarlo CON STOCK (visible) primero completa:\n\n• ' + v.errores.join('\n• ') + '\n\nMientras tanto puedes dejarlo "Sin stock" y guardar.');
      return false;
    }
    if (!silencioso && v.avisos.length) {
      if (!window.confirm('⚠ Revisa esto:\n\n• ' + v.avisos.join('\n• ') + '\n\n¿Guardar de todas formas?')) return false;
    }
    // limpieza optimista: la tarjeta queda "guardada" al instante; si falla, se restaura el borrador
    delete borradores[id];
    marcarDirty(id);
    actualizarBannerPend();
    itemsCol.doc(id).update(b).catch(err => {
      console.error('Error guardando:', err);
      borradores[id] = Object.assign({}, b, borradores[id] || {});
      marcarDirty(id);
      actualizarBannerPend();
      window.alert('No se pudo guardar (revisa tu conexión) y el cambio sigue pendiente. Intenta de nuevo.');
    });
    return true;
  }
  function guardarTodo() {
    const ids = Object.keys(borradores).filter(tieneBorrador);
    let quedan = 0;
    ids.forEach(id => { if (!guardarProducto(id, true)) quedan++; });
    if (quedan) window.alert('Guardé lo que estaba completo ✓\nQuedan ' + quedan + ' producto(s) con datos incompletos (o "sin stock"). Ábrelos, complétalos y guárdalos.');
  }

  function eliminar(id) {
    if (!window.confirm('¿Eliminar este producto del catálogo?')) return;
    delete borradores[id]; actualizarBannerPend();
    itemsCol.doc(id).delete().catch(err => console.error('Error eliminando:', err));
  }
  function agregar(categoria) {
    const cat = kvCategorias(settings).find(c => c.id === categoria);
    const maxOrder = products.reduce((m, p) => Math.max(m, p.order || 0), 0);
    const num = kvNextNumCat(products, categoria);   // sigue el correlativo de esa colección
    // nace SIN STOCK (oculto) para llenarlo con calma antes de publicarlo
    itemsCol.add({
      code: (cat && cat.prefijo ? cat.prefijo : 'PR') + '-' + String(num).padStart(3, '0'),
      name: 'Nuevo producto', detail: '', price: 0, priceOffer: 0, photo: null, category: categoria, order: maxOrder + 1, stock: false
    }).catch(err => console.error('Error agregando:', err));
  }
  // avisa al cerrar/recargar si quedan cambios sin guardar
  window.addEventListener('beforeunload', e => { if (Object.keys(borradores).some(tieneBorrador)) { e.preventDefault(); e.returnValue = ''; } });

  // reordenar dentro de la misma colección (‹ antes / › después)
  function moverProducto(id, dir) {
    const p0 = products.find(p => p.id === id);
    if (!p0) return;
    const lista = products.filter(p => p.category === p0.category).sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = lista.findIndex(p => p.id === id);
    const j = i + (dir === 'prev' ? -1 : 1);
    if (j < 0 || j >= lista.length) return;
    const orden = lista.map(p => p.order || 0).slice().sort((a, b) => a - b); // huecos de orden de esta colección
    lista.splice(j, 0, lista.splice(i, 1)[0]);                                 // mueve el elemento
    const cambios = [];
    lista.forEach((p, k) => { if ((p.order || 0) !== orden[k]) cambios.push({ id: p.id, order: orden[k] }); });
    if (!cambios.length) return;
    // actualización inmediata en pantalla (para que se vea el cambio con un solo clic)
    cambios.forEach(c => { const it = products.find(p => p.id === c.id); if (it) it.order = c.order; });
    products.sort((a, b) => (a.order || 0) - (b.order || 0));
    renderProductos();
    const cardEl = document.querySelector('.cat-card-edit[data-id="' + id + '"]');
    if (cardEl) cardEl.scrollIntoView({ block: 'nearest' });
    // guardar en la base de datos
    const batch = kvDb.batch();
    cambios.forEach(c => batch.update(itemsCol.doc(c.id), { order: c.order }));
    batch.commit().catch(err => console.error('Error reordenando:', err));
  }

  /* (eliminado) El botón "Restaurar catálogo inicial" borraba todos los productos
     reales y escribía encima los de ejemplo. Ya no existe: los productos solo
     cambian cuando TÚ los editas y guardas. */

  let pendienteProductos = false;
  function renderProductosGuarded() {
    const cont = $('adm-categorias');
    const ae = document.activeElement;
    // solo se pospone el refresco si se está editando un campo de texto/selección
    // (no cuando el foco está en un botón como Agregar/Eliminar/mover ni en casillas)
    const editando = cont && ae && cont.contains(ae) && (
      ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' ||
      (ae.tagName === 'INPUT' && ae.type !== 'checkbox' && ae.type !== 'button' && ae.type !== 'submit')
    );
    if (editando) { pendienteProductos = true; return; }
    pendienteProductos = false;
    renderProductos();
  }
  // al salir del foco de la sección, si quedó un render pendiente, se aplica
  (function () {
    const cont = $('adm-categorias');
    if (!cont) return;
    cont.addEventListener('focusout', () => {
      setTimeout(() => {
        if (pendienteProductos && !cont.contains(document.activeElement)) { pendienteProductos = false; renderProductos(); }
      }, 0);
    });
  })();

  function renderProductos() {
    const cats = kvCategorias(settings);
    $('adm-contador').textContent = products.length + ' productos';
    const huerfanos = products.filter(p => !cats.some(c => c.id === p.category));
    // barra de accesos rápidos a cada colección (para no bajar tanto)
    let nav = '<div class="adm-secnav">';
    cats.forEach(cat => { const n = products.filter(p => p.category === cat.id).length; nav += '<button type="button" class="adm-secnav-btn" data-goto="sec-' + cat.id + '">' + escapeHtml(cat.nombre) + ' <span>' + n + '</span></button>'; });
    if (huerfanos.length) nav += '<button type="button" class="adm-secnav-btn" data-goto="sec-huerfanos">Sin colección <span>' + huerfanos.length + '</span></button>';
    nav += '<span class="adm-pend-slot" id="adm-pend-slot"></span></div>';
    let html = nav;
    cats.forEach(cat => {
      const items = products.filter(p => p.category === cat.id);
      html +=
        '<section class="adm-seccion" id="sec-' + cat.id + '">' +
          '<h2 class="adm-seccion-titulo">' + escapeHtml(cat.nombre) + ' <span class="adm-tag">(' + items.length + ')</span>' +
            ' <button type="button" class="adm-btn-solido adm-btn-mini" data-role="add" data-cat="' + cat.id + '">+ Agregar producto</button></h2>' +
          '<div class="adm-grilla">' + items.map(p => kvCardEditHtml(vista(p), cats, focoModo[p.id])).join('') + '</div>' +
        '</section>';
    });
    if (huerfanos.length) {
      html += '<section class="adm-seccion" id="sec-huerfanos"><h2 class="adm-seccion-titulo">Sin colección <span class="adm-tag">(' + huerfanos.length + ')</span></h2>' +
        '<p class="adm-seccion-sub">Estos productos quedaron sin colección. Cámbiales la colección con el selector 📁 de cada uno.</p>' +
        '<div class="adm-grilla">' + huerfanos.map(p => kvCardEditHtml(vista(p), cats, focoModo[p.id])).join('') + '</div></section>';
    }
    $('adm-categorias').innerHTML = html;
    $('adm-categorias').querySelectorAll('[data-goto]').forEach(n => n.addEventListener('click', e => {
      const s = document.getElementById(e.currentTarget.dataset.goto);
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    conectarProductos();
    Object.keys(borradores).forEach(marcarDirty);   // reaplica el aviso "sin guardar" tras redibujar
    actualizarBannerPend();
  }

  function conectarProductos() {
    const r = $('adm-categorias');
    r.querySelectorAll('[data-role="add"]').forEach(n => n.addEventListener('click', e => agregar(e.currentTarget.dataset.cat)));
    r.querySelectorAll('[data-role="code"]').forEach(n => n.addEventListener('input', e => setBorrador(e.target.dataset.id, 'code', e.target.value)));
    r.querySelectorAll('[data-role="name"]').forEach(n => n.addEventListener('input', e => setBorrador(e.target.dataset.id, 'name', e.target.value)));
    r.querySelectorAll('[data-role="detail"]').forEach(n => n.addEventListener('input', e => setBorrador(e.target.dataset.id, 'detail', e.target.value)));
    r.querySelectorAll('[data-role="cantidad"]').forEach(n => n.addEventListener('input', e => {
      const txt = e.target.value.replace(/[^0-9]/g, '');
      if (txt !== e.target.value) e.target.value = txt;              // solo números
      setBorrador(e.target.dataset.id, 'cantidad', txt === '' ? null : parseInt(txt, 10));
    }));
    r.querySelectorAll('[data-role="price"]').forEach(n => n.addEventListener('input', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      setBorrador(e.target.dataset.id, 'price', isNaN(num) ? 0 : num);
    }));
    r.querySelectorAll('[data-role="priceOffer"]').forEach(n => n.addEventListener('input', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      setBorrador(e.target.dataset.id, 'priceOffer', isNaN(num) ? 0 : num);
    }));
    r.querySelectorAll('[data-role="category"]').forEach(n => n.addEventListener('change', e => {
      const id = e.target.dataset.id, nuevaCat = e.target.value;
      setBorrador(id, 'category', nuevaCat);
      // el código sigue el correlativo de la NUEVA colección (con su prefijo)
      const cat = kvCategorias(settings).find(c => c.id === nuevaCat);
      const otros = products.map(vista).filter(p => p.id !== id);
      const num = kvNextNumCat(otros, nuevaCat);
      const nuevoCode = (cat && cat.prefijo ? cat.prefijo : 'PR') + '-' + String(num).padStart(3, '0');
      setBorrador(id, 'code', nuevoCode);
      // …y se va AL FINAL de la nueva colección
      const ordenes = otros.filter(p => p.category === nuevaCat).map(p => Number(p.order) || 0);
      setBorrador(id, 'order', (ordenes.length ? Math.max.apply(null, ordenes) : 0) + 1);
      const card = e.target.closest('.cat-card-edit');
      const ci = card && card.querySelector('[data-role="code"]'); if (ci) ci.value = nuevoCode;
    }));
    r.querySelectorAll('[data-role="delete"]').forEach(n => n.addEventListener('click', e => eliminar(e.target.dataset.id)));
    r.querySelectorAll('[data-role="mover"]').forEach(n => n.addEventListener('click', e => moverProducto(e.currentTarget.dataset.id, e.currentTarget.dataset.dir)));
    r.querySelectorAll('[data-role="save"]').forEach(n => n.addEventListener('click', e => guardarProducto(e.currentTarget.dataset.id)));
    r.querySelectorAll('[data-role="stock"]').forEach(n => n.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) {   // para dejarlo VISIBLE, los datos deben estar completos
        const p = products.find(x => x.id === id);
        const v = validarProducto(Object.assign({}, vista(p), { stock: true }), id);
        if (v.errores.length) { e.target.checked = false; window.alert('Para dejarlo CON STOCK (visible) primero completa:\n\n• ' + v.errores.join('\n• ') + '\n\n(luego toca Guardar)'); return; }
      }
      setBorrador(id, 'stock', e.target.checked);
      const card = e.target.closest('.cat-card-edit');
      if (card) card.classList.toggle('sin-stock', !e.target.checked);
      const lbl = e.target.closest('.ed-stock');
      if (lbl) { lbl.classList.toggle('is-off', !e.target.checked); const t = lbl.querySelector('.ed-stock-txt'); if (t) t.textContent = e.target.checked ? 'En stock (visible)' : 'Sin stock (oculto)'; }
    }));
    r.querySelectorAll('input[data-role^="foco-"]').forEach(n => {
      n.addEventListener('input', e => aplicarFocoPreview(e.target.dataset.id));
      n.addEventListener('change', e => {
        const id = e.target.dataset.id;
        if (focoModo[id] === 'movil') { setBorrador(id, 'focoMovil', focoDeCard(id)); return; }
        // Se está tocando el encuadre de PC. Si este producto todavía no tiene
        // uno propio de celular, se le "congela" el que tenía AHORA, para que
        // el celular no se mueva junto con el PC (son independientes).
        const p = products.find(x => x.id === id);
        if (p && !kvTieneFocoMovil(vista(p)) && !kvFocoMovilGeneral()) {
          setBorrador(id, 'focoMovil', kvFoco(p));   // el valor guardado, antes de este cambio
        }
        setBorrador(id, 'foco', focoDeCard(id));
      });
    });
    // pestañas PC / Celular del encuadre
    r.querySelectorAll('[data-role="foco-modo"]').forEach(n => n.addEventListener('click', e => {
      const btn = e.target.closest('[data-role="foco-modo"]');
      cambiarFocoModo(btn.dataset.id, btn.dataset.modo);
    }));
    // "usar el mismo encuadre del PC": borra el encuadre propio del celular
    r.querySelectorAll('[data-role="foco-igualar"]').forEach(n => n.addEventListener('click', e => {
      const id = e.target.dataset.id;
      setBorrador(id, 'focoMovil', null);
      renderProductos();
    }));
    r.querySelectorAll('[data-role="remove-photo"]').forEach(n => n.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const p = products.find(x => x.id === id);
      if (!window.confirm('¿Quitar la foto de "' + ((p && p.name) || 'este producto') + '"?\n\nQuedará como cambio pendiente: si te arrepientes, recarga la página SIN guardar y la foto vuelve.')) return;
      setBorrador(id, 'photo', null);
      renderProductos();
    }));
    r.querySelectorAll('[data-role="upload"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0], id = e.target.dataset.id;
      if (file) kvCompressPhoto(file, (data) => {
        setBorrador(id, 'photo', data);
        const card = $('adm-categorias').querySelector('.cat-card-edit[data-id="' + id + '"]');
        const bg = card && card.querySelector('.kv-fbg');
        if (bg) bg.style.backgroundImage = "url('" + data + "')"; else renderProductos();
      }, 1600, 0.87);
      e.target.value = '';
    }));
  }

  // ---------- encuadre GENERAL para celular (se aplica a todos los productos) ----------
  (function setupFocoGeneral() {
    const zoom = $('adm-focogen-zoom'), x = $('adm-focogen-x'), y = $('adm-focogen-y');
    const foto = $('adm-focogen-foto'), prevTxt = $('adm-focogen-prevtxt'), estado = $('adm-focogen-estado');
    if (!zoom || !foto) return;
    const leer = () => ({ zoom: parseInt(zoom.value, 10), x: parseInt(x.value, 10), y: parseInt(y.value, 10) });
    // usa el primer producto con foto como muestra
    function muestra() { return products.find(p => p.photo) || null; }
    function pintar() {
      const p = muestra();
      if (!p) { foto.innerHTML = ''; prevTxt.textContent = 'Sube una foto para ver la vista previa'; return; }
      prevTxt.textContent = 'Ejemplo: ' + (p.name || '');
      foto.innerHTML = kvCapaFoto(p.photo, leer(), 'kv-fbg-solo');
    }
    function estadoTxt() {
      const g = kvFocoMovilGeneral();
      const propios = products.filter(kvTieneFocoMovil).length;
      estado.textContent = (g ? 'Encuadre general activo (zoom ' + (g.zoom != null ? g.zoom : 100) + ').' : 'Sin encuadre general: el celular usa el mismo del computador.') +
        (propios ? ' ' + propios + ' producto' + (propios === 1 ? ' tiene' : 's tienen') + ' encuadre propio y no se ven afectados.' : '');
    }
    window.__focogenRefrescar = () => {
      const g = kvFocoMovilGeneral() || { zoom: 100, x: 50, y: 50 };
      zoom.value = g.zoom != null ? g.zoom : 100;
      x.value = g.x != null ? g.x : 50;
      y.value = g.y != null ? g.y : 50;
      pintar(); estadoTxt();
    };
    [zoom, x, y].forEach(s => s.addEventListener('input', pintar));
    $('adm-focogen-guardar').addEventListener('click', () => {
      settingsRef.set({ focoMovilGeneral: leer() }, { merge: true })
        .then(() => guardado('adm-focogen-ok')).catch(err => console.error(err));
    });
    $('adm-focogen-quitar').addEventListener('click', () => {
      if (!window.confirm('¿Quitar el encuadre general?\n\nEn el celular los productos volverán a usar el mismo encuadre del computador (salvo los que tengan uno propio).')) return;
      settingsRef.set({ focoMovilGeneral: null }, { merge: true })
        .then(() => guardado('adm-focogen-ok')).catch(err => console.error(err));
    });
  })();

  // qué encuadre se está editando en cada tarjeta: 'pc' (por defecto) o 'movil'
  const focoModo = {};
  function cambiarFocoModo(id, modo) {
    focoModo[id] = modo;
    const card = $('adm-categorias').querySelector('.cat-card-edit[data-id="' + id + '"]');
    if (!card) return;
    card.querySelectorAll('[data-role="foco-modo"]').forEach(t => t.classList.toggle('is-active', t.dataset.modo === modo));
    const p = vista(products.find(x => x.id === id));
    const f = modo === 'movil' ? kvFocoMovil(p) : kvFoco(p);
    const set = (role, val) => { const el = card.querySelector('input[data-role="' + role + '"]'); if (el) el.value = val; };
    set('foco-zoom', f.zoom); set('foco-x', f.x); set('foco-y', f.y);
    const foto = card.querySelector('.cat-card-foto');
    if (foto) foto.classList.toggle('ed-foto-movil', modo === 'movil');
    const ayuda = card.querySelector('.ed-foco-ayuda');
    if (ayuda) ayuda.textContent = modo === 'movil'
      ? 'En el celular la foto se ve más alta que ancha. Ajusta aquí para que la joya no quede cortada en el teléfono.'
      : 'Así se ve en computador y tablet. El celular tiene su propio ajuste en la pestaña 📱.';
    aplicarFocoPreview(id);
  }

  // encuadre: lee los 3 sliders de una tarjeta y aplica la vista previa en vivo
  function focoDeCard(id) {
    const r = $('adm-categorias');
    const gv = (role) => { const el = r.querySelector('[data-role="' + role + '"][data-id="' + id + '"]'); return el ? parseInt(el.value, 10) : null; };
    return { x: gv('foco-x'), y: gv('foco-y'), zoom: gv('foco-zoom') };
  }
  function aplicarFocoPreview(id) {
    const f = focoDeCard(id);
    const card = $('adm-categorias').querySelector('.cat-card-edit[data-id="' + id + '"]');
    const bg = card && card.querySelector('.kv-fbg');
    if (!bg) return;
    const px = 100 - f.x, py = 100 - f.y;   // invertido: mover a la derecha = imagen a la derecha
    bg.style.backgroundPosition = px + '% ' + py + '%';
    bg.style.transform = 'scale(' + (f.zoom / 100) + ')';
    bg.style.transformOrigin = px + '% ' + py + '%';
  }

  // ---------- FONDOS (productos e información) ----------
  function setupFondo(prefix, key, defFondo) {
    let tmp = null;
    const sel = 'input[name="' + prefix + '-tipo"]';
    function visib(tipo) {
      tipo = tipo || (document.querySelector(sel + ':checked') || {}).value || 'gradiente';
      $(prefix + '-color').closest('.adm-color').style.display = tipo === 'color' ? '' : 'none';
      $(prefix + '-preview').closest('.adm-editor-fila').style.display = tipo === 'imagen' ? '' : 'none';
    }
    document.querySelectorAll(sel).forEach(r => r.addEventListener('change', () => visib()));
    $(prefix + '-op').addEventListener('input', e => { $(prefix + '-op-val').textContent = e.target.value; });
    $(prefix + '-file').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, (data) => { tmp = data; $(prefix + '-preview').style.backgroundImage = "url('" + data + "')"; }, 1400, 0.8);
      e.target.value = '';
    });
    $(prefix + '-guardar').addEventListener('click', () => {
      const tipo = (document.querySelector(sel + ':checked') || {}).value || 'gradiente';
      const fondo = { tipo: tipo, color: $(prefix + '-color').value, opacidad: parseInt($(prefix + '-op').value, 10) };
      fondo.imagen = tmp || (settings[key] && settings[key].imagen) || (defFondo && defFondo.imagen) || null;
      const dato = {}; dato[key] = fondo;
      settingsRef.set(dato, { merge: true }).then(() => { tmp = null; guardado(prefix + '-ok'); }).catch(err => console.error(err));
    });
    return function poblar() {
      const f = (settings[key] && settings[key].tipo) ? settings[key] : (defFondo || {});   // muestra el fondo sugerido si aún no hay uno propio
      const tipo = f.tipo || 'gradiente';
      document.querySelectorAll(sel).forEach(r => { if (activo() !== r) r.checked = (r.value === tipo); });
      if (activo() !== $(prefix + '-color')) $(prefix + '-color').value = f.color || '#2a1540';
      if (activo() !== $(prefix + '-op')) { const op = f.opacidad != null ? f.opacidad : 35; $(prefix + '-op').value = op; $(prefix + '-op-val').textContent = op; }
      if (!tmp) $(prefix + '-preview').style.backgroundImage = f.imagen ? "url('" + f.imagen + "')" : 'none';
      visib(tipo);
    };
  }
  let poblarFondoProd = () => {}, poblarFondoInfo = () => {};
  try {
    poblarFondoProd = setupFondo('adm-fondo', 'fondoProd', typeof KV_FONDO_PROD_DEFAULT !== 'undefined' ? KV_FONDO_PROD_DEFAULT : null);
    poblarFondoInfo = setupFondo('adm-fondoi', 'fondoInfo', typeof KV_FONDO_INFO_DEFAULT !== 'undefined' ? KV_FONDO_INFO_DEFAULT : null);
  } catch (err) { console.error('Error configurando fondos:', err); }

  // ---------- INSTAGRAM (kit de publicaciones) ----------
  $('adm-ig-guardar').addEventListener('click', () => {
    settingsRef.set({ igCaption: $('adm-ig-caption').value }, { merge: true })
      .then(() => guardado('adm-ig-ok')).catch(err => console.error(err));
  });
  $('adm-ig-reset').addEventListener('click', () => {
    $('adm-ig-caption').value = KV_IG_CAPTION_DEFAULT;
  });

  // selección de productos para publicar (persiste entre re-renders)
  const igSel = new Set();
  function igActualizarBarra() {
    const n = igSel.size;
    $('adm-ig-selcount').textContent = n + (n === 1 ? ' producto seleccionado' : ' productos seleccionados') + (n > 1 ? ' → carrusel' : '');
    $('adm-ig-preview').disabled = n === 0;
    const des = $('adm-ig-deseleccionar'); if (des) des.hidden = n === 0;
  }
  const igDesBtn = $('adm-ig-deseleccionar');
  if (igDesBtn) igDesBtn.addEventListener('click', () => { igSel.clear(); renderIG(); });

  function renderIG() {
    const cont = $('adm-ig-lista'); if (!cont) return;
    const enStock = products.filter(kvEnStock);
    // limpiar selecciones de productos que ya no existen o quedaron sin stock
    [...igSel].forEach(id => { if (!enStock.some(p => p.id === id)) igSel.delete(id); });
    $('adm-ig-contador').textContent = enStock.length + ' productos con stock';
    const fila = p =>
      '<div class="ig-fila" data-id="' + p.id + '">' +
        '<label class="ig-check"><input type="checkbox" data-role="ig-sel" data-id="' + p.id + '"' + (igSel.has(p.id) ? ' checked' : '') + ' /><span></span></label>' +
        '<div class="ig-thumb"' + (p.photo ? ' style="background-image:url(\'' + p.photo + '\')"' : '') + '>' + (p.photo ? '' : '✦') + '</div>' +
        '<div class="ig-info">' +
          '<div class="ig-nombre">' + escapeHtml(p.name || '') + '</div>' +
          '<div class="ig-precio">' + formatCLP(kvPrecioOferta(p) || p.price) + (kvPrecioOferta(p) ? ' <span class="ig-of">Oferta</span>' : '') + '</div>' +
          '<div class="ig-codigo">' + escapeHtml(p.code || '') + '</div>' +
        '</div>' +
        '<div class="ig-acciones">' +
          '<button type="button" class="adm-btn-solido ig-btn" data-role="ig-img" data-id="' + p.id + '">⬇ Imagen</button>' +
          '<button type="button" class="adm-btn-borde ig-btn" data-role="ig-txt" data-id="' + p.id + '">📋 Texto</button>' +
        '</div>' +
      '</div>';
    const cats = kvCategorias(settings);
    const huer = enStock.filter(p => !cats.some(c => c.id === p.category));
    // barra de acceso rápido: cada colección + la configuración del final
    let nav = '<div class="adm-secnav">';
    cats.forEach(cat => {
      const n = enStock.filter(p => p.category === cat.id).length;
      if (n) nav += '<button type="button" class="adm-secnav-btn" data-goto="ig-grupo-' + cat.id + '">' + escapeHtml(cat.nombre) + ' <span>' + n + '</span></button>';
    });
    if (huer.length) nav += '<button type="button" class="adm-secnav-btn" data-goto="ig-grupo-otros">Otros <span>' + huer.length + '</span></button>';
    nav += '<button type="button" class="adm-secnav-btn adm-secnav-cfg" data-goto="ig-sec-config">⚙ Configuración</button>';
    nav += '</div>';
    let html = nav;
    cats.forEach(cat => {
      const items = enStock.filter(p => p.category === cat.id);
      if (items.length) html += '<div class="ig-grupo-tit" id="ig-grupo-' + cat.id + '">' + escapeHtml(cat.nombre) + '</div>' + items.map(fila).join('');
    });
    if (huer.length) html += '<div class="ig-grupo-tit" id="ig-grupo-otros">Otros</div>' + huer.map(fila).join('');
    cont.innerHTML = html;
    cont.querySelectorAll('[data-goto]').forEach(n => n.addEventListener('click', e => {
      const s = document.getElementById(e.currentTarget.dataset.goto);
      if (s) s.scrollIntoView({ behavior: 'smooth', block: e.currentTarget.dataset.goto === 'ig-sec-config' ? 'start' : 'center' });
    }));
    cont.querySelectorAll('[data-role="ig-img"]').forEach(n => n.addEventListener('click', e => descargarPostIG(e.currentTarget.dataset.id, e.currentTarget)));
    cont.querySelectorAll('[data-role="ig-txt"]').forEach(n => n.addEventListener('click', e => copiarCaptionIG(e.currentTarget.dataset.id, e.currentTarget)));
    cont.querySelectorAll('[data-role="ig-sel"]').forEach(n => n.addEventListener('change', e => {
      if (e.target.checked) igSel.add(e.target.dataset.id); else igSel.delete(e.target.dataset.id);
      igActualizarBarra(); renderIGTags();
    }));
    igActualizarBarra(); renderIGTags();
  }

  // ---------- hashtags (predefinidos + de colección + propios) ----------
  function igTagsTodos() {
    const extras = Array.isArray(settings.igTagsExtra) ? settings.igTagsExtra : [];
    const auto = kvTagsDeProductos(products.filter(p => igSel.has(p.id)), settings);
    const base = KV_IG_TAGS_BASE.concat(extras.filter(t => KV_IG_TAGS_BASE.indexOf(t) === -1));
    return { base: base, auto: auto.filter(t => base.map(b => b.toLowerCase()).indexOf(t.toLowerCase()) === -1) };
  }
  function igTagsActivos() {
    return kvTagsActivos(products.filter(p => igSel.has(p.id)), settings);
  }
  function renderIGTags() {
    const cont = $('adm-ig-tags'); if (!cont) return;
    const off = Array.isArray(settings.igTagsOff) ? settings.igTagsOff : [];
    const t = igTagsTodos();
    const chip = (tag, auto) =>
      '<button type="button" class="ig-tag' + (off.indexOf(tag) === -1 ? ' is-on' : '') + (auto ? ' is-auto' : '') + '" data-tag="' + escapeHtml(tag) + '">' +
        (auto ? '✦ ' : '') + escapeHtml(tag) + '</button>';
    cont.innerHTML = t.auto.map(x => chip(x, true)).join('') + t.base.map(x => chip(x, false)).join('');
    cont.querySelectorAll('.ig-tag').forEach(n => n.addEventListener('click', e => {
      const tag = e.currentTarget.dataset.tag;
      const cur = Array.isArray(settings.igTagsOff) ? settings.igTagsOff.slice() : [];
      const i = cur.indexOf(tag);
      if (i === -1) cur.push(tag); else cur.splice(i, 1);
      settings.igTagsOff = cur;                       // reflejo inmediato
      renderIGTags();
      settingsRef.set({ igTagsOff: cur }, { merge: true }).catch(err => console.error(err));
    }));
  }
  $('adm-ig-tag-add').addEventListener('click', () => {
    let t = $('adm-ig-tag-nuevo').value.trim().replace(/\s+/g, '');
    if (!t) return;
    if (t[0] !== '#') t = '#' + t;
    const cur = Array.isArray(settings.igTagsExtra) ? settings.igTagsExtra.slice() : [];
    if (cur.indexOf(t) === -1 && KV_IG_TAGS_BASE.indexOf(t) === -1) {
      cur.push(t);
      settings.igTagsExtra = cur;
      renderIGTags();
      settingsRef.set({ igTagsExtra: cur }, { merge: true }).catch(err => console.error(err));
    }
    $('adm-ig-tag-nuevo').value = '';
  });

  // ---------- vista previa + publicar ----------
  let igPreviewImgs = [];        // dataURLs, alineadas con igPreviewProds
  let igPreviewProds = [];       // productos que están en la vista previa
  const igFocoTimer = {};
  const igModal = $('ig-modal');
  function igEstado(msg) { $('ig-m-estado').textContent = msg || ''; }
  function cerrarIGModal() { igModal.hidden = true; igEstado(''); clearInterval(igProgTimer); const pr = $('ig-m-progreso'); if (pr) pr.hidden = true; }
  igModal.querySelectorAll('[data-role="ig-close"]').forEach(n => n.addEventListener('click', cerrarIGModal));

  function igSlider(label, role, id, min, max, val) {
    return '<label class="ed-slider"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-role="' + role + '" data-id="' + id + '" value="' + val + '" /></label>';
  }
  function igFocoDe(id) {
    const cont = $('ig-m-fotos');
    const gv = role => { const el = cont.querySelector('[data-role="' + role + '"][data-id="' + id + '"]'); return el ? parseInt(el.value, 10) : null; };
    return { x: gv('igfoco-x'), y: gv('igfoco-y'), zoom: gv('igfoco-zoom') };
  }
  // mueve/hace zoom en vivo mientras arrastra el slider (regenera esa sola foto)
  function igFocoInput(id) {
    const i = igPreviewProds.findIndex(p => p.id === id);
    if (i < 0) return;
    const f = igFocoDe(id);
    clearTimeout(igFocoTimer[id]);
    igFocoTimer[id] = setTimeout(async () => {
      igPreviewImgs[i] = await kvGenerarPostIG(igPreviewProds[i], settings, f);
      const img = $('ig-m-fotos').querySelector('.ig-m-foto[data-i="' + i + '"] img');
      if (img) img.src = igPreviewImgs[i];
    }, 80);
  }
  // al soltar el slider, guarda el encuadre para que se recuerde
  function igFocoGuardar(id) {
    const f = igFocoDe(id);
    actualizar(id, 'igFoco', f);
    const p = igPreviewProds.find(x => x.id === id); if (p) p.igFoco = f;
    const g = products.find(x => x.id === id); if (g) g.igFoco = f;
  }
  function igQuitarDePreview(id) {
    igSel.delete(id);
    const i = igPreviewProds.findIndex(p => p.id === id);
    if (i >= 0) { igPreviewProds.splice(i, 1); igPreviewImgs.splice(i, 1); }
    renderPreviewFotos();
    renderIG();  // sincroniza las casillas y la barra de la lista de atrás
  }
  function renderPreviewFotos() {
    const cont = $('ig-m-fotos');
    const n = igPreviewProds.length;
    if (!n) { cont.innerHTML = '<div class="ig-m-cargando">No quedan productos. Cierra y elige al menos uno.</div>'; $('ig-m-publicar').disabled = true; igEstado(''); return; }
    $('ig-m-publicar').disabled = false;
    cont.innerHTML = igPreviewProds.map((p, i) => {
      const f = kvFocoIG(p);
      return '<div class="ig-m-foto" data-i="' + i + '">' +
        '<div class="ig-m-foto-img">' +
          '<img src="' + (igPreviewImgs[i] || '') + '" alt="Foto ' + (i + 1) + '" />' +
          (n > 1 ? '<span class="ig-m-num">' + (i + 1) + '/' + n + '</span>' : '') +
          '<button type="button" class="ig-m-quitar" data-role="ig-quitar" data-id="' + p.id + '" title="Quitar de la publicación">✕</button>' +
        '</div>' +
        '<div class="ig-m-fnombre">' + escapeHtml(p.name || '') + '</div>' +
        '<div class="ig-m-controles">' +
          igSlider('Zoom', 'igfoco-zoom', p.id, 100, 260, f.zoom) +
          igSlider('Horizontal', 'igfoco-x', p.id, 0, 100, f.x) +
          igSlider('Vertical', 'igfoco-y', p.id, 0, 100, f.y) +
        '</div>' +
      '</div>';
    }).join('');
    cont.querySelectorAll('[data-role="ig-quitar"]').forEach(b => b.addEventListener('click', e => igQuitarDePreview(e.currentTarget.dataset.id)));
    cont.querySelectorAll('[data-role^="igfoco-"]').forEach(s => {
      s.addEventListener('input', e => igFocoInput(e.target.dataset.id));
      s.addEventListener('change', e => igFocoGuardar(e.target.dataset.id));
    });
    igEstado(n > 1 ? 'Se publicará como carrusel de ' + n + ' fotos. Ajusta el zoom y la posición de cada foto; el logo queda fijo.' : 'Ajusta el zoom y la posición con los controles de abajo; el logo queda fijo.');
  }

  $('adm-ig-preview').addEventListener('click', async () => {
    const prods = products.filter(p => igSel.has(p.id));
    if (!prods.length) return;
    if (prods.length > 10) { window.alert('Instagram permite máximo 10 fotos por publicación. Quita algunos productos.'); return; }
    igModal.hidden = false;
    $('ig-m-fotos').innerHTML = '<div class="ig-m-cargando">Generando imágenes… ⏳</div>';
    $('ig-m-caption').value = kvCaptionMulti(prods, settings, igTagsActivos());
    igPreviewProds = prods.slice();
    igPreviewImgs = [];
    try {
      for (let i = 0; i < igPreviewProds.length; i++) igPreviewImgs[i] = await kvGenerarPostIG(igPreviewProds[i], settings);
      renderPreviewFotos();
    } catch (err) {
      console.error(err);
      $('ig-m-fotos').innerHTML = '<div class="ig-m-cargando">⚠ No se pudieron generar las imágenes.</div>';
    }
  });

  // barra de progreso estimada (no hay progreso real: es una sola llamada al publicador)
  let igProgTimer = null;
  function igProgresoPintar(pct, etapa) {
    const f = $('ig-m-progreso-fill'); if (f) f.style.width = Math.round(pct) + '%';
    const p = $('ig-m-progreso-pct'); if (p) p.textContent = Math.round(pct) + '%';
    if (etapa) { const e = $('ig-m-progreso-etapa'); if (e) e.textContent = etapa; }
  }
  function igProgresoIniciar(nFotos, destino) {
    const conIG = destino !== 'fb', conFB = destino !== 'ig';
    const prog = $('ig-m-progreso'); if (prog) prog.hidden = false;
    igProgresoPintar(0, 'Preparando las imágenes…');
    const total = 9000 + nFotos * 7000;   // duración estimada en ms
    const t0 = Date.now();
    clearInterval(igProgTimer);
    igProgTimer = setInterval(() => {
      const t = Date.now() - t0;
      const p = 95 * (1 - Math.exp(-3 * t / total));   // sube y se acerca a 95% sin llegar
      let etapa = 'Preparando las imágenes…';
      if (p >= 12) etapa = conIG ? '📸 Publicando en Instagram…' : '📘 Publicando en Facebook…';
      if (p >= 55 && conIG && conFB) etapa = '📘 Publicando en Facebook…';
      if (p >= 85) etapa = '🔎 Verificando la publicación…';
      igProgresoPintar(p, etapa);
    }, 220);
  }
  function igProgresoFin(exito) {
    clearInterval(igProgTimer); igProgTimer = null;
    igProgresoPintar(100, exito ? '✅ ¡Listo!' : 'Terminado');
    setTimeout(() => { const pr = $('ig-m-progreso'); if (pr) pr.hidden = true; }, exito ? 1400 : 500);
  }

  // el texto del botón sigue a la opción elegida
  const IG_DEST_TXT = { ambas: '🚀 Publicar en Instagram y Facebook', ig: '🚀 Publicar solo en Instagram', fb: '🚀 Publicar solo en Facebook' };
  function igDestino() { return (document.querySelector('input[name="ig-m-dest"]:checked') || {}).value || 'ambas'; }
  document.querySelectorAll('input[name="ig-m-dest"]').forEach(r => r.addEventListener('change', () => {
    $('ig-m-publicar').textContent = IG_DEST_TXT[igDestino()];
  }));

  $('ig-m-publicar').addEventListener('click', async () => {
    const url = String(settings.igPubUrl || '').trim();
    const clave = pubClave();
    if (!url) { igEstado('⚠ Falta configurar la URL del publicador (sección "Conexión con el publicador", abajo).'); return; }
    if (!clave) { igEstado('⚠ Falta la clave secreta en este navegador: escríbela en "Conexión con el publicador" y guarda.'); return; }
    if (!igPreviewImgs.length) { igEstado('⚠ Primero genera la vista previa.'); return; }
    const destino = igDestino();
    const btn = $('ig-m-publicar');
    btn.disabled = true;
    igEstado('Publicando… no cierres esta ventana ⏳');
    igProgresoIniciar(igPreviewImgs.length, destino);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: evita bloqueos CORS
        body: JSON.stringify({ clave: clave, destino: destino, caption: $('ig-m-caption').value, images: igPreviewImgs.map(u => u.split(',')[1]) })
      });
      const d = await r.json();
      if (d && d.ok) {
        igProgresoFin(true);
        const igOk = d.ig ? d.ig === 'ok' : destino !== 'fb';   // scripts antiguos no informan "ig"
        const fbOk = d.fb === 'ok';
        const donde = [igOk ? 'Instagram' : null, fbOk ? 'Facebook' : null].filter(Boolean).join(' y ');
        let msg = '✅ ¡Publicado en ' + (donde || 'tus redes') + '! Revisa tu perfil.';
        if (d.fb && ['ok', 'no configurado', 'omitido'].indexOf(d.fb) < 0) msg += ' ⚠ Facebook: ' + d.fb;
        igEstado(msg);
        igSel.clear(); renderIG();
      } else {
        igProgresoFin(false);
        igEstado('❌ ' + ((d && d.error) || 'Error desconocido al publicar.'));
      }
    } catch (err) {
      igProgresoFin(false);
      igEstado('❌ No se pudo contactar al publicador: ' + err.message);
    }
    btn.disabled = false;
  });

  // ---------- IA (Gemini principal / Groq respaldo) ----------
  // Las claves viven SOLO en este navegador (localStorage): la configuración del
  // catálogo es públicamente legible y guardarlas ahí las expondría.
  const IA_LS = { or: 'kv_ia_or', gem: 'kv_ia_gemini', groq: 'kv_ia_groq', pref: 'kv_ia_pref' };
  function iaKeys() {
    return {
      or: localStorage.getItem(IA_LS.or) || '',
      gem: localStorage.getItem(IA_LS.gem) || '',
      groq: localStorage.getItem(IA_LS.groq) || '',
      pref: localStorage.getItem(IA_LS.pref) || 'gemini'
    };
  }
  $('ia-guardar').addEventListener('click', () => {
    localStorage.setItem(IA_LS.or, $('ia-key-or').value.trim());
    localStorage.setItem(IA_LS.gem, $('ia-key-gemini').value.trim());
    localStorage.setItem(IA_LS.groq, $('ia-key-groq').value.trim());
    localStorage.setItem(IA_LS.pref, (document.querySelector('input[name="ia-pref"]:checked') || {}).value || 'gemini');
    _orModelosCache = null; _iaGemModelosCache = null;
    guardado('ia-keys-ok');
    iaORConsultarUso().then(renderIAUso);
    renderIAUso();
    // también se guardan escondidas en el publicador: el chat del catálogo las usa
    // y aparecerán solas en cualquier otro navegador donde configures la conexión
    sincronizarClavesIA().then(ok => {
      const el = $('ia-keys-ok');
      if (el && !el.hidden) el.textContent = ok ? '✓ Guardado aquí y en tu publicador (chat del catálogo ✓)' : '✓ Guardado en este navegador (no se pudo avisar al publicador)';
    });
  });
  (function poblarIAKeys() {
    const k = iaKeys();
    $('ia-key-or').value = k.or;
    $('ia-key-gemini').value = k.gem;
    $('ia-key-groq').value = k.groq;
    document.querySelectorAll('input[name="ia-pref"]').forEach(r => { r.checked = (r.value === k.pref); });
  })();

  // ---------- uso diario de cada IA (conteo local + estado real de OpenRouter) ----------
  function iaUsoDatos() {
    const hoy = new Date().toISOString().slice(0, 10);
    let u = {};
    try { u = JSON.parse(localStorage.getItem('kv_ia_uso') || '{}'); } catch (e) {}
    if (u.fecha !== hoy) u = { fecha: hoy, openrouter: 0, gemini: 0, groq: 0 };
    return u;
  }
  function iaUsoSumar(p) {
    const u = iaUsoDatos();
    u[p] = (u[p] || 0) + 1;
    localStorage.setItem('kv_ia_uso', JSON.stringify(u));
    renderIAUso();
  }
  let orInfo = null;
  async function iaORConsultarUso() {
    const k = iaKeys();
    if (!k.or) { orInfo = null; return; }
    for (const ep of ['https://openrouter.ai/api/v1/key', 'https://openrouter.ai/api/v1/auth/key']) {
      try {
        const r = await fetch(ep, { headers: { 'Authorization': 'Bearer ' + k.or } });
        if (r.ok) { const d = await r.json(); orInfo = d.data || d; return; }
      } catch (e) {}
    }
    orInfo = { error: true };
  }
  function renderIAUso() {
    const cont = $('ia-uso'); if (!cont) return;
    const k = iaKeys(); const u = iaUsoDatos();
    const fila = (nom, txts) => '<div class="ia-uso-fila"><div class="ia-uso-nombre">' + nom + '</div>' + txts.map(t => '<div class="ia-uso-det">' + t + '</div>').join('') + '</div>';
    let html = '';
    const orTxts = [];
    if (!k.or) orTxts.push('Sin clave configurada.');
    else {
      orTxts.push('Hoy: <b>' + (u.openrouter || 0) + '</b> solicitudes desde este navegador.');
      if (orInfo && !orInfo.error) {
        orTxts.push('Crédito usado: <b>US$ ' + (Number(orInfo.usage) || 0).toFixed(2) + '</b>' + (orInfo.limit != null ? ' de US$ ' + orInfo.limit : ' (sin tope de crédito)') + ' — los modelos <b>:free</b> no gastan crédito.');
        orTxts.push(orInfo.is_free_tier
          ? 'Cuenta gratis: ~<b>50 solicitudes al día</b> a modelos gratis (sube a ~1.000/día si cargas US$10 una sola vez).'
          : 'Cuenta con crédito: hasta ~<b>1.000 solicitudes al día</b> a modelos gratis.');
      } else if (orInfo && orInfo.error) orTxts.push('⚠ No se pudo consultar el estado de la clave (revisa que sea válida).');
    }
    html += fila('🌐 OpenRouter — principal', orTxts);
    html += fila('✨ Gemini — respaldo', [k.gem
      ? 'Hoy: <b>' + (u.gemini || 0) + '</b> solicitudes desde este navegador. Límite gratis aproximado: ~1.000/día con flash-lite (Google no permite consultar cuánto te queda).'
      : 'Sin clave configurada.']);
    html += fila('⚡ Groq — respaldo', [k.groq
      ? 'Hoy: <b>' + (u.groq || 0) + '</b> solicitudes desde este navegador. Límite gratis aproximado: ~1.000/día según el modelo (Groq tampoco permite consultarlo).'
      : 'Sin clave configurada.']);
    cont.innerHTML = html;
  }
  const iaUsoBtn = $('ia-uso-refrescar');
  if (iaUsoBtn) iaUsoBtn.addEventListener('click', async () => { await iaORConsultarUso(); renderIAUso(); });
  renderIAUso();
  iaORConsultarUso().then(renderIAUso);

  // lista por defecto, del que MENOS consume (lite) al que más; se actualiza sola con la lista real de Google
  const IA_GEM_MODELOS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  const IA_GROQ_TXT = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  const IA_GROQ_VIS = ['meta-llama/llama-4-scout-17b-16e-instruct'];
  let _iaGemModelosCache = null;

  // pregunta a Google qué modelos hay disponibles y los ordena del que menos consume al que más
  async function iaGemModelos(key) {
    if (_iaGemModelosCache) return _iaGemModelosCache;
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
      const d = await r.json();
      if (d && d.models) {
        const disp = d.models
          .filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0)
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(n => /^gemini/.test(n) && /flash|lite/.test(n) && !/pro|vision|embedding|image|tts|audio/.test(n));
        // menor puntaje = menos consumo/más cuota gratis: primero los "lite" y los estables
        const puntaje = n => (/lite/.test(n) ? 0 : 100) + (/(exp|preview|thinking)/.test(n) ? 30 : 0) + (/latest/.test(n) ? 5 : 0);
        disp.sort((a, b) => puntaje(a) - puntaje(b));
        if (disp.length) { _iaGemModelosCache = disp; return disp; }
      }
    } catch (e) {}
    return IA_GEM_MODELOS;
  }

  async function iaGemini(key, msgs) {
    const sys = msgs.find(m => m.role === 'system');
    const contents = msgs.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }].concat((m.images || []).map(b => ({ inline_data: { mime_type: 'image/jpeg', data: b } })))
    }));
    const body = { contents: contents };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    let ultimo = '';
    const modelos = await iaGemModelos(key);
    for (const modelo of modelos) {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts.map(p => p.text || '').join('');
        if (t) return t;
        ultimo = 'respuesta vacía';
      } else {
        ultimo = (d.error && d.error.message) || ('HTTP ' + r.status);
        // prueba otro modelo si éste no existe (404/400) o si se agotó su cuota (429): cada modelo tiene su propio límite
        if (r.status !== 404 && r.status !== 400 && r.status !== 429) break;
      }
    }
    throw new Error('Gemini: ' + ultimo);
  }

  // ---------- OpenRouter (principal): modelos GRATIS, priorizando los Gemini con visión ----------
  const IA_OR_FALLBACK = ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-4-maverick:free', 'qwen/qwen2.5-vl-72b-instruct:free', 'mistralai/mistral-small-3.1-24b-instruct:free'];
  let _orModelosCache = null;
  // pregunta a OpenRouter qué modelos gratis hay y los ordena: Gemini primero (lee mejor las fotos)
  async function iaORModelos() {
    if (_orModelosCache) return _orModelosCache;
    try {
      const r = await fetch('https://openrouter.ai/api/v1/models');
      const d = await r.json();
      if (d && d.data) {
        const libres = d.data.filter(m => m.pricing && parseFloat(m.pricing.prompt || '1') === 0 && parseFloat(m.pricing.completion || '1') === 0);
        const conVision = libres.filter(m => {
          const a = m.architecture || {};
          return ((a.input_modalities || []).join(',') + ',' + (a.modality || '')).indexOf('image') >= 0;
        });
        const punt = id => (/google\/gemini/.test(id) ? 0 : /llama/.test(id) ? 10 : /qwen/.test(id) ? 20 : 30) + (/preview|exp/.test(id) ? 1 : 0);
        const ids = (conVision.length ? conVision : libres).map(m => m.id).sort((a, b) => punt(a) - punt(b)).slice(0, 5);
        if (ids.length) { _orModelosCache = ids; return ids; }
      }
    } catch (e) {}
    return IA_OR_FALLBACK;
  }

  async function iaOpenRouter(key, msgs) {
    const messages = msgs.map(m => {
      if (m.images && m.images.length) {
        return { role: m.role, content: [{ type: 'text', text: m.content }].concat(m.images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b } }))) };
      }
      return { role: m.role, content: m.content };
    });
    let ultimo = '';
    const modelos = await iaORModelos();
    for (const modelo of modelos) {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: modelo, messages: messages, temperature: 0.7 })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (t) return t;
        ultimo = (d.error && d.error.message) || 'respuesta vacía';
      } else {
        ultimo = (d.error && d.error.message) || ('HTTP ' + r.status);
        // con estos códigos vale la pena probar el siguiente modelo; con otros (ej. clave mala) no
        if ([400, 402, 404, 408, 429, 502, 503].indexOf(r.status) < 0) break;
      }
    }
    throw new Error('OpenRouter: ' + ultimo);
  }

  async function iaGroq(key, msgs, conImagenes) {
    const modelos = conImagenes ? IA_GROQ_VIS.concat(IA_GROQ_TXT) : IA_GROQ_TXT;
    const messages = msgs.map(m => {
      if (m.images && m.images.length) {
        return { role: m.role, content: [{ type: 'text', text: m.content }].concat(m.images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b } }))) };
      }
      return { role: m.role, content: m.content };
    });
    let ultimo = '';
    for (const modelo of modelos) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: modelo, messages: messages, temperature: 0.7 })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (t) return t;
        ultimo = 'respuesta vacía';
      } else {
        ultimo = (d.error && d.error.message) || ('HTTP ' + r.status);
        if (r.status !== 404 && r.status !== 400) break;
      }
    }
    throw new Error('Groq: ' + ultimo);
  }

  // popup: muestra el error de la IA principal y pregunta si usar la de respaldo
  function iaPopupCambiar(principal, err, respaldo) {
    return new Promise(resolve => {
      const pop = $('ia-pop'); if (!pop) { resolve(true); return; }
      $('ia-pop-tit').textContent = '⚠ ' + principal + ' no pudo responder';
      $('ia-pop-msg').innerHTML = '<b>Motivo (' + escapeHtml(principal) + '):</b><br>' + escapeHtml(err) +
        '<br><br>¿Quieres intentar con <b>' + escapeHtml(respaldo) + '</b> (tu IA de respaldo)?';
      $('ia-pop-si').textContent = 'Sí, usar ' + respaldo;
      pop.hidden = false;
      const cerrar = val => { pop.hidden = true; $('ia-pop-si').onclick = null; $('ia-pop-no').onclick = null; resolve(val); };
      $('ia-pop-si').onclick = () => cerrar(true);
      $('ia-pop-no').onclick = () => cerrar(false);
    });
  }

  /* cadena de IAs: OpenRouter primero; si falla, popup con el error y pregunta si usar el siguiente respaldo */
  async function iaLlamar(msgs, conImagenes) {
    const k = iaKeys();
    const nombre = { openrouter: 'OpenRouter', gemini: 'Gemini', groq: 'Groq' };
    const hayKey = p => p === 'openrouter' ? !!k.or : p === 'gemini' ? !!k.gem : !!k.groq;
    const correr = p => p === 'openrouter' ? iaOpenRouter(k.or, msgs) : p === 'gemini' ? iaGemini(k.gem, msgs) : iaGroq(k.groq, msgs, conImagenes);
    const respaldos = k.pref === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
    const cadena = ['openrouter'].concat(respaldos).filter(hayKey);
    if (!cadena.length) throw new Error('No hay claves de IA. Ponlas en la pestaña "Asistente IA".');
    for (let i = 0; i < cadena.length; i++) {
      const p = cadena[i];
      try {
        iaUsoSumar(p);
        return await correr(p);
      } catch (err) {
        const sig = cadena[i + 1];
        if (!sig) throw err;                                        // no queda respaldo: se muestra este error
        const usar = await iaPopupCambiar(nombre[p], err.message, nombre[sig]);
        if (!usar) throw err;                                       // eligió no cambiar: conserva el error
      }
    }
  }

  /* miniatura base64 (sin encabezado) de una foto, para enviarla a la IA */
  function iaMiniatura(src, max) {
    return kvCargarImagen(src).then(img => {
      if (!img) return null;
      const c = document.createElement('canvas');
      const s = Math.min(1, (max || 512) / Math.max(img.width, img.height));
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    });
  }

  const IA_SISTEMA_MARCA = 'Eres la community manager de Karivé Joyas, una marca chilena de joyas artesanales hechas a mano (arcilla polimérica, miyuki, mostacillas). Escribes en español de Chile, con tono cálido y cercano. La marca solo hace envíos a todo Chile (NO hay retiros) y los pedidos son por DM de Instagram.\n\n' +
    'GUÍA DE ESTILO (basada en lo que mejor funciona en cuentas de joyería artesanal exitosas — síguela siempre):\n' +
    '- Parte con un GANCHO breve que conecte con una emoción o un momento de uso (ej: "Ese detalle que transforma un look sencillo…", "Para regalarte o sorprender a alguien especial…", o una pregunta directa). NUNCA partas con fórmulas planas tipo "Descubre nuestra nueva colección".\n' +
    '- Vende el SIGNIFICADO, no la ficha técnica: qué transmite la pieza, cómo se siente usarla, para qué ocasión sirve (regalo, uso diario, fecha especial).\n' +
    '- Destaca el valor de lo hecho a mano: cada pieza es única, hay dedicación y detalle detrás, es apoyar un emprendimiento chileno.\n' +
    '- Tono de emprendimiento profesional y serio, pero cercano y humano. Emojis con moderación (3 a 6 en todo el post), nada recargado.\n' +
    '- Cierra siempre con una llamada a la acción clara antes de las líneas fijas.\n' +
    '- LÍNEAS FIJAS DE LA MARCA (van siempre al final del post, cada una en su propia línea, y NUNCA las borres ni las cambies):\n' +
    '💜 Hecho a mano con mucho amor\n📩 Pedidos por DM\n🚚 Envíos a todo Chile';

  // datos reales de los productos elegidos, para que la IA los mencione por su nombre
  function igIAContexto(prods) {
    const l = prods.map(p => '- ' + (p.name || '') + ' (colección ' + kvCat(p.category, settings).nombre + ')' + (p.detail ? ', ' + p.detail : ''));
    return 'Productos de esta publicación (menciónalos por su nombre real):\n' + l.join('\n');
  }

  const KV_CATALOGO_URL = 'https://karivejoyas.github.io/catalogo/';
  // contexto GENERAL: solo las colecciones, sin nombres ni precios de productos
  function igIAContextoGeneral(prods) {
    const cols = [...new Set(prods.map(p => kvCat(p.category, settings).nombre).filter(Boolean))];
    return cols.length ? 'Colecciones que aparecen en las fotos: ' + cols.join(', ') + '.' : '';
  }

  // --- botón: descripción con IA (general, inspirada en las fotos, sin nombres ni precios) ---
  $('ig-m-ia-desc').addEventListener('click', async () => {
    const prods = products.filter(p => igSel.has(p.id));
    if (!prods.length) return;
    const btn = $('ig-m-ia-desc');
    btn.disabled = true; igEstado('✨ La IA está mirando tus joyas…');
    try {
      const imgs = [];
      for (const p of prods.slice(0, 4)) { const b = await iaMiniatura(p.photo, 512); if (b) imgs.push(b); }
      const tags = igTagsActivos();
      const texto = await iaLlamar([
        { role: 'system', content: IA_SISTEMA_MARCA },
        { role: 'user', content: 'Escribe una descripción atractiva para un post de Instagram, inspirándote en las fotos (su estilo, colores, lo hechas a mano).\n' +
          'REGLAS:\n' +
          '- SÍ puedes hablar del TIPO o TEMA de las joyas que se ven (por ejemplo: si son corazones, flores, mariposas…) y describir ese estilo de forma general y bonita.\n' +
          '- NO menciones nombres de productos, NI precios, NI enumeres los colores uno por uno (nada de "el corazón rojo, el verde, el azul…"). Habla del conjunto, no de piezas individuales.\n' +
          '- Invita a ver el catálogo completo así: una línea que diga "🔗 Míralo en el link de nuestra bio" y, en la línea de abajo, el enlace tal cual: ' + KV_CATALOGO_URL + '\n' +
          '- Termina con las 3 líneas fijas de la marca (💜 Hecho a mano con mucho amor / 📩 Pedidos por DM / 🚚 Envíos a todo Chile), cada una en su línea.\n' +
          '- Texto bien espaciado (frases cortas con saltos de línea), cálido y natural.\n\n' +
          igIAContextoGeneral(prods) + (tags.length ? '\n\nAgrega al final, en su propia línea, estos hashtags tal cual:\n' + tags.join(' ') : '') +
          '\n\nResponde SOLO con la descripción, sin comentarios.', images: imgs }
      ], imgs.length > 0);
      $('ig-m-caption').value = texto.trim();
      igEstado('✨ Descripción generada — revísala y edítala si quieres.');
    } catch (err) { igEstado('❌ IA: ' + err.message); }
    btn.disabled = false;
  });

  // --- pedirle un cambio a la IA escribiendo libremente (sin límites) ---
  async function igIAAplicar() {
    const pedido = $('ig-m-ia-pedido').value.trim();
    if (!pedido) { igEstado('Escribe primero qué quieres (ej: "hazla elegante y menciona los aros de media flor").'); return; }
    const prods = products.filter(p => igSel.has(p.id));
    const btn = $('ig-m-ia-aplicar');
    btn.disabled = true; igEstado('✨ Trabajando en tu pedido…');
    try {
      const actual = $('ig-m-caption').value;
      const texto = await iaLlamar([
        { role: 'system', content: IA_SISTEMA_MARCA + '\n\n' + igIAContexto(prods) + '\n\nREGLAS DE FORMATO (respétalas siempre):\n' +
          '- Devuelve el texto BIEN ESPACIADO, como un post real de Instagram: frases cortas, con saltos de línea y una línea en blanco entre bloques. NUNCA lo dejes todo pegado en un solo párrafo.\n' +
          '- Conserva SIEMPRE las 3 líneas fijas del cierre, cada una en su propia línea: "💜 Hecho a mano con mucho amor", "📩 Pedidos por DM" y "🚚 Envíos a todo Chile". Si alguna falta en el texto actual, agrégala. NUNCA las borres aunque el pedido parezca implicarlo.\n' +
          '- Si el texto actual trae hashtags al final, déjalos en su propia línea al final (a menos que te pidan quitarlos).\n' +
          '- Modifica SOLO lo que la usuaria pide; el resto de la estructura la mantienes.' },
        { role: 'user', content: 'Este es el texto actual del post (respétale la estructura y el espaciado):\n---\n' + actual + '\n---\n\nHaz esto que te pido: ' + pedido + '\n\nUsa los nombres reales de los productos cuando corresponda. Responde SOLO con la descripción final, ya formateada con sus saltos de línea, sin explicaciones ni comentarios.' }
      ], false);
      $('ig-m-caption').value = texto.trim();
      $('ig-m-ia-pedido').value = '';
      igEstado('✨ Listo — revisa cómo quedó.');
    } catch (err) { igEstado('❌ IA: ' + err.message); }
    btn.disabled = false;
  }
  $('ig-m-ia-aplicar').addEventListener('click', igIAAplicar);
  $('ig-m-ia-pedido').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); igIAAplicar(); } });

  // --- botón: hashtags nuevos con IA (se agregan tocándolos) ---
  $('ig-m-ia-tags').addEventListener('click', async () => {
    const prods = products.filter(p => igSel.has(p.id));
    if (!prods.length) return;
    const btn = $('ig-m-ia-tags');
    btn.disabled = true; igEstado('#️⃣ Buscando hashtags nuevos…');
    try {
      const datos = prods.map(p => p.name + ' (' + kvCat(p.category, settings).nombre + ')').join(', ');
      const actuales = igTagsActivos().join(' ');
      const texto = await iaLlamar([
        { role: 'system', content: IA_SISTEMA_MARCA },
        { role: 'user', content: 'Sugiere 8 hashtags NUEVOS y relevantes en español para un post de Instagram con: ' + datos + '. NO repitas ninguno de estos: ' + actuales + '. Responde SOLO los hashtags separados por espacios.' }
      ], false);
      const ya = igTagsActivos().map(t => t.toLowerCase());
      const sugs = [];
      (texto.match(/#[\wáéíóúñÁÉÍÓÚÑ]+/g) || []).forEach(t => {
        if (ya.indexOf(t.toLowerCase()) === -1 && sugs.map(x => x.toLowerCase()).indexOf(t.toLowerCase()) === -1) sugs.push(t);
      });
      if (!sugs.length) { igEstado('La IA no encontró hashtags nuevos. Intenta de nuevo.'); btn.disabled = false; return; }
      const cont = $('ig-m-sugeridos');
      cont.innerHTML = sugs.slice(0, 10).map(t => '<button type="button" class="ig-tag" data-tag="' + escapeHtml(t) + '">+ ' + escapeHtml(t) + '</button>').join('');
      cont.querySelectorAll('.ig-tag').forEach(n => n.addEventListener('click', e => {
        const tag = e.currentTarget.dataset.tag;
        const ta = $('ig-m-caption');
        ta.value = ta.value.replace(/\s*$/, '') + ' ' + tag;   // lo agrega al final de la descripción
        e.currentTarget.disabled = true; e.currentTarget.classList.add('is-on');
      }));
      igEstado('Toca los hashtags que quieras agregar a la descripción. 👇');
    } catch (err) { igEstado('❌ IA: ' + err.message); }
    btn.disabled = false;
  });

  // --- asistente de chat sobre el catálogo ---
  const iaHist = [];
  function contextoCatalogo() {
    const cats = kvCategorias(settings);
    let s = 'CATÁLOGO ACTUAL DE KARIVÉ JOYAS\n';
    cats.forEach(c => {
      const items = products.filter(p => p.category === c.id);
      if (!items.length) return;
      s += '\n' + c.nombre + ' (' + items.length + ' productos):\n';
      items.forEach(p => {
        const of = kvPrecioOferta(p);
        s += '- ' + (p.code || '') + ' ' + (p.name || '') + ' · ' + formatCLP(p.price) + (of ? ' (en oferta a ' + formatCLP(of) + ')' : '') + (kvEnStock(p) ? '' : ' [SIN STOCK]') + '\n';
      });
    });
    const huer = products.filter(p => !cats.some(c => c.id === p.category));
    if (huer.length) { s += '\nSin colección:\n'; huer.forEach(p => { s += '- ' + (p.code || '') + ' ' + (p.name || '') + ' · ' + formatCLP(p.price) + '\n'; }); }
    s += '\nContacto: Instagram ' + (settings.instagram || '') + ' · Facebook ' + (settings.facebook || '') + ' · WhatsApp ' + (settings.whatsapp || '');
    s += '\nCatálogo web: https://karivejoyas.github.io/catalogo/';
    return s.slice(0, 9000);
  }
  function iaChatAdd(rol, texto) {
    const div = document.createElement('div');
    div.className = 'ia-msg ia-' + rol;
    div.textContent = texto;
    $('ia-chat').appendChild(div);
    $('ia-chat').scrollTop = $('ia-chat').scrollHeight;
    return div;
  }
  async function iaPreguntar() {
    const q = $('ia-preg').value.trim();
    if (!q) return;
    $('ia-preg').value = '';
    iaChatAdd('user', q);
    iaHist.push({ role: 'user', content: q });
    while (iaHist.length > 12) iaHist.shift();
    const pensando = iaChatAdd('bot', 'Pensando…');
    pensando.classList.add('ia-pensando');
    try {
      const resp = await iaLlamar([
        { role: 'system', content: IA_SISTEMA_MARCA + ' Responde breve y útil, usando SOLO estos datos reales del catálogo (no inventes productos ni precios):\n\n' + contextoCatalogo() }
      ].concat(iaHist), false);
      iaHist.push({ role: 'assistant', content: resp });
      pensando.classList.remove('ia-pensando');
      pensando.textContent = resp;
    } catch (err) {
      pensando.classList.remove('ia-pensando');
      pensando.textContent = '⚠ ' + err.message;
    }
    $('ia-chat').scrollTop = $('ia-chat').scrollHeight;
  }
  $('ia-enviar').addEventListener('click', iaPreguntar);
  $('ia-preg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); iaPreguntar(); } });

  // ---------- conexión con el publicador ----------
  // La URL va a la base (el catálogo la necesita para el chat), pero la CLAVE queda
  // SOLO en este navegador: la configuración de la base es públicamente legible y
  // guardarla ahí dejaría el publicador abierto a cualquiera.
  function pubClave() { return (localStorage.getItem('kv_pub_clave') || String(settings.igPubClave || '')).trim(); }

  // empuja las claves de IA al publicador: quedan escondidas en Google y las usa el chat del catálogo
  async function sincronizarClavesIA() {
    const url = String(settings.igPubUrl || '').trim(), clave = pubClave();
    if (!url || !clave) return false;
    const k = iaKeys();
    if (!k.or && !k.gem && !k.groq) return false;   // sin claves aquí: no borrar las de la bóveda
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'config', clave: clave, claves: { or: k.or, gemini: k.gem, groq: k.groq } })
      });
      const d = await r.json();
      return !!(d && d.ok);
    } catch (e) { return false; }
  }

  // trae las claves guardadas en el publicador, para que aparezcan solas en cualquier navegador
  let clavesTraidas = false;
  async function traerClavesIA() {
    const k = iaKeys();
    if (k.or || k.gem || k.groq) return;               // este navegador ya las tiene
    const url = String(settings.igPubUrl || '').trim(), clave = pubClave();
    if (!url || !clave || clavesTraidas) return;
    clavesTraidas = true;
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'config', clave: clave, leer: true })
      });
      const d = await r.json();
      if (d && d.ok && d.claves) {
        if (d.claves.or) localStorage.setItem(IA_LS.or, d.claves.or);
        if (d.claves.gemini) localStorage.setItem(IA_LS.gem, d.claves.gemini);
        if (d.claves.groq) localStorage.setItem(IA_LS.groq, d.claves.groq);
        $('ia-key-or').value = d.claves.or || '';
        $('ia-key-gemini').value = d.claves.gemini || '';
        $('ia-key-groq').value = d.claves.groq || '';
        renderIAUso();
        iaORConsultarUso().then(renderIAUso);
      }
    } catch (e) {}
  }

  // migración: si la clave quedó guardada en la base (versión antigua), pásala a este navegador y bórrala de allá
  let clavesMigradas = false;
  function migrarPubClave() {
    if (clavesMigradas) return;
    const enBase = String(settings.igPubClave || '').trim();
    if (!enBase) return;   // nada que migrar (aún); se reintenta en el próximo refresco
    clavesMigradas = true;
    if (!localStorage.getItem('kv_pub_clave')) localStorage.setItem('kv_pub_clave', enBase);
    settingsRef.set({ igPubClave: '' }, { merge: true }).catch(() => {});
  }

  $('adm-ig-pubguardar').addEventListener('click', () => {
    localStorage.setItem('kv_pub_clave', $('adm-ig-pubclave').value.trim());
    settingsRef.set({ igPubUrl: $('adm-ig-puburl').value.trim(), igPubClave: '' }, { merge: true })
      .then(() => { guardado('adm-ig-pub-ok'); sincronizarClavesIA(); traerClavesIA(); })
      .catch(err => console.error(err));
  });

  // ---------- descuento global a todo el catálogo ----------
  function descFmtFecha(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : (iso || ''); }
  function descFechaSemana() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
  function poblarDescuento() {
    if (!$('adm-desc-activo')) return;
    const cfg = kvDescuentoConfig(settings);
    const pct = Number(cfg.pct) || 0, on = pct > 0;
    if (activo() !== $('adm-desc-activo')) $('adm-desc-activo').checked = on;
    if (activo() !== $('adm-desc-pct')) $('adm-desc-pct').value = on ? pct : 20;
    if (activo() !== $('adm-desc-hasta')) $('adm-desc-hasta').value = cfg.hasta || descFechaSemana();
    const vig = kvDescuentoActivo(settings), el = $('adm-desc-estado');
    if (vig) { el.textContent = '● Activo: −' + vig.pct + '% en todo el catálogo' + (vig.hasta ? ' hasta el ' + descFmtFecha(vig.hasta) : ''); el.className = 'adm-desc-estado es-on'; }
    else if (on && cfg.hasta) { el.textContent = '● Venció el ' + descFmtFecha(cfg.hasta) + ' — sin descuento activo'; el.className = 'adm-desc-estado es-off'; }
    else { el.textContent = '● Sin descuento activo'; el.className = 'adm-desc-estado es-off'; }
  }
  function previewDescuento() {
    const el = $('adm-desc-estado'); if (!el) return;
    const on = $('adm-desc-activo').checked, pct = parseInt($('adm-desc-pct').value, 10) || 0, hasta = $('adm-desc-hasta').value;
    if (on && pct > 0) { el.textContent = 'Se aplicará −' + pct + '%' + (hasta ? ' hasta el ' + descFmtFecha(hasta) : ' (sin fecha de término)') + ' — recuerda Guardar'; el.className = 'adm-desc-estado es-on'; }
    else { el.textContent = 'Sin descuento — recuerda Guardar'; el.className = 'adm-desc-estado es-off'; }
  }
  if ($('adm-desc-guardar')) {
    ['adm-desc-activo', 'adm-desc-pct', 'adm-desc-hasta'].forEach(id => { const e = $(id); e.addEventListener('input', previewDescuento); e.addEventListener('change', previewDescuento); });
    $('adm-desc-guardar').addEventListener('click', () => {
      const on = $('adm-desc-activo').checked;
      const pct = Math.max(0, Math.min(90, parseInt($('adm-desc-pct').value, 10) || 0));
      const hasta = $('adm-desc-hasta').value || '';
      const descuentoGlobal = (on && pct > 0) ? { pct: pct, hasta: hasta } : { pct: 0, hasta: '' };
      settingsRef.set({ descuentoGlobal: descuentoGlobal }, { merge: true })
        .then(() => guardado('adm-desc-ok')).catch(err => console.error(err));
    });
  }

  function descargarPostIG(id, btn) {
    const p = products.find(x => x.id === id); if (!p) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
    return kvGenerarPostIG(p, settings).then(url => {
      const a = document.createElement('a');
      a.href = url; a.download = 'karive-' + (p.code || id) + '.jpg';
      document.body.appendChild(a); a.click(); a.remove();
      if (btn) { btn.disabled = false; btn.textContent = '✓ Descargada'; setTimeout(() => { btn.textContent = '⬇ Imagen'; }, 1800); }
    }).catch(err => { console.error('Error generando post:', err); if (btn) { btn.disabled = false; btn.textContent = '⬇ Imagen'; } });
  }

  function copiarCaptionIG(id, btn) {
    const p = products.find(x => x.id === id); if (!p) return;
    const txt = kvCaptionIG(p, settings);
    const ok = () => { if (btn) { btn.textContent = '✓ Copiado'; setTimeout(() => { btn.textContent = '📋 Texto'; }, 1800); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(() => window.prompt('Copia el texto:', txt));
    else window.prompt('Copia el texto:', txt);
  }

  $('adm-ig-todas').addEventListener('click', async () => {
    const enStock = products.filter(kvEnStock);
    if (!enStock.length) return;
    if (!window.confirm('Se descargarán ' + enStock.length + ' imágenes, una por una. Puede que tu navegador pida permiso para descargas múltiples. ¿Continuar?')) return;
    const btn = $('adm-ig-todas'); btn.disabled = true;
    for (let i = 0; i < enStock.length; i++) {
      btn.textContent = 'Descargando ' + (i + 1) + '/' + enStock.length + '…';
      await descargarPostIG(enStock[i].id);
      await new Promise(r => setTimeout(r, 700));
    }
    btn.disabled = false; btn.textContent = '⬇ Descargar todas las imágenes';
  });

  // ---------- CONTACTO ----------
  $('adm-guardar-contacto').addEventListener('click', () => {
    settingsRef.set({ instagram: $('adm-ig').value.trim(), facebook: $('adm-fb').value.trim(), whatsapp: $('adm-wa').value.trim(), whatsappMsg: $('adm-wa-msg').value.trim() }, { merge: true })
      .then(() => guardado('adm-contacto-ok')).catch(err => console.error(err));
  });

  // ---------- COLORES ----------
  const COLOR_KEYS = ['morado', 'moradoProf', 'dorado', 'lila'];
  function colorInput(k) { return $('adm-c-' + k); }
  function previsualizarColores() {
    kvApplyTheme({ morado: colorInput('morado').value, moradoProf: colorInput('moradoProf').value, dorado: colorInput('dorado').value, lila: colorInput('lila').value });
  }
  COLOR_KEYS.forEach(k => colorInput(k).addEventListener('input', previsualizarColores));
  $('adm-guardar-colores').addEventListener('click', () => {
    const theme = {};
    COLOR_KEYS.forEach(k => theme[k] = colorInput(k).value);
    settingsRef.set({ theme }, { merge: true }).then(() => guardado('adm-colores-ok')).catch(err => console.error(err));
  });
  $('adm-reset-colores').addEventListener('click', () => {
    if (!window.confirm('¿Volver a los colores originales de la marca?')) return;
    settingsRef.set({ theme: KV_THEME_DEFAULT }, { merge: true }).then(() => guardado('adm-colores-ok')).catch(err => console.error(err));
  });

  // ---------- COLECCIONES (agregar / renombrar / foto / eliminar) ----------
  let catsCount = -1;
  function renderCatsEditorGuarded() {
    const cats = kvCategorias(settings);
    const cont = $('adm-cats-editor');
    const focoDentro = cont && cont.contains(document.activeElement);
    if (focoDentro && cats.length === catsCount) return; // editando y sin cambio de cantidad: no reescribir
    catsCount = cats.length;
    renderCatsEditor(cats);
  }

  function guardarCategorias(cats) {
    return settingsRef.set({ categorias: cats }, { merge: true }).catch(err => console.error('Error guardando colecciones:', err));
  }

  function renderCatsEditor(cats) {
    let html = '';
    cats.forEach((cat, idx) => {
      html +=
        '<div class="adm-editor-fila adm-cat-fila" data-idx="' + idx + '">' +
          '<div class="adm-editor-foto" style="background-image:url(\'' + (cat.imagen || '') + '\')"></div>' +
          '<div class="adm-editor-campos">' +
            '<label class="adm-etiqueta">Nombre de la colección</label>' +
            '<input class="adm-input" data-role="cat-nombre" data-idx="' + idx + '" value="' + escapeHtml(cat.nombre || '') + '" />' +
            '<label class="adm-etiqueta">Descripción</label>' +
            '<input class="adm-input" data-role="cat-sub" data-idx="' + idx + '" value="' + escapeHtml(cat.sub || '') + '" />' +
            '<label class="adm-etiqueta">Código de los productos (2–4 letras, ej: CO para Corazones)</label>' +
            '<input class="adm-input" data-role="cat-pref" data-idx="' + idx + '" value="' + escapeHtml(cat.prefijo || '') + '" maxlength="4" placeholder="CO" style="max-width:130px;text-transform:uppercase;letter-spacing:0.12em;" />' +
            '<div class="adm-cat-acciones">' +
              '<label class="adm-btn-solido adm-btn-file">Cambiar foto<input type="file" accept="image/*" data-role="cat-foto" data-idx="' + idx + '" hidden /></label>' +
              '<button type="button" class="adm-btn-borde adm-btn-del-cat" data-role="cat-del" data-idx="' + idx + '">Eliminar colección</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
    html += '<button type="button" id="adm-cat-add" class="adm-btn-solido adm-btn-add-cat">+ Agregar colección</button>';
    $('adm-cats-editor').innerHTML = html;
    conectarCatsEditor();
  }

  function conectarCatsEditor() {
    const r = $('adm-cats-editor');
    r.querySelectorAll('[data-role="cat-nombre"]').forEach(n => n.addEventListener('change', e => {
      const cats = kvCategorias(settings), i = +e.target.dataset.idx;
      if (cats[i]) { cats[i].nombre = e.target.value; guardarCategorias(cats); }
    }));
    r.querySelectorAll('[data-role="cat-sub"]').forEach(n => n.addEventListener('change', e => {
      const cats = kvCategorias(settings), i = +e.target.dataset.idx;
      if (cats[i]) { cats[i].sub = e.target.value; guardarCategorias(cats); }
    }));
    r.querySelectorAll('[data-role="cat-pref"]').forEach(n => n.addEventListener('change', e => {
      const cats = kvCategorias(settings), i = +e.target.dataset.idx;
      if (cats[i]) { cats[i].prefijo = (e.target.value.trim().toUpperCase().replace(/[^A-ZÑ]/g, '').slice(0, 4)) || 'PR'; e.target.value = cats[i].prefijo; guardarCategorias(cats); }
    }));
    r.querySelectorAll('[data-role="cat-foto"]').forEach(n => n.addEventListener('change', e => {
      const i = +e.target.dataset.idx, file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, (data) => { const cats = kvCategorias(settings); if (cats[i]) { cats[i].imagen = data; guardarCategorias(cats); } }, 1000);
      e.target.value = '';
    }));
    r.querySelectorAll('[data-role="cat-del"]').forEach(n => n.addEventListener('click', e => {
      const i = +e.target.dataset.idx, cats = kvCategorias(settings);
      if (!cats[i]) return;
      const nProd = products.filter(p => p.category === cats[i].id).length;
      const msg = nProd > 0
        ? 'La colección "' + cats[i].nombre + '" tiene ' + nProd + ' producto(s). Si la eliminas, esos productos quedarán "sin colección" (podrás reasignarlos en la pestaña Productos). ¿Eliminar?'
        : '¿Eliminar la colección "' + cats[i].nombre + '"?';
      if (!window.confirm(msg)) return;
      cats.splice(i, 1);
      guardarCategorias(cats);
    }));
    const add = $('adm-cat-add');
    if (add) add.addEventListener('click', () => {
      const cats = kvCategorias(settings);
      cats.push({ id: 'c' + Date.now().toString(36), nombre: 'Nueva colección', sub: '', imagen: '', prefijo: 'PR' });
      guardarCategorias(cats);
    });
  }

  // ---------- PORTADA ----------
  let coverImgTmp = null;
  $('adm-cover-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) kvCompressPhoto(file, (data) => { coverImgTmp = data; $('adm-cover-preview').style.backgroundImage = "url('" + data + "')"; }, 1200);
    e.target.value = '';
  });
  $('adm-guardar-portada').addEventListener('click', () => {
    const cover = Object.assign({}, KV_COVER_DEFAULT, settings.cover || {}, { tagline: $('adm-cover-tagline').value });
    if (coverImgTmp) cover.image = coverImgTmp;
    settingsRef.set({ cover }, { merge: true }).then(() => { coverImgTmp = null; guardado('adm-portada-ok'); }).catch(err => console.error(err));
  });

  // ---------- INFO ----------
  $('adm-guardar-info').addEventListener('click', () => {
    const info = { titulo: $('adm-info-titulo').value, b1: $('adm-info-b1').value, b2: $('adm-info-b2').value, b3: $('adm-info-b3').value, b4: $('adm-info-b4').value };
    settingsRef.set({ info }, { merge: true }).then(() => guardado('adm-info-ok')).catch(err => console.error(err));
  });

  // ---------- ¿CÓMO COMPRAR? ----------
  (function buildHowtoInputs() {
    let html = '';
    for (let i = 1; i <= 6; i++) {
      html += '<div class="adm-paso-fila">' +
        '<input class="adm-input" id="adm-howto-p' + i + 't" placeholder="Título del paso ' + i + '" />' +
        '<textarea class="adm-input" id="adm-howto-p' + i + 'd" rows="2" placeholder="Descripción del paso ' + i + '"></textarea>' +
      '</div>';
    }
    $('adm-howto-pasos').innerHTML = html;
  })();
  $('adm-guardar-howto').addEventListener('click', () => {
    const howto = { titulo: $('adm-howto-titulo').value };
    for (let i = 1; i <= 6; i++) { howto['p' + i + 't'] = $('adm-howto-p' + i + 't').value; howto['p' + i + 'd'] = $('adm-howto-p' + i + 'd').value; }
    settingsRef.set({ howto }, { merge: true }).then(() => guardado('adm-howto-ok')).catch(err => console.error(err));
  });

  // ---------- DESPEDIDA ----------
  $('adm-guardar-bye').addEventListener('click', () => {
    const despedida = { titulo: $('adm-bye-titulo').value, mensaje: $('adm-bye-msg').value };
    settingsRef.set({ despedida }, { merge: true }).then(() => guardado('adm-bye-ok')).catch(err => console.error(err));
  });

  // ---------- poblar campos desde settings ----------
  function poblarCampos() {
    poblarDescuento();
    if (activo() !== $('adm-ig')) $('adm-ig').value = settings.instagram || '';
    if (activo() !== $('adm-fb')) $('adm-fb').value = settings.facebook || '';
    if (activo() !== $('adm-wa')) $('adm-wa').value = settings.whatsapp || '';
    if (activo() !== $('adm-wa-msg')) $('adm-wa-msg').value = settings.whatsappMsg != null ? settings.whatsappMsg : KV_WHATSAPP_MSG_DEFAULT;
    if (activo() !== $('adm-ig-caption')) $('adm-ig-caption').value = settings.igCaption != null ? settings.igCaption : KV_IG_CAPTION_DEFAULT;
    if (activo() !== $('adm-ig-puburl')) $('adm-ig-puburl').value = settings.igPubUrl || '';
    migrarPubClave();
    if (activo() !== $('adm-ig-pubclave')) $('adm-ig-pubclave').value = pubClave();
    traerClavesIA();

    // fondos (productos e información): un fallo aquí no debe frenar el resto
    try { poblarFondoProd(); poblarFondoInfo(); } catch (err) { console.error('Error poblando fondos:', err); }

    const theme = Object.assign({}, KV_THEME_DEFAULT, settings.theme || {});
    COLOR_KEYS.forEach(k => { const inp = colorInput(k); if (activo() !== inp) inp.value = theme[k]; });

    const cover = Object.assign({}, KV_COVER_DEFAULT, settings.cover || {});
    if (activo() !== $('adm-cover-tagline')) $('adm-cover-tagline').value = cover.tagline || '';
    if (!coverImgTmp) $('adm-cover-preview').style.backgroundImage = "url('" + cover.image + "')";

    const info = Object.assign({}, KV_INFO_DEFAULT, settings.info || {});
    ['titulo', 'b1', 'b2', 'b3', 'b4'].forEach(k => { const inp = $('adm-info-' + k); if (inp && activo() !== inp) inp.value = info[k] || ''; });

    const howto = Object.assign({}, KV_HOWTO_DEFAULT, settings.howto || {});
    if (activo() !== $('adm-howto-titulo')) $('adm-howto-titulo').value = howto.titulo || '';
    for (let i = 1; i <= 6; i++) {
      ['t', 'd'].forEach(s => { const inp = $('adm-howto-p' + i + s); if (inp && activo() !== inp) inp.value = howto['p' + i + s] || ''; });
    }

    const bye = Object.assign({}, KV_DESPEDIDA_DEFAULT, settings.despedida || {});
    if (activo() !== $('adm-bye-titulo')) $('adm-bye-titulo').value = bye.titulo || '';
    if (activo() !== $('adm-bye-msg')) $('adm-bye-msg').value = bye.mensaje || '';

    const tr = kvTransferencia(settings);
    [['adm-tr-titular', 'titular'], ['adm-tr-rut', 'rut'], ['adm-tr-banco', 'banco'], ['adm-tr-tipo', 'tipo'], ['adm-tr-numero', 'numero'], ['adm-tr-correo', 'correo']].forEach(([id, k]) => {
      const inp = $(id); if (inp && activo() !== inp) inp.value = tr[k] || '';
    });
  }

  // ============================================================
  //  PEDIDOS (panel estilo tienda)
  // ============================================================
  $('adm-tr-guardar').addEventListener('click', () => {
    const transferencia = {
      titular: $('adm-tr-titular').value.trim(),
      rut: $('adm-tr-rut').value.trim(),
      banco: $('adm-tr-banco').value.trim(),
      tipo: $('adm-tr-tipo').value.trim(),
      numero: $('adm-tr-numero').value.trim(),
      correo: $('adm-tr-correo').value.trim()
    };
    const ped = Object.assign({}, settings.pedidos || {}, { transferencia: transferencia });
    settingsRef.set({ pedidos: ped }, { merge: true }).then(() => guardado('adm-tr-ok')).catch(err => console.error(err));
  });

  const pedidosAbiertos = {};   // id -> true (detalle expandido)

  /* Aviso anti-abuso del cupón: marca si esta persona YA hizo un pedido antes
     (mismo correo, teléfono o dirección). No bloquea nada — tú decides. */
  function repetido(p) {
    const cli = p.cliente || {}, dir = p.direccion || {};
    const mail = String(cli.correo || '').toLowerCase().trim();
    const fono = String(cli.telefono || '').replace(/[^0-9]/g, '').slice(-8);
    const calle = String(dir.calle || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const previos = pedidos.filter(o => o.id !== p.id && (o.num || 0) < (p.num || 0));
    const coincide = previos.find(o => {
      const c = o.cliente || {}, d = o.direccion || {};
      if (mail && String(c.correo || '').toLowerCase().trim() === mail) return true;
      if (fono && String(c.telefono || '').replace(/[^0-9]/g, '').slice(-8) === fono) return true;
      if (calle && String(d.calle || '').toLowerCase().replace(/\s+/g, ' ').trim() === calle) return true;
      return false;
    });
    return coincide ? ' <b class="ped-repetido">⚠ ya compró antes (pedido #' + (coincide.num || '?') + ')</b>' : '';
  }
  function pedFecha(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso).slice(0, 16); }
  }
  function renderPedidos() {
    const badge = $('adm-ped-badge');
    const nuevos = pedidos.filter(p => (p.estado || 'nuevo') === 'nuevo').length;
    if (badge) { badge.textContent = nuevos; badge.hidden = nuevos === 0; }
    const cont = $('adm-pedidos-lista'); if (!cont) return;
    if (!pedidos.length) {
      cont.innerHTML = '<p class="adm-seccion-sub">Aún no hay pedidos. Cuando una clienta compre desde el carrito del catálogo, aparecerá aquí. 🛒</p>';
      return;
    }
    const lista = pedidos.slice().sort((a, b) => (b.num || 0) - (a.num || 0));
    cont.innerHTML = lista.map(p => {
      const est = kvPedidoEstado(p.estado);
      const abierto = !!pedidosAbiertos[p.id];
      const items = (p.items || []).map(it => '<div class="ped-item"><span>' + it.qty + '× ' + escapeHtml(it.name) + ' <i>' + escapeHtml(it.code || '') + '</i></span><span>' + formatCLP((it.precio || 0) * it.qty) + '</span></div>').join('');
      const dir = p.direccion || {}; const cli = p.cliente || {};
      const telLimpio = String(cli.telefono || '').replace(/[^0-9]/g, '');
      return '<div class="ped-card' + (abierto ? ' abierto' : '') + '" data-id="' + p.id + '">' +
        '<button type="button" class="ped-head" data-role="ped-toggle" data-id="' + p.id + '">' +
          '<span class="ped-num">#' + (p.num || '—') + '</span>' +
          '<span class="ped-quien"><b>' + escapeHtml(cli.nombre || 'Sin nombre') + '</b><span>' + pedFecha(p.fecha) + ' · ' + (p.items || []).reduce((s, i) => s + i.qty, 0) + ' art.</span></span>' +
          '<span class="ped-total">' + formatCLP(p.total || 0) + '</span>' +
          '<span class="ped-estado ped-est-' + est.id + '">' + est.emoji + ' ' + est.nombre + '</span>' +
        '</button>' +
        (abierto ?
        '<div class="ped-body">' +
          '<div class="ped-cols">' +
            '<div><div class="ped-sub">Artículos</div>' + items +
              (p.cupon ? '<div class="ped-item ped-cupon"><span>🎟 Cupón ' + escapeHtml(p.cupon.codigo || '') + repetido(p) + '</span><span>−' + formatCLP(p.cupon.descuento || 0) + '</span></div>' : '') +
              '<div class="ped-item ped-envio"><span>Envío (' + escapeHtml((p.envio || {}).region || '') + ')</span><span>' + formatCLP((p.envio || {}).costo || 0) + '</span></div>' +
              '<div class="ped-item ped-tot"><span>Total</span><span>' + formatCLP(p.total || 0) + '</span></div>' +
              (p.notas ? '<div class="ped-nota">📝 ' + escapeHtml(p.notas) + '</div>' : '') +
            '</div>' +
            '<div><div class="ped-sub">Cliente y envío</div>' +
              '<div class="ped-dato">' + escapeHtml(cli.nombre || '') + '</div>' +
              '<div class="ped-dato">📍 ' + escapeHtml(dir.calle || '') + ', ' + escapeHtml(dir.comuna || '') + '<br>' + escapeHtml(dir.region || '') + '</div>' +
              '<div class="ped-dato">✉️ <a href="mailto:' + escapeHtml(cli.correo || '') + '">' + escapeHtml(cli.correo || '') + '</a></div>' +
              '<div class="ped-dato">📱 <a target="_blank" rel="noopener" href="https://wa.me/' + telLimpio + '">' + escapeHtml(cli.telefono || '') + '</a></div>' +
              '<div class="ped-sub" style="margin-top:10px;">' + (p.medioPago === 'mercadopago' ? 'Pago con tarjeta' : 'Comprobante') + '</div>' +
              (p.medioPago === 'mercadopago'
                ? '<div class="ped-mp' + (p.pagoEstado === 'approved' ? ' ok' : (p.pagoEstado === 'por-verificar' ? ' pend' : ' mal')) + '">' +
                    '<div>💳 Mercado Pago · N° ' + escapeHtml(p.pagoId || '—') + '</div>' +
                    '<div class="ped-mp-estado">' + (
                      p.pagoEstado === 'approved' ? '✅ Pago confirmado con Mercado Pago' :
                      p.pagoEstado === 'por-verificar' ? '⏳ Aún NO verificado — aprieta el botón antes de enviar' :
                      p.pagoEstado ? '⚠ ' + escapeHtml(String(p.pagoEstado)) : '—') + '</div>' +
                    (p.pagoDetalle ? '<div class="ped-mp-estado">' + escapeHtml(p.pagoDetalle) + '</div>' : '') +
                    '<button type="button" class="adm-btn-borde adm-btn-mini" data-role="ped-verificar" data-id="' + p.id + '">🔎 Verificar pago con Mercado Pago</button>' +
                  '</div>'
                : (p.comprobante ? '<a class="ped-comp" href="' + p.comprobante + '" target="_blank" rel="noopener" style="background-image:url(\'' + p.comprobante + '\')" title="Ver comprobante grande"></a>' : '<div class="ped-dato">⚠ Sin comprobante</div>')) +
            '</div>' +
          '</div>' +
          '<div class="ped-acciones">' +
            (est.id === 'nuevo' ? '<button class="adm-btn-solido adm-btn-mini" data-role="ped-estado" data-id="' + p.id + '" data-est="verificado">✅ Pago verificado</button>' : '') +
            (est.id === 'verificado' ? '<button class="adm-btn-solido adm-btn-mini" data-role="ped-estado" data-id="' + p.id + '" data-est="preparando">📦 Empezar a preparar</button>' : '') +
            (est.id === 'preparando' ?
              '<div class="ped-envio-form">' +
                '<input class="adm-input" id="ped-courier-' + p.id + '" placeholder="Courier" value="' + escapeHtml(p.courier || 'Bluexpress') + '" />' +
                '<input class="adm-input" id="ped-track-' + p.id + '" placeholder="N° de seguimiento" value="' + escapeHtml(p.tracking || '') + '" />' +
                '<input class="adm-input" id="ped-turl-' + p.id + '" placeholder="Link de seguimiento (pégalo aquí)" value="' + escapeHtml(p.trackingUrl || '') + '" />' +
                '<button class="adm-btn-solido adm-btn-mini" data-role="ped-enviar" data-id="' + p.id + '">🚚 Marcar enviado y avisar por correo</button>' +
              '</div>' : '') +
            (est.id === 'enviado' ?
              '<div class="ped-enviado-info">🚚 ' + escapeHtml(p.courier || 'Bluexpress') + (p.tracking ? ' · ' + escapeHtml(p.tracking) : '') +
              (p.trackingUrl ? ' · <a href="' + escapeHtml(p.trackingUrl) + '" target="_blank" rel="noopener">ver seguimiento</a>' : '') + '</div>' : '') +
            (est.id !== 'nuevo' ? '<button class="adm-btn-borde adm-btn-mini" data-role="ped-estado" data-id="' + p.id + '" data-est="' + KV_PEDIDO_ESTADOS[Math.max(0, KV_PEDIDO_ESTADOS.findIndex(e => e.id === est.id) - 1)].id + '">↩ Retroceder</button>' : '') +
            '<button class="adm-btn-borde adm-btn-mini ped-borrar" data-role="ped-borrar" data-id="' + p.id + '">Eliminar</button>' +
          '</div>' +
        '</div>' : '') +
      '</div>';
    }).join('');
    conectarPedidos(cont);
  }
  function conectarPedidos(cont) {
    cont.querySelectorAll('[data-role="ped-toggle"]').forEach(n => n.addEventListener('click', () => {
      pedidosAbiertos[n.dataset.id] = !pedidosAbiertos[n.dataset.id];
      renderPedidos();
    }));
    cont.querySelectorAll('[data-role="ped-estado"]').forEach(n => n.addEventListener('click', () => {
      const id = n.dataset.id, est = n.dataset.est;
      // al verificar el pago se descuenta el stock (una sola vez por pedido)
      if (est === 'verificado') descontarStock(id);
      pedidosCol.doc(id).update({ estado: est }).catch(err => console.error(err));
    }));
    cont.querySelectorAll('[data-role="ped-borrar"]').forEach(n => n.addEventListener('click', () => {
      if (!window.confirm('¿Eliminar este pedido del panel? (no avisa a la clienta)')) return;
      pedidosCol.doc(n.dataset.id).delete().catch(err => console.error(err));
    }));
    cont.querySelectorAll('[data-role="ped-enviar"]').forEach(n => n.addEventListener('click', () => pedMarcarEnviado(n.dataset.id, n)));
    cont.querySelectorAll('[data-role="ped-verificar"]').forEach(n => n.addEventListener('click', () => pedVerificarPago(n.dataset.id, n)));
  }
  /* descuenta del stock lo que lleva el pedido. Solo afecta a los productos que
     tienen una cantidad anotada; los que están "sin control" quedan igual.
     Se marca en el pedido para no descontar dos veces si retrocede y vuelve. */
  function descontarStock(pedidoId) {
    const ped = pedidos.find(x => x.id === pedidoId);
    if (!ped || ped.stockDescontado) return;
    const avisos = [];
    (ped.items || []).forEach(it => {
      const p = products.find(x => x.id === it.id);
      const c = kvStockCantidad(p);
      if (c === null) return;                       // sin control de cantidad
      const nueva = Math.max(0, c - (it.qty || 0));
      if (c < (it.qty || 0)) avisos.push(p.name + ' (quedaban ' + c + ', pedidas ' + it.qty + ')');
      itemsCol.doc(it.id).update({ cantidad: nueva }).catch(err => console.error('Error descontando stock:', err));
    });
    pedidosCol.doc(pedidoId).update({ stockDescontado: true }).catch(err => console.error(err));
    if (avisos.length) window.alert('⚠ Ojo con el stock:\n\n• ' + avisos.join('\n• ') + '\n\nQuedaron en 0. Revisa si alcanzas a cumplir el pedido.');
  }

  /* Pregunta a Mercado Pago si el pago realmente se aprobó.
     Es importante: lo que dice la página al volver del pago NO es prueba
     (se puede falsificar escribiendo la dirección a mano). Esto sí lo es. */
  async function pedVerificarPago(id, btn) {
    const p = pedidos.find(x => x.id === id); if (!p) return;
    const url = String(settings.igPubUrl || '').trim();
    const clave = pubClave();
    if (!url || !clave) { window.alert('Falta configurar la URL del publicador y tu clave secreta en "Instagram y Facebook".'); return; }
    if (!p.pagoId) { window.alert('Este pedido no tiene número de pago de Mercado Pago.'); return; }
    const txt = btn.textContent; btn.disabled = true; btn.textContent = 'Consultando…';
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'mp-verificar', clave: clave, pagoId: p.pagoId })
      });
      const d = await r.json();
      if (!d || !d.ok) throw new Error((d && d.error) || 'No se pudo consultar');
      const aprobado = d.estado === 'approved';
      const montoOk = Math.abs(Number(d.monto || 0) - Number(p.total || 0)) < 1;
      await pedidosCol.doc(id).update({
        pagoEstado: d.estado,
        pagoDetalle: (aprobado ? 'Verificado el ' + new Date().toLocaleString('es-CL') : (d.detalle || '')) +
          (aprobado && !montoOk ? ' · ⚠ el monto pagado (' + formatCLP(d.monto) + ') NO calza con el total del pedido' : ''),
        pagoMedio: d.medio || ''
      });
      window.alert(aprobado
        ? (montoOk ? '✅ Pago CONFIRMADO por ' + formatCLP(d.monto) + '.\n\nYa puedes preparar el pedido.'
                   : '⚠ El pago está aprobado pero por ' + formatCLP(d.monto) + ', y el pedido es de ' + formatCLP(p.total) + '.\n\nRevisa antes de enviar.')
        : '⚠ Mercado Pago dice que el pago está en estado "' + d.estado + '".\n\nNO envíes el pedido hasta que aparezca como aprobado.');
    } catch (e) {
      window.alert('No se pudo verificar el pago: ' + e.message);
    }
    btn.disabled = false; btn.textContent = txt;
  }

  async function pedMarcarEnviado(id, btn) {
    const p = pedidos.find(x => x.id === id); if (!p) return;
    const courier = ($('ped-courier-' + id).value || 'Bluexpress').trim();
    const tracking = $('ped-track-' + id).value.trim();
    const trackingUrl = $('ped-turl-' + id).value.trim();
    if (!tracking && !window.confirm('No pusiste número de seguimiento. ¿Avisar igual a la clienta?')) return;
    const url = String(settings.igPubUrl || '').trim();
    const clave = pubClave();
    btn.disabled = true; btn.textContent = 'Enviando correo…';
    let correoOk = false;
    if (url && clave && (p.cliente || {}).correo) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'pedido-envio', clave: clave, num: p.num, correo: p.cliente.correo, nombre: p.cliente.nombre, courier: courier, tracking: tracking, trackingUrl: trackingUrl })
        });
        const d = await r.json();
        correoOk = !!(d && d.ok);
        if (!correoOk) console.warn('Correo de envío:', d && d.error);
      } catch (e) { console.warn('Correo de envío falló:', e); }
    }
    pedidosCol.doc(id).update({ estado: 'enviado', courier: courier, tracking: tracking, trackingUrl: trackingUrl, enviadoFecha: new Date().toISOString() })
      .catch(err => console.error(err));
    if (!correoOk) window.alert('El pedido quedó marcado como ENVIADO, pero el correo a la clienta no se pudo mandar (revisa la URL del publicador y tu clave secreta en "Instagram y Facebook", o avísale por WhatsApp).');
  }

  // ---------- VISITAS ----------
  const VIS_ICONO_DISP = { 'Móvil': '📱', 'Tablet': '📲', 'Escritorio': '💻' };
  const VIS_ICONO_ORIGEN = { 'Instagram': '📷', 'Facebook': '👍', 'WhatsApp': '💬', 'Google': '🔎', 'Directo': '🔗', 'Otro': '🌐' };
  const visitasAbiertas = {};   // id -> true (detalle con miniaturas desplegado)

  /* ---------- LO MÁS VISTO ----------
     Se cuenta cuántas visitas distintas abrieron cada producto, y también
     cuántas lo pusieron en el carrito (eso pesa más porque es más intención). */
  function rankingVistos() {
    const cuenta = new Map();
    const sumar = (id, peso) => { if (id) cuenta.set(id, (cuenta.get(id) || 0) + peso); };
    visitas.forEach(v => {
      (v.productosIds || []).forEach(id => sumar(id, 1));
      (v.carritoActual || []).forEach(it => sumar(it.id, 2));
    });
    pedidos.forEach(p => (p.items || []).forEach(it => sumar(it.id, 3)));
    return [...cuenta.entries()]
      .map(([id, n]) => ({ p: products.find(x => x.id === id), id: id, n: n }))
      .filter(r => r.p)
      .sort((a, b) => b.n - a.n);
  }
  function renderMasVistos() {
    const cont = $('adm-mv-lista'); if (!cont) return;
    const act = $('adm-mv-activo'), cuantos = $('adm-mv-cuantos'), estado = $('adm-mv-estado');
    const cfg = (settings && settings.masVistos) || {};
    if (act && document.activeElement !== act) act.checked = !!cfg.activo;
    if (cuantos && document.activeElement !== cuantos && cfg.cuantos) cuantos.value = String(cfg.cuantos);
    const rank = rankingVistos();
    if (estado) {
      const pub = kvMasVistosIds(settings).length;
      estado.textContent = cfg.activo
        ? (pub ? '✓ Se están mostrando ' + pub + ' productos en el catálogo.' : '⚠ Está activado pero aún no has publicado la lista: aprieta "Guardar y publicar".')
        : 'Desactivado: no aparece en el catálogo.';
    }
    if (!rank.length) {
      cont.innerHTML = '<p class="adm-seccion-sub">Todavía no hay suficientes visitas para armar el ranking.</p>';
      return;
    }
    const publicados = kvMasVistosIds(settings);
    cont.innerHTML = '<div class="adm-mv-grid">' + rank.slice(0, 20).map((r, i) => {
      const cat = kvCat(r.p.category, settings);
      return '<div class="adm-mv-item' + (publicados.indexOf(r.id) !== -1 ? ' pub' : '') + '">' +
        '<span class="adm-mv-pos">' + (i + 1) + '</span>' +
        (r.p.photo ? '<span class="vis-mini-foto" style="background-image:url(\'' + r.p.photo + '\')"></span>' : '<span class="vis-mini-foto vis-mini-sin">✦</span>') +
        '<span class="vis-mini-txt"><b>' + escapeHtml(r.p.name || '') + '</b>' +
          '<span>' + escapeHtml(r.p.code || '') + (cat ? ' · ' + escapeHtml(cat.nombre) : '') + '</span></span>' +
        '<span class="adm-mv-pts">' + r.n + ' pts</span>' +
      '</div>';
    }).join('') + '</div>' +
    '<p class="adm-focogen-estado">Los puntos suman: 1 por abrir el producto, 2 por ponerlo en el carrito y 3 por comprarlo. Los marcados en dorado son los que están publicados.</p>';
  }
  if ($('adm-mv-guardar')) $('adm-mv-guardar').addEventListener('click', () => {
    const n = parseInt($('adm-mv-cuantos').value, 10) || 8;
    const ids = rankingVistos().slice(0, n).map(r => r.id);
    if ($('adm-mv-activo').checked && !ids.length) {
      window.alert('Todavía no hay visitas suficientes para armar la lista. Actívalo más adelante.');
      return;
    }
    settingsRef.set({ masVistos: { activo: $('adm-mv-activo').checked, cuantos: n, ids: ids, fecha: new Date().toISOString() } }, { merge: true })
      .then(() => guardado('adm-mv-ok')).catch(err => console.error(err));
  });

  /* Botones para recuperar un carrito abandonado: abren WhatsApp o el correo
     con un mensaje ya escrito (tú lo revisas antes de enviarlo). */
  function recuperarBotones(v) {
    const c = v.contacto || {};
    const nombre = String(c.nombre || '').split(' ')[0] || 'hola';
    const lista = (v.carritoActual || []).map(it => '• ' + it.qty + '× ' + it.name).join('\n');
    const cup = kvCupones(settings).find(x => x.activo !== false);
    const gancho = cup ? '\n\nSi quieres, usa el código ' + cup.codigo + ' (' + kvCuponTexto(cup) + ') 💜' : '';
    const msg = 'Hola ' + nombre + ' 💜 Soy de Karivé Joyas. Vi que dejaste esto en tu carrito:\n\n' + lista +
      '\n\n¿Te ayudo a terminar tu compra? Quedan poquitas unidades ✨' + gancho;
    const tel = String(c.telefono || '').replace(/[^0-9]/g, '');
    const asunto = 'Se te quedó algo en el carrito 💜 Karivé Joyas';
    let h = '';
    if (tel) h += '<a class="adm-btn-solido adm-btn-mini" target="_blank" rel="noopener" href="https://wa.me/' + (tel.length <= 9 ? '56' + tel : tel) + '?text=' + encodeURIComponent(msg) + '">💬 Escribir por WhatsApp</a>';
    h += '<a class="adm-btn-borde adm-btn-mini" href="mailto:' + escapeHtml(c.correo) + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(msg) + '">✉️ Escribir por correo</a>';
    return h;
  }

  /* miniatura + código + colección de un producto que la visitante miró.
     Si el producto ya no existe (lo borraste), igual muestra el nombre guardado. */
  function visMiniHtml(pid, nombreGuardado, qty) {
    const p = products.find(x => x.id === pid);
    const nombre = (p && p.name) || nombreGuardado || 'Producto eliminado';
    const cat = p ? kvCat(p.category, settings) : null;
    const foto = p && p.photo
      ? '<span class="vis-mini-foto" style="background-image:url(\'' + p.photo + '\')"></span>'
      : '<span class="vis-mini-foto vis-mini-sin">✦</span>';
    return '<div class="vis-mini">' + foto +
      '<div class="vis-mini-txt">' +
        '<b>' + (qty ? qty + '× ' : '') + escapeHtml(nombre) + '</b>' +
        '<span>' + (p ? escapeHtml(p.code || '') : '—') +
          (cat ? ' · ' + escapeHtml(cat.nombre) : (p ? '' : ' · ya no está en el catálogo')) + '</span>' +
      '</div>' +
    '</div>';
  }
  function renderVisitas() {
    const statsEl = $('adm-vis-stats');
    if (statsEl) {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const semana = Date.now() - 7 * 24 * 3600 * 1000;
      const esHoy = v => { const f = new Date(v.creada || v.ultima || 0); return f.getTime() >= hoy.getTime(); };
      const esSemana = v => new Date(v.creada || v.ultima || 0).getTime() >= semana;
      const total = visitas.length;
      const nHoy = visitas.filter(esHoy).length;
      const nSemana = visitas.filter(esSemana).length;
      const nCarrito = visitas.filter(v => v.agregoCarrito).length;
      const nPedido = visitas.filter(v => v.hizoPedido).length;
      const nAbandonado = visitas.filter(v => !v.hizoPedido && (v.carritoActual || []).length > 0).length;
      statsEl.innerHTML =
        '<div class="vis-stat"><b>' + total + '</b><span>Visitas (últimas 300)</span></div>' +
        '<div class="vis-stat"><b>' + nHoy + '</b><span>Hoy</span></div>' +
        '<div class="vis-stat"><b>' + nSemana + '</b><span>Últimos 7 días</span></div>' +
        '<div class="vis-stat"><b>' + nCarrito + '</b><span>Agregaron al carrito</span></div>' +
        '<div class="vis-stat"><b>' + nPedido + '</b><span>Hicieron un pedido</span></div>' +
        '<div class="vis-stat"><b>' + nAbandonado + '</b><span>Carritos abandonados</span></div>';
    }
    const cont = $('adm-visitas-lista'); if (!cont) return;
    if (!visitas.length) {
      cont.innerHTML = '<p class="adm-seccion-sub">Aún no hay visitas registradas. Aparecerán aquí a medida que la gente vea el catálogo. 👀</p>';
      return;
    }
    cont.innerHTML = '<div class="vis-lista">' + visitas.map(v => {
      const region = (v.region || '').replace(/Metropolitan$/i, 'Metropolitana');
      const ubicPartes = [v.ciudad, region !== v.ciudad ? region : ''].filter(Boolean);
      const ubic = ubicPartes.length ? ubicPartes.join(', ') + (v.pais ? ' · ' + v.pais : '') : (v.pais || 'Ubicación no disponible');
      const colecciones = (v.colecciones || []).map(c => '<span class="vis-chip">' + escapeHtml(c) + '</span>').join('');
      const nProd = Math.max((v.productos || []).length, (v.productosIds || []).length);
      const carritoAbandonado = !v.hizoPedido && (v.carritoActual || []).length > 0;
      const abierta = !!visitasAbiertas[v.id];
      // miniaturas de los productos que miró (solo al desplegar la tarjeta)
      const miniVistos = (v.productosIds || []).map((pid, i) => {
        const nombre = (v.productos || [])[i] || '';
        return visMiniHtml(pid, nombre);
      }).join('');
      const miniCarrito = (v.carritoActual || []).map(it => visMiniHtml(it.id, it.name, it.qty)).join('');
      const carritoHtml = (v.carritoActual || []).length
        ? '<div class="vis-fila' + (carritoAbandonado ? ' vis-carro-abandonado' : '') + '">' + (carritoAbandonado ? '🛒⚠ Carrito abandonado: ' : '🛒 Carrito: ') +
          (v.carritoActual || []).map(it => it.qty + '× ' + escapeHtml(it.name)).join(', ') +
          ' — ' + formatCLP(v.carritoTotal || 0) + '</div>'
        : '';
      const c = v.contacto || {};
      const contactoHtml = c.correo ? (
        '<div class="vis-sub">Alcanzó a dejar sus datos</div>' +
        '<div class="vis-contacto">' +
          '<div><b>' + escapeHtml(c.nombre || 'Sin nombre') + '</b></div>' +
          '<div>✉️ ' + escapeHtml(c.correo) + '</div>' +
          (c.telefono ? '<div>📱 ' + escapeHtml(c.telefono) + '</div>' : '') +
          (carritoAbandonado ? '<div class="vis-recuperar">' + recuperarBotones(v) + '</div>' : '') +
        '</div>') : (carritoAbandonado
          ? '<div class="vis-fila vis-sincontacto">No alcanzó a dejar sus datos, así que no hay cómo escribirle.</div>' : '');
      const detalleHtml = abierta ? (
        '<div class="vis-detalle">' +
          (miniVistos ? '<div class="vis-sub">Productos que miró</div><div class="vis-minis">' + miniVistos + '</div>' : '') +
          (miniCarrito ? '<div class="vis-sub">' + (carritoAbandonado ? 'Quedó en su carrito' : 'En su carrito') + '</div><div class="vis-minis">' + miniCarrito + '</div>' : '') +
          contactoHtml +
          (!miniVistos && !miniCarrito ? '<div class="vis-fila">Solo navegó, no abrió ningún producto.</div>' : '') +
        '</div>') : '';
      const hayDetalle = nProd > 0 || (v.carritoActual || []).length > 0;
      return '<div class="vis-card' + (abierta ? ' abierta' : '') + (hayDetalle ? ' vis-click' : '') + '"' +
        (hayDetalle ? ' data-role="vis-toggle" data-id="' + v.id + '" role="button" tabindex="0"' : '') + '>' +
        '<div class="vis-fila-top">' +
          '<span class="vis-fecha">' + pedFecha(v.ultima || v.creada) + '</span>' +
          '<span class="vis-dispo">' + (VIS_ICONO_DISP[v.dispositivo] || '💻') + ' ' + escapeHtml(v.dispositivo || '') + ' · ' + escapeHtml(v.so || '') + ' · ' + escapeHtml(v.navegador || '') + '</span>' +
          '<button type="button" class="vis-borrar" data-role="vis-borrar" data-id="' + v.id + '" title="Eliminar">✕</button>' +
        '</div>' +
        '<div class="vis-fila">📍 ' + escapeHtml(ubic) + '</div>' +
        '<div class="vis-fila">' + (VIS_ICONO_ORIGEN[v.origenTipo] || '🌐') + ' Llegó desde: ' + escapeHtml(v.origenTipo || 'Directo') + (v.origenHost ? ' (' + escapeHtml(v.origenHost) + ')' : '') + '</div>' +
        (colecciones ? '<div class="vis-fila">Colecciones vistas: ' + colecciones + '</div>' : '') +
        (nProd ? '<div class="vis-fila">🔍 Vio ' + nProd + ' producto' + (nProd === 1 ? '' : 's') + '</div>' : '') +
        carritoHtml +
        (v.hizoPedido ? '<div class="vis-fila vis-destacado">✅ Hizo un pedido</div>' : '') +
        (hayDetalle ? '<div class="vis-vermas">' + (abierta ? '▴ Ocultar detalle' : '▾ Ver qué miró') + '</div>' : '') +
        detalleHtml +
      '</div>';
    }).join('') + '</div>';
    cont.querySelectorAll('[data-role="vis-toggle"]').forEach(n => {
      const abrir = (e) => {
        if (e.target.closest('[data-role="vis-borrar"]')) return;   // la ✕ no despliega
        visitasAbiertas[n.dataset.id] = !visitasAbiertas[n.dataset.id];
        renderVisitas();
      };
      n.addEventListener('click', abrir);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(e); } });
    });
    cont.querySelectorAll('[data-role="vis-borrar"]').forEach(n => n.addEventListener('click', (e) => {
      e.stopPropagation();
      visitasCol.doc(n.dataset.id).delete().catch(err => console.error(err));
    }));
  }
  // ---------- RESEÑAS ----------
  /* Al aprobar/rechazar se vuelve a armar la lista PÚBLICA en la configuración.
     Así el catálogo solo ve las aprobadas, sin acceso a las pendientes. */
  function publicarResenas(extraAprobada) {
    const aprobadas = resenas.filter(r => r.aprobada || (extraAprobada && r.id === extraAprobada));
    const publica = aprobadas.map(r => ({
      producto: r.producto || '', estrellas: Number(r.estrellas) || 0,
      nombre: String(r.nombre || '').slice(0, 40), texto: String(r.texto || '').slice(0, 400), fecha: r.fecha || ''
    }));
    return settingsRef.set({ resenas: publica }, { merge: true });
  }
  function renderResenas() {
    const badge = $('adm-res-badge');
    const pend = resenas.filter(r => !r.aprobada).length;
    if (badge) { badge.textContent = pend; badge.hidden = pend === 0; }
    const cont = $('adm-resenas-lista'); if (!cont) return;
    if (!resenas.length) {
      cont.innerHTML = '<p class="adm-seccion-sub">Todavía no hay opiniones. Aparecerán aquí cuando tus clientas escriban una ⭐</p>';
      return;
    }
    const orden = resenas.slice().sort((a, b) => (a.aprobada ? 1 : 0) - (b.aprobada ? 1 : 0));
    cont.innerHTML = '<div class="adm-res-lista">' + orden.map(r => {
      const p = products.find(x => x.id === r.producto);
      const nom = (p && p.name) || r.productoNombre || 'Producto eliminado';
      return '<div class="adm-res' + (r.aprobada ? ' aprobada' : '') + '">' +
        '<div class="adm-res-top">' +
          (p && p.photo ? '<span class="vis-mini-foto" style="background-image:url(\'' + p.photo + '\')"></span>' : '<span class="vis-mini-foto vis-mini-sin">✦</span>') +
          '<div class="adm-res-txt">' +
            '<b>' + escapeHtml(nom) + '</b>' +
            '<span>' + kvEstrellas(Number(r.estrellas) || 0, 'kv-estrellas chico') + ' · ' + escapeHtml(r.nombre || 'Anónima') + ' · ' + pedFecha(r.fecha) + '</span>' +
          '</div>' +
          '<span class="adm-res-estado">' + (r.aprobada ? '✅ publicada' : '⏳ pendiente') + '</span>' +
        '</div>' +
        (r.texto ? '<p class="adm-res-com">' + escapeHtml(r.texto) + '</p>' : '<p class="adm-res-com adm-res-sincom">(solo puso estrellas, sin comentario)</p>') +
        '<div class="adm-res-acciones">' +
          (r.aprobada
            ? '<button class="adm-btn-borde adm-btn-mini" data-role="res-ocultar" data-id="' + r.id + '">Quitar del catálogo</button>'
            : '<button class="adm-btn-solido adm-btn-mini" data-role="res-aprobar" data-id="' + r.id + '">✅ Publicar</button>') +
          '<button class="adm-btn-borde adm-btn-mini adm-btn-del-cat" data-role="res-borrar" data-id="' + r.id + '">Eliminar</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
    cont.querySelectorAll('[data-role="res-aprobar"]').forEach(n => n.addEventListener('click', () => {
      const id = n.dataset.id;
      resenasCol.doc(id).update({ aprobada: true })
        .then(() => publicarResenas(id)).catch(err => console.error(err));
    }));
    cont.querySelectorAll('[data-role="res-ocultar"]').forEach(n => n.addEventListener('click', () => {
      const id = n.dataset.id;
      const r = resenas.find(x => x.id === id); if (r) r.aprobada = false;
      resenasCol.doc(id).update({ aprobada: false })
        .then(() => publicarResenas()).catch(err => console.error(err));
    }));
    cont.querySelectorAll('[data-role="res-borrar"]').forEach(n => n.addEventListener('click', () => {
      if (!window.confirm('¿Eliminar esta opinión para siempre?')) return;
      const id = n.dataset.id;
      resenas = resenas.filter(x => x.id !== id);
      resenasCol.doc(id).delete().then(() => publicarResenas()).catch(err => console.error(err));
    }));
  }

  // ---------- ORDENAR CÓDIGOS ----------
  /* Calcula qué código DEBERÍA tener cada producto: correlativo dentro de su
     colección (según el orden en que están), con el prefijo de esa colección.
     No escribe nada: solo propone. */
  let codPropuesta = [];
  function calcularCodigos() {
    const cats = kvCategorias(settings);
    const cambios = [];
    cats.concat([{ id: '__otros__', nombre: 'Sin colección', prefijo: 'PR' }]).forEach(cat => {
      const suyos = products
        .filter(p => cat.id === '__otros__' ? !cats.some(c => c.id === p.category) : p.category === cat.id)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      const pre = cat.prefijo || 'PR';
      suyos.forEach((p, i) => {
        const nuevo = pre + '-' + String(i + 1).padStart(3, '0');
        if ((p.code || '') !== nuevo) {
          cambios.push({ id: p.id, nombre: p.name || '(sin nombre)', coleccion: cat.nombre, antes: p.code || '(sin código)', ahora: nuevo });
        }
      });
    });
    return cambios;
  }
  function contarRepetidos() {
    const c = {};
    products.forEach(p => { const k = p.code || ''; c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).filter(k => k && c[k] > 1);
  }
  if ($('adm-cod-revisar')) $('adm-cod-revisar').addEventListener('click', () => {
    codPropuesta = calcularCodigos();
    const inf = $('adm-cod-informe'), btn = $('adm-cod-aplicar');
    const rep = contarRepetidos();
    if (!codPropuesta.length) {
      inf.innerHTML = '<p class="adm-focogen-estado">✅ Todos los códigos ya están correlativos y con su prefijo correcto.</p>';
      btn.hidden = true;
      return;
    }
    inf.innerHTML = '<p class="adm-focogen-estado">Se cambiarían <b>' + codPropuesta.length + '</b> código(s)' +
        (rep.length ? ', y se arreglarían los repetidos: <b>' + rep.join(', ') + '</b>' : '') + '. Las fotos, nombres y precios <b>no se tocan</b>.</p>' +
      '<div class="adm-cod-tabla">' + codPropuesta.map(c =>
        '<div class="adm-cod-fila"><span class="adm-cod-col">' + escapeHtml(c.coleccion) + '</span>' +
        '<span class="adm-cod-nom">' + escapeHtml(c.nombre) + '</span>' +
        '<span class="adm-cod-antes">' + escapeHtml(c.antes) + '</span>' +
        '<span class="adm-cod-flecha">→</span>' +
        '<span class="adm-cod-ahora">' + escapeHtml(c.ahora) + '</span></div>').join('') + '</div>';
    btn.hidden = false;
  });
  if ($('adm-cod-aplicar')) $('adm-cod-aplicar').addEventListener('click', () => {
    if (!codPropuesta.length) return;
    if (!window.confirm('Se cambiarán ' + codPropuesta.length + ' código(s).\n\nSolo cambia el CÓDIGO: nombres, precios, fotos y tamaños quedan igual.\n\n¿Continuar?')) return;
    const btn = $('adm-cod-aplicar'); btn.disabled = true; btn.textContent = 'Aplicando…';
    // se hace en dos pasos para no chocar con un código que todavía usa otro producto
    const paso1 = kvDb.batch();
    codPropuesta.forEach(c => paso1.update(itemsCol.doc(c.id), { code: 'TMP-' + c.id }));
    paso1.commit().then(() => {
      const paso2 = kvDb.batch();
      codPropuesta.forEach(c => paso2.update(itemsCol.doc(c.id), { code: c.ahora }));
      return paso2.commit();
    }).then(() => {
      guardado('adm-cod-ok');
      $('adm-cod-informe').innerHTML = '<p class="adm-focogen-estado">✅ Listo: ' + codPropuesta.length + ' código(s) ordenados.</p>';
      codPropuesta = []; btn.hidden = true;
    }).catch(err => {
      console.error(err);
      window.alert('No se pudieron ordenar los códigos: ' + err.message);
    }).then(() => { btn.disabled = false; btn.textContent = 'Aplicar los cambios'; });
  });

  // ---------- MEDIOS DE PAGO ----------
  function poblarPagos() {
    const mp = kvMercadoPago(settings);
    if ($('adm-mp-activo') && document.activeElement !== $('adm-mp-activo')) $('adm-mp-activo').checked = mp.activo;
    if ($('adm-mp-prueba') && document.activeElement !== $('adm-mp-prueba')) $('adm-mp-prueba').checked = mp.prueba;
  }
  if ($('adm-mp-guardar')) $('adm-mp-guardar').addEventListener('click', () => {
    const activo = $('adm-mp-activo').checked;
    if (activo && !window.confirm('¿Ya pegaste tu Access Token en el script de Google y ejecutaste probarMercadoPago?\n\nSi no lo has hecho, el botón de tarjeta va a dar error a tus clientas.')) return;
    settingsRef.set({ pagos: { mercadopago: { activo: activo, prueba: $('adm-mp-prueba').checked } } }, { merge: true })
      .then(() => guardado('adm-mp-ok')).catch(err => console.error(err));
  });

  // ---------- CORREOS Y CUPONES ----------
  function poblarMarketing() {
    const b = kvBienvenida(settings);
    if ($('adm-bien-activo')) $('adm-bien-activo').checked = b.activo;
    if ($('adm-bien-pct')) $('adm-bien-pct').value = b.pct;
    if ($('adm-bien-codigo')) $('adm-bien-codigo').value = b.codigo;
    if ($('adm-bien-titulo')) $('adm-bien-titulo').value = b.titulo;
    if ($('adm-bien-texto')) $('adm-bien-texto').value = b.texto;
    const aviso = $('adm-bien-aviso');
    if (aviso) {
      const existe = kvCupones(settings).some(c => kvCuponNormalizar(c.codigo) === b.codigo);
      aviso.textContent = b.activo && !existe
        ? '⚠ El código "' + b.codigo + '" todavía no existe como cupón: créalo más abajo o el descuento no se podrá usar.'
        : (b.activo ? '✓ Todo listo: el cupón "' + b.codigo + '" existe y está activo.' : '');
    }
    renderCupones();
  }
  if ($('adm-bien-guardar')) $('adm-bien-guardar').addEventListener('click', () => {
    const pct = parseInt($('adm-bien-pct').value, 10);
    settingsRef.set({ bienvenida: {
      activo: $('adm-bien-activo').checked,
      pct: isNaN(pct) ? 10 : pct,
      codigo: kvCuponNormalizar($('adm-bien-codigo').value) || 'BIENVENIDA10',
      titulo: $('adm-bien-titulo').value.trim(),
      texto: $('adm-bien-texto').value.trim()
    } }, { merge: true }).then(() => guardado('adm-bien-ok')).catch(err => console.error(err));
  });

  /* cuántas veces se usó cada cupón (se cuenta desde los pedidos) */
  function cuponUsos(codigo) {
    const cod = kvCuponNormalizar(codigo);
    return pedidos.filter(p => p.cupon && kvCuponNormalizar(p.cupon.codigo) === cod).length;
  }
  function renderCupones() {
    const cont = $('adm-cupones-lista'); if (!cont) return;
    const cups = kvCupones(settings);
    if (!cups.length) {
      cont.innerHTML = '<p class="adm-seccion-sub">Todavía no hay cupones. Crea uno abajo 🎟</p>';
      return;
    }
    cont.innerHTML = '<div class="adm-cup-lista">' + cups.map((c, i) => {
      const usos = cuponUsos(c.codigo);
      const vencido = c.hasta && new Date(c.hasta + 'T23:59:59') < new Date();
      const off = c.activo === false || vencido;
      return '<div class="adm-cup' + (off ? ' off' : '') + '">' +
        '<div class="adm-cup-cod">' + escapeHtml(c.codigo) + '</div>' +
        '<div class="adm-cup-info">' +
          '<b>' + escapeHtml(kvCuponTexto(c)) + '</b>' +
          '<span>' + (Number(c.minimo || 0) > 0 ? 'Sobre ' + formatCLP(Number(c.minimo)) + ' · ' : '') +
            (c.hasta ? (vencido ? 'venció el ' + c.hasta : 'hasta el ' + c.hasta) : 'sin vencimiento') +
            ' · usado ' + usos + ' ' + (usos === 1 ? 'vez' : 'veces') + '</span>' +
        '</div>' +
        '<button type="button" class="adm-btn-borde adm-btn-mini" data-role="cup-toggle" data-i="' + i + '">' + (c.activo === false ? 'Activar' : 'Desactivar') + '</button>' +
        '<button type="button" class="adm-btn-borde adm-btn-mini adm-btn-del-cat" data-role="cup-borrar" data-i="' + i + '">Eliminar</button>' +
      '</div>';
    }).join('') + '</div>';
    cont.querySelectorAll('[data-role="cup-toggle"]').forEach(n => n.addEventListener('click', () => {
      const lista = kvCupones(settings).slice();
      const i = parseInt(n.dataset.i, 10);
      lista[i] = Object.assign({}, lista[i], { activo: lista[i].activo === false });
      guardarCupones(lista);
    }));
    cont.querySelectorAll('[data-role="cup-borrar"]').forEach(n => n.addEventListener('click', () => {
      const lista = kvCupones(settings).slice();
      const i = parseInt(n.dataset.i, 10);
      if (!window.confirm('¿Eliminar el cupón "' + lista[i].codigo + '"?\n\nQuien lo tenga guardado ya no podrá usarlo.')) return;
      lista.splice(i, 1);
      guardarCupones(lista);
    }));
  }
  function guardarCupones(lista) {
    settingsRef.set({ cupones: lista }, { merge: true }).catch(err => console.error(err));
  }
  if ($('adm-cup-agregar')) $('adm-cup-agregar').addEventListener('click', () => {
    const codigo = kvCuponNormalizar($('adm-cup-codigo').value);
    const valor = parseInt(String($('adm-cup-valor').value).replace(/[^0-9]/g, ''), 10);
    const minimo = parseInt(String($('adm-cup-minimo').value).replace(/[^0-9]/g, ''), 10);
    const tipo = $('adm-cup-tipo').value === 'monto' ? 'monto' : 'pct';
    if (!codigo) { window.alert('Escribe un código para el cupón.'); return; }
    if (isNaN(valor) || valor <= 0) { window.alert('Escribe el valor del descuento.'); return; }
    if (tipo === 'pct' && valor > 90) { window.alert('El porcentaje no puede ser mayor a 90%.'); return; }
    if (kvCupones(settings).some(c => kvCuponNormalizar(c.codigo) === codigo)) { window.alert('Ya existe un cupón con ese código.'); return; }
    const lista = kvCupones(settings).concat([{
      codigo: codigo, tipo: tipo, valor: valor,
      minimo: isNaN(minimo) ? 0 : minimo,
      hasta: $('adm-cup-hasta').value || '',
      activo: true
    }]);
    guardarCupones(lista);
    $('adm-cup-codigo').value = ''; $('adm-cup-valor').value = ''; $('adm-cup-minimo').value = ''; $('adm-cup-hasta').value = '';
  });

  /* correos registrados: se agrupan por correo (si alguien se inscribió dos veces) */
  function suscritosUnicos() {
    const mapa = new Map();
    suscritos.forEach(s => {
      const c = String(s.correo || '').toLowerCase().trim();
      if (!c) return;
      if (!mapa.has(c)) mapa.set(c, Object.assign({}, s, { correo: c, veces: 1 }));
      else mapa.get(c).veces++;
    });
    return [...mapa.values()];
  }
  function renderSuscritos() {
    const cont = $('adm-suscriptores-lista'); if (!cont) return;
    const lista = suscritosUnicos();
    const cuenta = $('adm-sus-cuenta');
    if (cuenta) cuenta.textContent = lista.length + ' correo' + (lista.length === 1 ? '' : 's') + ' registrado' + (lista.length === 1 ? '' : 's');
    if (!lista.length) {
      cont.innerHTML = '<p class="adm-seccion-sub">Todavía no hay correos. Activa el regalo de bienvenida para empezar a juntarlos 💌</p>';
      return;
    }
    // ¿ya compró? se cruza con los pedidos
    const correosConPedido = new Set(pedidos.map(p => String((p.cliente || {}).correo || '').toLowerCase()));
    cont.innerHTML = '<div class="adm-sus-lista">' + lista.map(s =>
      '<div class="adm-sus">' +
        '<span class="adm-sus-mail">' + escapeHtml(s.correo) + '</span>' +
        '<span class="adm-sus-meta">' + pedFecha(s.fecha) + (s.origen ? ' · ' + escapeHtml(s.origen) : '') + '</span>' +
        (correosConPedido.has(s.correo) ? '<span class="adm-sus-compro">✅ ya compró</span>' : '<span class="adm-sus-nocompro">— sin compras</span>') +
        '<button type="button" class="vis-borrar" data-role="sus-borrar" data-id="' + s.id + '" title="Eliminar">✕</button>' +
      '</div>').join('') + '</div>';
    cont.querySelectorAll('[data-role="sus-borrar"]').forEach(n => n.addEventListener('click', () => {
      if (!window.confirm('¿Eliminar este correo de la lista?')) return;
      suscritosCol.doc(n.dataset.id).delete().catch(err => console.error(err));
    }));
  }
  if ($('adm-sus-copiar')) $('adm-sus-copiar').addEventListener('click', async () => {
    const txt = suscritosUnicos().map(s => s.correo).join(', ');
    if (!txt) { window.alert('Todavía no hay correos que copiar.'); return; }
    try { await navigator.clipboard.writeText(txt); $('adm-sus-copiar').textContent = '✓ Copiados'; setTimeout(() => { $('adm-sus-copiar').textContent = '📋 Copiar todos los correos'; }, 2200); }
    catch (e) { window.prompt('Copia los correos desde aquí:', txt); }
  });
})();