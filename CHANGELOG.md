# Changelog

Todos los cambios de ProDash por versión. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [versionado semántico](https://semver.org/lang/es/).

## [1.3.0] - 2026-10-22

### Agregado
- **Vistas guardadas**: además del dashboard **General**, se pueden crear vistas con nombre que muestran solo una selección de tickets. Aparecen como pestañas arriba del dashboard y las ve todo el que entra.
- Botón **Nueva vista** con un asistente para elegir **epics** (con todos sus tickets, también los que se agreguen después), **tickets sueltos** (con sus subtareas), **etiquetas**, **componentes** y **JQL avanzado** (con botón *Probar*). Una vista incluye todo lo que cumpla cualquiera de los criterios.
- Selector **Estimar con: Histórico del proyecto | Solo esta selección** en cada vista. Quien crea la vista elige el valor por defecto; quien la mira puede cambiarlo.
- Editar y borrar vistas (el borrado pide confirmación).
- El PNG lleva el nombre de la vista y con qué se estimó.

### Cambiado
- Docker: las vistas se guardan en el volumen `prodash-data` (`/app/data/views.json`), que se conserva entre actualizaciones. Sin Docker se guardan en la carpeta `data/` o en `DATA_DIR`.

## [1.2.0] - 2026-10-21

### Agregado
- **Proyección por estado**: usa el historial de Jira (cuánto suelen tardar los tickets en cerrarse desde cada estado, medido en los cerrados del periodo) y lo que cada ticket ya lleva en su estado actual. Un ticket listo para pruebas cuenta como casi cerrado en lugar de como uno nuevo.
- Tercera vista **Estado** en el bloque Por epic (Ritmo | Estado | Entrega), con el trabajo que queda en tickets equivalentes.
- **Para cerrar todo** usa la proyección por estado cuando la vista elegida es Estado o Entrega, e indica qué método usa.
- En **Personalizar → Tiempo que falta por estado**: el valor calculado de cada estado y la opción de corregirlo a mano.

### Cambiado
- La etiqueta **A tiempo / No llega** de cada epic se calcula con la proyección por estado en las vistas Estado y Entrega.
- El PNG refleja lo que se ve en Por epic: la vista elegida, las epics desplegadas y sus tickets. La cabecera del reporte indica la vista.
- Los datos de un proyecto se reutilizan durante 2 minutos para no recargar el historial de Jira en cada visita; **Actualizar** siempre trae datos nuevos.

## [1.1.0] - 2026-10-20

### Agregado
- En el bloque **Por epic**, un selector **Ritmo | Entrega**:
  - **Ritmo**: cuánto falta para cerrar cada epic al ritmo de cierre del periodo, y la fecha estimada.
  - **Entrega**: cuánto falta para la fecha de entrega (*Due date*) de cada epic en Jira, o cuánto hace que venció.
- Etiqueta por epic que compara las dos: **A tiempo**, **No llega**, **Vencida** o **Sin datos**.
- La vista elegida se recuerda en cada dispositivo y se respeta en el PNG.

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

[1.3.0]: https://github.com/cesared19/ProDash/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/cesared19/ProDash/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/cesared19/ProDash/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/cesared19/ProDash/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/cesared19/ProDash/releases/tag/v1.0.0
