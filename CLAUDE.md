# ProDash

Dashboard visual de un proyecto de Jira Cloud con reporte en PNG. Corre con Docker en un servidor de la empresa.

**Idioma:** comunícate con el usuario en español.

## Arquitectura

- **Servidor:** Node + Express en `server/` (ESM, sin build). Hace de proxy a la API REST v3 de Jira (`/search/jql`) con el token de `.env`; el navegador nunca lo ve. Calcula las métricas en `metrics.js`, la proyección por estado (con el changelog de Jira) en `forecast.js` y los tickets atascados en `stuck.js`; tests en `metrics.test.js`, `forecast.test.js` y `stuck.test.js`. Vistas guardadas (selecciones de tickets compartidas) en `views.js`, en `DATA_DIR/views.json` (volumen `prodash-data` en Docker); tests en `views.test.js`. Mensajes de error en español e inglés en `messages.js`.
- **Cliente:** React + Vite + TypeScript en `src/`, CSS propio en `styles.css` (sin Tailwind). Textos en `src/i18n.ts` (español e inglés): todo texto visible va ahí, nunca escrito en un componente.
- **Modo demo:** `JIRA_MOCK=true` usa `server/mock.js`; sirve para probar la interfaz sin Jira.
- **Deploy:** imagen Docker (`Dockerfile`, `docker-compose.yml`), configurada con `.env`.

## Proceso de versiones

- `main` es lo que corre en el servidor. No se hace push directo a `main`.
- **Un PR por versión:** al recibir una lista de cambios, proponer un orden (bugs primero), preguntar lo que no quede claro y trabajar en una rama `release/X.Y.Z`. El usuario decide cuándo fusionar; nunca fusionar por iniciativa propia.
- **Versionado semántico:** arreglos → parche (1.0.1), funciones nuevas → menor (1.1.0), cambios que obligan a reconfigurar → mayor (2.0.0).
- Cada versión actualiza `version` en `package.json` y `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`) y agrega su sección en `CHANGELOG.md`. CI falla si falta la sección.
- Al fusionar en `main`, `.github/workflows/release.yml` crea la etiqueta `vX.Y.Z` y la release con la sección del CHANGELOG. No crear etiquetas a mano.

## Antes de hacer push

- `npm test`, `npx tsc --noEmit` y `npm run build`.
- Cambios de interfaz: probarlos en el navegador con `JIRA_MOCK=true DASHBOARD_PASSWORD=demo npm start`, a 1366, 820 y 390 px, en modo oscuro, en los dos idiomas y descargando el PNG.
- Formato: tabs, comillas simples y sin punto y coma; sigue el estilo del código existente.
