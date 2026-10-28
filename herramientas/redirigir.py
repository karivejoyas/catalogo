"""
Manda las páginas públicas del catálogo antiguo a la tienda nueva (karivejoyas.cl).

Solo actúa si karivejoyas.cl ya está en línea (así nadie llega a una página vacía
mientras se conecta el dominio). Entonces:
  - a cada página pública le pone la dirección nueva como canónica y un salto
    inmediato a la página equivalente (Google lo toma como cambio de dirección);
  - en los feeds de Google y Meta cambia los enlaces de los productos a la tienda nueva.

No toca el panel (admin.html), las herramientas de publicación ni las tarjetas,
y no cambia ningún producto. Lo corre el workflow después de generar las fichas.
"""
import glob
import os
import re
import urllib.request

ANTES = "https://karivejoyas.github.io/catalogo/"
NUEVA = "https://karivejoyas.cl/"
MARCA = "<!-- kv-redirigir -->"


def nueva_en_linea():
    try:
        with urllib.request.urlopen(urllib.request.Request(NUEVA + "version.txt", headers={"User-Agent": "KariveJoyas-catalogo"}), timeout=20) as r:
            return r.status == 200 and len(r.read().strip()) > 0
    except Exception:
        return False


def destino(ruta):
    """Página equivalente en la tienda nueva."""
    if ruta.startswith("p/") or ruta.startswith("c/") or ruta in ("devoluciones.html", "privacidad.html"):
        return NUEVA + ruta
    if ruta == "catalogo.html":
        return NUEVA + "tienda/"
    return NUEVA


def redirigir(ruta):
    s = open(ruta, encoding="utf-8").read()
    if MARCA in s:
        return False
    url = destino(ruta)
    s = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s">' % url, s, count=1)
    # en la portada antigua, ?p=CÓDIGO abría un producto: se manda a su ficha
    js = ("var q=new URLSearchParams(location.search).get('p');"
          "location.replace(q&&/^[A-Za-z0-9-]+$/.test(q)?'%sp/'+q+'.html':'%s');" % (NUEVA, url)) if ruta == "index.html" else \
         "location.replace('%s');" % url
    salto = '%s\n<meta http-equiv="refresh" content="0;url=%s">\n<script>%s</script>\n' % (MARCA, url, js)
    s = s.replace("<head>", "<head>\n" + salto, 1)
    open(ruta, "w", encoding="utf-8").write(s)
    return True


def feeds():
    for f in ("catalogo-google.csv", "catalogo-meta.csv"):
        if not os.path.exists(f):
            continue
        s = open(f, encoding="utf-8").read()
        n = re.sub(re.escape(ANTES) + r"\?p=([A-Za-z0-9-]+)", NUEVA + r"p/\1.html", s)
        n = n.replace(ANTES + "p/", NUEVA + "p/")
        if n != s:
            open(f, "w", encoding="utf-8").write(n)


if __name__ == "__main__":
    if not nueva_en_linea():
        print("karivejoyas.cl todavía no está en línea: el catálogo sigue igual.")
    else:
        paginas = ["index.html", "catalogo.html", "devoluciones.html", "privacidad.html"] + sorted(glob.glob("p/*.html")) + sorted(glob.glob("c/*.html"))
        n = sum(redirigir(p) for p in paginas if os.path.exists(p))
        feeds()
        print("Catálogo antiguo → karivejoyas.cl: %d página(s) redirigidas; enlaces de los feeds actualizados." % n)
