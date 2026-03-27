# Nivora

Nivora es un dashboard de prospeccion outbound para vender landing pages, sitios web, automatizaciones y piezas creativas a negocios con mala presencia digital.

Ahora corre sobre `Next.js + TypeScript` y puede trabajar en dos modos:

- `preview`: usa datos de muestra mientras terminas la configuracion
- `cloud`: guarda leads reales en Supabase a traves del servidor

Tambien puede usar OpenAI desde el servidor para clasificar leads y redactar propuestas mas inteligentes, si agregas la API key en `.env.local`.

## Lo que ya hace

- definir foco de trabajo por ciudad, nicho y oferta
- login con Supabase Auth cuando configuras la llave publica
- bootstrap del primer `admin` desde el primer login valido
- crear usuarios internos `admin` y `setter`
- asignar nichos y cartera por lead
- seguimiento operativo separado del `stage` comercial
- agregar leads manualmente
- importar leads desde CSV
- deduplicar por negocio + datos de contacto
- mover negocios por el pipeline comercial
- generar propuesta, mensaje de WhatsApp y email base
- enriquecer leads con OpenAI cuando quieras mas clasificacion y copy automatico
- dejar la app lista para desplegar en Vercel

## Lo que falta despues

- ingestion desde Google Maps o una fuente compatible
- auditoria automatica de sitios web
- envio real de emails, WhatsApp y recordatorios
- storage de propuestas y archivos
- timeline visual completa de `lead_activities` dentro del drawer
- roadmap de llamadas y agenda automatizada: [docs/llamadas-agenda-roadmap.md](docs/llamadas-agenda-roadmap.md)

## Documentacion comercial

- kit operativo para setters humanos: [docs/setters/README.md](/Users/edwinsalgado/Documents/search-leeds-web/docs/setters/README.md)

## Correr localmente

Instala dependencias:

```bash
npm install
```

Crea tu archivo de entorno:

```bash
cp .env.example .env.local
```

Luego inicia el entorno local:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Si todavia no llenas `.env.local`, la app abre en `modo preview` con datos de ejemplo para que puedas revisar la UI.

Si quieres activar la IA, agrega tambien estas variables en `.env.local`:

- `OPENAI_API_KEY`
- `OPENAI_CLASSIFIER_MODEL` (por defecto `gpt-5-nano`)
- `OPENAI_WRITER_MODEL` (por defecto `gpt-4o-mini`)

Opcionales para afinar costo y latencia:

- `OPENAI_TIMEOUT_MS` (por defecto `20000`)
- `OPENAI_IMPORT_CHUNK_SIZE` (por defecto `8`)

## Conexion con Supabase

1. Abre `SQL Editor` en tu proyecto de Supabase.
2. Ejecuta [`supabase/schema.sql`](/Users/edwinsalgado/Documents/search-leeds-web/supabase/schema.sql).
3. Copia `.env.example` a `.env.local`.
4. Llena `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y una llave de servidor:
   `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY`.
5. Crea manualmente el primer usuario en `Authentication -> Users`.
6. Ejecuta `npm run verify:supabase-crm`.
7. Reinicia `npm run dev` y entra a `/login`.

La app usa Supabase en dos capas:

- Auth con la llave publica para login
- acceso servidor con `service role` o `secret key` para operaciones admin

No uses una llave `sb_publishable` ni la `anon/public` en las variables del servidor.

La guia completa quedo en [`docs/supabase-vercel-setup.md`](/Users/edwinsalgado/Documents/search-leeds-web/docs/supabase-vercel-setup.md).
La activacion del CRM multiusuario quedo en [`docs/crm-multiusuario-supabase-checklist.md`](/Users/edwinsalgado/Documents/search-leeds-web/docs/crm-multiusuario-supabase-checklist.md).

## CSV de ejemplo

Tienes un ejemplo listo en [`data/leads-example.csv`](/Users/edwinsalgado/Documents/search-leeds-web/data/leads-example.csv).

Columnas esperadas:

- `businessName`
- `city`
- `niche`
- `phone`
- `email`
- `website`
- `websiteStatus`
- `digitalPresence`
- `painPoints`
- `notes`
- `source`
- `offerType`
- `stage`
- `lastTouch`

Para `painPoints`, separa varios items con ` | `.
