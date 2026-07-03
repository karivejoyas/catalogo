(() => {
  'use strict';

  const ADMIN_EMAIL = 'karive.joyas@gmail.com';

  const state = { products: [], query: '' };
  const $ = (id) => document.getElementById(id);

  const itemsCol = kvDb.collection('catalog').doc('products').collection('items');
  const settingsRef = kvDb.collection('catalog').doc('settings');
  let unsubItems = null, unsubSettings = null;

  // ---- login ----
  $('adm-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('adm-login-error').hidden = true;
    kvAuth.signInWithEmailAndPassword(ADMIN_EMAIL, $('adm-pass').value)
      .then(() => { $('adm-pass').value = ''; })
      .catch(() => { $('adm-login-error').hidden = false; });
  });
  $('adm-salir').addEventListener('click', () => kvAuth.signOut());

  kvAuth.onAuthStateChanged((user) => {
    if (user) {
      $('adm-login').hidden = true;
      $('adm-app').hidden = false;
      escuchar();
    } else {
      $('adm-app').hidden = true;
      $('adm-login').hidden = false;
      dejarDeEscuchar();
    }
  });

  function escuchar() {
    if (unsubItems) return;
    unsubItems = itemsCol.orderBy('order').onSnapshot((snap) => {
      state.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (state.products.length === 0) sembrar();
      render();
    }, (err) => console.error('Error leyendo productos:', err));
    unsubSettings = settingsRef.onSnapshot((doc) => {
      const data = doc.data() || {};
      if (document.activeElement !== $('adm-ig')) $('adm-ig').value = data.instagram || '';
      if (document.activeElement !== $('adm-wa')) $('adm-wa').value = data.whatsapp || '';
    }, (err) => console.error('Error leyendo configuración:', err));
  }

  function dejarDeEscuchar() {
    if (unsubItems) { unsubItems(); unsubItems = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    state.products = [];
  }

  function sembrar() {
    const batch = kvDb.batch();
    KV_PRODUCTOS_INICIALES().forEach((p, i) => {
      batch.set(itemsCol.doc('p' + String(i + 1).padStart(3, '0')), p);
    });
    batch.commit().catch(err => console.error('Error sembrando catálogo:', err));
  }

  // ---- buscador / contacto / reset ----
  $('adm-query').addEventListener('input', (e) => { state.query = e.target.value; render(); });

  $('adm-guardar-contacto').addEventListener('click', () => {
    settingsRef.set({ instagram: $('adm-ig').value.trim(), whatsapp: $('adm-wa').value.trim() }, { merge: true })
      .then(() => {
        $('adm-contacto-ok').hidden = false;
        setTimeout(() => { $('adm-contacto-ok').hidden = true; }, 2000);
      })
      .catch(err => console.error('Error guardando contacto:', err));
  });

  $('adm-reset').addEventListener('click', () => {
    if (!window.confirm('Esto reemplazará todo tu catálogo por los productos iniciales (tus 25 aros con sus fotos). ¿Continuar?')) return;
    itemsCol.get().then((snap) => {
      const batch = kvDb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      KV_PRODUCTOS_INICIALES().forEach((p, i) => {
        batch.set(itemsCol.doc('p' + String(i + 1).padStart(3, '0')), p);
      });
      return batch.commit();
    }).catch(err => console.error('Error restaurando catálogo:', err));
  });

  // ---- mutaciones ----
  function actualizar(id, campo, valor) {
    itemsCol.doc(id).update({ [campo]: valor }).catch(err => console.error('Error guardando cambio:', err));
  }

  function eliminar(id) {
    if (!window.confirm('¿Eliminar este producto del catálogo?')) return;
    itemsCol.doc(id).delete().catch(err => console.error('Error eliminando:', err));
  }

  function agregar(categoria) {
    const cat = KV_CATEGORIAS.find(c => c.id === categoria);
    const maxOrder = state.products.reduce((m, p) => Math.max(m, p.order || 0), 0);
    itemsCol.add({
      code: (cat ? cat.prefijo : 'PR') + '-' + String(state.products.length + 1).padStart(3, '0'),
      name: 'Nuevo producto', detail: '', price: 0, photo: null,
      category: categoria, order: maxOrder + 1
    }).catch(err => console.error('Error agregando:', err));
  }

  // ---- render ----
  function render() {
    const q = state.query.trim().toLowerCase();
    const filtrados = q
      ? state.products.filter(p => (p.name + ' ' + p.code + ' ' + (p.detail || '')).toLowerCase().includes(q))
      : state.products;

    $('adm-contador').textContent = filtrados.length + ' de ' + state.products.length + ' productos';

    let html = '';
    KV_CATEGORIAS.forEach(cat => {
      const items = filtrados.filter(p => p.category === cat.id);
      html +=
        '<section class="adm-seccion">' +
          '<h2 class="adm-seccion-titulo">' + cat.nombre + ' <span class="adm-tag">(' + items.length + ')</span></h2>' +
          '<p class="adm-seccion-sub">' + cat.sub + ' · <button type="button" class="adm-btn-solido" data-role="add" data-cat="' + cat.id + '" style="padding:5px 14px;font-size:12px;">+ Agregar producto</button></p>' +
          '<div class="adm-grilla">' + items.map(kvCardEditHtml).join('') + '</div>' +
        '</section>';
    });
    const huerfanos = filtrados.filter(p => !KV_CATEGORIAS.some(c => c.id === p.category));
    if (huerfanos.length) {
      html += '<section class="adm-seccion"><h2 class="adm-seccion-titulo">Sin categoría</h2><div class="adm-grilla">' + huerfanos.map(kvCardEditHtml).join('') + '</div></section>';
    }
    $('adm-categorias').innerHTML = html;
    conectarEventos();
  }

  function conectarEventos() {
    const root = $('adm-categorias');
    root.querySelectorAll('[data-role="add"]').forEach(n => n.addEventListener('click', e => agregar(e.target.dataset.cat)));
    root.querySelectorAll('[data-role="code"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'code', e.target.value)));
    root.querySelectorAll('[data-role="name"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'name', e.target.value)));
    root.querySelectorAll('[data-role="detail"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'detail', e.target.value)));
    root.querySelectorAll('[data-role="price"]').forEach(n => n.addEventListener('change', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      actualizar(e.target.dataset.id, 'price', isNaN(num) ? 0 : num);
    }));
    root.querySelectorAll('[data-role="category"]').forEach(n => n.addEventListener('change', e => actualizar(e.target.dataset.id, 'category', e.target.value)));
    root.querySelectorAll('[data-role="delete"]').forEach(n => n.addEventListener('click', e => eliminar(e.target.dataset.id)));
    root.querySelectorAll('[data-role="remove-photo"]').forEach(n => n.addEventListener('click', e => actualizar(e.target.dataset.id, 'photo', null)));
    root.querySelectorAll('[data-role="upload"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) kvCompressPhoto(file, (data) => actualizar(e.target.dataset.id, 'photo', data));
      e.target.value = '';
    }));
  }
})();
