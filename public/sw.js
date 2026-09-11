/* Service worker de turnogym.
 *
 * Hace dos cosas, y las dos son las que convierten la web en una app:
 *
 *  1. AVISOS: recibe las notificaciones aunque la app esté cerrada, y al
 *     tocarlas abre la pantalla que corresponde.
 *  2. SIN SEÑAL: si el socio abre la app sin internet, en vez del error del
 *     navegador ve una pantalla nuestra.
 *
 * OJO: no se cachea la app. Se probó pensarlo y se descartó: servir el código
 * viejo desde el caché hace que el socio use una versión distinta a la que está
 * publicada, y eso genera errores imposibles de reproducir. Solo se guarda la
 * pantalla de "sin conexión", que es un archivo suelto y no cambia nunca.
 */

const CACHE = "turnogym-v1";
const SIN_CONEXION = "/sin-conexion.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.add(SIN_CONEXION)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Solo se atiende la navegación: todo lo demás va a la red como siempre. */
self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(SIN_CONEXION)),
  );
});

/* ── El aviso ─────────────────────────────────────────────────────────── */
self.addEventListener("push", (evento) => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch (e) { datos = {}; }

  const titulo = datos.titulo || "turnogym";
  const opciones = {
    body: datos.cuerpo || "",
    icon: datos.icono || "/icon-192.png",
    badge: "/icon-192.png",
    // Con la misma etiqueta, un aviso nuevo REEMPLAZA al anterior en vez de
    // apilarse. Así el socio no se encuentra con cinco avisos de la misma clase.
    tag: datos.etiqueta || "turnogym",
    renotify: true,
    data: { url: datos.url || "/portal" },
  };
  evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/portal";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si ya tiene la app abierta, la traemos al frente en vez de abrir otra.
      for (const v of ventanas) {
        if (v.url.includes("/portal") && "focus" in v) {
          v.navigate(destino).catch(() => {});
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
