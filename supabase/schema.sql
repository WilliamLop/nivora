create extension if not exists pgcrypto;
create extension if not exists unaccent;

create or replace function public.make_slug(value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'item'
  );
$$;

create table if not exists public.markets (
  id text primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.segments (
  id text primary key,
  market_id text not null references public.markets(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.batches (
  id text primary key,
  market_id text not null references public.markets(id) on delete cascade,
  segment_id text not null references public.segments(id) on delete cascade,
  name text not null,
  source text not null default 'Manual',
  import_file_name text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  target_size integer not null default 25 check (target_size between 1 and 500),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists markets_name_key on public.markets (name);
create unique index if not exists segments_market_name_key on public.segments (market_id, name);
create unique index if not exists batches_segment_name_key on public.batches (segment_id, name);

create table if not exists public.workspace_settings (
  id text primary key default 'default',
  city text not null default 'Leeds',
  niche text not null default 'Local service businesses',
  offer_base_id text not null default 'landing',
  offer_addons text[] not null default '{}',
  offer text not null default 'Landing page',
  batch_size integer not null default 25 check (batch_size between 1 and 500),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.workspace_settings
  add column if not exists market_id text references public.markets(id) on delete set null;

alter table public.workspace_settings
  add column if not exists segment_id text references public.segments(id) on delete set null;

alter table public.workspace_settings
  add column if not exists batch_id text references public.batches(id) on delete set null;

alter table public.workspace_settings
  add column if not exists offer_base_id text not null default 'landing';
alter table public.workspace_settings
  alter column offer_base_id set default 'landing';

alter table public.workspace_settings
  add column if not exists offer_addons text[] not null default '{}';
alter table public.workspace_settings
  alter column offer_addons set default '{}';

alter table public.workspace_settings
  alter column offer set default 'Landing page';

alter table public.workspace_settings
  add column if not exists batch_name text not null default 'Base activa';
alter table public.workspace_settings
  alter column batch_name set default 'Base activa';

create table if not exists public.team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null check (role in ('admin', 'setter')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  city text not null,
  niche text not null,
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  source text not null default 'Manual intake',
  website_status text not null check (website_status in ('none', 'weak', 'strong')),
  digital_presence text not null check (digital_presence in ('low', 'medium', 'high')),
  pain_points text[] not null default '{}',
  offer_type text not null default '',
  stage text not null check (stage in ('sourced', 'qualified', 'contacted', 'booked', 'demo', 'proposal', 'closed')),
  notes text not null default '',
  last_touch date not null default current_date,
  fingerprint text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.leads
  add column if not exists market_id text references public.markets(id) on delete set null;

alter table public.leads
  add column if not exists segment_id text references public.segments(id) on delete set null;

alter table public.leads
  add column if not exists batch_id text references public.batches(id) on delete set null;

alter table public.leads
  add column if not exists subniche text not null default '';

alter table public.leads
  add column if not exists batch_name text not null default 'Base activa';
alter table public.leads
  alter column batch_name set default 'Base activa';

alter table public.leads
  add column if not exists assigned_user_id uuid references public.team_members(id) on delete set null;
alter table public.leads
  add column if not exists assigned_at timestamptz;
alter table public.leads
  add column if not exists assigned_by_user_id uuid references public.team_members(id) on delete set null;
alter table public.leads
  add column if not exists ops_status text not null default 'pending';
alter table public.leads
  add column if not exists next_follow_up_at date;
alter table public.leads
  add column if not exists last_activity_at timestamptz;
alter table public.leads
  add column if not exists last_activity_summary text not null default '';
alter table public.leads
  drop constraint if exists leads_ops_status_check;
alter table public.leads
  add constraint leads_ops_status_check check (
    ops_status in (
      'pending',
      'no_answer',
      'contacted',
      'callback_requested',
      'interested',
      'booked',
      'not_interested',
      'do_not_contact'
    )
  );

alter table public.leads
  add column if not exists ai_service_id text;
alter table public.leads
  add column if not exists ai_service_reason text not null default '';
alter table public.leads
  add column if not exists ai_confidence double precision;
alter table public.leads
  add column if not exists ai_pain_points text[] not null default '{}';
alter table public.leads
  add column if not exists ai_audit text not null default '';
alter table public.leads
  add column if not exists ai_scope text[] not null default '{}';
alter table public.leads
  add column if not exists ai_whatsapp text not null default '';
alter table public.leads
  add column if not exists ai_email text not null default '';
alter table public.leads
  add column if not exists ai_call text not null default '';
alter table public.leads
  add column if not exists ai_model_classify text not null default '';
alter table public.leads
  add column if not exists ai_model_copy text not null default '';
alter table public.leads
  add column if not exists ai_enriched_at timestamptz;

alter table public.leads
  drop constraint if exists leads_ai_service_id_check;
alter table public.leads
  add constraint leads_ai_service_id_check check (
    ai_service_id is null or ai_service_id in (
      'landing_conversion',
      'website_redesign',
      'conversion_audit',
      'whatsapp_followup',
      'google_business_profile',
      'booking_funnel'
    )
  );

alter table public.leads
  add column if not exists fingerprint text;

create table if not exists public.segment_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.team_members(id) on delete cascade,
  market_id text not null references public.markets(id) on delete cascade,
  segment_id text not null references public.segments(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists segment_assignments_user_segment_key
  on public.segment_assignments (user_id, segment_id);
create unique index if not exists segment_assignments_active_segment_key
  on public.segment_assignments (segment_id)
  where is_active;

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.team_members(id) on delete restrict,
  user_name text not null default '',
  activity_type text not null check (activity_type in ('call', 'whatsapp', 'email', 'note', 'assignment_change', 'stage_change')),
  outcome text not null default '',
  summary text not null default '',
  next_follow_up_at date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid references public.team_members(id) on delete set null,
  batch_id text references public.batches(id) on delete set null,
  batch_name text not null default 'Base activa',
  import_file_name text not null default '',
  status text not null default 'queued',
  total_leads integer not null default 0,
  processed_leads integer not null default 0,
  enriched_leads integer not null default 0,
  failed_leads integer not null default 0,
  classifier_model text not null default '',
  writer_model text not null default '',
  last_error text not null default '',
  started_at timestamptz,
  finished_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.ai_import_jobs
  drop constraint if exists ai_import_jobs_status_check;
alter table public.ai_import_jobs
  add constraint ai_import_jobs_status_check check (
    status in ('queued', 'running', 'completed', 'completed_with_errors', 'failed')
  );

create table if not exists public.ai_import_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_import_jobs(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text not null default '',
  locked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(job_id, lead_id)
);

alter table public.ai_import_job_items
  drop constraint if exists ai_import_job_items_status_check;
alter table public.ai_import_job_items
  add constraint ai_import_job_items_status_check check (
    status in ('pending', 'processing', 'enriched', 'failed')
  );

create index if not exists leads_market_id_idx on public.leads (market_id);
create index if not exists leads_segment_id_idx on public.leads (segment_id);
create index if not exists leads_batch_id_idx on public.leads (batch_id);
create index if not exists leads_city_niche_idx on public.leads (city, niche);
create index if not exists leads_assigned_user_idx on public.leads (assigned_user_id);
create index if not exists leads_ops_status_idx on public.leads (ops_status);
create index if not exists leads_next_follow_up_idx on public.leads (next_follow_up_at);
create index if not exists lead_activities_lead_id_idx on public.lead_activities (lead_id, created_at desc);
create index if not exists ai_import_jobs_status_idx on public.ai_import_jobs (status, created_at desc);
create index if not exists ai_import_job_items_job_status_idx on public.ai_import_job_items (job_id, status, created_at);

insert into public.workspace_settings (id)
values ('default')
on conflict (id) do nothing;

insert into public.markets (id, name, description)
select
  source.id,
  source.name,
  ''
from (
  select distinct on (public.make_slug(raw.city))
    public.make_slug(raw.city) as id,
    trim(raw.city) as name
  from (
    select city, 0 as source_priority from public.workspace_settings
    union all
    select city, 1 as source_priority from public.leads
  ) as raw
  where coalesce(trim(raw.city), '') <> ''
  order by
    public.make_slug(raw.city),
    raw.source_priority,
    char_length(trim(raw.city)) desc,
    trim(raw.city)
) as source
on conflict (id) do update
set name = excluded.name;

insert into public.segments (id, market_id, name, description)
select
  source.id,
  source.market_id,
  source.name,
  ''
from (
  select distinct on (concat_ws('__', public.make_slug(raw.city), public.make_slug(raw.niche)))
    concat_ws('__', public.make_slug(raw.city), public.make_slug(raw.niche)) as id,
    public.make_slug(raw.city) as market_id,
    trim(raw.niche) as name
  from (
    select city, niche, 0 as source_priority from public.workspace_settings
    union all
    select city, niche, 1 as source_priority from public.leads
  ) as raw
  where coalesce(trim(raw.city), '') <> ''
    and coalesce(trim(raw.niche), '') <> ''
  order by
    concat_ws('__', public.make_slug(raw.city), public.make_slug(raw.niche)),
    raw.source_priority,
    char_length(trim(raw.niche)) desc,
    trim(raw.niche),
    char_length(trim(raw.city)) desc,
    trim(raw.city)
) as source
on conflict (id) do update
set market_id = excluded.market_id,
    name = excluded.name;

insert into public.batches (
  id,
  market_id,
  segment_id,
  name,
  source,
  import_file_name,
  status,
  target_size,
  notes
)
select
  source.id,
  source.market_id,
  source.segment_id,
  source.name,
  source.source,
  '',
  'active',
  source.target_size,
  ''
from (
  select distinct on (
    concat_ws(
      '__',
      public.make_slug(raw.city),
      public.make_slug(raw.niche),
      public.make_slug(raw.batch_name)
    )
  )
    concat_ws(
      '__',
      public.make_slug(raw.city),
      public.make_slug(raw.niche),
      public.make_slug(raw.batch_name)
    ) as id,
    public.make_slug(raw.city) as market_id,
    concat_ws('__', public.make_slug(raw.city), public.make_slug(raw.niche)) as segment_id,
    trim(raw.batch_name) as name,
    raw.source,
    raw.target_size
  from (
    select
      city,
      niche,
      coalesce(nullif(trim(batch_name), ''), 'Base activa') as batch_name,
      'Workspace selection'::text as source,
      batch_size as target_size,
      0 as source_priority
    from public.workspace_settings
    union all
    select
      city,
      niche,
      coalesce(nullif(trim(batch_name), ''), 'Base activa') as batch_name,
      'Lead backfill'::text as source,
      25 as target_size,
      1 as source_priority
    from public.leads
  ) as raw
  where coalesce(trim(raw.city), '') <> ''
    and coalesce(trim(raw.niche), '') <> ''
    and coalesce(trim(raw.batch_name), '') <> ''
  order by
    concat_ws(
      '__',
      public.make_slug(raw.city),
      public.make_slug(raw.niche),
      public.make_slug(raw.batch_name)
    ),
    raw.source_priority,
    raw.target_size desc,
    trim(raw.batch_name),
    trim(raw.niche),
    trim(raw.city)
) as source
on conflict (id) do update
set market_id = excluded.market_id,
    segment_id = excluded.segment_id,
    name = excluded.name,
    target_size = excluded.target_size;

update public.workspace_settings
set
  market_id = coalesce(market_id, public.make_slug(city)),
  segment_id = coalesce(segment_id, concat_ws('__', public.make_slug(city), public.make_slug(niche))),
  batch_name = coalesce(nullif(batch_name, ''), 'Base activa'),
  batch_id = coalesce(
    batch_id,
    concat_ws(
      '__',
      public.make_slug(city),
      public.make_slug(niche),
      public.make_slug(coalesce(nullif(batch_name, ''), 'Base activa'))
    )
  );

update public.leads
set
  market_id = coalesce(market_id, public.make_slug(city)),
  segment_id = coalesce(segment_id, concat_ws('__', public.make_slug(city), public.make_slug(niche))),
  batch_name = coalesce(nullif(batch_name, ''), 'Base activa'),
  batch_id = coalesce(
    batch_id,
    concat_ws(
      '__',
      public.make_slug(city),
      public.make_slug(niche),
      public.make_slug(coalesce(nullif(batch_name, ''), 'Base activa'))
    )
  ),
  subniche = coalesce(nullif(subniche, ''), niche);

update public.leads
set fingerprint = concat_ws(
  '::',
  lower(trim(coalesce(business_name, ''))),
  lower(trim(coalesce(city, ''))),
  lower(trim(coalesce(phone, ''))),
  lower(trim(coalesce(email, ''))),
  lower(trim(coalesce(website, '')))
)
where coalesce(trim(fingerprint), '') = '';

alter table public.leads
  alter column fingerprint set not null;

create unique index if not exists leads_fingerprint_key on public.leads (fingerprint);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists markets_set_updated_at on public.markets;
create trigger markets_set_updated_at
before update on public.markets
for each row
execute function public.set_updated_at();

drop trigger if exists segments_set_updated_at on public.segments;
create trigger segments_set_updated_at
before update on public.segments
for each row
execute function public.set_updated_at();

drop trigger if exists batches_set_updated_at on public.batches;
create trigger batches_set_updated_at
before update on public.batches
for each row
execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

drop trigger if exists workspace_settings_set_updated_at on public.workspace_settings;
create trigger workspace_settings_set_updated_at
before update on public.workspace_settings
for each row
execute function public.set_updated_at();

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
before update on public.team_members
for each row
execute function public.set_updated_at();

drop trigger if exists segment_assignments_set_updated_at on public.segment_assignments;
create trigger segment_assignments_set_updated_at
before update on public.segment_assignments
for each row
execute function public.set_updated_at();

drop trigger if exists ai_import_jobs_set_updated_at on public.ai_import_jobs;
create trigger ai_import_jobs_set_updated_at
before update on public.ai_import_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists ai_import_job_items_set_updated_at on public.ai_import_job_items;
create trigger ai_import_job_items_set_updated_at
before update on public.ai_import_job_items
for each row
execute function public.set_updated_at();

create or replace function public.claim_ai_import_job_items(p_job_id uuid, p_limit integer default 8)
returns setof public.ai_import_job_items
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_import_job_items
  set status = 'pending',
      locked_at = null
  where job_id = p_job_id
    and status = 'processing'
    and locked_at < timezone('utc', now()) - interval '5 minutes';

  return query
  with picked as (
    select id
    from public.ai_import_job_items
    where job_id = p_job_id
      and status = 'pending'
    order by created_at asc
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.ai_import_job_items as items
  set status = 'processing',
      locked_at = timezone('utc', now()),
      attempt_count = items.attempt_count + 1,
      updated_at = timezone('utc', now())
  from picked
  where items.id = picked.id
  returning items.*;
end;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select role
  from public.team_members
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.claim_ai_import_job_items(uuid, integer) to authenticated;

alter table public.markets enable row level security;
alter table public.segments enable row level security;
alter table public.batches enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.team_members enable row level security;
alter table public.leads enable row level security;
alter table public.segment_assignments enable row level security;
alter table public.lead_activities enable row level security;
alter table public.ai_import_jobs enable row level security;
alter table public.ai_import_job_items enable row level security;

drop policy if exists "markets_authenticated_all" on public.markets;
drop policy if exists "segments_authenticated_all" on public.segments;
drop policy if exists "batches_authenticated_all" on public.batches;
drop policy if exists "workspace_settings_authenticated_all" on public.workspace_settings;
drop policy if exists "leads_authenticated_all" on public.leads;
drop policy if exists "markets_authenticated_read" on public.markets;
drop policy if exists "markets_admin_write" on public.markets;
drop policy if exists "segments_authenticated_read" on public.segments;
drop policy if exists "segments_admin_write" on public.segments;
drop policy if exists "batches_authenticated_read" on public.batches;
drop policy if exists "batches_admin_write" on public.batches;
drop policy if exists "workspace_settings_admin_all" on public.workspace_settings;
drop policy if exists "team_members_self_select" on public.team_members;
drop policy if exists "team_members_admin_all" on public.team_members;
drop policy if exists "leads_select_scope" on public.leads;
drop policy if exists "leads_insert_scope" on public.leads;
drop policy if exists "leads_update_scope" on public.leads;
drop policy if exists "leads_delete_scope" on public.leads;
drop policy if exists "segment_assignments_admin_all" on public.segment_assignments;
drop policy if exists "segment_assignments_self_select" on public.segment_assignments;
drop policy if exists "lead_activities_select_scope" on public.lead_activities;
drop policy if exists "lead_activities_insert_scope" on public.lead_activities;
drop policy if exists "lead_activities_admin_delete" on public.lead_activities;
drop policy if exists "ai_import_jobs_admin_all" on public.ai_import_jobs;
drop policy if exists "ai_import_job_items_admin_all" on public.ai_import_job_items;

create policy "markets_authenticated_read"
on public.markets
for select
to authenticated
using (true);

create policy "markets_admin_write"
on public.markets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "segments_authenticated_read"
on public.segments
for select
to authenticated
using (true);

create policy "segments_admin_write"
on public.segments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "batches_authenticated_read"
on public.batches
for select
to authenticated
using (true);

create policy "batches_admin_write"
on public.batches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "workspace_settings_admin_all"
on public.workspace_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "team_members_self_select"
on public.team_members
for select
to authenticated
using (id = auth.uid());

create policy "team_members_admin_all"
on public.team_members
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "leads_select_scope"
on public.leads
for select
to authenticated
using (public.is_admin() or assigned_user_id = auth.uid());

create policy "leads_insert_scope"
on public.leads
for insert
to authenticated
with check (public.is_admin() or assigned_user_id = auth.uid());

create policy "leads_update_scope"
on public.leads
for update
to authenticated
using (public.is_admin() or assigned_user_id = auth.uid())
with check (public.is_admin() or assigned_user_id = auth.uid());

create policy "leads_delete_scope"
on public.leads
for delete
to authenticated
using (public.is_admin() or assigned_user_id = auth.uid());

create policy "segment_assignments_admin_all"
on public.segment_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "segment_assignments_self_select"
on public.segment_assignments
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

create policy "lead_activities_select_scope"
on public.lead_activities
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.leads
    where public.leads.id = lead_activities.lead_id
      and public.leads.assigned_user_id = auth.uid()
  )
);

create policy "lead_activities_insert_scope"
on public.lead_activities
for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.leads
      where public.leads.id = lead_activities.lead_id
        and public.leads.assigned_user_id = auth.uid()
    )
  )
);

create policy "lead_activities_admin_delete"
on public.lead_activities
for delete
to authenticated
using (public.is_admin());

create policy "ai_import_jobs_admin_all"
on public.ai_import_jobs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "ai_import_job_items_admin_all"
on public.ai_import_job_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to authenticated;

grant select, insert, update, delete
on public.markets,
   public.segments,
   public.batches,
   public.workspace_settings,
   public.team_members,
   public.leads,
   public.segment_assignments,
   public.lead_activities,
   public.ai_import_jobs,
   public.ai_import_job_items
to authenticated;

grant usage, select
on all sequences in schema public
to authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;

comment on table public.markets is
'Catalogo de ciudades o mercados donde operas prospectos.';

comment on table public.segments is
'Macro-nichos por ciudad. Ejemplo: Odontologia, Abogados o Arquitectura.';

comment on table public.batches is
'Lotes o importaciones concretas dentro de un macro-nicho. Cada CSV debe aterrizar en uno de estos lotes.';

comment on table public.workspace_settings is
'Configuracion global del dashboard. Guarda la ciudad, macro-nicho y lote activos del workspace.';

comment on table public.team_members is
'Usuarios internos del CRM. Define rol, acceso y estado operativo del equipo.';

comment on table public.leads is
'Pipeline de prospectos. Cada lead queda asociado a ciudad, macro-nicho, lote y subnicho.';

comment on table public.segment_assignments is
'Asignaciones activas de nichos a setters para autoenrutamiento y visibilidad del CRM.';

comment on table public.lead_activities is
'Historial operativo por lead: llamadas, notas, cambios de asignacion y seguimiento.';
