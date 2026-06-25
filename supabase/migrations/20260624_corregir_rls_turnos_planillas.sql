-- Permisos internos para configurar turnos y registrar rinde por saco.

alter table public.turnos enable row level security;
alter table public.planillas enable row level security;
alter table public.planilla_turnos enable row level security;
alter table public.planilla_insumos enable row level security;
alter table public.planilla_detalles enable row level security;

drop policy if exists "turnos_empresa" on public.turnos;
create policy "turnos_empresa"
on public.turnos
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "planillas_empresa" on public.planillas;
create policy "planillas_empresa"
on public.planillas
for all
to authenticated
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "planilla_turnos_empresa" on public.planilla_turnos;
create policy "planilla_turnos_empresa"
on public.planilla_turnos
for all
to authenticated
using (
  exists (
    select 1
    from public.planillas p
    where p.id = planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.planillas p
    where p.id = planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
);

drop policy if exists "planilla_insumos_empresa" on public.planilla_insumos;
create policy "planilla_insumos_empresa"
on public.planilla_insumos
for all
to authenticated
using (
  exists (
    select 1
    from public.planilla_turnos pt
    join public.planillas p on p.id = pt.planilla_id
    where pt.id = planilla_turno_id
      and p.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.planilla_turnos pt
    join public.planillas p on p.id = pt.planilla_id
    where pt.id = planilla_turno_id
      and p.empresa_id = public.usuario_empresa_id()
  )
);

drop policy if exists "planilla_detalles_empresa" on public.planilla_detalles;
create policy "planilla_detalles_empresa"
on public.planilla_detalles
for all
to authenticated
using (
  exists (
    select 1
    from public.planillas p
    where p.id = planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
)
with check (
  exists (
    select 1
    from public.planillas p
    where p.id = planilla_id
      and p.empresa_id = public.usuario_empresa_id()
  )
);

grant select, insert, update, delete on public.turnos to authenticated;
grant select, insert, update, delete on public.planillas to authenticated;
grant select, insert, update, delete on public.planilla_turnos to authenticated;
grant select, insert, update, delete on public.planilla_insumos to authenticated;
grant select, insert, update, delete on public.planilla_detalles to authenticated;
