'use strict';

function formatCLP(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('es-CL');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const KV_NO_PHOTO_BG = 'repeating-linear-gradient(45deg, rgba(201,162,75,0.10) 0 11px, transparent 11px 22px)';

function kvCardHtml(p, cardStyle, editing) {
  const cls = 'kv-card kv-card--' + cardStyle;
  const photoStyle = 'background-image:' + (p.photo ? "url('" + p.photo + "')" : KV_NO_PHOTO_BG) + ';';

  let photoInner;
  if (editing) {
    photoInner =
      (!p.photo ? '<div class="kv-photo-placeholder"><span class="kv-photo-mark">✦</span><span class="kv-photo-text">FOTO PRODUCTO</span></div>' : '') +
      '<div class="kv-photo-edit">' +
        '<label class="kv-photo-btn">' + (p.photo ? 'Cambiar foto' : 'Agregar foto') +
          '<input type="file" accept="image/*" data-role="upload" data-id="' + p.id + '" style="display:none;" />' +
        '</label>' +
        (p.photo ? '<button type="button" class="kv-photo-btn-ghost" data-role="remove-photo" data-id="' + p.id + '">Quitar</button>' : '') +
      '</div>';
  } else {
    photoInner = !p.photo ? '<div class="kv-photo-placeholder"><span class="kv-photo-mark">✦</span><span class="kv-photo-text">FOTO PRODUCTO</span></div>' : '';
  }

  let body;
  if (editing) {
    body =
      '<div class="kv-card-toprow">' +
        '<input class="kv-ed-input kv-ed-code" data-role="code" data-id="' + p.id + '" value="' + escapeHtml(p.code) + '" />' +
        '<button type="button" class="kv-delete-btn" data-role="delete" data-id="' + p.id + '">Eliminar</button>' +
      '</div>' +
      '<input class="kv-ed-input kv-ed-name" data-role="name" data-id="' + p.id + '" value="' + escapeHtml(p.name) + '" />' +
      '<textarea class="kv-ed-textarea kv-ed-desc" data-role="desc" data-id="' + p.id + '" rows="2">' + escapeHtml(p.desc) + '</textarea>' +
      '<div class="kv-ed-price-row"><span class="kv-ed-peso">$</span>' +
        '<input class="kv-ed-input kv-ed-price" data-role="price" data-id="' + p.id + '" value="' + p.price + '" inputmode="numeric" />' +
      '</div>';
  } else {
    body =
      '<div class="kv-card-toprow"><span class="kv-code">' + escapeHtml(p.code) + '</span></div>' +
      '<h3 class="kv-name">' + escapeHtml(p.name) + '</h3>' +
      '<p class="kv-desc">' + escapeHtml(p.desc) + '</p>' +
      '<div class="kv-price">' + formatCLP(p.price) + '</div>';
  }

  return (
    '<div class="' + cls + '" data-id="' + p.id + '">' +
      '<div class="kv-photo" style="' + photoStyle + '">' + photoInner + '</div>' +
      '<div class="kv-card-body">' + body + '</div>' +
    '</div>'
  );
}

function kvCompressPhoto(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const max = 560;
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

const KV_DEFAULT_PRODUCTS = (() => {
  const tipos = [
    ['Argollas', 'argollas'], ['Aros colgantes', 'colgantes'], ['Topos', 'topos'],
    ['Ear cuff', 'ear cuff'], ['Aros perla', 'perla'], ['Aros gota', 'gota'],
    ['Aros circón', 'circón'], ['Aros corazón', 'corazón'], ['Aros estrella', 'estrella'], ['Huggies', 'huggie']
  ];
  const mats = ['Acero quirúrgico dorado', 'Plata 925', 'Baño de oro 18k', 'Oro laminado', 'Acero blanco'];
  const adjs = ['minimalistas', 'elegantes', 'delicados', 'statement', 'románticos', 'clásicos'];
  const precios = [4990, 5990, 6990, 7990, 8990, 9990, 11990, 12990, 14990, 16990, 18990, 22990];
  return function defaults() {
    const out = [];
    for (let i = 0; i < 50; i++) {
      const t = tipos[i % tipos.length];
      const m = mats[i % mats.length];
      const a = adjs[i % adjs.length];
      out.push({
        id: 'p' + String(i + 1).padStart(3, '0'),
        code: 'AR-' + String(i + 1).padStart(3, '0'),
        name: t[0] + ' ' + a,
        desc: m + ' · hipoalergénico · ' + t[1],
        price: precios[i % precios.length],
        photo: null,
        order: i
      });
    }
    return out;
  };
})();
