-- Recepción de XML: solo lectura para usuarios de Compras; escritura desde webhook firmado.
create table if not exists public.facturas_correo_adjuntos (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 email_id text not null, adjunto_id text not null, remitente text not null,
 asunto text not null default '', archivo text not null,
 estado text not null default 'pendiente' check (estado in ('pendiente','procesado','error','sin_xml')),
 xml text, mensaje text, creadas integer not null default 0, duplicadas integer not null default 0,
 created_at timestamptz not null default now(),
 unique (empresa_id,email_id,adjunto_id),
 check (xml is null or octet_length(xml) <= 20000000)
);
create table if not exists public.facturas_recibidas (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 adjunto_id uuid not null references public.facturas_correo_adjuntos(id),
 rut_emisor text not null, tipo text not null check (tipo in ('33','34')), folio text not null,
 proveedor text not null, fecha date not null, total numeric not null,
 estado text not null check (estado in ('pendiente','revision')),
 datos jsonb not null, avisos jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 unique (empresa_id,rut_emisor,tipo,folio)
);
create index if not exists facturas_recibidas_empresa_fecha on public.facturas_recibidas(empresa_id,created_at desc);
create index if not exists facturas_correo_adjuntos_empresa_fecha on public.facturas_correo_adjuntos(empresa_id,created_at desc);
alter table public.facturas_correo_adjuntos enable row level security;
alter table public.facturas_recibidas enable row level security;
drop policy if exists facturas_adjuntos_lectura on public.facturas_correo_adjuntos;
create policy facturas_adjuntos_lectura on public.facturas_correo_adjuntos for select to authenticated
using (empresa_id=public.usuario_empresa_id() and (public.usuario_es_admin() or exists (
 select 1 from public.usuario_permisos where usuario_id=auth.uid() and modulo_codigo='compras' and puede_ver
)));
drop policy if exists facturas_recibidas_lectura on public.facturas_recibidas;
create policy facturas_recibidas_lectura on public.facturas_recibidas for select to authenticated
using (empresa_id=public.usuario_empresa_id() and (public.usuario_es_admin() or exists (
 select 1 from public.usuario_permisos where usuario_id=auth.uid() and modulo_codigo='compras' and puede_ver
)));
revoke all on public.facturas_correo_adjuntos, public.facturas_recibidas from anon, authenticated;
grant select on public.facturas_correo_adjuntos, public.facturas_recibidas to authenticated;
grant all on public.facturas_correo_adjuntos, public.facturas_recibidas to service_role;
