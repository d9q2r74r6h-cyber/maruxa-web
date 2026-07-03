alter table public.perfiles_usuario
add column if not exists notificar_whatsapp boolean not null default false,
add column if not exists notificar_email boolean not null default false,
add column if not exists notificacion_whatsapp text,
add column if not exists notificacion_email text;
