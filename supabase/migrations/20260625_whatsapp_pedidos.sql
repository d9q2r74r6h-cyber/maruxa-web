-- Base de integración con carros de WhatsApp Business.

alter table public.pedidos
  add column if not exists origen text not null default 'web',
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_catalog_id text,
  add column if not exists whatsapp_payload jsonb;

create unique index if not exists idx_pedidos_whatsapp_message_id
  on public.pedidos (whatsapp_message_id)
  where whatsapp_message_id is not null;

create table if not exists public.whatsapp_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id bigint references public.pedidos(id) on delete set null,
  message_id text not null unique,
  telefono text,
  tipo text not null,
  estado text not null default 'recibido',
  observacion text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_eventos_empresa_fecha
  on public.whatsapp_eventos (empresa_id, created_at desc);

alter table public.whatsapp_eventos enable row level security;

drop policy if exists "whatsapp_eventos_empresa" on public.whatsapp_eventos;
create policy "whatsapp_eventos_empresa"
on public.whatsapp_eventos
for select
to authenticated
using (empresa_id = public.usuario_empresa_id());

grant select on public.whatsapp_eventos to authenticated;
