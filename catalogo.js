(() => {
  'use strict';

  const state = { products: [], query: '' };

  const $ = (id) => document.getElementById(id);
  const cont = $('cat-secciones');
  const contador = $('cat-contador');
  const sinRes = $('cat-sinresultados');
  const sinResTxt = $('cat-sinresultados-texto');

  $('cat-query').addEventListener('input', (e) => { state.query = e.target.value; render(); });

  function render() {
    const q = state.query.trim().toLowerCase();
    const filtrados = q
      ? state.products.filter(p => (p.name + ' ' + p.code + ' ' + (p.detail || '')).toLowerCase().includes(q))
      : state.products;

    contador.textContent = filtrados.length + ' de ' + state.products.length + ' productos';

    let html = '';
    KV_CATEGORIAS.forEach(cat => {
      const items = filtrados.filter(p => p.category === cat.id);
      if (items.length === 0) return;
      html +=
        '<section class="cat-separador" style="background-image:url(\'' + cat.imagen + '\');">' +
          '<div class="cat-separador-velo"></div>' +
          '<div class="cat-separador-inner">' +
            '<h2 class="cat-separador-titulo">' + cat.nombre + '</h2>' +
            '<div class="cat-separador-sub">' + cat.sub + '</div>' +
          '</div>' +
        '</section>' +
        '<section class="cat-seccion-grilla">' +
          '<div class="cat-encabezado">' +
            '<span class="cat-encabezado-linea"></span>' +
            '<span class="cat-encabezado-estrella">✦</span>' +
            '<h3 class="cat-encabezado-titulo">' + cat.nombre + '</h3>' +
            '<span class="cat-encabezado-estrella">✦</span>' +
            '<span class="cat-encabezado-linea der"></span>' +
          '</div>' +
          '<div class="cat-grilla">' + items.map(kvCardHtml).join('') + '</div>' +
        '</section>';
    });
    cont.innerHTML = html;

    const vacio = filtrados.length === 0 && state.products.length > 0;
    sinRes.hidden = !vacio;
    if (vacio) sinResTxt.textContent = 'No encontramos productos para “' + state.query + '”. Prueba con otra palabra.';
  }

  render();

  // ---- datos en vivo desde Firestore ----
  kvDb.collection('catalog').doc('products').collection('items').orderBy('order').onSnapshot((snap) => {
    state.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => console.error('Error leyendo el catálogo:', err));

  kvDb.collection('catalog').doc('settings').onSnapshot((doc) => {
    const data = doc.data() || {};
    if (data.instagram) {
      ['cat-ig-portada', 'cat-ig-info', 'cat-ig-pie'].forEach(id => { const n = $(id); if (n) n.textContent = data.instagram; });
    }
    if (data.whatsapp) {
      ['cat-wa-info', 'cat-wa-pie'].forEach(id => { const n = $(id); if (n) n.textContent = data.whatsapp; });
    }
  }, (err) => console.error('Error leyendo la configuración:', err));
})();
