-- Un producto terminado puede usarse también como materia prima de una receta.
-- El tipo principal no se modifica: esta marca preserva catálogo, precios y stock.
alter table public.productos
  add column if not exists es_materia_prima boolean not null default false;

update public.productos
set es_materia_prima = true
where tipo_producto = 'ingrediente'
  and es_materia_prima is false;

create index if not exists productos_empresa_materia_prima_idx
  on public.productos (empresa_id, es_materia_prima)
  where es_materia_prima is true;

comment on column public.productos.es_materia_prima is
  'Permite usar un producto terminado como materia prima en recetas sin quitarlo del catálogo.';
