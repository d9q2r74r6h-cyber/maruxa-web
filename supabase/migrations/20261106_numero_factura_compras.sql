alter table public.compras
  add column if not exists numero_factura text;

create index if not exists compras_empresa_numero_factura_idx
  on public.compras (empresa_id, numero_factura)
  where numero_factura is not null;
