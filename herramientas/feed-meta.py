#!/usr/bin/env python3
"""
Genera catalogo-meta.csv (el feed que lee el catálogo de productos de Meta)
leyendo el catálogo EN VIVO desde Firestore, y exporta a assets/productos/
las fotos que están guardadas dentro de la base de datos.

Uso, parado en la raíz del repositorio:
    python3 herramientas/feed-meta.py

No escribe nada en Firestore: solo lee. Después hay que hacer commit y push
para que GitHub Pages publique el archivo, y pedirle a Meta que lo relea.
"""
import base64, csv, json, os, re, sys, urllib.parse, urllib.request

PROYECTO = "karive-catalogo"
BASE_WEB = "https://karivejoyas.github.io/catalogo/"
RAIZ = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROYECTO
EXT = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp"}
MARCA = "Karivé Joyas"
CATEGORIA_GOOGLE = "Apparel & Accessories > Jewelry > Earrings"


def valor(campo):
    """Desenvuelve un valor del formato de Firestore."""
    if campo is None:
        return None
    for clave in ("stringValue", "booleanValue", "doubleValue"):
        if clave in campo:
            return campo[clave]
    if "integerValue" in campo:
        return int(campo["integerValue"])
    return None


def leer_documentos(ruta, campos):
    """Trae todos los documentos de una colección, paginando."""
    mask = "&".join("mask.fieldPaths=%s" % c for c in campos)
    docs, token = [], None
    while True:
        url = "%s/%s?pageSize=100&%s" % (RAIZ, ruta, mask)
        if token:
            url += "&pageToken=" + urllib.parse.quote(token)
        with urllib.request.urlopen(url, timeout=90) as r:
            datos = json.load(r)
        docs += datos.get("documents", [])
        token = datos.get("nextPageToken")
        if not token:
            return docs


def nombres_de_coleccion():
    """id de colección -> nombre que ve la clienta."""
    with urllib.request.urlopen(RAIZ + "/catalog/settings", timeout=40) as r:
        s = json.load(r).get("fields", {})
    nombres = {}
    for v in s.get("categorias", {}).get("arrayValue", {}).get("values", []):
        f = v.get("mapValue", {}).get("fields", {})
        ident, nombre = valor(f.get("id")), valor(f.get("nombre"))
        if ident:
            nombres[ident] = nombre or ident
    # 'cats' puede renombrar una colección por encima de 'categorias'
    for ident, v in s.get("cats", {}).get("mapValue", {}).get("fields", {}).items():
        nombre = valor(v.get("mapValue", {}).get("fields", {}).get("nombre"))
        if nombre:
            nombres[ident] = nombre
    return nombres


def exportar_foto(codigo, foto):
    """Deja la foto como archivo público y devuelve su ruta relativa."""
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


def main():
    if not os.path.isdir("assets/productos"):
        sys.exit("Ejecuta esto parado en la raíz del repositorio.")
    nombres = nombres_de_coleccion()
    campos = ["code", "name", "price", "priceOffer", "stock", "detail", "category", "order", "photo"]
    docs = leer_documentos("catalog/products/items", campos)

    # Red de seguridad: si Firestore responde a medias, mejor fallar que
    # publicar un catálogo vacío y borrar lo que estaba bien.
    if len(docs) < 20:
        sys.exit("Solo llegaron %d productos. Se aborta sin escribir nada." % len(docs))

    filas, sin_foto = [], []
    for doc in docs:
        f = doc.get("fields", {})
        p = {c: valor(f.get(c)) for c in campos}
        codigo = (p.get("code") or "").strip()
        if not codigo:
            continue
        ruta = exportar_foto(codigo, p.get("photo") or "")
        if not ruta:
            sin_foto.append(codigo)
            continue
        imagen = ruta if ruta.startswith("http") else BASE_WEB + ruta
        coleccion = nombres.get(p.get("category"), (p.get("category") or "").capitalize())
        medida = (p.get("detail") or "").strip()
        desc = "%s de Karivé Joyas. Aros artesanales hechos a mano en Chile, en acero quirúrgico." % (p.get("name") or "")
        if medida:
            desc += " Medida %s." % medida
        desc += " Colección %s. Código %s." % (coleccion, codigo)
        precio = int(p.get("price") or 0)
        oferta = int(p.get("priceOffer") or 0)
        filas.append({
            "id": codigo,
            "title": (p.get("name") or "")[:150],
            "description": desc[:5000],
            "availability": "in stock" if p.get("stock") else "out of stock",
            "condition": "new",
            "price": "%d CLP" % precio,
            "sale_price": ("%d CLP" % oferta) if 0 < oferta < precio else "",
            "link": BASE_WEB + "?p=" + codigo,
            "image_link": imagen,
            "brand": MARCA,
            "product_type": coleccion,
            "google_product_category": CATEGORIA_GOOGLE,
            "_orden": (p.get("category") or "", p.get("order") or 0),
        })

    filas.sort(key=lambda r: r.pop("_orden"))
    columnas = ["id", "title", "description", "availability", "condition", "price",
                "sale_price", "link", "image_link", "brand", "product_type",
                "google_product_category"]
    with open("catalogo-meta.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(filas)

    print("productos en el feed :", len(filas))
    print("sin stock            :", sum(1 for r in filas if r["availability"] == "out of stock"))
    print("con oferta           :", sum(1 for r in filas if r["sale_price"]))
    if sin_foto:
        print("SIN FOTO (quedaron fuera):", ", ".join(sin_foto))


if __name__ == "__main__":
    main()
