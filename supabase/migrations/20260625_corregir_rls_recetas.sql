-- Permisos internos para crear y mantener recetas y sus detalles.

alter table public.recetas enable row level security;
alter table public.receta_ingredientes enable row level security;
alter table public.receta_subproductos enable row level security;

drop policy if exists "recetas_empresa" on public.recetas;
create policy "recetas_empresa"
on public.recetas
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "receta_ingredientes_empresa" on public.receta_ingredientes;
create policy "receta_ingredientes_empresa"
on public.receta_ingredientes
for all
to authenticated
using (
  exists (
    select 1
    from public.recetas r
    where r.id = receta_id
      and r.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.recetas r
    where r.id = receta_id
      and r.empresa_id = public.usuario_empresa_id()
  )
);

drop policy if exists "receta_subproductos_empresa" on public.receta_subproductos;
create policy "receta_subproductos_empresa"
on public.receta_subproductos
for all
to authenticated
using (
  exists (
    select 1
    from public.recetas r
    where r.id = receta_id
      and r.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.recetas r
    where r.id = receta_id
      and r.empresa_id = public.usuario_empresa_id()
  )
);

grant select, insert, update, delete on public.recetas to authenticated;
grant select, insert, update, delete on public.receta_ingredientes to authenticated;
grant select, insert, update, delete on public.receta_subproductos to authenticated;
