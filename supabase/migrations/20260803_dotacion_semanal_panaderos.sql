create table if not exists public.caja_dotaciones_semanales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  semana_desde date not null,
  dotacion jsonb not null default '{}'::jsonb,
  observacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, semana_desde)
);

create index if not exists caja_dotaciones_empresa_semana_idx
  on public.caja_dotaciones_semanales (empresa_id, semana_desde desc);

drop trigger if exists caja_dotaciones_semanales_updated_at on public.caja_dotaciones_semanales;
create trigger caja_dotaciones_semanales_updated_at
before update on public.caja_dotaciones_semanales
for each row execute function public.actualizar_updated_at();

alter table public.caja_dotaciones_semanales enable row level security;

drop policy if exists "caja_dotaciones_empresa" on public.caja_dotaciones_semanales;
create policy "caja_dotaciones_empresa"
on public.caja_dotaciones_semanales for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

alter table public.caja_cierres
  add column if not exists es_festivo boolean not null default false;
