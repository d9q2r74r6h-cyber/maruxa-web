create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rut text not null,
  razon_social text not null,
  giro text,
  direccion text,
  comuna text,
  ciudad text,
  email text,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, rut)
);

create table if not exists public.documentos_tributarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo_dte integer not null,
  folio bigint,
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  forma_pago text,
  estado text not null default 'borrador'
    check (estado in (
      'borrador', 'pendiente_envio', 'enviado', 'aceptado',
      'aceptado_reparos', 'rechazado', 'anulado'
    )),
  rut_receptor text not null,
  razon_social_receptor text not null,
  giro_receptor text,
  direccion_receptor text,
  comuna_receptor text,
  ciudad_receptor text,
  monto_exento numeric not null default 0,
  monto_neto numeric not null default 0,
  tasa_iva numeric not null default 19,
  monto_iva numeric not null default 0,
  impuestos_adicionales numeric not null default 0,
  monto_total numeric not null default 0,
  observaciones text,
  xml_dte text,
  xml_respuesta text,
  track_id text,
  estado_sii text,
  glosa_sii text,
  pdf_url text,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, tipo_dte, folio)
);

create table if not exists public.documento_tributario_detalles (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos_tributarios(id) on delete cascade,
  numero_linea integer not null,
  producto_id bigint references public.productos(id) on delete set null,
  codigo text,
  nombre text not null,
  descripcion text,
  cantidad numeric not null default 0,
  unidad text,
  precio_unitario numeric not null default 0,
  descuento_porcentaje numeric not null default 0,
  descuento_monto numeric not null default 0,
  exento boolean not null default false,
  monto_item numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (documento_id, numero_linea)
);

create table if not exists public.documento_tributario_referencias (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos_tributarios(id) on delete cascade,
  numero_linea integer not null,
  tipo_documento_referencia text not null,
  folio_referencia text not null,
  fecha_referencia date,
  codigo_referencia integer,
  razon_referencia text,
  created_at timestamptz not null default now()
);

create table if not exists public.dte_folios_caf (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo_dte integer not null,
  folio_desde bigint not null,
  folio_hasta bigint not null,
  folio_actual bigint not null,
  caf_xml text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (empresa_id, tipo_dte, folio_desde, folio_hasta)
);

create table if not exists public.dte_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  documento_id uuid references public.documentos_tributarios(id) on delete cascade,
  tipo_envio text not null default 'dte',
  track_id text,
  estado text not null default 'pendiente',
  xml_envio text,
  xml_respuesta text,
  intentos integer not null default 0,
  ultimo_error text,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_documentos_empresa_fecha
  on public.documentos_tributarios (empresa_id, fecha_emision desc);
create index if not exists idx_documentos_estado
  on public.documentos_tributarios (empresa_id, estado);

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at
before update on public.clientes
for each row execute function public.actualizar_updated_at();

drop trigger if exists documentos_tributarios_updated_at on public.documentos_tributarios;
create trigger documentos_tributarios_updated_at
before update on public.documentos_tributarios
for each row execute function public.actualizar_updated_at();

alter table public.clientes enable row level security;
alter table public.documentos_tributarios enable row level security;
alter table public.documento_tributario_detalles enable row level security;
alter table public.documento_tributario_referencias enable row level security;
alter table public.dte_folios_caf enable row level security;
alter table public.dte_envios enable row level security;

drop policy if exists "clientes_empresa" on public.clientes;
create policy "clientes_empresa" on public.clientes
for all using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "documentos_empresa" on public.documentos_tributarios;
create policy "documentos_empresa" on public.documentos_tributarios
for all using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

drop policy if exists "documentos_detalles_empresa" on public.documento_tributario_detalles;
create policy "documentos_detalles_empresa" on public.documento_tributario_detalles
for all using (
  exists (
    select 1 from public.documentos_tributarios d
    where d.id = documento_id
      and d.empresa_id = public.usuario_empresa_id()
  )
) with check (
  exists (
    select 1 from public.documentos_tributarios d
    where d.id = documento_id
      and d.empresa_id = public.usuario_empresa_id()
  )
);

drop policy if exists "documentos_referencias_empresa" on public.documento_tributario_referencias;
create policy "documentos_referencias_empresa" on public.documento_tributario_referencias
for all using (
  exists (
    select 1 from public.documentos_tributarios d
    where d.id = documento_id
      and d.empresa_id = public.usuario_empresa_id()
  )
) with check (
  exists (
    select 1 from public.documentos_tributarios d
    where d.id = documento_id
      and d.empresa_id = public.usuario_empresa_id()
  )
);

drop policy if exists "caf_admin" on public.dte_folios_caf;
create policy "caf_admin" on public.dte_folios_caf
for all using (
  empresa_id = public.usuario_empresa_id() and public.usuario_es_admin()
) with check (
  empresa_id = public.usuario_empresa_id() and public.usuario_es_admin()
);

drop policy if exists "envios_empresa" on public.dte_envios;
create policy "envios_empresa" on public.dte_envios
for all using (empresa_id = public.usuario_empresa_id())
with check (empresa_id = public.usuario_empresa_id());

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden) values
  ('clientes', 'Clientes', 'Comercial', '/admin/clientes', 22),
  ('documentos', 'Documentos tributarios', 'Comercial', '/admin/documentos', 24),
  ('informe_rinde', 'Rinde mensual', 'Informes', '/admin/informes/rinde', 105)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden;

do $$
declare
  configuracion record;
begin
  for configuracion in
    select * from (values
      ('clientes', 'clientes'),
      ('documentos_tributarios', 'documentos'),
      ('documento_tributario_detalles', 'documentos'),
      ('documento_tributario_referencias', 'documentos'),
      ('dte_folios_caf', 'documentos'),
      ('dte_envios', 'documentos')
    ) as t(tabla, modulo)
  loop
    if to_regclass('public.' || configuracion.tabla) is not null then
      execute format(
        'drop trigger if exists auditoria_erp on public.%I',
        configuracion.tabla
      );
      execute format(
        'create trigger auditoria_erp after insert or update or delete on public.%I for each row execute function public.auditar_cambio_erp(%L)',
        configuracion.tabla,
        configuracion.modulo
      );
    end if;
  end loop;
end;
$$;
