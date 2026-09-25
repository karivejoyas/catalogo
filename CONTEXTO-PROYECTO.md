# Karivé Joyas — contexto del proyecto

> Adjunta este archivo al inicio de cualquier conversación nueva (Cowork, Claude Code,
> extensión del navegador). Con esto, Claude parte sabiendo todo lo importante y no hay
> que explicarle el proyecto de nuevo.
>
> Última actualización: 17 de septiembre de 2026.

---

## REGLAS QUE NUNCA SE ROMPEN

1. **NUNCA cambiar nada de los productos si Karina no lo pide.** Ni nombres, ni precios,
   ni tamaños, ni descripciones, ni códigos. Esto ya pasó una vez y ella tuvo que
   arreglar decenas de productos a mano. Si algo "se ve mal", se avisa, no se corrige solo.
2. **Nunca escribir productos automáticamente en Firestore.** Existía una función
   `sembrar()` que, si la lista llegaba vacía (aunque fuera un parpadeo de internet),
   escribía el catálogo de ejemplo ENCIMA de los productos reales. Ya fue eliminada.
   No volver a crear nada parecido.
3. **Hablarle en español, siempre.**
4. **Subir cambios = subir de verdad.** Cada vez que se toca `catalogo.css`, `catalogo.js`,
   `comun.js` o `admin.js` hay que subir el número de versión `?v=` en `index.html` y
   `admin.html`, o los navegadores siguen mostrando la versión vieja.
5. **Antes de tocar el carrito o el pago, probar.** Un error ahí es una venta perdida.

---

## Qué es el proyecto

Catálogo web de joyas artesanales hechas a mano en Chile por Karina Coronado.
Es un sitio estático publicado en GitHub Pages, con Firebase Firestore como base de
datos y un Google Apps Script que hace de mini-backend para correos y Mercado Pago.

- **Repositorio:** `karivejoyas/catalogo` (público)
- **Sitio:** GitHub Pages desde ese repo
- **Correo de Claude/GitHub de Karina:** distintos entre sí (esto causó problemas de permisos)
- **Correo de Mercado Libre:** kari.coronadoc@gmail.com

---

## Archivos del repositorio

| Archivo | Qué hace |
|---|---|
| `index.html` | Página principal, carga todo lo demás |
| `catalogo.js` | Todo el catálogo público: productos, carrito, pago, buscador, visitas |
| `admin.js` | Panel de administración: productos, pedidos, colecciones, cupones, estadísticas |
| `comun.js` | Funciones compartidas entre catálogo y panel (modelo de datos, tarjetas, encuadre) |
| `catalogo.css` | Todos los estilos |
| `admin.html` | Página del panel |
| `firebase-config.js` | Configuración de Firebase (claves públicas, no son secretas) |
| `privacidad.html` | Política de privacidad |
| `assets/productos/` | 49 fotos de productos guardadas como archivo |
| `tarjeta-*.html/.pdf/.png` | Tarjetas impresas que van dentro del paquete |

---

## Base de datos (Firestore, proyecto `karive-catalogo`)

| Colección | Contenido |
|---|---|
| `catalog/products/items` | Los productos (118 hoy) |
| `catalog/settings` | Configuración: colecciones, cupones, textos, Mercado Pago |
| `catalog/pedidos/items` | Pedidos de clientas — **datos personales, NO son públicos** |
| `catalog/visitas/items` | Estadísticas de visitas — **tampoco públicas** |
| `catalog/suscriptores/items` | Correos capturados con el descuento de bienvenida |

### Campos de un producto
`name`, `price`, `priceOffer`, `detail` (la medida), `category`, `code`, `photo`,
`stock`, `cantidad`, `order`, `foco` (encuadre PC), `focoMovil` (encuadre celular), `igFoco`

### Reglas de seguridad — IMPORTANTE
Las reglas de Firestore se evalúan con **OR**: si un bloque más general ya dio permiso,
un bloque más específico **no puede quitarlo**. Antes había un `allow read: if true` sobre
`/catalog/{document=**}` que dejaba los pedidos de las clientas visibles para cualquiera.
Ya está corregido: `products` y `settings` son públicos, `pedidos` y `visitas` no.
**Si alguna vez hay que tocar las reglas, revisar esto y probar con curl antes de dar por hecho que quedó bien.**

---

## Colecciones del catálogo (118 productos)

| Colección | Código | Cantidad |
|---|---|---|
| Flores | FL | 29 |
| Argollas de cristal | AG | 29 |
| Topos | TP | 20 |
| Charms | CH | 16 |
| Marina | MA | 13 |
| Otros | OT | 11 |

Precios de $2.990 a $12.990. Mediana $6.990. 103 de los 118 están bajo $10.000.
Los códigos deben ser **correlativos dentro de cada colección**. Si un producto cambia
de colección, se va al final de la nueva con el código que le corresponda.

---

## Funciones que ya están hechas y andando

- Catálogo con colecciones, buscador (ignora tildes) y lightbox de fotos
- Carrito de compras con cupones de descuento
- **Stock por cantidad** (no solo sí/no), con aviso de "quedan pocos"
- **Encuadre separado para PC y celular** en cada producto, más un switch en el panel
  para ver todo el catálogo con un encuadre u otro de una pasada
- Captura de correos con 10% de descuento de bienvenida
- Recuperación de carritos abandonados
- "Lo más visto"
- Reseñas (solo se muestran, no se pueden dejar desde el sitio)
- Estadísticas de visitas: zona aproximada, dispositivo, de dónde llegó, qué productos vio
- Pago por transferencia (con comprobante) y **pago con tarjeta por Mercado Pago**
- Correos automáticos por Google Apps Script
- Panel: productos, pedidos, colecciones (con orden y botón de guardar), cupones,
  suscriptores, estadísticas

## Detalles técnicos que costó descubrir

- **Emojis en los correos:** los de 4 bytes (💜 🛍 🚚) se corrompen al pasar por Apps
  Script y Gmail. En el cuerpo HTML hay que escribirlos como `&#128156;` y en el asunto
  usar emojis de 3 bytes (✅ ⚠ ✿).
- **Safari en iPhone:** usar `dvh` además de `vh`, porque la barra de Safari cambia de
  alto y corta el contenido.
- **Pago con Mercado Pago:** el pedido se guarda en Firestore **antes** de mandar a la
  clienta a pagar. Si no, un pago aprobado puede no llegar nunca al panel — ya pasó.
  El correo de "recibimos tu pedido" sale al volver, no antes de pagar.

---

## Cómo se sube un cambio

1. Subir el número `?v=` en `index.html` y `admin.html` (hoy va en `20260939`)
2. `git commit`
3. `git push`
4. Pedirle a GitHub Pages que reconstruya y esperar a que diga `"status":"built"` con el SHA correcto

**Resuelto (17-sep-2026):** el push a `karivejoyas/catalogo` ya funciona. Se arregló
instalando la app de Claude en GitHub (pestaña "Installed GitHub Apps", no basta
"Authorized") **y** reconectando el conector de GitHub en claude.ai. Verificado con
`git push --dry-run`: acceso de escritura confirmado.

---

## Seguridad — pendiente

Karina pegó en chats varias credenciales que quedaron expuestas. **Todas siguen sin
rotar y hay que anularlas y generarlas de nuevo:**
- El Access Token de producción de Mercado Pago
- Un token personal de GitHub (empezaba en `ghp_`)
- La `CLAVE` del Apps Script, que es además la contraseña del panel de administración
- La contraseña de administrador de Firebase
- Los tokens de Instagram y de Facebook

Esto es lo más urgente del proyecto y lleva pendiente desde el 15 de septiembre.

Ninguna clave debe volver a escribirse en un chat. Van en la configuración de Apps
Script o en Firestore, nunca en la conversación.

---

## Mercado Libre — estado al 17 de septiembre de 2026

Los 118 aros **ya están publicados** (unas 122 publicaciones vivas). No se usó el
publicador masivo: se construyó una pestaña **🛒 Mercado Libre** dentro del panel de
administración, que publica y administra por API.

### Lo que ya funciona en el panel
- Publicar uno o varios productos, con pantalla de revisión previa
- Descripciones variadas generadas por IA desde el navegador (misma cadena que Instagram,
  con las claves guardadas en `localStorage`, **no** en el vault de Apps Script)
- Ver ventas de Mercado Libre
- Administrar publicaciones: precio, stock, pausar, cerrar, borrar definitivamente
- Detectar duplicadas mostrando el par, para poder verificar antes de cerrar
- Pasar de Premium (`gold_pro`) a Clásica (`gold_special`) en lote
- Precio de Mercado Libre **aparte del precio del catálogo**: recargo fijo + porcentaje,
  mínimo y redondeo. Nunca toca el precio del catálogo.
- Comisiones reales consultadas a Mercado Libre, no estimadas
- Estampar SKU y MODELO en las publicaciones
- Completar características en lote

### Cosas que costó descubrir (no volver a tropezar)
- **Variantes:** precio, stock y los atributos que definen la variante viven dentro de
  `variations[]`, no en el ítem. Mandar el precio al ítem da `price is not modifiable`, y
  mandar un atributo de variante al ítem da `Same attributes are used in more than of
  item.attributes, variation.attr`.
- **Siempre verificar leyendo de vuelta.** Mercado Libre responde 2xx a cambios que no
  aplica. Hay que releer el aviso y comparar valor por valor, no solo "¿existe el campo?".
- **Nunca confiar en el registro local** (`catalog/mercadolibre`) para saber si algo está
  publicado. Hay que consultar Mercado Libre. Este error causó 20 publicaciones duplicadas.
- **Paginar:** `/users/{id}/items/search` devuelve máximo 100 por llamada.
- **Unidades:** Largo va en `cm`, Diámetro y Ancho en `mm`. Leer `default_unit` del
  atributo y convertir.
- **`MODEL` es público** (lo ve la compradora): va el nombre del producto.
  El código interno va en `SELLER_SKU`.
- Apps Script se corta a los 6 minutos: lotes de 20 a 25 como máximo.

### Calidad de las publicaciones
El puntaje está estancado entre 48% y 53%. La restricción real es que **hay una sola foto
por producto**, y Karina ya dijo que no puede cambiar eso. Completar características
sube algo, pero no rompe ese techo.

### Pendiente
- Instalar la v35 del Apps Script y volver a correr "Completar las características"
  (trae la conversión de unidades para que el diámetro quede en mm)
- Marcar "No aplica" en código de barras y tipo de piedra
- Definir tipo de cierre e hipoalergénico en Ajustes avanzados
- Promociones y descuentos de Mercado Libre (el permiso ya está dado en la app;
  Karina lo dejó para después)
- Decidir qué hacer con los ~9 productos que quedaron pegados en el mínimo de $5.990

---

## Entornos de Claude y acceso a la red

Las sesiones en la nube corren con una lista blanca de dominios. El entorno **Default**
está en nivel *Trusted*, que **no** permite salir a `api.mercadolibre.com` ni a
`script.google.com` — desde ahí es imposible tocar Mercado Libre.

El 17-sep-2026 se creó un segundo entorno llamado **Karive**, en nivel *Personalizado*,
con estos dominios permitidos:

```
api.mercadolibre.com
script.google.com
script.googleusercontent.com
firestore.googleapis.com
identitytoolkit.googleapis.com
karivejoyas.github.io
```

**Para trabajar en Mercado Libre hay que abrir la sesión en el entorno "Karive"**, no en
"Default". El entorno se elige en el ícono de nube que está arriba de la caja de mensaje
en claude.ai/code, y solo aplica a sesiones nuevas.

Si algo de Firebase Auth falla, los dominios que faltarían son `securetoken.googleapis.com`
y `oauth2.googleapis.com`.

---

---

## SEO y rendimiento (septiembre 2026)

- `herramientas/paginas-producto.py` (se corre solo cada noche) genera: fichas `p/`,
  páginas de colección `c/`, `sitemap.xml` con fotos, feed de Google, `llms.txt`,
  fotos WebP livianas en `assets/productos/w/` y `productos-fotos.json`.
- **El catálogo ya no baja las fotos en base64** (eran ~15 MB): lee los productos por
  la API REST sin la foto y usa los archivos de `productos-fotos.json`. Los productos
  cambiados después de la última corrida nocturna traen su foto de la base, de a uno.
  Si la carga rápida falla, usa la lectura de siempre (onSnapshot).
- Las tarjetas del catálogo usan la versión WebP (`photoMini`); la foto grande se baja
  al abrir el producto.
- La portada tiene un H1 oculto a la vista (clase `kv-sr`) con la marca y los enlaces a
  las colecciones, que el generador actualiza entre `<!-- COLECCIONES -->`.
- `?q=texto` en la portada abre el buscador (lo usa el SearchAction de schema.org).
