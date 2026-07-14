create table if not exists public.cliente_producto_precios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete cascade,
  precio numeric not null check (precio >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, producto_id)
);

create index if not exists cliente_producto_precios_empresa_cliente_idx
  on public.cliente_producto_precios (empresa_id, cliente_id);

alter table public.cliente_producto_precios enable row level security;

drop policy if exists "precios_cliente_empresa" on public.cliente_producto_precios;
create policy "precios_cliente_empresa"
on public.cliente_producto_precios
for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop trigger if exists cliente_producto_precios_updated_at
  on public.cliente_producto_precios;
create trigger cliente_producto_precios_updated_at
before update on public.cliente_producto_precios
for each row execute function public.actualizar_updated_at();
