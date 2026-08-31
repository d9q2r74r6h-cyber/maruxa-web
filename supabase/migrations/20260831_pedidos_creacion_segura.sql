-- Los pedidos publicos se crean exclusivamente mediante /api/pedidos,
-- que recalcula precios con service_role. El navegador no escribe directo.

alter table public.pedidos enable row level security;

revoke all on table public.pedidos from anon;

drop policy if exists "pedidos_empresa" on public.pedidos;
create policy "pedidos_empresa"
on public.pedidos
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

grant select, insert, update, delete on table public.pedidos to authenticated;