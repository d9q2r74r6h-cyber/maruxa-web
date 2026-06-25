-- Corrige el acceso interno despues de habilitar RLS para el catalogo publico.

alter table public.empresas enable row level security;
alter table public.productos enable row level security;

drop policy if exists "empresas_erp_autenticado" on public.empresas;
create policy "empresas_erp_autenticado"
on public.empresas
for all
to authenticated
using (id = public.usuario_empresa_id())
with check (id = public.usuario_empresa_id());

drop policy if exists "productos_erp_autenticado" on public.productos;
create policy "productos_erp_autenticado"
on public.productos
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());
