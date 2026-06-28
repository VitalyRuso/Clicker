# Contrato de trabajo para el socio — Agent / Planner

## Objetivo

Construir el módulo que decide qué acción ejecutar a partir de:

1. instrucción del usuario;
2. mapa de elementos visibles de la página;
3. reglas de seguridad;
4. contexto mínimo de la página.

La extensión ya puede tener un planner local simple. El trabajo del socio es preparar una versión más potente en Rust.

## Rama de trabajo

```text
feature/agent-planner-api
```

## Stack

- Rust
- Axum
- Serde JSON
- Tests unitarios

## Endpoint principal futuro

```http
POST /v1/plan
```

## Request esperado

```json
{
  "instruction": "Click the login button",
  "page": {
    "title": "Example page",
    "url": "https://example.com"
  },
  "elements": [
    {
      "element_id": "ap-1-x3f9",
      "tag_name": "button",
      "text": "Login",
      "aria_label": "",
      "placeholder": "",
      "role": "",
      "rect": {
        "x": 120,
        "y": 80,
        "width": 90,
        "height": 36
      }
    }
  ]
}
```

## Response esperado

```json
{
  "ok": true,
  "action_id": "uuid",
  "action_kind": "click",
  "element_id": "ap-1-x3f9",
  "confidence": 87,
  "risk": "low",
  "reason": "Best match: text Login matches the user instruction."
}
```

## Response bloqueado

```json
{
  "ok": false,
  "blocked": true,
  "reason": "Payments and password actions are not allowed."
}
```

## Primera tarea del socio

1. Ejecutar el backend.
2. Confirmar que `/health` funciona.
3. Revisar `/v1/plan`.
4. Cambiar el stub por un planner básico:
   - normalizar instrucción;
   - bloquear términos peligrosos;
   - puntuar candidatos;
   - devolver mejor candidato;
   - devolver error si confianza baja.
5. Añadir tests.

## Dos opciones de implementación

### Opción A — Planner determinista primero

Ventajas:

- Más fácil de probar.
- Menos coste.
- Más seguro.
- No depende de IA.

Desventajas:

- Entiende menos instrucciones complejas.

### Opción B — Planner IA más adelante

Ventajas:

- Entiende mejor lenguaje natural.
- Puede manejar flujos complejos.

Desventajas:

- Más riesgo.
- Más coste.
- Hay que controlar al modelo.
- Nunca debe ejecutar sin confirmación.

## Decisión recomendada

Primero Opción A. Después, cuando el flujo esté sólido, se añade IA como capa de ayuda, no como dueño del sistema.
