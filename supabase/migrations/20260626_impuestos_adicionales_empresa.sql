create table if not exists public.impuestos_adicionales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  porcentaje numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz default now(),
  unique (empresa_id, nombre)
);

alter table public.productos
add column if not exists impuesto_adicional_id uuid
references public.impuestos_adicionales(id) on delete set null;

alter table public.impuestos_adicionales enable row level security;

drop policy if exists "impuestos_adicionales_empresa" on public.impuestos_adicionales;
create policy "impuestos_adicionales_empresa"
on public.impuestos_adicionales
for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

create index if not exists idx_impuestos_adicionales_empresa
on public.impuestos_adicionales (empresa_id, activo, nombre);
