(() => {
  'use strict';

  const ADMIN_EMAIL = 'karive.joyas@gmail.com';

  const state = {
    products: [],
    cardStyle: 'marco',
    query: ''
  };

  const el = {
    loginScreen: document.getElementById('kv-login'),
    loginForm: document.getElementById('kv-login-form'),
    loginPass: document.getElementById('kv-login-pass'),
    loginError: document.getElementById('kv-login-error'),
    app: document.getElementById('kv-admin-app'),
    logout: document.getElementById('kv-logout'),
    query: document.getElementById('kv-query'),
    count: document.getElementById('kv-count'),
    tabs: Array.from(document.querySelectorAll('.kv-tab')),
    add: document.getElementById('kv-add'),
    reset: document.getElementById('kv-reset'),
    grid: document.getElementById('kv-grid'),
    noResults: document.getElementById('kv-noresults'),
    noResultsText: document.getElementById('kv-noresults-text')
  };

  const itemsCol = kvDb.collection('catalog').doc('products').collection('items');
  const settingsRef = kvDb.collection('catalog').doc('settings');
  let unsubItems = null;
  let unsubSettings = null;

  // ---- login ----
  el.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    el.loginError.hidden = true;
    const pass = el.loginPass.value;
    kvAuth.signInWithEmailAndPassword(ADMIN_EMAIL, pass)
      .then(() => { el.loginPass.value = ''; })
      .catch(() => { el.loginError.hidden = false; });
  });

  el.logout.addEventListener('click', () => kvAuth.signOut());

  kvAuth.onAuthStateChanged((user) => {
    if (user) {
      el.loginScreen.hidden = true;
      el.app.hidden = false;
      startListening();
    } else {
      el.app.hidden = true;
      el.loginScreen.hidden = false;
      stopListening();
    }
  });

  function startListening() {
    if (unsubItems) return;
    unsubItems = itemsCol.orderBy('order').onSnapshot((snap) => {
      state.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (state.products.length === 0) seedDefaults();
      render();
    }, (err) => console.error('Error leyendo productos:', err));
    unsubSettings = settingsRef.onSnapshot((doc) => {
      const data = doc.data();
      state.cardStyle = (data && data.cardStyle) || 'marco';
      render();
    }, (err) => console.error('Error leyendo configuración:', err));
  }

  function stopListening() {
    if (unsubItems) { unsubItems(); unsubItems = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    state.products = [];
  }

  function seedDefaults() {
    const batch = kvDb.batch();
    KV_DEFAULT_PRODUCTS().forEach(p => {
      const { id, ...data } = p;
      batch.set(itemsCol.doc(id), data);
    });
    batch.commit().catch(err => console.error('Error sembrando catálogo:', err));
  }

  // ---- search ----
  el.query.addEventListener('input', (e) => { state.query = e.target.value; render(); });

  // ---- card style tabs ----
  el.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      settingsRef.set({ cardStyle: tab.dataset.style }, { merge: true })
        .catch(err => console.error('Error guardando estilo:', err));
    });
  });

  // ---- add / reset ----
  el.add.addEventListener('click', () => {
    itemsCol.add({
      code: 'AR-' + String(state.products.length + 1).padStart(3, '0'),
      name: 'Nuevo aro', desc: 'Escribe aquí la descripción', price: 0, photo: null,
      order: -Date.now()
    }).catch(err => console.error('Error agregando producto:', err));
  });

  el.reset.addEventListener('click', () => {
    if (!window.confirm('Esto reemplazará todo tu catálogo por los 50 ejemplos. ¿Continuar?')) return;
    itemsCol.get().then((snap) => {
      const batch = kvDb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      KV_DEFAULT_PRODUCTS().forEach(p => {
        const { id, ...data } = p;
        batch.set(itemsCol.doc(id), data);
      });
      return batch.commit();
    }).catch(err => console.error('Error restaurando catálogo:', err));
  });

  function updateField(id, field, value) {
    itemsCol.doc(id).update({ [field]: value }).catch(err => console.error('Error guardando cambio:', err));
  }

  function deleteProduct(id) {
    if (!window.confirm('¿Eliminar este producto del catálogo?')) return;
    itemsCol.doc(id).delete().catch(err => console.error('Error eliminando producto:', err));
  }

  function uploadPhoto(id, file) {
    kvCompressPhoto(file, (data) => updateField(id, 'photo', data));
  }

  function bindCardEvents() {
    el.grid.querySelectorAll('[data-role="name"]').forEach(n => n.addEventListener('change', e => updateField(e.target.dataset.id, 'name', e.target.value)));
    el.grid.querySelectorAll('[data-role="desc"]').forEach(n => n.addEventListener('change', e => updateField(e.target.dataset.id, 'desc', e.target.value)));
    el.grid.querySelectorAll('[data-role="code"]').forEach(n => n.addEventListener('change', e => updateField(e.target.dataset.id, 'code', e.target.value)));
    el.grid.querySelectorAll('[data-role="price"]').forEach(n => n.addEventListener('change', e => {
      const num = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10);
      updateField(e.target.dataset.id, 'price', isNaN(num) ? 0 : num);
    }));
    el.grid.querySelectorAll('[data-role="delete"]').forEach(n => n.addEventListener('click', e => deleteProduct(e.target.dataset.id)));
    el.grid.querySelectorAll('[data-role="remove-photo"]').forEach(n => n.addEventListener('click', e => updateField(e.target.dataset.id, 'photo', null)));
    el.grid.querySelectorAll('[data-role="upload"]').forEach(n => n.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      uploadPhoto(e.target.dataset.id, file);
      e.target.value = '';
    }));
  }

  function render() {
    el.tabs.forEach(tab => tab.classList.toggle('is-active', tab.dataset.style === state.cardStyle));

    const q = state.query.trim().toLowerCase();
    const filtered = q
      ? state.products.filter(p => (p.name + ' ' + p.code + ' ' + p.desc).toLowerCase().includes(q))
      : state.products;

    el.count.textContent = filtered.length + ' de ' + state.products.length + ' aros';
    el.grid.innerHTML = filtered.map(p => kvCardHtml(p, state.cardStyle, true)).join('');
    bindCardEvents();

    const noResults = filtered.length === 0;
    el.noResults.hidden = !noResults;
    if (noResults) el.noResultsText.textContent = 'No encontramos aros para “' + state.query + '”. Prueba con otra palabra.';
  }
})();
