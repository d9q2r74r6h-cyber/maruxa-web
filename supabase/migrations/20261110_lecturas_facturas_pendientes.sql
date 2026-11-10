-- Bandeja privada de lecturas hechas desde fotos. Guarda sólo los datos extraídos;
-- la imagen nunca se sube a Storage ni se persiste en la aplicación.
create table if not exists public.lecturas_facturas_pendientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  datos jsonb not null,
  cantidad_fotos smallint not null check (cantidad_fotos between 1 and 5),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_revision')),
  created_at timestamptz not null default now()
);

create index if not exists lecturas_facturas_pendientes_usuario_fecha_idx
  on public.lecturas_facturas_pendientes (empresa_id, usuario_id, created_at desc);

alter table public.lecturas_facturas_pendientes enable row level security;

drop policy if exists lecturas_facturas_pendientes_usuario on public.lecturas_facturas_pendientes;
create policy lecturas_facturas_pendientes_usuario
on public.lecturas_facturas_pendientes
for all
to authenticated
using (
  empresa_id = public.usuario_empresa_id()
  and usuario_id = auth.uid()
)
with check (
  empresa_id = public.usuario_empresa_id()
  and usuario_id = auth.uid()
);

revoke all on public.lecturas_facturas_pendientes from anon;
grant select, insert, update, delete on public.lecturas_facturas_pendientes to authenticated;
