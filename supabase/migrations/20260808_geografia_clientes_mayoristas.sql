alter table public.clientes_mayoristas
  add column if not exists empresa_pais text not null default 'Chile',
  add column if not exists despacho_pais text;

update public.clientes_mayoristas
set despacho_pais = case when despacho_a_empresa then null else 'Chile' end
where despacho_pais is null;
