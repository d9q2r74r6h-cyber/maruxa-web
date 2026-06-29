create table if not exists public.instagram_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sender_id text,
  recipient_id text,
  message_id text not null unique,
  tipo text not null default 'text',
  texto text,
  estado text not null default 'recibido',
  observacion text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_instagram_eventos_empresa_fecha
on public.instagram_eventos (empresa_id, created_at desc);

alter table public.instagram_eventos enable row level security;

drop policy if exists "instagram_eventos_empresa_select" on public.instagram_eventos;
create policy "instagram_eventos_empresa_select"
on public.instagram_eventos
for select
to authenticated
using (empresa_id = public.usuario_empresa_id());

grant select on public.instagram_eventos to authenticated;
