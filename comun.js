'use strict';

const KV_CATEGORIAS = [
  { id: 'flores',   nombre: 'Flores',              sub: 'Aros de flores hechos a mano, livianos e hipoalergénicos', imagen: 'assets/productos/floron-rojo.jpg', prefijo: 'FL' },
  { id: 'charms',   nombre: 'Charms',              sub: 'Argollita de acero con tu charm favorito colgando', imagen: 'assets/productos/charms-flor-azul-oro.jpg', prefijo: 'CH' },
  { id: 'argollas', nombre: 'Argollas de cristal', sub: 'Acero inoxidable hipoalergénico, dorado o plateado, con cristales', imagen: 'assets/modelo-argollas.jpg', prefijo: 'AG' },
  { id: 'topos',    nombre: 'Topos',               sub: 'Aros pequeños tipo botón, ideales para el día a día', imagen: 'assets/productos/topos-corazon-dorado.jpg', prefijo: 'TP' },
  { id: 'otros',    nombre: 'Otros',               sub: 'Otros accesorios de la colección', imagen: 'assets/productos/floron-blanco-perla.jpg', prefijo: 'OT' }
];

/* defaults editables desde el panel admin (se guardan en settings) */
const KV_THEME_DEFAULT = { morado: '#5B2A82', moradoProf: '#3A1D4E', dorado: '#E3C572', lila: '#CFC4DF' };
const KV_COVER_DEFAULT = { image: 'assets/modelo-portada.jpg', tagline: 'Accesorios hechos a mano, con amor' };
const KV_INFO_DEFAULT = {
  titulo: 'Accesorios que iluminan, hechos con amor',
  b1: 'Todas nuestras piezas tienen base de acero inoxidable hipoalergénico.',
  b2: '¿Eres alérgica/o? Tenemos opción de plata 925, solo pregúntanos ✨',
  b3: 'Hacemos envíos a todo Chile.',
  b4: 'Si sueñas con un diseño especial, lo creamos juntas/os — envíanos una fotito de referencia y te damos el presupuesto.'
};

const KV_HOWTO_DEFAULT = {
  titulo: '¿Cómo comprar?',
  p1t: '1 · Elige tus favoritos', p1d: 'Recorre el catálogo y guarda los códigos de los que más te gusten.',
  p2t: '2 · Escríbenos',          p2d: 'Mándanos los códigos por Instagram o WhatsApp.',
  p3t: '3 · Confirmamos tu pedido',p3d: 'Te avisamos el stock y el total con el envío.',
  p4t: '4 · Realiza el pago',     p4d: 'Por transferencia o link de pago; te enviamos los datos.',
  p5t: '5 · Enviamos con amor',   p5d: 'Preparamos tu pedido a mano y te compartimos el seguimiento.',
  p6t: '6 · ¡Luce tu Karivé!',    p6d: 'Etiquétanos en tus historias. Nos encanta verte brillar ✦'
};
const KV_DESPEDIDA_DEFAULT = {
  titulo: '¡Gracias por tu visita!',
  mensaje: 'Esperamos que hayas encontrado tu joya favorita. Escríbenos cuando quieras — nos encanta verte brillar ✦'
};

/* devuelve la categoría con las modificaciones guardadas en settings.cats aplicadas encima */
function kvCat(id, settings) {
  const base = KV_CATEGORIAS.find(c => c.id === id) || {};
  const ov = (settings && settings.cats && settings.cats[id]) || {};
  return Object.assign({}, base, ov);
}

/* aplica los colores guardados a las variables CSS */
function kvApplyTheme(t) {
  t = t || {};
  const r = document.documentElement.style;
  if (t.morado)     r.setProperty('--kv-morado', t.morado);
  if (t.moradoProf) r.setProperty('--kv-morado-prof', t.moradoProf);
  if (t.dorado)     r.setProperty('--kv-dorado-cl', t.dorado);
  if (t.lila)       r.setProperty('--kv-lila-fondo', t.lila);
}

function KV_PRODUCTOS_INICIALES() {
  const p = (code, name, detail, price, photo, category, order) =>
    ({ code, name, detail, price, photo: 'assets/productos/' + photo + '.jpg', category, order });
  return [
    // ---- FLORES ----
    p('FL-001', 'Florón rojo',            'Aprox. 5cm de diámetro', 13990, 'floron-rojo', 'flores', 1),
    p('FL-002', 'Florón morado',          'Aprox. 5cm de diámetro', 13990, 'floron-morado', 'flores', 2),
    p('FL-003', 'Florón azul',            'Aprox. 5cm de diámetro', 13990, 'floron-azul', 'flores', 3),
    p('FL-004', 'Florón naranjo',         'Aprox. 5cm de diámetro', 13990, 'floron-naranjo', 'flores', 4),
    p('FL-005', 'Florón negro',           'Aprox. 5cm de diámetro', 13990, 'floron-negro', 'flores', 5),
    p('FL-006', 'Florón cobre',           'Aprox. 5cm de diámetro', 13990, 'floron-cobre', 'flores', 6),
    p('FL-007', 'Florón blanco',          'Aprox. 5cm de diámetro', 13990, 'floron-blanco', 'flores', 7),
    p('FL-008', 'Florón blanco perla',    'Aprox. 5cm de diámetro', 13990, 'floron-blanco-perla', 'flores', 8),
    p('FL-009', 'Flores cristal',         'Aprox. 4cm de diámetro', 11990, 'flores-cristal', 'flores', 9),
    p('FL-010', 'Flores plateadas',       'Aprox. 4cm de diámetro', 11990, 'flores-plateadas', 'flores', 10),
    p('FL-011', 'Flores amarillo & negro','Aprox. 4cm de diámetro', 11990, 'flores-amarillo-negro', 'flores', 11),
    p('FL-012', 'Flores blanco & negro',  'Aprox. 4cm de diámetro', 11990, 'flores-blanco-negro-stand', 'flores', 12),
    p('FL-013', 'Flores amarillas',       'Aprox. 4cm de diámetro', 10990, 'flores-amarillas', 'flores', 13),
    p('FL-014', 'Mini flores amarillas',  'Aprox. 3cm de diámetro', 9990,  'flores-amarillas-mini', 'flores', 14),
    p('FL-015', 'Flores amarillas & blancas','Elige tu color', 10990, 'flores-amarillas-blancas', 'flores', 15),
    p('FL-016', 'Margaritas blancas',     'Aprox. 3cm de diámetro', 9990,  'margaritas-blancas', 'flores', 16),
    p('FL-017', 'Margaritas blancas texturadas','Aprox. 3.5cm de diámetro', 10990, 'margaritas-blancas-texturadas', 'flores', 17),
    p('FL-018', 'Margaritas grises',      'Aprox. 5cm de diámetro', 11990, 'margaritas-grises', 'flores', 18),
    p('FL-019', 'Margaritas blancas colgantes','Aprox. 4cm de largo', 10990, 'margaritas-blancas-colg', 'flores', 19),
    p('FL-020', 'Margaritas blancas topo','Aprox. 2.5cm de diámetro', 8990, 'margaritas-blancas-topo', 'flores', 20),
    p('FL-021', 'Margaritas rojas',       'Aprox. 2.5cm de diámetro', 8990, 'margaritas-rojas', 'flores', 21),
    p('FL-022', 'Margaritas colgantes',   'Aprox. 4cm de largo', 10990, 'margaritas-blancas-colg2', 'flores', 22),
    // ---- CHARMS (argollita + charm) ----
    p('CH-023', 'Charms flor azul (oro)',    'Argolla dorada · flor azul', 9500, 'charms-flor-azul-oro', 'charms', 23),
    p('CH-024', 'Charms flor azul (negro)',  'Argolla negra · flor azul', 9500, 'charms-flor-azul-negro', 'charms', 24),
    p('CH-025', 'Charms flor blanca (oro)',  'Argolla dorada · flor blanca', 9500, 'charms-flor-blanca-oro', 'charms', 25),
    p('CH-026', 'Charms flor blanca (plata)','Argolla plateada · flor blanca', 9500, 'charms-flor-blanca-plata', 'charms', 26),
    p('CH-027', 'Charms donut azul',         'Argolla · donut de arcilla', 9500, 'charms-donut-azul', 'charms', 27),
    p('CH-028', 'Charms donut marino',       'Argolla · donut de arcilla', 9500, 'charms-donut-marino', 'charms', 28),
    p('CH-029', 'Charms donut blanco',       'Argolla · donut de arcilla', 9500, 'charms-donut-blanco', 'charms', 29),
    // ---- ARGOLLAS DE CRISTAL ----
    p('AG-030', 'Argollas cristal amarillo',   'Acero dorado · cristales', 10990, 'argollas-amarillo', 'argollas', 30),
    p('AG-031', 'Argollas cristal azul',       'Acero dorado · cristales', 10990, 'argollas-azul', 'argollas', 31),
    p('AG-032', 'Argollas cristal azul rey',   'Acero dorado · cristales', 10990, 'argollas-azul-rey', 'argollas', 32),
    p('AG-033', 'Argollas cristal verde',      'Acero dorado · cristales', 10990, 'argollas-verde', 'argollas', 33),
    p('AG-034', 'Argollas cristal verde oliva','Acero dorado · cristales', 10990, 'argollas-verde-oliva', 'argollas', 34),
    p('AG-035', 'Argollas cristal rojo',       'Acero dorado · cristales', 10990, 'argollas-rojo', 'argollas', 35),
    p('AG-036', 'Argollas cristal rojo intenso','Acero dorado · cristales', 10990, 'argollas-rojo2', 'argollas', 36),
    p('AG-037', 'Argollas cristal turquesa',   'Acero dorado · cristales', 10990, 'argollas-turquesa', 'argollas', 37),
    p('AG-038', 'Argollas cristal turquesa II', 'Acero dorado · cristales', 10990, 'argollas-turquesa2', 'argollas', 38),
    p('AG-039', 'Argollas cristal lila',       'Acero dorado · cristales', 10990, 'argollas-lila', 'argollas', 39),
    p('AG-040', 'Argollas cristal negro',      'Acero dorado · cristales', 10990, 'argollas-negro', 'argollas', 40),
    p('AG-041', 'Argollas cristal multicolor', 'Acero dorado · cristales', 11990, 'argollas-multicolor', 'argollas', 41),
    p('AG-042', 'Argollas cristal transparente','Acero dorado · cristales', 10990, 'argollas-transparente', 'argollas', 42),
    p('AG-043', 'Argollas cristal transparente II','Acero dorado · cristales', 10990, 'argollas-transparente2', 'argollas', 43),
    p('AG-044', 'Argollas cristal pavé',       'Acero · pavé de cristales', 12990, 'argollas-pave', 'argollas', 44),
    p('AG-045', 'Argollas abanico negro',      'Acero dorado · cristales', 12990, 'argollas-negro-abanico', 'argollas', 45),
    p('AG-046', 'Argollas mandala dorado',     'Tejido a mano · dorado', 13990, 'argollas-mandala-dorado', 'argollas', 46),
    // ---- TOPOS ----
    p('TP-047', 'Topos corazón dorado',   'Aprox. 1.5cm', 7990, 'topos-corazon-dorado', 'topos', 47),
    p('TP-048', 'Topos corazón celeste',  'Aprox. 1.5cm', 7990, 'topos-corazon-celeste', 'topos', 48),
    p('TP-049', 'Topos botón celeste',    'Aprox. 1.2cm', 6990, 'topos-boton-celeste', 'topos', 49)
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
        '</div>' +
        '<div class="ed-coleccion">' +
          '<label class="ed-coleccion-label">📁 Colección:</label>' +
          '<select class="ed-input ed-categoria" data-role="category" data-id="' + p.id + '">' + opciones + '</select>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function kvCompressPhoto(file, cb, max) {
  if (!file) return;
  max = max || 700;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
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
