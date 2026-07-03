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
      if (products.length === 0) sembrar();
      renderProductos();
    }, (err) => console.error('Error leyendo productos:', err));
    unsubSettings = settingsRef.onSnapshot((doc) => {
      settings = doc.data() || {};
      poblarCampos();
      renderCatsEditor();
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
    const cat = KV_CATEGORIAS.find(c => c.id === categoria);
    const maxOrder = products.reduce((m, p) => Math.max(m, p.order || 0), 0);
    itemsCol.add({
      code: (cat ? cat.prefijo : 'PR') + '-' + String(products.length + 1).padStart(3, '0'),
      name: 'Nuevo producto', detail: '', price: 0, photo: null, category: categoria, order: maxOrder + 1
    }).catch(err => console.error('Error agregando:', err));
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

  function renderProductos() {
    $('adm-contador').textContent = products.length + ' productos';
    let html = '';
    KV_CATEGORIAS.forEach(catBase => {
      const cat = kvCat(catBase.id, settings);
      const items = products.filter(p => p.category === catBase.id);
      html +=
        '<section class="adm-seccion">' +
          '<h2 class="adm-seccion-titulo">' + escapeHtml(cat.nombre) + ' <span class="adm-tag">(' + items.length + ')</span>' +
            ' <button type="button" class="adm-btn-solido adm-btn-mini" data-role="add" data-cat="' + catBase.id + '">+ Agregar producto</button></h2>' +
          '<div class="adm-grilla">' + items.map(kvCardEditHtml).join('') + '</div>' +
        '</section>';
    });
    const huerfanos = products.filter(p => !KV_CATEGORIAS.some(c => c.id === p.category));
    if (huerfanos.length) {
      html += '<section class="adm-seccion"><h2 class="adm-seccion-titulo">Sin categoría</h2><div class="adm-grilla">' + huerfanos.map(kvCardEditHtml).join('') + '</div></section>';
    }
    $('adm-categorias').innerHTML = html;
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
    r.querySelectorAll('[data-role="category"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'category', e.target.value)));
    r.querySelectorAll('[data-role="delete"]').forEach(n => n.addEventListener('click', e => eliminar(e.target.dataset.id)));
    r.querySelectorAll('[data-role="remove-photo"]').forEach(n => n.addEventListener('click', e => actualizar(e.target.dataset.id, 'photo', null)));
    r.querySelectorAll('[data-role="upload"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, (data) => actualizar(e.target.dataset.id, 'photo', data));
      e.target.value = '';
    }));
  }

  // ---------- CONTACTO ----------
  $('adm-guardar-contacto').addEventListener('click', () => {
    settingsRef.set({ instagram: $('adm-ig').value.trim(), whatsapp: $('adm-wa').value.trim() }, { merge: true })
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

  // ---------- COLECCIONES (nombre / sub / foto) ----------
  function renderCatsEditor() {
    let html = '';
    KV_CATEGORIAS.forEach(catBase => {
      const cat = kvCat(catBase.id, settings);
      html +=
        '<div class="adm-editor-fila adm-cat-fila" data-cat="' + catBase.id + '">' +
          '<div class="adm-editor-foto" style="background-image:url(\'' + cat.imagen + '\')"></div>' +
          '<div class="adm-editor-campos">' +
            '<label class="adm-etiqueta">Nombre de la colección</label>' +
            '<input class="adm-input" data-role="cat-nombre" data-cat="' + catBase.id + '" value="' + escapeHtml(cat.nombre) + '" />' +
            '<label class="adm-etiqueta">Descripción</label>' +
            '<input class="adm-input" data-role="cat-sub" data-cat="' + catBase.id + '" value="' + escapeHtml(cat.sub || '') + '" />' +
            '<label class="adm-btn-solido adm-btn-file">Cambiar foto de portada<input type="file" accept="image/*" data-role="cat-foto" data-cat="' + catBase.id + '" hidden /></label>' +
            '<span class="adm-guardado" data-role="cat-ok" data-cat="' + catBase.id + '" hidden>✓ Guardado</span>' +
          '</div>' +
        '</div>';
    });
    $('adm-cats-editor').innerHTML = html;
    const r = $('adm-cats-editor');
    const saveCat = (id, campo, valor) => {
      const cats = Object.assign({}, settings.cats || {});
      cats[id] = Object.assign({}, cats[id] || {}, { [campo]: valor });
      settingsRef.set({ cats }, { merge: true })
        .then(() => { const ok = r.querySelector('[data-role="cat-ok"][data-cat="' + id + '"]'); if (ok) { ok.hidden = false; setTimeout(() => ok.hidden = true, 2000); } })
        .catch(err => console.error(err));
    };
    r.querySelectorAll('[data-role="cat-nombre"]').forEach(n => n.addEventListener('change', e => saveCat(e.target.dataset.cat, 'nombre', e.target.value)));
    r.querySelectorAll('[data-role="cat-sub"]').forEach(n => n.addEventListener('change', e => saveCat(e.target.dataset.cat, 'sub', e.target.value)));
    r.querySelectorAll('[data-role="cat-foto"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, (data) => saveCat(e.target.dataset.cat, 'imagen', data), 1000);
      e.target.value = '';
    }));
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

  // ---------- poblar campos desde settings ----------
  function poblarCampos() {
    if (activo() !== $('adm-ig')) $('adm-ig').value = settings.instagram || '';
    if (activo() !== $('adm-wa')) $('adm-wa').value = settings.whatsapp || '';

    const theme = Object.assign({}, KV_THEME_DEFAULT, settings.theme || {});
    COLOR_KEYS.forEach(k => { const inp = colorInput(k); if (activo() !== inp) inp.value = theme[k]; });

    const cover = Object.assign({}, KV_COVER_DEFAULT, settings.cover || {});
    if (activo() !== $('adm-cover-tagline')) $('adm-cover-tagline').value = cover.tagline || '';
    if (!coverImgTmp) $('adm-cover-preview').style.backgroundImage = "url('" + cover.image + "')";

    const info = Object.assign({}, KV_INFO_DEFAULT, settings.info || {});
    ['titulo', 'b1', 'b2', 'b3', 'b4'].forEach(k => { const inp = $('adm-info-' + k); if (inp && activo() !== inp) inp.value = info[k] || ''; });
  }
})();
