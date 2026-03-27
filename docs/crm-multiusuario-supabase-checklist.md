# CRM Multiusuario - Checklist de activacion en Supabase

Usa esta guia para dejar funcionando la version con `Supabase Auth`, roles `admin` y `setter`, y seguimiento operativo.

## 1. Variables locales

Copia el ejemplo:

```bash
cp .env.example .env.local
```

Llena estas variables:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
```

Tambien puedes usar `SUPABASE_SERVICE_ROLE_KEY` en lugar de `SUPABASE_SECRET_KEY`.

No uses la `anon/public key` en las variables de servidor.

## 2. Ejecutar el schema

1. Abre `SQL Editor` en Supabase.
2. Pega y ejecuta [`supabase/schema.sql`](/Users/edwinsalgado/Documents/search-leeds-web/supabase/schema.sql).
3. Espera a que termine sin errores.

Este archivo crea o actualiza:

- `team_members`
- `segment_assignments`
- `lead_activities`
- columnas operativas en `leads`
- funciones y politicas RLS para `admin` y `setter`

## 3. Crear el primer admin

1. Ve a `Authentication -> Users`.
2. Crea manualmente un usuario con email y password.
3. Confirma ese usuario si tu proyecto lo requiere.

No hace falta insertar manualmente la fila en `team_members`.
Cuando ese primer usuario haga login y `team_members` este vacia, la app lo bootstrappea como `admin`.

## 4. Verificar desde el proyecto

Ejecuta:

```bash
npm run verify:supabase-crm
```

Debe marcar `OK` para:

- variables de entorno
- `workspace_settings`
- `leads`
- `team_members`
- `segment_assignments`
- `lead_activities`

## 5. Probar la app

Inicia local:

```bash
npm run dev
```

Luego prueba:

1. entra a `/login`
2. inicia sesion con el primer usuario
3. confirma que entra al dashboard sin modo preview
4. crea un `setter` en `Equipo`
5. asigna un nicho
6. reasigna uno o varios leads
7. prueba seguimiento operativo desde el drawer

## 6. Si algo falla

Casos comunes:

- `/login` muestra configuracion pendiente
  Falta `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- `verify:supabase-crm` falla en `team_members`, `segment_assignments` o `lead_activities`
  El `schema.sql` no se ejecuto o no termino bien.

- falla acceso a rutas admin
  El usuario no alcanzo a bootstrapearse como `admin`; revisa que `team_members` exista y este vacia antes del primer login.
