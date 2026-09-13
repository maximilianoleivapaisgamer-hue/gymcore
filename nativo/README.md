# Las apps de tienda

Una app de Play Store y App Store **por cada gimnasio**. Todas cargan el mismo
sitio (`turnogym.com`), pero cada una tiene su nombre, su ícono y su identidad.

## Para qué sirve esto

El socio de DanzArte busca "DanzArte" en Play Store y encuentra *su* app, no una
app genérica donde después tiene que elegir su gimnasio de una lista. Para el
dueño es la diferencia entre "usamos un sistema" y "tenemos nuestra app".

## Preparar una app

```bash
cd nativo
npm install
npm run preparar -- danzarte
```

Eso deja `android/` listo para compilar esa app y nada más. Para cambiar de
gimnasio, se corre de nuevo con otra clave: el proyecto se **rehace entero**.

```bash
npm run preparar -- megacenter
npm run android              # la prepara y abre Android Studio
```

Las claves salen de `apps.json`. Corriendo `npm run preparar` sin nada, te las
lista.

## Agregar un gimnasio

1. Una entrada en `apps.json`.
2. Su ícono en `iconos/<clave>-1024.png`, PNG cuadrado de 1024×1024.

El script frena solo si algo no cierra: nombre de más de 30 caracteres (Apple
corta ahí), id repetido o mal escrito, ícono que falta.

## Lo que NO se toca

`android/`, `ios/`, `www/`, `assets/` y `capacitor.config.json` **se borran y se
rehacen en cada corrida**. Cualquier cambio a mano ahí adentro se pierde. Si
hace falta que algo quede, va en `scripts/preparar.mjs`.

Se rehace en vez de retocarse porque el id de la app queda cocido en media
docena de archivos cuando se crea el proyecto. Cambiarlo después a mano es justo
la clase de cosa que se rompe en silencio y te hace publicar la app de un
gimnasio con el id de otro.

## Decisiones que ya están tomadas

**La app carga el sitio de verdad, no una copia congelada adentro del paquete.**
Así una corrección sale publicada al toque en vez de esperar los días que tarda
la revisión de las tiendas. El precio es que la app necesita señal; por eso
existe la pantalla de respaldo (`www/index.html`, la misma de "te quedaste sin
señal").

**El ícono se aplana contra el color del gimnasio.** Apple rechaza los íconos
con transparencia y es uno de los rechazos más bobos y más comunes. El script lo
hace solo, así que alcanza con dar un PNG cualquiera de 1024.

**Cada app tiene que verse distinta.** Dos apps con el mismo ícono y la misma
pantalla de inicio son, para Apple, la misma app repetida (regla 4.3) y te
rechazan las dos. Por eso el ícono es obligatorio y no tiene valor por defecto.

## Lo que falta

- **iOS no se puede armar en Windows**: necesita Xcode y CocoaPods, o sea una
  Mac. Los íconos igual se generan en `assets/ios/` para que la Mac (o el runner
  de la nube) los levante sin regenerar nada.
- **Los íconos de `iconos/` son PROVISORIOS**: dicen "PROVISORIO" arriba a
  propósito, para que no se publiquen sin querer. Hay que reemplazarlos por el
  logo real de cada gimnasio.
- **La pantalla de acceso todavía no tiene la marca del gimnasio.** Hoy las seis
  apps abren en la misma pantalla genérica de turnogym, que es la señal más clara
  posible de "apps repetidas" para la revisión de Apple. La app ya manda el
  gimnasio en la URL (`/portal?app=<slug>`); falta que el sitio la use.
