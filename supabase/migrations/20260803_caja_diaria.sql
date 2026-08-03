create table if not exists public.caja_cierres (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha date not null,
  cajera_id uuid references public.funcionarios(id) on delete set null,
  cajera_nombre text not null,
  panaderos_primer_turno jsonb not null default '[]'::jsonb,
  panaderos_segundo_turno jsonb not null default '[]'::jsonb,
  compras_gastos jsonb not null default '[]'::jsonb,
  total_ventas numeric not null default 0,
  efectivo numeric not null default 0,
  tarjetas numeric not null default 0,
  observacion text,
  estado text not null default 'borrador' check (estado in ('borrador', 'cerrada')),
  cerrado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, fecha)
);

create index if not exists caja_cierres_empresa_fecha_idx
  on public.caja_cierres (empresa_id, fecha desc);

drop trigger if exists caja_cierres_updated_at on public.caja_cierres;
create trigger caja_cierres_updated_at
before update on public.caja_cierres
for each row execute function public.actualizar_updated_at();

alter table public.caja_cierres enable row level security;

drop policy if exists "caja_cierres_empresa" on public.caja_cierres;
create policy "caja_cierres_empresa"
on public.caja_cierres for all
using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden, activo)
values ('caja_diaria', 'Caja diaria', 'Comercial', '/admin/caja', 24, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden,
  activo = true;

insert into public.usuario_permisos (
  usuario_id, modulo_codigo, puede_ver, puede_crear, puede_editar, puede_eliminar
)
select id, 'caja_diaria', true, true, true, false
from public.perfiles_usuario
where activo = true
on conflict (usuario_id, modulo_codigo) do update set
  puede_ver = excluded.puede_ver,
  puede_crear = excluded.puede_crear,
  puede_editar = excluded.puede_editar;

