create table if not exists public.recuperaciones_password_whatsapp (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  telefono text not null,
  ventana_10_minutos timestamptz not null,
  estado text not null check (estado in ('procesando', 'enviado', 'fallido')),
  message_id text,
  detalle text,
  solicitado_en timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id, ventana_10_minutos)
);

create index if not exists idx_recuperaciones_password_whatsapp_empresa_fecha
  on public.recuperaciones_password_whatsapp (empresa_id, solicitado_en desc);

drop trigger if exists recuperaciones_password_whatsapp_updated_at
  on public.recuperaciones_password_whatsapp;
create trigger recuperaciones_password_whatsapp_updated_at
before update on public.recuperaciones_password_whatsapp
for each row execute function public.actualizar_updated_at();

alter table public.recuperaciones_password_whatsapp enable row level security;

comment on table public.recuperaciones_password_whatsapp is
  'Registro técnico de solicitudes de recuperación por WhatsApp; nunca guarda el enlace ni el token.';
