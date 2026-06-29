create table if not exists public.cuentas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  banco text not null,
  tipo_cuenta text not null default 'Cuenta corriente',
  numero_cuenta text not null,
  titular text not null,
  rut_titular text,
  email_notificacion text,
  alias text,
  es_principal boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, banco, numero_cuenta)
);

create index if not exists idx_cuentas_bancarias_empresa
on public.cuentas_bancarias (empresa_id, activo, es_principal desc, banco);

alter table public.cuentas_bancarias enable row level security;

drop policy if exists "cuentas_bancarias_empresa" on public.cuentas_bancarias;
create policy "cuentas_bancarias_empresa"
on public.cuentas_bancarias
for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop trigger if exists cuentas_bancarias_updated_at on public.cuentas_bancarias;
create trigger cuentas_bancarias_updated_at
before update on public.cuentas_bancarias
for each row execute function public.set_updated_at();
