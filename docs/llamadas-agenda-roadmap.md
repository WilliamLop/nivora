# Roadmap de llamadas y agenda automatizada

## Objetivo

Construir un setter automatico sobre el sistema actual para:

- importar leads
- priorizar los mejores leads
- hacer llamadas salientes por lote
- calificar interes
- agendar reuniones
- dejar el cierre humano para la llamada ya agendada

La regla de producto es simple:

- el agente no cierra ventas
- el agente no intenta reemplazar la reunion humana
- el agente solo busca avanzar al lead hasta `booked`

## Principio de diseno

No queremos rehacer el sistema actual. Queremos extenderlo.

La base ya existe en:

- [Supabase schema](../supabase/schema.sql)
- [Lead scoring y propuesta](../lib/dashboard.ts)
- [Enriquecimiento con IA](../lib/ai.ts)
- [Repository y operaciones sobre leads](../lib/repository.ts)
- [Dashboard principal](../components/dashboard-app.tsx)

Eso significa que la capa nueva debe vivir encima de lo que ya tenemos, no al lado.

## Lectura del sistema actual

Hoy el proyecto ya resuelve bien estas piezas:

- importar leads
- deduplicar registros
- definir ciudad, nicho e importacion
- clasificar oportunidades por score
- generar copy para WhatsApp, email y llamada
- guardar datos en Supabase desde servidor

Lo que falta para llevarlo al siguiente nivel es:

- control de campañas de llamada
- registro de cada intento
- estado de agenda
- handoff al humano
- seguimiento y no-show recovery

## Objetivo tecnico de esta fase

La primera version no debe ser un contact center completo.

Debe ser un sistema que:

1. toma un lote de leads
2. los pone en una cola de llamada
3. ejecuta llamadas salientes
4. detecta interes real
5. agenda una reunion
6. guarda evidencia de lo ocurrido

## Stack propuesto

- `Supabase` como fuente de verdad
- `ElevenLabs Agents` para conversacion de voz
- `ElevenLabs Batch Calling` para campañas por lote
- `Twilio` para numeracion y ruta telefonica cuando haga falta
- `OpenAI` para briefing previo, resumen posterior y clasificacion

Regla importante:

- no mezclar varios proveedores dentro del camino critico de una llamada en v1
- usar un unico stack de voz para la ejecucion
- dejar otros modelos como apoyo offline o de back office

## Modelo de datos propuesto

La tabla `leads` debe seguir siendo la entidad comercial principal.

Las llamadas, intentos y booking deben vivir en tablas separadas.

### 1. `call_campaigns`

Representa una campaña de llamadas construida a partir de un batch.

Campos recomendados:

- `id`
- `batch_id`
- `name`
- `status`
- `goal`
- `agent_config_id`
- `scheduled_at`
- `created_at`
- `updated_at`

### 2. `call_targets`

Representa cada lead que entra a una campaña.

Campos recomendados:

- `id`
- `campaign_id`
- `lead_id`
- `phone`
- `priority_score`
- `status`
- `attempt_count`
- `last_attempt_at`
- `result`
- `next_retry_at`

### 3. `call_attempts`

Representa cada llamada individual.

Campos recomendados:

- `id`
- `target_id`
- `provider`
- `provider_call_id`
- `started_at`
- `ended_at`
- `duration_seconds`
- `outcome`
- `transcript`
- `summary`
- `booking_status`
- `recording_url`
- `raw_payload`

### 4. `bookings`

Representa la reunion ya agendada.

Campos recomendados:

- `id`
- `lead_id`
- `call_attempt_id`
- `scheduled_for`
- `timezone`
- `provider`
- `booking_url`
- `status`
- `confirmed_at`
- `notes`

### 5. `agent_configs`

Representa el comportamiento del agente.

Campos recomendados:

- `id`
- `name`
- `voice_id`
- `purpose`
- `system_prompt`
- `first_message`
- `language`
- `booking_mode`
- `enabled`

### 6. `lead_dnc`

Lista de no volver a llamar.

Campos recomendados:

- `lead_id`
- `reason`
- `created_at`

## Estados recomendados

No conviene meter todo dentro de `leads.stage`.

`leads.stage` debe seguir siendo el estado comercial general.

Para llamadas conviene usar estados propios de la campana:

- `queued`
- `dialing`
- `connected`
- `qualified`
- `booked`
- `no_answer`
- `voicemail`
- `callback_requested`
- `dnc`
- `failed`

Regla clave:

- `leads.stage` solo debe cambiar cuando haya un evento comercial real
- cada intento de llamada debe quedar guardado aunque el lead no avance

## Flujos

### Flujo 1: campana por lote

1. seleccionamos un batch ya importado
2. filtramos solo leads con score alto
3. generamos la campana
4. cargamos los targets
5. lanzamos la ejecucion por lote
6. guardamos cada intento

### Flujo 2: llamada que logra agenda

1. el agente detecta interes
2. valida que el lead sea apto
3. ofrece agenda
4. registra la cita
5. cambia el estado del target a `booked`
6. actualiza `leads.stage` a `booked`
7. guarda un brief para el humano

### Flujo 3: llamada sin interes

1. el agente detecta desinteres o falta de fit
2. corta rapido
3. marca resultado
4. si aplica, programa reintento
5. si no aplica, pasa a `dnc` o `lost`

## Fases de implementacion

### Fase 0: definicion y limites

Duracion estimada: 1 a 2 dias

Entregables:

- guion del agente
- regla de calificacion
- regla de booking
- politica de opt-out
- horario de llamadas
- numero maximo de intentos

Salida esperada:

- ya sabemos exactamente que hace el agente y que no hace

### Fase 1: base de datos y tipos

Duracion estimada: 2 a 3 dias

Entregables:

- nuevas tablas en `supabase/schema.sql`
- tipos en `lib/types.ts`
- helpers en `lib/repository.ts`
- estados y validaciones basicas

Salida esperada:

- podemos guardar campañas, targets, attempts y bookings sin tocar el flujo actual

### Fase 2: API de campanas

Duracion estimada: 2 a 3 dias

Entregables:

- crear campana desde un batch
- listar campanas
- pausar / reanudar campana
- disparar export o payload para batch calling

Salida esperada:

- el dashboard ya puede transformar un batch en una campana operable

### Fase 3: agente de llamada

Duracion estimada: 2 a 4 dias

Entregables:

- prompt del agente
- primera frase
- preguntas minimas
- reglas de objecion
- handoff a agenda
- webhooks de estado

Salida esperada:

- una llamada real puede llegar a agenda o terminar con un resultado guardado

### Fase 4: booking y confirmacion

Duracion estimada: 2 a 4 dias

Entregables:

- integracion con scheduler
- confirmacion automatica
- recordatorio previo
- reprogramacion
- no-show recovery

Salida esperada:

- la reunion ya no depende de memoria manual

### Fase 5: seguimiento y control

Duracion estimada: 1 a 2 dias

Entregables:

- panel de metricas
- tasa de contacto
- tasa de agenda
- tasa de no answer
- costo por agenda
- lista de opt-out

Salida esperada:

- sabemos si el sistema es rentable o solo "interesante"

## Que no debemos hacer en v1

- no construir un closer autonomo
- no usar varios modelos en vivo al mismo tiempo
- no automatizar todos los canales a la vez
- no meter WhatsApp, voice y email simultaneamente como canal principal
- no hacer scraping antes de validar agenda
- no mezclar la logica de llamada dentro de `leads` sin tablas de soporte

## Regla de rentabilidad

El sistema debe ahorrar tiempo humano en la parte mas repetitiva:

- calificar
- insistir
- filtrar
- agendar

Y debe reservar el tiempo humano para lo que mas valor tiene:

- discovery
- propuesta
- cierre

Para eso la prioridad de costo es:

1. usar el lead scoring para llamar solo a los mejores leads
2. limitar reintentos
3. mantener llamadas cortas
4. guardar solo lo necesario
5. usar modelos pequenos para briefing y resumos

## Criterio de exito del primer piloto

El primer piloto es exitoso si logra esto:

- toma un batch real
- hace llamadas reales
- guarda todos los resultados
- agenda al menos algunas reuniones
- deja al humano entrar directo al cierre

El objetivo del piloto no es volumen.

El objetivo es validar que el setter automatizado convierte mejor que el proceso manual puro.

## Mapa de archivos que tocariamos

- `supabase/schema.sql`
- `lib/types.ts`
- `lib/repository.ts`
- `app/api/leads/[id]/route.ts`
- `app/api/leads/route.ts`
- `components/views/pipeline-view.tsx`
- `components/views/studio-view.tsx`
- `components/views/overview-view.tsx`
- nuevo handler para webhooks de voz
- nueva API para campanas y booking

## Orden recomendado para ejecutar

1. cerrar el alcance del setter
2. crear el modelo de datos
3. crear la API de campanas
4. crear el agente de llamada
5. conectar booking
6. validar con 10 a 20 leads
7. medir conversion
8. ajustar antes de escalar

## Decision final

Si queremos hacerlo bien, el camino correcto es:

- primero una base de datos y estados solidos
- luego una campana de llamadas real
- luego booking
- luego seguimiento

Eso mantiene el sistema estable y evita una reescritura futura.
