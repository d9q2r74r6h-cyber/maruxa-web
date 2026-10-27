create table if not exists public.producto_precios_whatsapp (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal text not null,
  producto_id bigint not null references public.productos(id) on delete cascade,
  precio numeric not null default 0 check (precio >= 0),
  precio_10 numeric check (precio_10 is null or precio_10 >= 0),
  precio_15 numeric check (precio_15 is null or precio_15 >= 0),
  precio_20 numeric check (precio_20 is null or precio_20 >= 0),
  precio_25 numeric check (precio_25 is null or precio_25 >= 0),
  updated_at timestamptz not null default now(),
  primary key (empresa_id, canal, producto_id)
);

alter table public.producto_precios_whatsapp enable row level security;

drop policy if exists "precios_whatsapp_empresa" on public.producto_precios_whatsapp;
create policy "precios_whatsapp_empresa" on public.producto_precios_whatsapp
for all using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.producto_precios_whatsapp
  (empresa_id, canal, producto_id, precio, precio_10, precio_15, precio_20, precio_25)
select empresa_id, '5041', id, 0, null, null, null, null
from public.productos p
where p.tipo_producto = 'producto'
  and p.activo = true
  and p.codigo is not null
  and p.precio > 0
  and exists (
    select 1 from public.familias_productos f
    where f.id = p.familia_id
      and f.activo = true
      and f.mostrar_catalogo = true
  )
on conflict (empresa_id, canal, producto_id) do nothing;

