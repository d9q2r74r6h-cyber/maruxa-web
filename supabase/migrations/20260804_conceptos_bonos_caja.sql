create table if not exists public.caja_conceptos_bono (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  monto numeric not null default 0 check (monto >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

drop trigger if exists caja_conceptos_bono_updated_at on public.caja_conceptos_bono;
create trigger caja_conceptos_bono_updated_at
before update on public.caja_conceptos_bono
for each row execute function public.actualizar_updated_at();

alter table public.caja_conceptos_bono enable row level security;

drop policy if exists "caja_conceptos_bono_empresa" on public.caja_conceptos_bono;
create policy "caja_conceptos_bono_empresa"
on public.caja_conceptos_bono for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.caja_conceptos_bono (empresa_id, nombre, monto)
select empresa.id, concepto.nombre, concepto.monto
from public.empresas empresa
cross join (values ('Cocer noche', 5000::numeric), ('Cocer día', 2500::numeric)) as concepto(nombre, monto)
on conflict (empresa_id, nombre) do nothing;
