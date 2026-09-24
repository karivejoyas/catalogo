#!/usr/bin/env python3
"""
Resumen diario de Karivé por Telegram.

Junta en un solo mensaje lo que pasó en las últimas 24 horas y lo que queda
por hacer:
  - ventas del catálogo y de Mercado Libre
  - pedidos que esperan acción (pago sin verificar, pagados sin enviar)
  - carritos abandonados que se pueden recuperar, con el enlace de WhatsApp
  - visitas y productos más mirados
  - cambios en el catálogo (nuevos, precios, stock, ofertas)
  - productos que faltan en Mercado Libre o en redes
  - publicaciones de Mercado Libre de productos que ya no tienen stock

No usa IA: son comparaciones y cuentas exactas, así que no inventa nada.

Cada sección se activa sola cuando tiene lo que necesita (secretos de
GitHub Actions):
  TELEGRAM_TOKEN      bot de Karivé (sin esto, el resumen solo se imprime)
  TELEGRAM_CHAT_ID    opcional: si falta, se usa el único chat del bot
  PUBLICADOR_CLAVE    la clave del publicador (Apps Script): Mercado Libre
  FIREBASE_EMAIL      usuario del panel de administración: pedidos y
  FIREBASE_PASSWORD   visitas (son privados, por eso piden iniciar sesión)

La foto del catálogo del día anterior queda en herramientas/estado-catalogo.json.
Solo lee: no escribe nada en Firestore, en Mercado Libre ni en ninguna parte.

Uso, parado en la raíz del repositorio:
    python3 herramientas/vigia.py
"""
import html, json, os, re, sys, urllib.error, urllib.parse, urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
    CHILE = ZoneInfo("America/Santiago")
except Exception:                       # sin base de zonas: se aproxima
    CHILE = timezone(timedelta(hours=-3))

PROYECTO = "karive-catalogo"
RAIZ = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROYECTO
SITIO = "https://karivejoyas.github.io/catalogo/"
ESTADO = "herramientas/estado-catalogo.json"
MAX_POR_GRUPO = 12        # Telegram corta los mensajes largos; el resto se resume
DIAS_NUEVO = 30           # un producto es "nuevo" para redes durante estos días
# El panel empezó a anotar lo publicado en redes este día. Lo subido antes no
# tiene registro, así que no se reclama: saldría todo como pendiente.
REDES_DESDE = datetime(2026, 9, 24, tzinfo=timezone.utc)
AHORA = datetime.now(timezone.utc)
DESDE = AHORA - timedelta(hours=24)
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

faltan = []               # secciones que no se pudieron armar, y por qué


# ============================================================ utilidades

def env(nombre):
    return os.environ.get(nombre, "").strip()


def aviso(nivel, texto):
    """Imprime y deja una anotación visible en la corrida de GitHub Actions."""
    print(texto)
    if env("GITHUB_ACTIONS"):
        print("::%s title=Vigía::%s" % (nivel, texto.replace("\n", " ")))


def e(t):
    return html.escape(str(t), quote=False)


def pesos(n):
    return "$" + format(int(round(n or 0)), ",d").replace(",", ".")


def fecha(txt):
    """Convierte un texto ISO en fecha con zona. None si no se puede."""
    if not txt:
        return None
    try:
        d = datetime.fromisoformat(str(txt).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def hace(d):
    """'hace 3 días', 'hace 5 h'."""
    horas = (AHORA - d).total_seconds() / 3600
    if horas < 1:
        return "recién"
    if horas < 48:
        return "hace %d h" % horas
    return "hace %d días" % (horas // 24)


def pedir(url, datos=None, cabeceras=None, timeout=60):
    cuerpo = None
    if datos is not None:
        cuerpo = datos if isinstance(datos, bytes) else json.dumps(datos).encode()
    req = urllib.request.Request(url, data=cuerpo, headers=cabeceras or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


# ============================================================ Firestore

def desenvolver(v):
    """Pasa un valor del formato de Firestore a Python normal."""
    if v is None:
        return None
    if "mapValue" in v:
        return {k: desenvolver(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v:
        return [desenvolver(x) for x in v["arrayValue"].get("values", [])]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "nullValue" in v:
        return None
    for k in ("stringValue", "booleanValue", "timestampValue"):
        if k in v:
            return v[k]
    return None


def documentos(ruta, campos=None, token=None):
    """Todos los documentos de una colección: [(id, creado, datos)]."""
    mask = "&".join("mask.fieldPaths=%s" % c for c in (campos or []))
    cab = {"Authorization": "Bearer " + token} if token else {}
    salida, pagina = [], None
    while True:
        url = "%s/%s?pageSize=300%s" % (RAIZ, ruta, ("&" + mask) if mask else "")
        if pagina:
            url += "&pageToken=" + urllib.parse.quote(pagina)
        d = pedir(url, cabeceras=cab, timeout=90)
        for doc in d.get("documents", []):
            datos = {k: desenvolver(v) for k, v in doc.get("fields", {}).items()}
            salida.append((doc["name"].rsplit("/", 1)[-1], doc.get("createTime", ""), datos))
        pagina = d.get("nextPageToken")
        if not pagina:
            return salida


def configuracion():
    campos = ["igPubUrl", "redes", "cats", "categorias"]
    mask = "&".join("mask.fieldPaths=%s" % c for c in campos)
    try:
        d = pedir("%s/catalog/settings?%s" % (RAIZ, mask), timeout=60)
    except Exception:
        return {}
    return {k: desenvolver(v) for k, v in d.get("fields", {}).items()}


def nombres_coleccion(cfg):
    n = {}
    for c in cfg.get("categorias") or []:
        if isinstance(c, dict) and c.get("id"):
            n[c["id"]] = c.get("nombre") or c["id"]
    for ident, c in (cfg.get("cats") or {}).items():
        if isinstance(c, dict) and c.get("nombre"):
            n[ident] = c["nombre"]
    return n


def iniciar_sesion():
    """Pedidos y visitas son privados: se entra con el usuario del panel."""
    correo, clave = env("FIREBASE_EMAIL"), env("FIREBASE_PASSWORD")
    if not (correo and clave):
        faltan.append("pedidos y visitas (faltan FIREBASE_EMAIL y FIREBASE_PASSWORD)")
        return None
    try:
        conf = open("firebase-config.js", encoding="utf-8").read()
        llave = re.search(r'apiKey:\s*"([^"]+)"', conf).group(1)
        r = pedir("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + llave,
                  {"email": correo, "password": clave, "returnSecureToken": True},
                  {"Content-Type": "application/json"})
        return r["idToken"]
    except urllib.error.HTTPError as err:
        try:
            motivo = json.load(err).get("error", {}).get("message", "")
        except Exception:
            motivo = str(err.code)
        faltan.append("pedidos y visitas (no se pudo iniciar sesión: %s)" % motivo)
    except Exception as err:
        faltan.append("pedidos y visitas (no se pudo iniciar sesión: %s)" % err)
    return None


# ============================================================ catálogo

def leer_catalogo():
    campos = ["code", "name", "price", "priceOffer", "stock", "category"]
    cat = {}
    for ident, creado, p in documentos("catalog/products/items", campos):
        cat[ident] = {
            "code": (p.get("code") or "").strip(),
            "name": " ".join(str(p.get("name") or "").split()),
            "price": int(p.get("price") or 0),
            "offer": int(p.get("priceOffer") or 0),
            "stock": bool(p.get("stock")),
            "category": p.get("category") or "",
            "creado": creado,
        }
    return cat


def etiqueta(p, con_enlace=False):
    cod = p.get("code") or "sin código"
    if con_enlace and p.get("code"):
        return '<a href="%sp/%s.html">%s</a> %s' % (SITIO, urllib.parse.quote(p["code"]), e(cod), e(p["name"]))
    return "<b>%s</b> %s" % (e(cod), e(p.get("name", "")))


def grupo(titulo, lineas, maximo=MAX_POR_GRUPO):
    if not lineas:
        return ""
    cuerpo = "\n".join("• " + l for l in lineas[:maximo])
    if len(lineas) > maximo:
        cuerpo += "\n• …y %d más" % (len(lineas) - maximo)
    return "%s (%d)\n%s" % (titulo, len(lineas), cuerpo)


def cambios_catalogo(antes, ahora, cols):
    nuevos, borrados, sin_stock, con_stock = [], [], [], []
    precios, of_on, of_off, codigos, nombres = [], [], [], [], []
    for ident, p in ahora.items():
        a = antes.get(ident)
        if a is None:
            nuevos.append("%s · %s · %s" % (etiqueta(p, True), pesos(p["price"]), e(cols.get(p["category"], p["category"]))))
            continue
        if a.get("code") != p["code"]:
            codigos.append("%s → <b>%s</b> %s" % (e(a.get("code") or "sin código"), e(p["code"] or "sin código"), e(p["name"])))
        if a.get("name") != p["name"]:
            nombres.append("<b>%s</b> «%s» → «%s»" % (e(p["code"]), e(a.get("name")), e(p["name"])))
        if a.get("stock") and not p["stock"]:
            sin_stock.append(etiqueta(p))
        if not a.get("stock") and p["stock"]:
            con_stock.append(etiqueta(p))
        if a.get("price") != p["price"]:
            precios.append("%s %s → %s" % (etiqueta(p), pesos(a.get("price")), pesos(p["price"])))
        antes_of = 0 < (a.get("offer") or 0) < (a.get("price") or 0)
        ahora_of = 0 < p["offer"] < p["price"]
        if ahora_of and (not antes_of or a.get("offer") != p["offer"]):
            of_on.append("%s %s → <b>%s</b>" % (etiqueta(p), pesos(p["price"]), pesos(p["offer"])))
        if antes_of and not ahora_of:
            of_off.append(etiqueta(p))
    for ident, a in antes.items():
        if ident not in ahora:
            borrados.append(etiqueta(a))
    return [b for b in [
        grupo("🆕 Nuevos", nuevos),
        grupo("💲 Cambios de precio", precios),
        grupo("🏷 Ofertas nuevas", of_on),
        grupo("🏷 Ofertas terminadas", of_off),
        grupo("⛔ Quedaron sin stock", sin_stock),
        grupo("✅ Volvieron a tener stock", con_stock),
        grupo("🔢 Cambió el código", codigos),
        grupo("✏️ Cambió el nombre", nombres),
        grupo("🗑 Ya no están en el catálogo", borrados),
    ] if b]


# ============================================================ pedidos y visitas

def whatsapp(telefono, texto):
    num = re.sub(r"\D", "", str(telefono or ""))
    if len(num) == 9 and num.startswith("9"):
        num = "56" + num
    if len(num) < 11:
        return ""
    return "https://wa.me/%s?text=%s" % (num, urllib.parse.quote(texto))


def primer_nombre(c):
    return (str((c or {}).get("nombre") or "").strip().split() or ["Sin nombre"])[0]


def seccion_pedidos(token):
    campos = ["num", "estado", "fecha", "total", "items", "cliente", "medioPago", "pagoEstado"]
    peds = [(i, d) for i, _, d in documentos("catalog/pedidos/items", campos, token)]
    ventas, cantidad, lineas_ventas, hacer = 0, 0, [], []
    for _, p in sorted(peds, key=lambda x: x[1].get("fecha") or ""):
        f = fecha(p.get("fecha"))
        estado = p.get("estado") or "nuevo"
        pago_mp = p.get("pagoEstado")
        pagado_mal = pago_mp in ("rejected", "cancelled")
        if f and f >= DESDE and not pagado_mal:
            sin_pagar = pago_mp == "esperando-pago"
            if not sin_pagar:
                ventas += p.get("total") or 0
                cantidad += 1
            cods = ", ".join("%s×%s" % (it.get("qty", 1), it.get("code") or it.get("name", "")) for it in (p.get("items") or []))
            medio = "tarjeta" if p.get("medioPago") == "mercadopago" else "transferencia"
            nota = " · ⏳ pago no confirmado" if sin_pagar else (" · por verificar" if estado == "nuevo" else "")
            lineas_ventas.append("#%s %s · <b>%s</b> · %s · %s%s" % (
                p.get("num") or "?", e(primer_nombre(p.get("cliente"))), pesos(p.get("total")), medio, e(cods), nota))
        if not f:
            continue
        if estado == "nuevo" and pago_mp == "esperando-pago":
            if AHORA - f > timedelta(hours=12):
                hacer.append("Pedido #%s de %s se fue a pagar con tarjeta %s y no volvió: revisa si pagó" % (
                    p.get("num") or "?", e(primer_nombre(p.get("cliente"))), hace(f)))
        elif estado == "nuevo" and not pagado_mal:
            hacer.append("Pedido #%s de %s (%s): falta verificar el pago · %s" % (
                p.get("num") or "?", e(primer_nombre(p.get("cliente"))), pesos(p.get("total")), hace(f)))
        elif estado in ("verificado", "preparando") and AHORA - f > timedelta(days=2):
            hacer.append("Pedido #%s de %s está pagado y sin enviar · %s" % (
                p.get("num") or "?", e(primer_nombre(p.get("cliente"))), hace(f)))
    return {"monto": ventas, "cantidad": cantidad, "lineas": lineas_ventas, "hacer": hacer}


def seccion_visitas(token, catalogo):
    campos = ["creada", "ultima", "agregoCarrito", "hizoPedido", "carritoActual",
              "carritoTotal", "contacto", "productosIds"]
    vis = [d for _, _, d in documentos("catalog/visitas/items", campos, token)]
    recientes = [v for v in vis if (fecha(v.get("ultima") or v.get("creada")) or DESDE - timedelta(1)) >= DESDE]
    n = len(recientes)
    carrito = sum(1 for v in recientes if v.get("agregoCarrito") or v.get("carritoActual"))
    compras = sum(1 for v in recientes if v.get("hizoPedido"))
    por_id = {i: p for i, p in catalogo.items()}
    vistos = Counter(pid for v in recientes for pid in set(v.get("productosIds") or []))
    top = ["%s (%d)" % (e(por_id[i]["code"] or por_id[i]["name"]), c)
           for i, c in vistos.most_common(3) if i in por_id]

    recuperar = []
    for v in recientes:
        items = v.get("carritoActual") or []
        c = v.get("contacto") or {}
        if v.get("hizoPedido") or not items or not (c.get("telefono") or c.get("correo")):
            continue
        nombre = primer_nombre(c)
        lista = ", ".join(str(it.get("name") or "") for it in items)
        texto = ("Hola %s! 💜 Vi que dejaste %s en tu carrito de Karivé. "
                 "¿Te ayudo a terminar tu pedido?" % (nombre, lista))
        enlace = whatsapp(c.get("telefono"), texto)
        destino = ('<a href="%s">escribirle por WhatsApp</a>' % enlace) if enlace else e(c.get("correo") or "")
        recuperar.append("%s dejó %s en el carrito · %s" % (e(nombre), pesos(v.get("carritoTotal")), destino))

    linea = "%d visitas · %d al carrito · %d compraron" % (n, carrito, compras)
    if top:
        linea += "\nMás mirados: " + ", ".join(top)
    return {"linea": linea, "recuperar": recuperar}


# ============================================================ Mercado Libre

def publicador(url, accion, **extra):
    datos = dict(extra, accion=accion, clave=env("PUBLICADOR_CLAVE"))
    # El Apps Script responde con una redirección a googleusercontent: urllib la
    # sigue como GET, que es exactamente lo que ese servicio espera.
    return pedir(url, json.dumps(datos).encode(), {"Content-Type": "text/plain;charset=utf-8"}, timeout=300)


def seccion_ml(cfg, catalogo):
    url = (cfg.get("igPubUrl") or "").strip()
    if not env("PUBLICADOR_CLAVE"):
        faltan.append("Mercado Libre (falta PUBLICADOR_CLAVE)")
        return None
    if not url:
        faltan.append("Mercado Libre (no está configurada la URL del publicador en el panel)")
        return None
    try:
        ventas = publicador(url, "ml-ventas", limite=50)
        pubs = publicador(url, "ml-publicaciones")
    except Exception as err:
        faltan.append("Mercado Libre (el publicador no respondió: %s)" % err)
        return None
    if not ventas.get("ok") or not pubs.get("ok"):
        faltan.append("Mercado Libre (%s)" % (ventas.get("error") or pubs.get("error") or "error del publicador"))
        return None

    monto, lineas = 0, []
    for v in ventas.get("ventas") or []:
        f = fecha(v.get("fecha"))
        if not f or f < DESDE or v.get("estado") in ("cancelled", "invalid"):
            continue
        monto += v.get("total") or 0
        prods = ", ".join("%s×%s" % (x.get("cantidad", 1), x.get("titulo", "")) for x in v.get("productos") or [])
        lineas.append("<b>%s</b> · %s" % (pesos(v.get("total")), e(prods)))

    por_codigo = {}
    sin_sku = 0
    for pub in pubs.get("publicaciones") or []:
        if pub.get("estado") == "closed":
            continue
        sku = (pub.get("sku") or "").strip().upper()
        if not sku:
            sin_sku += 1
            continue
        por_codigo.setdefault(sku, []).append(pub)

    hacer, falta_ml, ml_sin_stock = [], [], []
    for p in sorted(catalogo.values(), key=lambda x: x.get("creado") or "", reverse=True):
        cod = (p["code"] or "").upper()
        if not cod:
            continue
        mias = por_codigo.get(cod, [])
        activas = [x for x in mias if x.get("estado") == "active"]
        if p["stock"] and not mias:
            falta_ml.append(etiqueta(p, True))
        if not p["stock"] and activas:
            hacer.append(etiqueta(p))
        if p["stock"] and mias and not activas:
            ml_sin_stock.append(etiqueta(p))

    preguntas = []
    try:
        r = publicador(url, "ml-preguntas")
        if r.get("ok"):
            for q in r.get("preguntas") or []:
                preguntas.append("%s — «%s» %s" % (e(q.get("titulo", "")), e(q.get("texto", "")),
                                                   hace(fecha(q.get("fecha")) or AHORA)))
    except Exception:
        pass            # el publicador aún no sabe leer preguntas: se omite

    return {"monto": monto, "cantidad": len(lineas), "lineas": lineas, "hacer": hacer,
            "falta_ml": falta_ml, "ml_pausadas": ml_sin_stock, "sin_sku": sin_sku,
            "preguntas": preguntas}


# ============================================================ redes

def falta_en_redes(catalogo, cfg):
    redes = cfg.get("redes") or {}
    limite = max(AHORA - timedelta(days=DIAS_NUEVO), REDES_DESDE)
    faltan_redes = []
    for p in sorted(catalogo.values(), key=lambda x: x.get("creado") or "", reverse=True):
        creado = fecha(p.get("creado"))
        if not p["stock"] or not p["code"] or not creado or creado < limite:
            continue
        if p["code"] not in redes:
            faltan_redes.append("%s · subido %s" % (etiqueta(p, True), hace(creado)))
    return faltan_redes


# ============================================================ mensaje

def armar(catalogo, antes, cfg):
    cols = nombres_coleccion(cfg)
    hoy = AHORA.astimezone(CHILE)
    bloques = ["💜 <b>Resumen Karivé</b> · %s %d %s" % (DIAS[hoy.weekday()], hoy.day, MESES[hoy.month - 1])]

    token = iniciar_sesion()
    ped = vis = None
    if token:
        try:
            ped = seccion_pedidos(token)
        except Exception as err:
            faltan.append("pedidos (%s)" % err)
        try:
            vis = seccion_visitas(token, catalogo)
        except Exception as err:
            faltan.append("visitas (%s)" % err)
    ml = seccion_ml(cfg, catalogo)

    # --- plata
    if ped or ml:
        partes, total = [], 0
        if ped:
            partes.append("catálogo %s (%d)" % (pesos(ped["monto"]), ped["cantidad"]))
            total += ped["monto"]
        if ml:
            partes.append("Mercado Libre %s (%d)" % (pesos(ml["monto"]), ml["cantidad"]))
            total += ml["monto"]
        bloques.append("💰 <b>Ventas últimas 24 h: %s</b>\n%s" % (pesos(total), " · ".join(partes)))
        if ped and ped["lineas"]:
            bloques.append(grupo("🛒 Pedidos del catálogo", ped["lineas"]))
        if ml and ml["lineas"]:
            bloques.append(grupo("🟡 Ventas en Mercado Libre", ml["lineas"]) + "\n<i>(montos brutos, antes de comisión)</i>")

    # --- lo urgente
    # primero las clientas que esperan, después Mercado Libre
    if ped and ped["hacer"]:
        bloques.append(grupo("📌 <b>Pedidos que esperan acción</b>", ped["hacer"]))
    if ml and ml["preguntas"]:
        bloques.append(grupo("❓ <b>Preguntas sin responder en Mercado Libre</b>", ml["preguntas"]))
    if vis and vis["recuperar"]:
        bloques.append(grupo("🛍 Carritos que puedes recuperar", vis["recuperar"]))
    if ml and ml["hacer"]:
        bloques.append(grupo("⚠️ <b>Activos en Mercado Libre sin stock en el catálogo</b>", ml["hacer"], 8)
                       + "\n<i>Páusalos antes de que alguien los compre.</i>")

    # --- movimiento
    if vis:
        bloques.append("👀 <b>Visitas 24 h</b>\n" + vis["linea"])

    # --- cambios del catálogo
    if antes is None:
        bloques.append("📦 Vigía del catálogo activado: desde mañana te aviso cada cambio.")
    else:
        cambios = cambios_catalogo(antes, catalogo, cols)
        bloques.append("📦 <b>Catálogo</b>\n" + ("\n\n".join(cambios) if cambios else "Sin cambios desde ayer."))

    # --- pendientes de publicar
    pend = []
    if ml:
        pend.append(grupo("Con stock y sin publicar en Mercado Libre", ml["falta_ml"], 8))
        pend.append(grupo("Pausados en Mercado Libre pero con stock en el catálogo", ml["ml_pausadas"], 8))
        if ml["sin_sku"]:
            pend.append("• %d publicaciones de Mercado Libre sin código: no las puedo comparar" % ml["sin_sku"])
    pend.append(grupo("Nuevos (últimos %d días) sin publicar en redes" % DIAS_NUEVO, falta_en_redes(catalogo, cfg), 8))
    pend = [x for x in pend if x]
    if pend:
        bloques.append("📋 <b>Pendientes de publicar</b>\n" + "\n\n".join(pend))

    total = len(catalogo)
    sin = sum(1 for p in catalogo.values() if not p["stock"])
    pie = "%d productos · %d sin stock" % (total, sin)
    if faltan:
        pie += "\n<i>No incluido: %s</i>" % e("; ".join(faltan))
    bloques.append(pie)
    return bloques


def partir(bloques, limite=3900):
    """Telegram acepta hasta 4096 caracteres por mensaje: se corta entre bloques."""
    mensajes, actual = [], ""
    for b in bloques:
        if actual and len(actual) + len(b) + 2 > limite:
            mensajes.append(actual)
            actual = ""
        actual = (actual + "\n\n" + b) if actual else b
    if actual:
        mensajes.append(actual)
    return mensajes


# ============================================================ Telegram

def telegram(metodo, datos=None):
    url = "https://api.telegram.org/bot%s/%s" % (env("TELEGRAM_TOKEN"), metodo)
    try:
        cuerpo = urllib.parse.urlencode(datos).encode() if datos else None
        with urllib.request.urlopen(url, data=cuerpo, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as err:
        try:
            motivo = json.load(err).get("description", "")
        except Exception:
            motivo = ""
        pistas = {
            401: "el token no es válido",
            404: "el token no es válido",
            409: "otro servicio está usando este bot con un webhook; define TELEGRAM_CHAT_ID",
            400: "el chat no existe o el bot no puede escribirle: mándale /start",
            403: "el bot fue bloqueado o nunca recibió /start",
        }
        aviso("error", "Telegram respondió %d en %s: %s. %s" % (err.code, metodo, motivo, pistas.get(err.code, "")))
        sys.exit(1)


def chat_destino():
    fijo = env("TELEGRAM_CHAT_ID")
    if fijo:
        return fijo
    chats = {}
    for u in telegram("getUpdates").get("result", []):
        c = (u.get("message") or u.get("edited_message") or {}).get("chat") or {}
        if c.get("type") == "private":
            chats[str(c["id"])] = True
    if len(chats) == 1:
        return next(iter(chats))
    aviso("error", "No pude saber a qué chat escribir (%d chats). Define TELEGRAM_CHAT_ID." % len(chats))
    sys.exit(1)


# ============================================================ principal

def main():
    catalogo = leer_catalogo()
    if len(catalogo) < 20:
        sys.exit("Solo llegaron %d productos. Se aborta sin avisar ni guardar nada." % len(catalogo))

    antes = None
    if os.path.exists(ESTADO):
        with open(ESTADO, encoding="utf-8") as f:
            antes = json.load(f).get("productos")

    mensajes = partir(armar(catalogo, antes, configuracion()))
    for m in mensajes:
        print(m)
        print("-" * 40)

    if env("TELEGRAM_TOKEN"):
        chat = chat_destino()
        for m in mensajes:
            r = telegram("sendMessage", {"chat_id": chat, "text": m, "parse_mode": "HTML",
                                         "disable_web_page_preview": "true"})
            if not r.get("ok"):
                aviso("error", "Telegram rechazó el mensaje: %s" % r)
                sys.exit(1)
        aviso("notice", "Resumen enviado por Telegram (%d mensaje%s)." % (len(mensajes), "" if len(mensajes) == 1 else "s")
              + (" No incluido: " + "; ".join(faltan) if faltan else ""))
    else:
        aviso("warning", "No llegó el secreto TELEGRAM_TOKEN: el resumen no se envió.")

    with open(ESTADO, "w", encoding="utf-8") as f:
        json.dump({"productos": catalogo}, f, ensure_ascii=False, indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
