create table if not exists public.correo_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  email_id text not null unique,
  message_id text,
  remitente text not null,
  destinatarios text[] not null default '{}',
  asunto text not null default '(Sin asunto)',
  texto text,
  html text,
  adjuntos jsonb not null default '[]'::jsonb,
  direccion text not null default 'entrante'
    check (direccion in ('entrante', 'saliente')),
  estado text not null default 'recibido'
    check (estado in ('recibido', 'leido', 'respondido', 'enviado', 'fallido')),
  respondido_a text,
  enviado_por text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_correo_eventos_empresa_fecha
  on public.correo_eventos (empresa_id, created_at desc);

create index if not exists idx_correo_eventos_empresa_remitente
  on public.correo_eventos (empresa_id, remitente, created_at desc);

alter table public.correo_eventos enable row level security;

drop policy if exists "correo_eventos_empresa_select" on public.correo_eventos;
create policy "correo_eventos_empresa_select"
on public.correo_eventos
for select
to authenticated
using (empresa_id = public.usuario_empresa_id());

grant select on public.correo_eventos to authenticated;

