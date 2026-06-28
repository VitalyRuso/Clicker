# Estrategia de ramas Git

## Ramas principales

### `main`

Rama estable. Solo debe contener versiones que funcionan o demos cerradas.

Reglas:

- No trabajar directamente aquí.
- Solo merge desde `develop` cuando una versión esté probada.
- Ideal para enseñar una demo estable.

### `develop`

Rama de integración.

Reglas:

- Aquí se juntan las ramas de Miguel y del socio.
- Puede tener cambios en curso, pero no debería estar rota durante mucho tiempo.
- Antes de merge a `main`, se prueba desde `develop`.

## Ramas de trabajo

### `feature/miguel-ui-extension`

Rama de Miguel.

Objetivo:

- Popup.
- Diseño.
- Flujo visual.
- Scanner.
- Planner local simple.
- Confirmación y ejecución.

### `feature/agent-planner-api`

Rama del socio.

Objetivo:

- Backend Rust/Axum.
- Contrato del agente.
- Planner backend.
- Tests.
- Reglas de safety.

### `experiment/lab-click-flows`

Rama para pruebas agresivas.

Objetivo:

- Probar ideas sin miedo.
- Código que puede romperse.
- No mergear a `develop` sin limpiar.

### `archive/v0-scaffold`

Rama congelada de la base inicial.

Objetivo:

- Guardar una copia limpia del primer scaffold.
- Poder volver atrás si algo se rompe.

## Comandos iniciales recomendados

Después de crear el repo y hacer el primer commit en `main`:

```bash
git checkout -b develop
git push -u origin develop

git checkout -b feature/miguel-ui-extension
git push -u origin feature/miguel-ui-extension

git checkout develop
git checkout -b feature/agent-planner-api
git push -u origin feature/agent-planner-api

git checkout develop
git checkout -b experiment/lab-click-flows
git push -u origin experiment/lab-click-flows

git checkout main
git checkout -b archive/v0-scaffold
git push -u origin archive/v0-scaffold

git checkout develop
```

## Regla práctica

- Miguel trabaja en `feature/miguel-ui-extension`.
- Socio trabaja en `feature/agent-planner-api`.
- Pruebas locas van a `experiment/lab-click-flows`.
- Cuando una parte está bien, se mergea a `develop`.
- Cuando `develop` está probado, se mergea a `main`.
