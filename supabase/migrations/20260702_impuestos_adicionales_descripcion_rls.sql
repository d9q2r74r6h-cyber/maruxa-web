alter table public.impuestos_adicionales
add column if not exists descripcion text;

alter table public.impuestos_adicionales enable row level security;

drop policy if exists "impuestos_adicionales_empresa" on public.impuestos_adicionales;
drop policy if exists "impuestos_adicionales_erp_autenticado" on public.impuestos_adicionales;

create policy "impuestos_adicionales_erp_autenticado"
on public.impuestos_adicionales
for all
to authenticated
using (true)
with check (true);
