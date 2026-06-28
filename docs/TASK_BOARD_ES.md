# Task board

Estados posibles:

```text
Pendiente | En curso | Bloqueado | Revisión | Hecho
```

## Sprint 0 — Base del proyecto

| ID | Tarea | Responsable | Rama | Estado | Resultado esperado |
|---|---|---|---|---|---|
| S0-01 | Crear repo GitHub | Miguel | main | Pendiente | Repo creado y primer push |
| S0-02 | Subir scaffold base | Miguel | main | Pendiente | Archivos iniciales en GitHub |
| S0-03 | Crear ramas | Miguel | main/develop | Pendiente | main, develop, UI, agent, experiment, archive |
| S0-04 | Revisar docs | Ambos | develop | Pendiente | Plan claro de trabajo |

## Sprint 1 — Extensión MVP

| ID | Tarea | Responsable | Rama | Estado | Resultado esperado |
|---|---|---|---|---|---|
| S1-01 | Build de extension | Miguel | feature/miguel-ui-extension | Pendiente | `npm run build` funciona |
| S1-02 | Cargar extensión unpacked | Miguel | feature/miguel-ui-extension | Pendiente | Popup abre en Chrome/Edge |
| S1-03 | Scan page | Miguel | feature/miguel-ui-extension | Pendiente | Lista elementos visibles |
| S1-04 | Planner local click | Miguel | feature/miguel-ui-extension | Pendiente | Propone candidato |
| S1-05 | Execute confirmed click | Miguel | feature/miguel-ui-extension | Pendiente | Click solo con confirmación |

## Sprint 2 — Agent/backend

| ID | Tarea | Responsable | Rama | Estado | Resultado esperado |
|---|---|---|---|---|---|
| S2-01 | Ejecutar Rust API | Socio | feature/agent-planner-api | Pendiente | `/health` responde |
| S2-02 | Definir JSON final | Socio | feature/agent-planner-api | Pendiente | Contrato claro extension/backend |
| S2-03 | Planner backend v1 | Socio | feature/agent-planner-api | Pendiente | Devuelve action plan básico |
| S2-04 | Tests planner | Socio | feature/agent-planner-api | Pendiente | Tests de scoring y bloqueo |

## Sprint 3 — Integración

| ID | Tarea | Responsable | Rama | Estado | Resultado esperado |
|---|---|---|---|---|---|
| S3-01 | Config backend URL | Miguel | feature/miguel-ui-extension | Pendiente | UI permite backend local |
| S3-02 | Enviar DOM map | Ambos | develop | Pendiente | Extension llama a Rust API |
| S3-03 | Mostrar backend plan | Ambos | develop | Pendiente | Plan visible antes de ejecutar |
| S3-04 | Demo privada | Ambos | main | Pendiente | Versión probada estable |
