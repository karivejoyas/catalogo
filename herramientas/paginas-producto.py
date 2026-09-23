#!/usr/bin/env python3
"""
Genera, leyendo el catálogo EN VIVO desde Firestore:

  p/<CODIGO>.html     una página real por producto (con precio visible)
  catalogo-google.csv el feed para las fichas gratuitas de Google Shopping
  sitemap.xml         para que Google encuentre todas las páginas

Por qué páginas de verdad: el catálogo es una sola página que arma todo con
JavaScript. Google y Merchant Center necesitan una dirección que muestre el
producto y su precio sin depender de eso, y WhatsApp e Instagram necesitan
una página con etiquetas Open Graph para mostrar la foto al compartir.

Uso, parado en la raíz del repositorio:
    python3 herramientas/paginas-producto.py

Solo lee Firestore; no escribe nada en la base de datos.
"""
import base64, csv, html, json, os, re, sys, urllib.parse, urllib.request

PROYECTO = "karive-catalogo"
BASE = "https://karivejoyas.github.io/catalogo/"
RAIZ = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROYECTO
EXT = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp"}
MARCA = "Karivé Joyas"
CAT_GOOGLE = "Apparel & Accessories > Jewelry > Earrings"
WHATSAPP = "56988829803"


# Colores reconocidos en el nombre del producto. Es el mismo diccionario que
# usa comun.js para Mercado Libre, portado aquí para no repetir criterios.
COLORES = {
    "rojo": "Rojo", "roja": "Rojo", "rojas": "Rojo", "rojos": "Rojo",
    "azul": "Azul", "azules": "Azul",
    "blanco": "Blanco", "blanca": "Blanco", "blancas": "Blanco", "blancos": "Blanco",
    "negro": "Negro", "negra": "Negro", "negras": "Negro", "negros": "Negro",
    "dorado": "Dorado", "dorada": "Dorado", "doradas": "Dorado", "dorados": "Dorado",
    "plateado": "Plateado", "plateada": "Plateado", "plateadas": "Plateado", "plateados": "Plateado",
    "morado": "Morado", "morada": "Morado", "moradas": "Morado",
    "celeste": "Celeste", "celestes": "Celeste",
    "verde": "Verde", "verdes": "Verde",
    "amarillo": "Amarillo", "amarilla": "Amarillo",
    "naranjo": "Naranjo", "naranja": "Naranjo",
    "rosa": "Rosa", "rosado": "Rosa", "rosada": "Rosa", "rosas": "Rosa",
    "turquesa": "Turquesa", "mostaza": "Mostaza", "cobre": "Cobre", "beige": "Beige",
    "marino": "Azul", "petroleo": "Azul", "lila": "Lila", "violeta": "Violeta",
    "fucsia": "Fucsia", "gris": "Gris", "cafe": "Café", "burdeo": "Burdeo",
    "coral": "Coral", "arena": "Beige", "perla": "Blanco",
    "transparente": "Transparente", "multicolor": "Multicolor",
    "tricolor": "Multicolor", "glitter": "Multicolor",
}


def medidas(ruta):
    """Ancho y alto de un JPEG o PNG, sin librerías externas. WhatsApp y
    Facebook suelen omitir la vista previa cuando el tamaño no viene declarado."""
    import struct
    try:
        with open(ruta, "rb") as f:
            cab = f.read(26)
            if cab[:8] == b"\x89PNG\r\n\x1a\n":
                return struct.unpack(">II", cab[16:24])
            if cab[:2] != b"\xff\xd8":
                return None
            f.seek(2)
            while True:
                b = f.read(1)
                while b and b != b"\xff":
                    b = f.read(1)
                m = f.read(1)
                while m == b"\xff":
                    m = f.read(1)
                if not m:
                    return None
                if m[0] in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    f.read(3)
                    alto, ancho = struct.unpack(">HH", f.read(4))
                    return ancho, alto
                largo = struct.unpack(">H", f.read(2))[0]
                f.read(largo - 2)
    except Exception:
        return None


def limpio(t):
    """Quita espacios sobrantes. Los nombres vienen tal cual de la base de datos
    y alguno trae espacios de más; se corrige aquí, sin tocar el producto."""
    return re.sub(r"\s+", " ", str(t or "")).strip()


def sin_tildes(t):
    import unicodedata
    t = unicodedata.normalize("NFD", str(t or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def color_de(nombre):
    """Gana la palabra que aparece MÁS TARDE: en 'Flor Blanca Dorado' el color
    del aro es el último; el primero suele describir la flor."""
    n = sin_tildes(nombre)
    if not n:
        return ""
    mejor, pos = "", -1
    for clave, valor_color in COLORES.items():
        m = re.search(r"\b" + clave + r"\b", n)
        if m and m.start() > pos:
            pos, mejor = m.start(), valor_color
    return mejor


def valor(c):
    if c is None:
        return None
    for k in ("stringValue", "booleanValue", "doubleValue"):
        if k in c:
            return c[k]
    if "integerValue" in c:
        return int(c["integerValue"])
    return None


def documentos(ruta, campos):
    mask = "&".join("mask.fieldPaths=%s" % c for c in campos)
    docs, token = [], None
    while True:
        url = "%s/%s?pageSize=100&%s" % (RAIZ, ruta, mask)
        if token:
            url += "&pageToken=" + urllib.parse.quote(token)
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
        docs += d.get("documents", [])
        token = d.get("nextPageToken")
        if not token:
            return docs


def colecciones():
    with urllib.request.urlopen(RAIZ + "/catalog/settings", timeout=40) as r:
        s = json.load(r).get("fields", {})
    n = {}
    for v in s.get("categorias", {}).get("arrayValue", {}).get("values", []):
        f = v.get("mapValue", {}).get("fields", {})
        if valor(f.get("id")):
            n[valor(f.get("id"))] = valor(f.get("nombre")) or valor(f.get("id"))
    for ident, v in s.get("cats", {}).get("mapValue", {}).get("fields", {}).items():
        nom = valor(v.get("mapValue", {}).get("fields", {}).get("nombre"))
        if nom:
            n[ident] = nom
    return n


def foto_publica(codigo, foto):
    if not foto:
        return None
    if foto.startswith("http"):
        return foto
    if not foto.startswith("data:"):
        return foto if os.path.exists(foto) else None
    m = re.match(r"data:image/([a-zA-Z]+);base64,(.*)$", foto, re.S)
    if not m:
        return None
    destino = "assets/productos/%s.%s" % (codigo, EXT.get(m.group(1).lower(), "jpg"))
    datos = base64.b64decode(m.group(2))
    if not (os.path.exists(destino) and open(destino, "rb").read() == datos):
        open(destino, "wb").write(datos)
    return destino


def pesos(n):
    return "$" + format(int(n), ",d").replace(",", ".")


PLANTILLA = """<!doctype html>
<html lang="es" prefix="og: https://ogp.me/ns# product: https://ogp.me/ns/product#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo} · {marca}</title>
<meta name="description" content="{desc_corta}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="{marca}">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{desc_corta}">
<meta property="og:image" content="{imagen}">
<meta property="og:image:secure_url" content="{imagen}">
<meta property="og:image:alt" content="{titulo}">{medidas_og}
<meta property="og:url" content="{url}">
<meta property="og:locale" content="es_CL">
<meta property="product:price:amount" content="{precio_num}">
<meta property="product:price:currency" content="CLP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{imagen}">
<link rel="icon" href="../assets/logo-avatar.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<script type="application/ld+json">{jsonld}</script>
<style>
:root{{--morado-osc:#2A123E;--morado-prof:#3A1D4E;--dorado:#C9A24B;--dorado-cl:#E3C572;--lavanda:#CBB7D8;--crema:#FBF6EE;}}
*{{box-sizing:border-box;}}
body{{margin:0;background:var(--morado-osc);color:var(--crema);font-family:'Jost',system-ui,sans-serif;font-weight:300;line-height:1.6;}}
a{{color:var(--dorado-cl);}}
.envoltura{{max-width:960px;margin:0 auto;padding:24px 16px 64px;}}
header{{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:28px;}}
.logo{{font-family:'Cormorant Garamond',serif;font-size:22px;letter-spacing:.18em;color:var(--dorado-cl);text-decoration:none;}}
.volver{{font-size:13px;text-decoration:none;}}
.ficha{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:start;}}
.foto{{width:100%;border-radius:16px;border:1px solid rgba(201,162,75,.3);background:var(--morado-prof);display:block;aspect-ratio:4/3;object-fit:cover;}}
h1{{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:34px;line-height:1.15;margin:0 0 6px;color:var(--crema);}}
.codigo{{font-size:12px;letter-spacing:.14em;color:var(--lavanda);text-transform:uppercase;margin-bottom:14px;}}
.precio{{font-family:'Cormorant Garamond',serif;font-size:36px;color:var(--dorado-cl);margin:10px 0 4px;}}
.stock{{font-size:13px;color:var(--lavanda);margin-bottom:18px;}}
.stock.no{{color:#E6A5A5;}}
.datos{{border-top:1px solid rgba(201,162,75,.22);margin-top:18px;padding-top:16px;font-size:14px;color:var(--lavanda);}}
.datos div{{margin-bottom:5px;}}
.acciones{{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;}}
.btn{{display:inline-block;padding:12px 20px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:400;}}
.btn-1{{background:linear-gradient(135deg,var(--dorado),var(--dorado-cl));color:#2A123E;}}
.btn-2{{border:1px solid rgba(201,162,75,.5);color:var(--dorado-cl);}}
.texto{{margin-top:34px;font-size:14px;color:var(--lavanda);max-width:640px;}}
footer{{margin-top:48px;padding-top:18px;border-top:1px solid rgba(201,162,75,.18);font-size:12px;color:var(--lavanda);}}
@media (max-width:720px){{.ficha{{grid-template-columns:1fr;gap:22px;}}h1{{font-size:27px;}}.precio{{font-size:30px;}}}}
</style>
</head>
<body>
<div class="envoltura">
  <header>
    <a class="logo" href="../">KARIVÉ · JOYAS</a>
    <a class="volver" href="../">← Ver todo el catálogo</a>
  </header>

  <article class="ficha">
    <img class="foto" src="{imagen_rel}" alt="{titulo}" width="800" height="600">
    <div>
      <h1>{titulo}</h1>
      <div class="codigo">Código {codigo} · {coleccion}</div>
      <div class="precio">{precio_txt}</div>
      <div class="stock{clase_stock}">{texto_stock}</div>
      <div class="datos">
        {medida_html}
        <div>Material: acero quirúrgico</div>
        <div>Hechos a mano en Chile</div>
      </div>
      <div class="acciones">
        <a class="btn btn-1" href="../?p={codigo}">Comprar en el catálogo</a>
        <a class="btn btn-2" href="https://wa.me/{whatsapp}?text={wa_texto}">Consultar por WhatsApp</a>
      </div>
    </div>
  </article>

  <p class="texto">{descripcion}</p>

  <footer>{marca} · Joyería artesanal hecha a mano en Chile · <a href="../">Catálogo completo</a> · <a href="../devoluciones.html">Cambios y devoluciones</a> · <a href="../privacidad.html">Privacidad</a></footer>
</div>
</body>
</html>
"""


def main():
    if not os.path.isdir("assets/productos"):
        sys.exit("Ejecuta esto parado en la raíz del repositorio.")
    os.makedirs("p", exist_ok=True)
    nombres = colecciones()
    campos = ["code", "name", "price", "priceOffer", "stock", "detail", "category", "order", "photo"]
    docs = documentos("catalog/products/items", campos)

    # Red de seguridad: si Firestore responde a medias, mejor fallar que
    # publicar un catálogo vacío y borrar lo que estaba bien.
    if len(docs) < 20:
        sys.exit("Solo llegaron %d productos. Se aborta sin escribir nada." % len(docs))

    filas, paginas, sin_foto = [], [], []
    for doc in docs:
        f = doc.get("fields", {})
        p = {c: valor(f.get(c)) for c in campos}
        cod = (p.get("code") or "").strip()
        if not cod:
            continue
        ruta = foto_publica(cod, p.get("photo") or "")
        if not ruta:
            sin_foto.append(cod)
            continue
        imagen = ruta if ruta.startswith("http") else BASE + ruta
        imagen_rel = ruta if ruta.startswith("http") else "../" + ruta
        col = nombres.get(p.get("category"), (p.get("category") or "").capitalize())
        nombre = limpio(p.get("name"))
        medida = limpio(p.get("detail"))
        color = color_de(nombre)
        precio = int(p.get("price") or 0)
        oferta = int(p.get("priceOffer") or 0)
        vigente = oferta if 0 < oferta < precio else precio
        hay = bool(p.get("stock"))
        url = BASE + "p/" + cod + ".html"
        dim = medidas(ruta) if not ruta.startswith("http") else None
        medidas_og = ('\n<meta property="og:image:width" content="%d">'
                      '\n<meta property="og:image:height" content="%d">' % dim) if dim else ""

        desc = ("%s de Karivé Joyas. Aros artesanales hechos a mano en Chile, en acero quirúrgico."
                % nombre)
        if medida:
            desc += " Medida %s." % medida
        desc += " Colección %s. Código %s." % (col, cod)
        corta = ("%s · %s · acero quirúrgico, hecho a mano en Chile."
                 % (nombre, pesos(vigente)))

        jsonld = json.dumps({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": nombre,
            "sku": cod,
            "mpn": cod,
            "image": imagen,
            "description": desc,
            "brand": {"@type": "Brand", "name": MARCA},
            "material": "Acero quirúrgico",
            "offers": {
                "@type": "Offer",
                "url": url,
                "priceCurrency": "CLP",
                "price": str(vigente),
                "availability": "https://schema.org/%s" % ("InStock" if hay else "OutOfStock"),
                "itemCondition": "https://schema.org/NewCondition",
            },
        }, ensure_ascii=False)

        e = lambda s: html.escape(str(s), quote=True)
        pagina = PLANTILLA.format(
            titulo=e(nombre), marca=e(MARCA), desc_corta=e(corta), url=e(url),
            imagen=e(imagen), imagen_rel=e(imagen_rel), codigo=e(cod), coleccion=e(col),
            medidas_og=medidas_og,
            precio_num=vigente, precio_txt=e(pesos(vigente)),
            clase_stock="" if hay else " no",
            texto_stock="Disponible" if hay else "Por ahora sin stock",
            medida_html=("<div>Medida: %s</div>" % e(medida)) if medida else "",
            descripcion=e(desc), jsonld=jsonld, whatsapp=WHATSAPP,
            wa_texto=urllib.parse.quote("Hola! Me interesa %s (%s)" % (nombre, cod)),
        )
        open("p/%s.html" % cod, "w", encoding="utf-8").write(pagina)
        paginas.append(cod)

        filas.append({
            "id": cod,
            "title": nombre[:150],
            "description": desc[:5000],
            "link": url,
            "image_link": imagen,
            "availability": "in_stock" if hay else "out_of_stock",
            "price": "%d CLP" % precio,
            "sale_price": ("%d CLP" % oferta) if 0 < oferta < precio else "",
            "condition": "new",
            "brand": MARCA,
            "mpn": cod,
            "identifier_exists": "no",
            "google_product_category": CAT_GOOGLE,
            "product_type": col,
            "color": color,
            "_orden": (p.get("category") or "", p.get("order") or 0),
        })

    filas.sort(key=lambda r: r.pop("_orden"))
    cols = ["id", "title", "description", "link", "image_link", "availability", "price",
            "sale_price", "condition", "brand", "mpn", "identifier_exists",
            "google_product_category", "product_type", "color"]
    with open("catalogo-google.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)

    urls = [BASE, BASE + "devoluciones.html"] + [BASE + "p/" + c + ".html" for c in sorted(paginas)]
    with open("sitemap.xml", "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        fh.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            fh.write("  <url><loc>%s</loc></url>\n" % html.escape(u))
        fh.write("</urlset>\n")

    print("páginas creadas :", len(paginas))
    print("filas en el feed:", len(filas))
    print("sin stock       :", sum(1 for r in filas if r["availability"] == "out_of_stock"))
    if sin_foto:
        print("SIN FOTO (fuera):", ", ".join(sin_foto))


if __name__ == "__main__":
    main()
