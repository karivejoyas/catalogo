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

/* lista de colecciones vigente: la guardada en settings.categorias, o los
   valores por defecto (migrando ediciones antiguas de settings.cats). */
function kvCategorias(settings) {
  settings = settings || {};
  if (Array.isArray(settings.categorias) && settings.categorias.length) {
    return settings.categorias.map(c => Object.assign({}, c));
  }
  return KV_CATEGORIAS.map(base => {
    const ov = (settings.cats && settings.cats[base.id]) || {};
    return Object.assign({}, base, ov);
  });
}

/* devuelve una colección por id */
function kvCat(id, settings) {
  return kvCategorias(settings).find(c => c.id === id) || { id: id, nombre: 'Otros', sub: '', imagen: '', prefijo: 'PR' };
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

/* ---------- contacto: Instagram / Facebook / WhatsApp ---------- */
const KV_ICONOS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07c-1.27.06-2.15.26-2.91.56-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.67-.51-.17 0-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12 22a10 10 0 0 1-5.1-1.4l-.36-.22-3.79 1 1.01-3.7-.24-.38A9.9 9.9 0 0 1 2 12a10 10 0 1 1 10 10zm0-22C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.98L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>'
};

function kvContactos(settings) {
  settings = settings || {};
  const ig = (settings.instagram || '').trim();
  const fb = (settings.facebook || '').trim();
  const wa = (settings.whatsapp || '').trim();
  const out = [];
  if (ig) out.push({ tipo: 'instagram', texto: ig, url: 'https://instagram.com/' + ig.replace(/^@/, '').replace(/\s+/g, '') });
  if (fb) {
    let url, texto;
    if (/^https?:\/\//i.test(fb)) { url = fb; texto = fb.replace(/^https?:\/\/(www\.)?(m\.)?facebook\.com\//i, '').replace(/\/$/, '') || 'Facebook'; }
    else { url = 'https://facebook.com/' + fb.replace(/^@/, ''); texto = fb.replace(/^@/, ''); }
    out.push({ tipo: 'facebook', texto: texto, url: url });
  }
  if (wa) out.push({ tipo: 'whatsapp', texto: wa, url: 'https://wa.me/' + wa.replace(/[^0-9]/g, '') });
  return out;
}

/* fila de contactos con ícono + enlace. `tipos` opcional filtra cuáles mostrar. */
function kvContactoRow(settings, tipos) {
  let cs = kvContactos(settings);
  if (tipos) cs = cs.filter(c => tipos.indexOf(c.tipo) !== -1);
  if (!cs.length) return '';
  return '<div class="fb-contactos">' + cs.map(c =>
    '<a class="fb-contacto fb-contacto-' + c.tipo + '" href="' + c.url + '" target="_blank" rel="noopener">' +
      '<span class="fb-contacto-ico">' + KV_ICONOS[c.tipo] + '</span>' +
      '<span class="fb-contacto-txt">' + escapeHtml(c.texto) + '</span>' +
    '</a>'
  ).join('') + '</div>';
}

/* tarjeta pública (estilo Amore: foto + barra de etiqueta), clickeable para ampliar */
function kvCardHtml(p) {
  return (
    '<div class="cat-card cat-card-click" data-id="' + p.id + '" role="button" tabindex="0" aria-label="Ver ' + escapeHtml(p.name) + '">' +
      '<div class="cat-card-foto" style="' + kvFotoCss(p) + '">' +
        (!p.photo ? '<span class="cat-card-sinfoto">✦</span>' : '') +
        '<span class="cat-card-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>' +
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
function kvCardEditHtml(p, cats) {
  cats = cats || KV_CATEGORIAS;
  const opciones = cats.map(c =>
    '<option value="' + c.id + '"' + (p.category === c.id ? ' selected' : '') + '>' + escapeHtml(c.nombre) + '</option>').join('');
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
