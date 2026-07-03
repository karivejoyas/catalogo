'use strict';

const KV_CATEGORIAS = [
  { id: 'flores',   nombre: 'Flores',             sub: 'Aros de flores hechos a mano, livianos e hipoalergénicos', imagen: 'assets/productos/flores-eleccion.jpg', prefijo: 'FL' },
  { id: 'arcilla',  nombre: 'Charms de arcilla',  sub: 'Piezas de arcilla polimérica llenas de color', imagen: 'assets/productos/margaritas-blancas.jpg', prefijo: 'CH' },
  { id: 'argollas', nombre: 'Argollas de cristal', sub: 'Acero inoxidable hipoalergénico, dorado o plateado', imagen: 'assets/modelo-argollas.jpg', prefijo: 'AG' }
];

function KV_PRODUCTOS_INICIALES() {
  const p = (code, name, detail, price, photo, category, order) =>
    ({ code, name, detail, price, photo: 'assets/productos/' + photo + '.jpg', category, order });
  return [
    p('FL-001', 'Florón dorado',          'Aprox. 5cm de diámetro', 12990, 'flor-dorada', 'flores', 1),
    p('FL-002', 'Flor cristal',           'Aprox. 5cm de diámetro', 11990, 'flor-cristal', 'flores', 2),
    p('FL-003', 'Flor amarilla & negra',  'Aprox. 5cm de diámetro', 11990, 'flor-amarilla-negra', 'flores', 3),
    p('FL-004', 'Flor blanca & negra',    'Aprox. 5cm de diámetro', 11990, 'flor-blanca-negra', 'flores', 4),
    p('FL-005', 'Flores amarillas',       'Aprox. 4cm de diámetro', 9990,  'flor-amarilla', 'flores', 5),
    p('FL-006', 'Flor traslúcida',        'Aprox. 4cm de diámetro', 9990,  'flor-traslucida', 'flores', 6),
    p('FL-007', 'Flores color a elección','Elige tu color favorito', 9990, 'flores-eleccion', 'flores', 7),
    p('FL-008', 'Argollitas flor blanca', 'Argolla dorada con flor', 8990, 'argollita-flor-blanca', 'flores', 8),
    p('FL-009', 'Topos margarita',        'Aprox. 2cm de diámetro', 7990,  'topos-margarita', 'flores', 9),
    p('CH-010', 'Charms donuts azul',     'Arcilla polimérica', 9500, 'donuts-azul', 'arcilla', 10),
    p('CH-011', 'Charms donuts marino',   'Arcilla polimérica', 9500, 'donuts-marino', 'arcilla', 11),
    p('CH-012', 'Charms margaritas blancas', 'Arcilla polimérica', 9500, 'margaritas-blancas', 'arcilla', 12),
    p('CH-013', 'Charms margaritas doradas', 'Arcilla polimérica', 9500, 'margaritas-doradas', 'arcilla', 13),
    p('CH-014', 'Margarita gris XL',      'Arcilla polimérica', 10500, 'margarita-gris', 'arcilla', 14),
    p('CH-015', 'Charms donas blancas',   'Arcilla polimérica', 9500, 'donas-blancas', 'arcilla', 15),
    p('CH-016', 'Corazones dorados',      'Arcilla polimérica', 9500, 'corazones-dorados', 'arcilla', 16),
    p('CH-017', 'Corazones celestes',     'Arcilla polimérica', 9500, 'corazones-celestes', 'arcilla', 17),
    p('CH-018', 'Botones celestes',       'Arcilla polimérica', 8500, 'botones-celestes', 'arcilla', 18),
    p('AG-019', 'Argollas cristal azul',       'Acero dorado · cristales', 10990, 'argollas-azul', 'argollas', 19),
    p('AG-020', 'Argollas cristal negro',      'Acero dorado · cristales', 10990, 'argollas-negro', 'argollas', 20),
    p('AG-021', 'Argollas cristal lila',       'Acero dorado · cristales', 10990, 'argollas-lila', 'argollas', 21),
    p('AG-022', 'Argollas cristal transparente','Acero dorado · cristales', 10990, 'argollas-cristal', 'argollas', 22),
    p('AG-023', 'Argollas cristal rojo',       'Acero dorado · cristales', 10990, 'argollas-rojo', 'argollas', 23),
    p('AG-024', 'Argollas cristal verde',      'Acero dorado · cristales', 10990, 'argollas-verde', 'argollas', 24),
    p('AG-025', 'Argollas cristal turquesa',   'Acero dorado · cristales', 10990, 'argollas-turquesa', 'argollas', 25)
  ];
}

function formatCLP(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('es-CL');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const KV_SIN_FOTO = 'repeating-linear-gradient(45deg, rgba(122,47,176,0.08) 0 11px, rgba(122,47,176,0.02) 11px 22px)';

function kvFotoCss(p) {
  return 'background-image:' + (p.photo ? "url('" + p.photo + "')" : KV_SIN_FOTO) + ';';
}

/* tarjeta pública (estilo Amore: foto + barra de etiqueta) */
function kvCardHtml(p) {
  return (
    '<div class="cat-card">' +
      '<div class="cat-card-foto" style="' + kvFotoCss(p) + '">' +
        (!p.photo ? '<span class="cat-card-sinfoto">✦</span>' : '') +
      '</div>' +
      '<div class="cat-card-etiqueta">' +
        '<div class="cat-card-nombre">' + escapeHtml(p.name) + '</div>' +
        (p.detail ? '<div class="cat-card-detalle">' + escapeHtml(p.detail) + '</div>' : '') +
        '<div class="cat-card-pie"><span class="cat-card-codigo">' + escapeHtml(p.code) + '</span><span class="cat-card-precio">' + formatCLP(p.price) + '</span></div>' +
      '</div>' +
    '</div>'
  );
}

/* tarjeta de edición (panel admin) */
function kvCardEditHtml(p) {
  const opciones = KV_CATEGORIAS.map(c =>
    '<option value="' + c.id + '"' + (p.category === c.id ? ' selected' : '') + '>' + c.nombre + '</option>').join('');
  return (
    '<div class="cat-card cat-card-edit" data-id="' + p.id + '">' +
      '<div class="cat-card-foto" style="' + kvFotoCss(p) + '">' +
        (!p.photo ? '<span class="cat-card-sinfoto">✦</span>' : '') +
        '<div class="ed-foto-botones">' +
          '<label class="ed-btn-foto">' + (p.photo ? 'Cambiar foto' : 'Agregar foto') +
            '<input type="file" accept="image/*" data-role="upload" data-id="' + p.id + '" style="display:none;" />' +
          '</label>' +
          (p.photo ? '<button type="button" class="ed-btn-foto-ghost" data-role="remove-photo" data-id="' + p.id + '">Quitar</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ed-cuerpo">' +
        '<div class="ed-fila">' +
          '<input class="ed-input ed-codigo" data-role="code" data-id="' + p.id + '" value="' + escapeHtml(p.code) + '" placeholder="Código" />' +
          '<button type="button" class="ed-btn-eliminar" data-role="delete" data-id="' + p.id + '">Eliminar</button>' +
        '</div>' +
        '<input class="ed-input ed-nombre" data-role="name" data-id="' + p.id + '" value="' + escapeHtml(p.name) + '" placeholder="Nombre" />' +
        '<input class="ed-input ed-detalle" data-role="detail" data-id="' + p.id + '" value="' + escapeHtml(p.detail || '') + '" placeholder="Detalle (ej: 5cm de diámetro)" />' +
        '<div class="ed-fila">' +
          '<span class="ed-peso">$</span>' +
          '<input class="ed-input ed-precio" data-role="price" data-id="' + p.id + '" value="' + p.price + '" inputmode="numeric" />' +
          '<select class="ed-input ed-categoria" data-role="category" data-id="' + p.id + '">' + opciones + '</select>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function kvCompressPhoto(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const max = 700;
      let w = img.width, h = img.height;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let data;
      try { data = c.toDataURL('image/jpeg', 0.82); } catch (err) { data = ev.target.result; }
      cb(data);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
