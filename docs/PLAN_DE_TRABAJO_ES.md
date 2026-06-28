# Plan de trabajo — Browser Clicker Agent

## 1. Objetivo del proyecto

Crear una extensión de navegador que permita al usuario dar una instrucción en lenguaje natural y ejecutar una acción visible en la página activa, siempre con control humano.

Ejemplo del MVP:

```text
User instruction: Click the login button
Extension: scans the page, finds visible candidates, proposes one action, waits for confirmation, clicks.
```

El producto no es un bot oculto. Es un asistente visible que ayuda a controlar páginas web con menos trabajo manual.

## 2. Resultado final esperado por etapas

### Resultado MVP local

- Extensión cargable en Chrome/Edge como extensión desempaquetada.
- Popup con interfaz limpia.
- Escaneo de elementos visibles.
- Planner local básico.
- Ejecución de click solo después de confirmación.
- Reglas de seguridad mínimas.

### Resultado demo privada

- Mejor interfaz.
- Mejor selección de elementos.
- Logs locales.
- Modo manual para elegir candidato si el planner duda.
- Backend Rust preparado para planner/agente.

### Resultado avanzado

- Planner/agente conectado al backend Rust.
- Acciones multi-step controladas.
- Traducciones de interfaz.
- Perfiles de sitios o flujos repetibles.
- Tests y documentación para instalar.

## 3. Stack decidido

### Extensión

- Vite
- TypeScript
- Chrome Manifest V3
- HTML/CSS sin React en el primer MVP

Razón: menos peso, menos dependencias, más rápido para hacer funcionar el primer flujo.

### Backend/agente

- Rust
- Axum
- JSON API

Razón: buen rendimiento, tipado fuerte, buena base para un planner serio en fases posteriores.

## 4. Principios del producto

1. El usuario manda, la extensión no actúa sola.
2. Primero escanear, después planificar, después confirmar, después ejecutar.
3. Si hay duda, mostrar opciones y pedir elección.
4. No guardar contraseñas ni datos sensibles.
5. No hacer pagos, banca, CAPTCHA, 2FA ni acciones destructivas.
6. Empezar simple y sólido antes de meter IA compleja.

## 5. División de trabajo

### Miguel

Responsable principal de:

- Interfaz del popup.
- Experiencia de usuario.
- Flujo de scan → plan → confirm → execute.
- Estilo visual.
- Documentación de uso.
- Pruebas manuales en páginas reales.

Rama principal de trabajo:

```text
feature/miguel-ui-extension
```

### Socio

Responsable principal de:

- Planner/agente.
- Backend Rust.
- Contrato API.
- Reglas de decisión.
- Posible integración futura con modelos IA.
- Tests del planner.

Rama principal de trabajo:

```text
feature/agent-planner-api
```

### Trabajo conjunto

- Revisar decisiones grandes.
- Revisar seguridad.
- Revisar merges a `develop`.
- Definir qué entra en cada versión.

## 6. Flujo de construcción

### Fase 0 — Base del repositorio

Estado esperado:

- Estructura del monorepo creada.
- Extensión con build básico.
- Rust API scaffold.
- Documentos de trabajo.
- Estrategia de ramas.

### Fase 1 — Extensión MVP

Tareas:

- Popup funcional.
- Scan page.
- Mostrar elementos detectados.
- Planner local básico.
- Confirmación antes de ejecutar.
- Click ejecutado en elemento visible.

Criterio de terminado:

- Se carga en Chrome/Edge.
- Se prueba en una página normal.
- No hay acciones automáticas ocultas.

### Fase 2 — UX y control manual

Tareas:

- Mejorar diseño.
- Lista de candidatos.
- Selección manual de candidato.
- Mensajes de error buenos.
- Logs locales.

### Fase 3 — Backend Rust y planner

Tareas:

- Endpoint `/health`.
- Endpoint `/v1/plan`.
- Contrato JSON estable.
- Planner inicial en Rust.
- Tests de scoring y safety.

### Fase 4 — Integración extension ↔ backend

Tareas:

- Configurar URL del backend.
- Enviar DOM map al backend.
- Recibir plan.
- Mostrar plan.
- Ejecutar solo con confirmación.

### Fase 5 — Demo privada

Tareas:

- Documentar instalación.
- Preparar casos de prueba.
- Añadir traducción ES/RU si merece la pena.
- Preparar vídeo corto o explicación para enseñar.

## 7. Reglas de decisión

Para cada parte importante se deben comparar al menos dos opciones.

Ejemplo:

| Decisión | Opción A | Opción B | Decisión provisional |
|---|---|---|---|
| UI extension | Plain HTML/CSS/TS | React | Plain para MVP |
| Planner | Local TS | Rust API | Local primero, Rust después |
| Ramas | Una rama por persona | Todo en develop | Una rama por persona |
| Acciones | Solo click | Click + type + select | Solo click primero |

## 8. Definition of Done general

Una tarea está terminada solo si:

- Compila o queda claro qué falta para compilar.
- Se puede probar manualmente.
- No rompe el flujo anterior.
- No añade permisos innecesarios.
- No salta confirmaciones de usuario.
- Tiene README o notas si cambia el uso.
- El commit tiene nombre claro.
