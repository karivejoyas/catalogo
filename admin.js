(() => {
  'use strict';

  const ADMIN_EMAIL = 'karive.joyas@gmail.com';
  const $ = (id) => document.getElementById(id);

  let products = [];
  let settings = {};

  const itemsCol = kvDb.collection('catalog').doc('products').collection('items');
  const settingsRef = kvDb.collection('catalog').doc('settings');
  let unsubItems = null, unsubSettings = null;

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

  // ---------- pestañas ----------
  document.querySelectorAll('.adm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.adm-tab').forEach(t => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('.adm-panel').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  // ---------- datos ----------
  function escuchar() {
    if (unsubItems) return;
    unsubItems = itemsCol.orderBy('order').onSnapshot((snap) => {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (products.length === 0) { sembrar(); return; }
      renderProductosGuarded();
      renderIG();
    }, (err) => console.error('Error leyendo productos:', err));
    unsubSettings = settingsRef.onSnapshot((doc) => {
      settings = doc.data() || {};
      poblarCampos();
      renderCatsEditorGuarded();
      renderProductosGuarded();
      renderIG();
    }, (err) => console.error('Error leyendo configuración:', err));
  }
  function dejarDeEscuchar() {
    if (unsubItems) { unsubItems(); unsubItems = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    products = [];
  }
  function sembrar() {
    const batch = kvDb.batch();
    KV_PRODUCTOS_INICIALES().forEach((p, i) => batch.set(itemsCol.doc('p' + String(i + 1).padStart(3, '0')), p));
    batch.commit().catch(err => console.error('Error sembrando:', err));
  }

  // ---------- PRODUCTOS ----------
  function actualizar(id, campo, valor) {
    itemsCol.doc(id).update({ [campo]: valor }).catch(err => console.error('Error guardando:', err));
  }
  function eliminar(id) {
    if (!window.confirm('¿Eliminar este producto del catálogo?')) return;
    itemsCol.doc(id).delete().catch(err => console.error('Error eliminando:', err));
  }
  function agregar(categoria) {
    const cat = kvCategorias(settings).find(c => c.id === categoria);
    const maxOrder = products.reduce((m, p) => Math.max(m, p.order || 0), 0);
    const num = kvNextNumCat(products, categoria);   // sigue el correlativo de esa colección
    itemsCol.add({
      code: (cat && cat.prefijo ? cat.prefijo : 'PR') + '-' + String(num).padStart(3, '0'),
      name: 'Nuevo producto', detail: '', price: 0, priceOffer: 0, photo: null, category: categoria, order: maxOrder + 1, stock: true
    }).catch(err => console.error('Error agregando:', err));
  }

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

  $('adm-reset').addEventListener('click', () => {
    if (!window.confirm('Esto reemplazará todo tu catálogo por los productos iniciales. ¿Continuar?')) return;
    itemsCol.get().then((snap) => {
      const batch = kvDb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      KV_PRODUCTOS_INICIALES().forEach((p, i) => batch.set(itemsCol.doc('p' + String(i + 1).padStart(3, '0')), p));
      return batch.commit();
    }).catch(err => console.error('Error restaurando:', err));
  });

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
    nav += '</div>';
    let html = nav;
    cats.forEach(cat => {
      const items = products.filter(p => p.category === cat.id);
      html +=
        '<section class="adm-seccion" id="sec-' + cat.id + '">' +
          '<h2 class="adm-seccion-titulo">' + escapeHtml(cat.nombre) + ' <span class="adm-tag">(' + items.length + ')</span>' +
            ' <button type="button" class="adm-btn-solido adm-btn-mini" data-role="add" data-cat="' + cat.id + '">+ Agregar producto</button></h2>' +
          '<div class="adm-grilla">' + items.map(p => kvCardEditHtml(p, cats)).join('') + '</div>' +
        '</section>';
    });
    if (huerfanos.length) {
      html += '<section class="adm-seccion" id="sec-huerfanos"><h2 class="adm-seccion-titulo">Sin colección <span class="adm-tag">(' + huerfanos.length + ')</span></h2>' +
        '<p class="adm-seccion-sub">Estos productos quedaron sin colección. Cámbiales la colección con el selector 📁 de cada uno.</p>' +
        '<div class="adm-grilla">' + huerfanos.map(p => kvCardEditHtml(p, cats)).join('') + '</div></section>';
    }
    $('adm-categorias').innerHTML = html;
    $('adm-categorias').querySelectorAll('[data-goto]').forEach(n => n.addEventListener('click', e => {
      const s = document.getElementById(e.currentTarget.dataset.goto);
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    conectarProductos();
  }

  function conectarProductos() {
    const r = $('adm-categorias');
    r.querySelectorAll('[data-role="add"]').forEach(n => n.addEventListener('click', e => agregar(e.currentTarget.dataset.cat)));
    r.querySelectorAll('[data-role="code"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'code', e.target.value)));
    r.querySelectorAll('[data-role="name"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'name', e.target.value)));
    r.querySelectorAll('[data-role="detail"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'detail', e.target.value)));
    r.querySelectorAll('[data-role="price"]').forEach(n => n.addEventListener('change', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      actualizar(e.target.dataset.id, 'price', isNaN(num) ? 0 : num);
    }));
    r.querySelectorAll('[data-role="priceOffer"]').forEach(n => n.addEventListener('change', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      actualizar(e.target.dataset.id, 'priceOffer', isNaN(num) ? 0 : num);
    }));
    r.querySelectorAll('[data-role="category"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'category', e.target.value)));
    r.querySelectorAll('[data-role="delete"]').forEach(n => n.addEventListener('click', e => eliminar(e.target.dataset.id)));
    r.querySelectorAll('[data-role="mover"]').forEach(n => n.addEventListener('click', e => moverProducto(e.currentTarget.dataset.id, e.currentTarget.dataset.dir)));
    r.querySelectorAll('[data-role="stock"]').forEach(n => n.addEventListener('change', e => {
      actualizar(e.target.dataset.id, 'stock', e.target.checked);
      const card = e.target.closest('.cat-card-edit');
      if (card) card.classList.toggle('sin-stock', !e.target.checked);
      const lbl = e.target.closest('.ed-stock');
      if (lbl) { lbl.classList.toggle('is-off', !e.target.checked); const t = lbl.querySelector('.ed-stock-txt'); if (t) t.textContent = e.target.checked ? 'En stock' : 'Sin stock (oculto)'; }
    }));
    r.querySelectorAll('[data-role^="foco-"]').forEach(n => {
      n.addEventListener('input', e => aplicarFocoPreview(e.target.dataset.id));
      n.addEventListener('change', e => actualizar(e.target.dataset.id, 'foco', focoDeCard(e.target.dataset.id)));
    });
    r.querySelectorAll('[data-role="remove-photo"]').forEach(n => n.addEventListener('click', e => actualizar(e.target.dataset.id, 'photo', null)));
    r.querySelectorAll('[data-role="upload"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, (data) => actualizar(e.target.dataset.id, 'photo', data), 1000, 0.88);
      e.target.value = '';
    }));
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
    bg.style.backgroundPosition = f.x + '% ' + f.y + '%';
    bg.style.transform = 'scale(' + (f.zoom / 100) + ')';
    bg.style.transformOrigin = f.x + '% ' + f.y + '%';
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
  function cerrarIGModal() { igModal.hidden = true; igEstado(''); }
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

  $('ig-m-publicar').addEventListener('click', async () => {
    const url = String(settings.igPubUrl || '').trim();
    const clave = String(settings.igPubClave || '').trim();
    if (!url) { igEstado('⚠ Falta configurar la URL del publicador (sección "Conexión con el publicador", abajo).'); return; }
    if (!igPreviewImgs.length) { igEstado('⚠ Primero genera la vista previa.'); return; }
    const btn = $('ig-m-publicar');
    btn.disabled = true;
    igEstado('Publicando… puede tardar hasta 1 minuto ⏳ (no cierres esta ventana)');
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: evita bloqueos CORS
        body: JSON.stringify({ clave: clave, caption: $('ig-m-caption').value, images: igPreviewImgs.map(u => u.split(',')[1]) })
      });
      const d = await r.json();
      if (d && d.ok) {
        let msg = '✅ ¡Publicado en Instagram';
        if (d.fb === 'ok') msg += ' y Facebook';
        msg += '! Revisa tu perfil.';
        if (d.fb && d.fb !== 'ok' && d.fb !== 'no configurado') msg += ' ⚠ Facebook: ' + d.fb;
        igEstado(msg);
        igSel.clear(); renderIG();
      } else {
        igEstado('❌ ' + ((d && d.error) || 'Error desconocido al publicar.'));
      }
    } catch (err) {
      igEstado('❌ No se pudo contactar al publicador: ' + err.message);
    }
    btn.disabled = false;
  });

  // ---------- IA (Gemini principal / Groq respaldo) ----------
  // Las claves viven SOLO en este navegador (localStorage): la configuración del
  // catálogo es públicamente legible y guardarlas ahí las expondría.
  const IA_LS = { gem: 'kv_ia_gemini', groq: 'kv_ia_groq', pref: 'kv_ia_pref' };
  function iaKeys() {
    return {
      gem: localStorage.getItem(IA_LS.gem) || '',
      groq: localStorage.getItem(IA_LS.groq) || '',
      pref: localStorage.getItem(IA_LS.pref) || 'gemini'
    };
  }
  $('ia-guardar').addEventListener('click', () => {
    localStorage.setItem(IA_LS.gem, $('ia-key-gemini').value.trim());
    localStorage.setItem(IA_LS.groq, $('ia-key-groq').value.trim());
    localStorage.setItem(IA_LS.pref, (document.querySelector('input[name="ia-pref"]:checked') || {}).value || 'gemini');
    guardado('ia-keys-ok');
  });
  (function poblarIAKeys() {
    const k = iaKeys();
    $('ia-key-gemini').value = k.gem;
    $('ia-key-groq').value = k.groq;
    document.querySelectorAll('input[name="ia-pref"]').forEach(r => { r.checked = (r.value === k.pref); });
  })();

  const IA_GEM_MODELOS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const IA_GROQ_TXT = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  const IA_GROQ_VIS = ['meta-llama/llama-4-scout-17b-16e-instruct'];

  async function iaGemini(key, msgs) {
    const sys = msgs.find(m => m.role === 'system');
    const contents = msgs.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }].concat((m.images || []).map(b => ({ inline_data: { mime_type: 'image/jpeg', data: b } })))
    }));
    const body = { contents: contents };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    let ultimo = '';
    for (const modelo of IA_GEM_MODELOS) {
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
        if (r.status !== 404 && r.status !== 400) break;   // solo prueba otro modelo si éste no existe
      }
    }
    throw new Error('Gemini: ' + ultimo);
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

  /* llama a la IA preferida y usa la otra como respaldo si falla */
  async function iaLlamar(msgs, conImagenes) {
    const k = iaKeys();
    const orden = k.pref === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
    let ultimo = 'No hay claves de IA. Configúralas en la pestaña "Asistente IA".';
    for (const p of orden) {
      try {
        if (p === 'gemini' && k.gem) return await iaGemini(k.gem, msgs);
        if (p === 'groq' && k.groq) return await iaGroq(k.groq, msgs, conImagenes);
      } catch (err) { ultimo = err.message; }
    }
    throw new Error(ultimo);
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

  const IA_SISTEMA_MARCA = 'Eres la community manager de Karivé Joyas, una marca chilena de joyas artesanales hechas a mano (arcilla polimérica, miyuki, mostacillas). Escribes en español de Chile, con tono cálido y cercano. La marca solo hace envíos a todo Chile (NO hay retiros) y los pedidos son por DM de Instagram.';

  // datos reales de los productos elegidos, para que la IA los mencione por su nombre
  function igIAContexto(prods) {
    const l = prods.map(p => '- ' + (p.name || '') + ' (colección ' + kvCat(p.category, settings).nombre + ')' + (p.detail ? ', ' + p.detail : ''));
    return 'Productos de esta publicación (menciónalos por su nombre real):\n' + l.join('\n');
  }

  // --- botón: descripción con IA (mira las fotos + conoce los nombres) ---
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
        { role: 'user', content: 'Escribe una descripción para un post de Instagram: elegante, cálida y natural, inspirándote en las fotos y MENCIONANDO los productos por su nombre real. Termina con "📩 Pedidos por DM" y "🚚 Envíos a todo Chile".\n\n' + igIAContexto(prods) + (tags.length ? '\n\nAgrega al final, en su propia línea, estos hashtags tal cual:\n' + tags.join(' ') : '') + '\n\nResponde SOLO con la descripción, sin comentarios.', images: imgs }
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
          '- Conserva el cierre "📩 Pedidos por DM" y "🚚 Envíos a todo Chile", cada uno en su propia línea.\n' +
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

  // conexión con el publicador
  $('adm-ig-pubguardar').addEventListener('click', () => {
    settingsRef.set({ igPubUrl: $('adm-ig-puburl').value.trim(), igPubClave: $('adm-ig-pubclave').value.trim() }, { merge: true })
      .then(() => guardado('adm-ig-pub-ok')).catch(err => console.error(err));
  });

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
    if (activo() !== $('adm-ig')) $('adm-ig').value = settings.instagram || '';
    if (activo() !== $('adm-fb')) $('adm-fb').value = settings.facebook || '';
    if (activo() !== $('adm-wa')) $('adm-wa').value = settings.whatsapp || '';
    if (activo() !== $('adm-wa-msg')) $('adm-wa-msg').value = settings.whatsappMsg != null ? settings.whatsappMsg : KV_WHATSAPP_MSG_DEFAULT;
    if (activo() !== $('adm-ig-caption')) $('adm-ig-caption').value = settings.igCaption != null ? settings.igCaption : KV_IG_CAPTION_DEFAULT;
    if (activo() !== $('adm-ig-puburl')) $('adm-ig-puburl').value = settings.igPubUrl || '';
    if (activo() !== $('adm-ig-pubclave')) $('adm-ig-pubclave').value = settings.igPubClave || '';

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
  }
})();
