#!/usr/bin/env python3
"""
Vigía del catálogo: compara el catálogo en vivo con el del día anterior y
avisa por Telegram lo que cambió (productos nuevos, sin stock, precios,
ofertas...). No usa IA: es una comparación exacta, así que no inventa nada.

La foto del día anterior se guarda en herramientas/estado-catalogo.json,
que el flujo de GitHub Actions deja en el repositorio.

Variables de entorno (en GitHub van como Secrets):
  TELEGRAM_TOKEN    token del bot de Karivé (obligatorio para enviar)
  TELEGRAM_CHAT_ID  chat al que se envía (opcional: si falta, se usa el
                    único chat que le haya escrito al bot)

Sin TELEGRAM_TOKEN el reporte se imprime y no se envía nada.

Uso, parado en la raíz del repositorio:
    python3 herramientas/vigia.py

Solo lee Firestore; no escribe nada en la base de datos.
"""
import html, json, os, sys, urllib.error, urllib.parse, urllib.request

PROYECTO = "karive-catalogo"
RAIZ = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROYECTO
SITIO = "https://karivejoyas.github.io/catalogo/"
ESTADO = "herramientas/estado-catalogo.json"
MAX_POR_GRUPO = 15          # Telegram corta los mensajes largos; se resume el resto


def valor(c):
    if c is None:
        return None
    for k in ("stringValue", "booleanValue", "doubleValue"):
        if k in c:
            return c[k]
    if "integerValue" in c:
        return int(c["integerValue"])
    return None


def leer_catalogo():
    campos = ["code", "name", "price", "priceOffer", "stock", "category"]
    mask = "&".join("mask.fieldPaths=%s" % c for c in campos)
    docs, token = [], None
    while True:
        url = "%s/catalog/products/items?pageSize=100&%s" % (RAIZ, mask)
        if token:
            url += "&pageToken=" + urllib.parse.quote(token)
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
        docs += d.get("documents", [])
        token = d.get("nextPageToken")
        if not token:
            break
    catalogo = {}
    for doc in docs:
        f = doc.get("fields", {})
        ident = doc["name"].rsplit("/", 1)[-1]
        catalogo[ident] = {
            "code": (valor(f.get("code")) or "").strip(),
            "name": " ".join(str(valor(f.get("name")) or "").split()),
            "price": int(valor(f.get("price")) or 0),
            "offer": int(valor(f.get("priceOffer")) or 0),
            "stock": bool(valor(f.get("stock"))),
            "category": valor(f.get("category")) or "",
        }
    return catalogo


def colecciones():
    try:
        with urllib.request.urlopen(RAIZ + "/catalog/settings", timeout=40) as r:
            s = json.load(r).get("fields", {})
    except Exception:
        return {}
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


def aviso(nivel, texto):
    """Deja el resultado como anotación de GitHub Actions (visible en la
    corrida y consultable por la API), además de imprimirlo."""
    print(texto)
    if os.environ.get("GITHUB_ACTIONS"):
        print("::%s title=Vigía::%s" % (nivel, texto.replace("\n", " ")))


def pesos(n):
    return "$" + format(int(n), ",d").replace(",", ".")


def e(t):
    return html.escape(str(t), quote=False)


def etiqueta(p, con_enlace=False):
    cod = p["code"] or "sin código"
    txt = "<b>%s</b> %s" % (e(cod), e(p["name"]))
    if con_enlace and p["code"]:
        txt = '<a href="%sp/%s.html">%s</a> %s' % (SITIO, urllib.parse.quote(p["code"]), e(cod), e(p["name"]))
    return txt


def grupo(titulo, lineas):
    if not lineas:
        return ""
    extra = len(lineas) - MAX_POR_GRUPO
    cuerpo = "\n".join("• " + l for l in lineas[:MAX_POR_GRUPO])
    if extra > 0:
        cuerpo += "\n• …y %d más" % extra
    return "%s (%d)\n%s" % (titulo, len(lineas), cuerpo)


def comparar(antes, ahora, cols):
    nuevos, borrados, sin_stock, con_stock = [], [], [], []
    precios, ofertas_on, ofertas_off, codigos, nombres = [], [], [], [], []

    for ident, p in ahora.items():
        a = antes.get(ident)
        if a is None:
            col = cols.get(p["category"], p["category"])
            nuevos.append("%s · %s · %s" % (etiqueta(p, True), pesos(p["price"]), e(col)))
            continue
        if a["code"] != p["code"]:
            codigos.append("%s → <b>%s</b> %s" % (e(a["code"] or "sin código"), e(p["code"] or "sin código"), e(p["name"])))
        if a["name"] != p["name"]:
            nombres.append("<b>%s</b> «%s» → «%s»" % (e(p["code"]), e(a["name"]), e(p["name"])))
        if a["stock"] and not p["stock"]:
            sin_stock.append(etiqueta(p))
        if not a["stock"] and p["stock"]:
            con_stock.append(etiqueta(p))
        if a["price"] != p["price"]:
            precios.append("%s %s → %s" % (etiqueta(p), pesos(a["price"]), pesos(p["price"])))
        oferta_antes = 0 < a["offer"] < a["price"]
        oferta_ahora = 0 < p["offer"] < p["price"]
        if oferta_ahora and (not oferta_antes or a["offer"] != p["offer"]):
            ofertas_on.append("%s %s → <b>%s</b>" % (etiqueta(p), pesos(p["price"]), pesos(p["offer"])))
        if oferta_antes and not oferta_ahora:
            ofertas_off.append(etiqueta(p))

    for ident, a in antes.items():
        if ident not in ahora:
            borrados.append(etiqueta(a))

    return [
        grupo("🆕 Nuevos", nuevos),
        grupo("💲 Cambios de precio", precios),
        grupo("🏷 Ofertas nuevas", ofertas_on),
        grupo("🏷 Ofertas terminadas", ofertas_off),
        grupo("⛔ Quedaron sin stock", sin_stock),
        grupo("✅ Volvieron a tener stock", con_stock),
        grupo("🔢 Cambió el código", codigos),
        grupo("✏️ Cambió el nombre", nombres),
        grupo("🗑 Ya no están en el catálogo", borrados),
    ]


def resumen(catalogo):
    total = len(catalogo)
    sin = sum(1 for p in catalogo.values() if not p["stock"])
    return "%d productos · %d sin stock" % (total, sin)


def armar_mensaje(antes, ahora, cols):
    cab = "💜 <b>Catálogo Karivé</b>"
    if antes is None:
        return "%s\nVigía activado. Desde mañana te aviso cada cambio.\n%s" % (cab, resumen(ahora))
    bloques = [b for b in comparar(antes, ahora, cols) if b]
    if not bloques:
        return "%s\nSin novedades · %s" % (cab, resumen(ahora))
    return "%s\n\n%s\n\n%s" % (cab, "\n\n".join(bloques), resumen(ahora))


def telegram(metodo, datos=None):
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    url = "https://api.telegram.org/bot%s/%s" % (token, metodo)
    cuerpo = urllib.parse.urlencode(datos).encode() if datos else None
    try:
        with urllib.request.urlopen(url, data=cuerpo, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as err:
        try:
            motivo = json.load(err).get("description", "")
        except Exception:
            motivo = ""
        pistas = {
            401: "el token no es válido (¿quedó con espacios o incompleto?)",
            404: "el token no es válido",
            409: "otro servicio está usando este bot (por ejemplo Houston con un webhook); "
                 "hay que definir TELEGRAM_CHAT_ID para no depender de getUpdates",
            400: "el chat no existe o el bot no puede escribirle: mándale /start",
            403: "el bot fue bloqueado o nunca recibió /start",
        }
        aviso("error", "Telegram respondió %d en %s: %s. %s" % (
            err.code, metodo, motivo, pistas.get(err.code, "")))
        sys.exit(1)


def chat_destino():
    """El chat configurado, o el único chat privado que le haya escrito al bot."""
    fijo = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if fijo:
        return fijo
    res = telegram("getUpdates")
    chats = {}
    for u in res.get("result", []):
        m = u.get("message") or u.get("edited_message") or {}
        c = m.get("chat") or {}
        if c.get("type") == "private":
            chats[str(c["id"])] = c.get("first_name") or c.get("username") or ""
    if len(chats) == 1:
        return next(iter(chats))
    if not chats:
        aviso("error", "El bot no tiene chats pendientes. Mándale /start en Telegram "
                       "o define TELEGRAM_CHAT_ID.")
        sys.exit(1)
    aviso("error", "Varios chats le escribieron al bot (%s). Define TELEGRAM_CHAT_ID "
                   "con el que corresponda." % ", ".join(chats))
    sys.exit(1)


def main():
    ahora = leer_catalogo()
    # Red de seguridad: una lectura a medias haría creer que se borró el catálogo
    if len(ahora) < 20:
        sys.exit("Solo llegaron %d productos. Se aborta sin avisar ni guardar nada." % len(ahora))

    antes = None
    if os.path.exists(ESTADO):
        with open(ESTADO, encoding="utf-8") as f:
            antes = json.load(f).get("productos")

    mensaje = armar_mensaje(antes, ahora, colecciones())
    print(mensaje)

    if os.environ.get("TELEGRAM_TOKEN", "").strip():
        res = telegram("sendMessage", {
            "chat_id": chat_destino(),
            "text": mensaje,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        })
        if not res.get("ok"):
            aviso("error", "Telegram rechazó el mensaje: %s" % res)
            sys.exit(1)
        aviso("notice", "Reporte enviado por Telegram.")
    else:
        aviso("warning", "No llegó el secreto TELEGRAM_TOKEN: el reporte no se envió. "
                         "Debe estar en Settings > Secrets and variables > Actions > "
                         "pestaña Secrets (no Variables), con ese nombre exacto.")

    # la foto de hoy se guarda solo después de avisar, para no perder cambios
    with open(ESTADO, "w", encoding="utf-8") as f:
        json.dump({"productos": ahora}, f, ensure_ascii=False, indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
