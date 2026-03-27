# Supabase + Vercel Setup

## Arquitectura actual

Esta version usa:

- `Next.js` para frontend y rutas del servidor
- `Supabase Postgres` como base de datos
- `Vercel` para desplegar la app

Esta version ya puede operar con login interno usando `Supabase Auth`.

La arquitectura queda asi:

- navegador: usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` solo para iniciar sesion
- servidor: usa `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` para operaciones admin
- base de datos: protege acceso con RLS para `admin` y `setter`

## 1. Crear el proyecto en Supabase

- Crea un proyecto nuevo en Supabase.
- Abre `SQL Editor`.
- Ejecuta [`supabase/schema.sql`](/Users/edwinsalgado/Documents/search-leeds-web/supabase/schema.sql).

Ese schema crea:

- `workspace_settings`
- `leads`
- `team_members`
- `segment_assignments`
- `lead_activities`
- `fingerprint` unico para deduplicar leads
- columnas operativas como `ops_status`, `assigned_user_id` y `next_follow_up_at`
- triggers para `updated_at`
- funciones y politicas RLS

## 2. Configurar variables locales

Copia el ejemplo:

```bash
cp .env.example .env.local
```

Llena estas variables en `.env.local`:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_JWT
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_CLASSIFIER_MODEL=gpt-5-nano
OPENAI_WRITER_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=20000
OPENAI_IMPORT_CHUNK_SIZE=8
```

Usa solo una de las dos llaves de servidor.

La parte de OpenAI es opcional. Si no la llenas, la app sigue funcionando con las reglas locales y el modo preview.

No pongas aqui:

- `sb_publishable` ni la `anon/public key` en variables de servidor

La llave publica si debe existir en:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Probar localmente

Instala dependencias y corre el proyecto:

```bash
npm install
npm run verify:supabase-crm
npm run dev
```

Antes del primer login:

1. crea manualmente un usuario en `Authentication -> Users`
2. abre [http://localhost:3000/login](http://localhost:3000/login)
3. entra con ese usuario

Si `team_members` esta vacia, ese primer usuario queda bootstrappeado como `admin`.

Si todo esta bien:

- `/login` deja de mostrar configuracion pendiente
- el dashboard deja el modo preview
- `Equipo` aparece para el admin
- las operaciones reales quedan guardadas en Supabase

Si faltan variables, la app sigue funcionando en `preview mode` con datos de ejemplo.

## 4. Desplegar en Vercel

- Sube el proyecto a GitHub.
- Importa el repositorio en Vercel.
- En `Project Settings -> Environment Variables`, agrega:
  - `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY`
- Lanza el deploy.

Vercel va a ejecutar el servidor de Next.js y desde ahi hablar con Supabase.

## 5. Seguridad minima para esta etapa

- No pongas `SUPABASE_SERVICE_ROLE_KEY` en componentes cliente.
- No la guardes en archivos JS del frontend.
- No habilites acceso anonimo directo a la tabla solo para evitar escribir backend.
- Mantén el deploy en un entorno controlado mientras no exista login.

## 6. Siguiente endurecimiento recomendado

Cuando el flujo comercial ya este validado, el siguiente paso es agregar:

- autenticacion
- roles por equipo
- auditoria de cambios
- storage de propuestas PDF
