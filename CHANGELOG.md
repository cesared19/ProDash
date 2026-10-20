# Changelog

Todos los cambios de ProDash por versión. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [versionado semántico](https://semver.org/lang/es/).

## [1.0.1] - 2026-10-20

### Agregado
- Proceso de versiones: revisión automática (tests, build e imagen Docker) en cada PR, y etiqueta y release en GitHub al fusionar en `main`.
- `Dockerfile` y `docker-compose.yml` para correr ProDash en un servidor, con pasos para actualizar y volver atrás en el README.
- La versión se muestra en la pantalla de entrada, en Personalizar y en la Terminal al arrancar.

## [1.0.0] - 2026-10-20

Primera versión, la que corre en el servidor de la empresa.

- Dashboard de un proyecto de Jira Cloud: abiertos por estado, cerrados en el periodo, tiempo estimado para cerrar todo, comparación de tiempos, trayectoria con proyección y desglose por epic con sus tickets.
- Bloques personalizables (visibles y orden), tipos de ticket excluidos (por defecto bugs y épicas), texto extra grande, modo oscuro y diseño para móvil.
- Reporte en PNG.
- Español e inglés.
- Contraseña compartida; el token de Jira queda en el servidor.
- `npm run check` para diagnosticar la conexión con Jira.

[1.0.1]: https://github.com/cesared19/ProDash/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/cesared19/ProDash/releases/tag/v1.0.0
