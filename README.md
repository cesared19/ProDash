# ProDash

Dashboard visual de un proyecto de Jira Cloud, con bloques grandes de color pensados para leerse de un vistazo y un botón para descargar el reporte en PNG.

Muestra:

- **Abiertos**: cuántos tickets siguen abiertos y en qué estado (sin contar errores/bugs ni épicas, configurable).
- **Cerrados**: cuántos se cerraron en el periodo elegido (30 días, 90 días, 6 meses, 1 año o todo).
- **Para cerrar todo**: cuánto falta al ritmo actual de cierre, con la fecha estimada.
- **¿Cuánto tardan?**: el tiempo promedio que tarda un ticket en cerrarse comparado con el tiempo que llevan esperando los abiertos. El color indica si van **al día** (verde), si piden **atención** (ámbar) o si van **atrasados** (rojo).
- **Trayectoria**: la evolución de los tickets abiertos y la proyección hasta cerrarlos.
- **Por epic**: cada epic con sus tickets abiertos y los cerrados en el periodo, y una barra por estado. Al tocarla se despliegan sus tickets con enlace a Jira. Las subtareas cuentan en la epic de su ticket padre; los tickets sin epic van en el grupo *Sin epic*.
  Con el selector **Ritmo | Entrega** se ve cuánto falta para cerrar cada epic a su ritmo de cierre, o cuánto falta para su fecha de entrega (*Due date* de la epic en Jira), con una etiqueta que indica si llega a tiempo.

Se puede personalizar qué bloques se ven, su orden, qué tipos de ticket no se cuentan, el idioma (español o inglés) y activar el texto extra grande. Las preferencias se guardan en cada dispositivo; el idioma inicial es el del navegador y también se puede cambiar en la pantalla de entrada. Los nombres de estados y tipos de ticket se muestran tal como están en Jira.

## Puesta en marcha en el Mac

1. Instala [Node.js](https://nodejs.org) (versión LTS).
2. Crea un token de API de Jira en https://id.atlassian.com/manage-profile/security/api-tokens.
3. Haz doble clic en **`Iniciar ProDash.command`**. La primera vez crea el archivo `.env` y lo abre: completa la URL de Jira, tu email, el token y una contraseña para el dashboard, guárdalo y vuelve a hacer doble clic.
   - Si macOS dice que *no ha podido verificar* el archivo (pasa cuando se descarga el ZIP desde el navegador): pulsa **Aceptar**, ve a **Ajustes del Sistema → Privacidad y seguridad**, pulsa **Abrir igualmente** junto al aviso y vuelve a hacer doble clic. También se puede quitar la marca desde la Terminal con `xattr -d com.apple.quarantine "Iniciar ProDash.command"`.
   - Para evitar el aviso, descarga el proyecto con `git clone https://github.com/cesared19/ProDash` en lugar del ZIP.
4. Se abre el navegador en http://localhost:3100. Entra con la contraseña y elige el proyecto.

Desde la terminal es lo mismo:

```sh
cp .env.example .env   # y complétalo
npm install
npm run build
npm start
```

Para probarlo sin Jira, pon `JIRA_MOCK=true` en `.env` (datos de ejemplo).

## Servidor con Docker

En el servidor, con Docker y git instalados:

```sh
git clone https://github.com/cesared19/ProDash
cd ProDash
cp .env.example .env      # y complétalo
git checkout v1.0.1       # la versión a instalar (ver Releases en GitHub)
docker compose up -d --build
```

ProDash queda en `http://IP-del-servidor:3100` (o en el `PORT` de `.env`) y se reinicia solo si el servidor se reinicia. Para ver los mensajes: `docker compose logs -f`.

**Actualizar a una versión nueva** (las novedades de cada una están en [Releases](https://github.com/cesared19/ProDash/releases) y en `CHANGELOG.md`):

```sh
cd ProDash
git fetch --tags
git checkout v1.1.0
docker compose up -d --build
```

**Volver a la versión anterior** si algo falla: lo mismo con la etiqueta anterior (`git checkout v1.0.1` y `docker compose up -d --build`). El `.env` no cambia entre versiones.

La versión instalada se ve en la pantalla de entrada y en Personalizar.

## Versiones y cambios

- `main` es lo que está publicado. Cada versión se prepara en una rama `release/X.Y.Z` y llega a `main` con un PR.
- Cada PR pasa una revisión automática (tests, build e imagen Docker).
- Al fusionar el PR, GitHub crea la etiqueta `vX.Y.Z` y la release con las novedades de `CHANGELOG.md`.

## Verlo en el móvil y en otros equipos

Al iniciar, la terminal muestra una dirección como `http://192.168.1.20:3100`. Ábrela en el móvil o en otro ordenador **conectado a la misma Wi‑Fi** que el Mac (el Mac tiene que estar encendido y con el dashboard en marcha).

- **iPhone/iPad**: en Safari, botón Compartir → *Añadir a pantalla de inicio*.
- **Android**: en Chrome, menú ⋮ → *Añadir a pantalla de inicio*.
- **Mac**: en Safari, Archivo → *Añadir al Dock*.

Si macOS pregunta si permite conexiones entrantes para `node`, acepta para que el móvil pueda conectarse.

## Reporte en PNG

**Descargar PNG** genera una imagen del dashboard (siempre a 1200 px de ancho, igual desde cualquier dispositivo) con el nombre del proyecto, la fecha y el periodo. Respeta los bloques visibles y su orden.

## Cómo se calcula

- **Cerrado** = cualquier estado de la categoría *Done* de Jira. La fecha de cierre es la resolución o, si no la hay, el último cambio de categoría.
- **Ritmo de cierre** = cerrados en el periodo ÷ semanas del periodo. **Para cerrar todo** = abiertos ÷ ritmo de cierre. Es una aproximación: no tiene en cuenta los tickets nuevos que lleguen (si llegan más de los que se cierran, el dashboard lo avisa).
- **Un ticket tarda** = promedio de días entre creación y cierre de los cerrados en el periodo. **Los abiertos llevan** = promedio de días desde la creación de los abiertos.
- **Estado**: al día si los abiertos llevan menos que lo que tarda un ticket en cerrarse, atención hasta 1,5 veces y atrasado por encima.
- Se consideran hasta 5.000 tickets abiertos y 5.000 cerrados.

## Problemas frecuentes

**Diagnóstico rápido.** En la carpeta de ProDash ejecuta `npm run check`: revisa `.env`, prueba la conexión con Jira e indica qué corregir, sin mostrar el token.

**"Elige un proyecto" aparece vacío o dice que Jira no aceptó las credenciales.** Si las credenciales no son válidas, Jira Cloud no da error: responde como a un visitante anónimo, que no ve proyectos. Revisa `.env`:

- `JIRA_BASE_URL` es la dirección que ves en el navegador al abrir Jira, solo hasta `.atlassian.net` (por ejemplo `https://tu-empresa.atlassian.net`, sin `/jira/...` al final).
- `JIRA_EMAIL` es el email de la cuenta de Atlassian que creó el token.
- `JIRA_API_TOKEN` está completo, en una sola línea y sin espacios. Usa **Create API token** (el token sin scopes), no *Create API token with scopes*.
- Tras cambiar `.env`, detén ProDash (`Ctrl + C`) y vuelve a iniciarlo.

Si las credenciales son correctas y la lista sigue vacía, la cuenta no tiene permiso para ver proyectos (*Browse projects*) en ese sitio.

## Seguridad

El token de Jira se queda en el Mac, en `.env` (no se sube a git). El navegador nunca lo ve: todas las consultas pasan por el pequeño servidor local, que pide la contraseña del dashboard. La sesión dura 30 días por dispositivo; cambiar la contraseña cierra todas las sesiones.

## Desarrollo

```sh
npm run dev    # servidor en :3100 y Vite con recarga en :5173
npm test       # tests de los cálculos
```

- `server/` — Express: sesión, proxy a la API REST v3 de Jira (`/search/jql`) y cálculo de métricas (`metrics.js`).
- `src/` — React + Vite. Bloques en `components/Blocks.tsx`, gráfica en `components/TrendChart.tsx`, exportación en `exportPng.ts`.

## Licencia

Apache 2.0, ver [LICENSE](LICENSE).
