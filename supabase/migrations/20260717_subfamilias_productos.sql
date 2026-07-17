alter table public.familias_productos
  add column if not exists familia_padre_id uuid
  references public.familias_productos(id) on delete set null;

create index if not exists familias_productos_padre_idx
  on public.familias_productos(empresa_id, familia_padre_id);

alter table public.familias_productos
  drop constraint if exists familias_productos_no_autoreferencia;

alter table public.familias_productos
  add constraint familias_productos_no_autoreferencia
  check (familia_padre_id is null or familia_padre_id <> id);

comment on column public.familias_productos.familia_padre_id is
  'Familia principal opcional. Las familias sin padre son familias principales.';
