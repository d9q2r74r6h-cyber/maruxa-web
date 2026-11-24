create table if not exists public.ventas_fepan_importaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  fecha_desde date not null,
  fecha_hasta date not null,
  detalle jsonb not null,
  nombre_archivo text not null,
  created_at timestamptz not null default now(),
  check (fecha_desde <= fecha_hasta),
  unique (empresa_id, fecha_desde, fecha_hasta)
);
alter table public.ventas_fepan_importaciones enable row level security;
drop policy if exists ventas_fepan_admin on public.ventas_fepan_importaciones;
create policy ventas_fepan_admin on public.ventas_fepan_importaciones
  for all to authenticated
  using (empresa_id = public.usuario_empresa_id() and public.usuario_es_admin())
  with check (empresa_id = public.usuario_empresa_id() and public.usuario_es_admin());
