-- Un mismo producto puede tener un código diferente para cada proveedor.
-- El código se guarda normalizado para que "ABC- 123" y "abc123" se reconozcan igual.
create table if not exists public.productos_proveedor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete cascade,
  codigo_proveedor text not null check (btrim(codigo_proveedor) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, proveedor_id, codigo_proveedor)
);

create index if not exists productos_proveedor_producto_idx
  on public.productos_proveedor (empresa_id, producto_id);

alter table public.productos_proveedor enable row level security;

drop policy if exists "productos_proveedor_empresa" on public.productos_proveedor;
create policy "productos_proveedor_empresa"
on public.productos_proveedor
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop trigger if exists productos_proveedor_updated_at on public.productos_proveedor;
create trigger productos_proveedor_updated_at
before update on public.productos_proveedor
for each row execute function public.set_updated_at();

comment on table public.productos_proveedor is
  'Equivalencias entre los códigos de cada proveedor y los productos internos.';
