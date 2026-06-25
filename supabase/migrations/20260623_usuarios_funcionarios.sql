create extension if not exists pgcrypto;

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text,
  nombre_completo text not null,
  rut text,
  email text,
  telefono text,
  cargo text not null,
  fecha_ingreso date,
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists public.perfiles_usuario (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid unique references public.funcionarios(id) on delete set null,
  nombre_visible text not null,
  rol text not null default 'operador'
    check (rol in ('superadmin', 'administrador', 'supervisor', 'operador', 'consulta')),
  activo boolean not null default true,
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modulos_erp (
  codigo text primary key,
  nombre text not null,
  grupo text not null,
  ruta text,
  orden integer not null default 0,
  activo boolean not null default true
);

insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden) values
  ('inicio', 'Inicio', 'General', '/admin', 10),
  ('pedidos', 'Pedidos', 'Comercial', '/admin/pedidos', 20),
  ('productos', 'Productos', 'Inventario', '/admin/productos', 30),
  ('compras', 'Compras', 'Inventario', '/admin/compras', 40),
  ('recetas', 'Recetas', 'Produccion', '/admin/recetas', 50),
  ('produccion', 'Fabricacion', 'Produccion', '/admin/produccion', 60),
  ('planillas', 'Rinde por saco', 'Produccion', '/admin/planillas', 70),
  ('familias', 'Familias de productos', 'Configuracion', '/admin/familias-productos', 80),
  ('empresa', 'Empresa', 'Configuracion', '/admin/configuracion', 90),
  ('usuarios', 'Usuarios y permisos', 'Configuracion', '/admin/usuarios', 100),
  ('auditoria', 'Auditoria', 'Configuracion', '/admin/auditoria', 110)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden;

create table if not exists public.usuario_permisos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles_usuario(id) on delete cascade,
  modulo_codigo text not null references public.modulos_erp(codigo) on delete cascade,
  puede_ver boolean not null default false,
  puede_crear boolean not null default false,
  puede_editar boolean not null default false,
  puede_eliminar boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, modulo_codigo)
);

create table if not exists public.auditoria_erp (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  modulo text not null,
  accion text not null,
  tabla text,
  registro_id text,
  descripcion text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_funcionarios_empresa_cargo
  on public.funcionarios (empresa_id, cargo, activo);
create index if not exists idx_perfiles_empresa
  on public.perfiles_usuario (empresa_id, activo);
create index if not exists idx_auditoria_empresa_fecha
  on public.auditoria_erp (empresa_id, created_at desc);

create or replace function public.actualizar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists funcionarios_updated_at on public.funcionarios;
create trigger funcionarios_updated_at
before update on public.funcionarios
for each row execute function public.actualizar_updated_at();

drop trigger if exists perfiles_usuario_updated_at on public.perfiles_usuario;
create trigger perfiles_usuario_updated_at
before update on public.perfiles_usuario
for each row execute function public.actualizar_updated_at();

drop trigger if exists usuario_permisos_updated_at on public.usuario_permisos;
create trigger usuario_permisos_updated_at
before update on public.usuario_permisos
for each row execute function public.actualizar_updated_at();

create or replace function public.usuario_es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles_usuario
    where id = auth.uid()
      and activo = true
      and rol in ('superadmin', 'administrador')
  );
$$;

create or replace function public.usuario_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id
  from public.perfiles_usuario
  where id = auth.uid() and activo = true
  limit 1;
$$;

alter table public.funcionarios enable row level security;
alter table public.perfiles_usuario enable row level security;
alter table public.modulos_erp enable row level security;
alter table public.usuario_permisos enable row level security;
alter table public.auditoria_erp enable row level security;

drop policy if exists "funcionarios_empresa" on public.funcionarios;
create policy "funcionarios_empresa" on public.funcionarios
for select using (empresa_id = public.usuario_empresa_id());

drop policy if exists "funcionarios_admin" on public.funcionarios;
create policy "funcionarios_admin" on public.funcionarios
for all using (
  empresa_id = public.usuario_empresa_id() and public.usuario_es_admin()
) with check (
  empresa_id = public.usuario_empresa_id() and public.usuario_es_admin()
);

drop policy if exists "perfil_propio" on public.perfiles_usuario;
create policy "perfil_propio" on public.perfiles_usuario
for select using (
  id = auth.uid()
  or (empresa_id = public.usuario_empresa_id() and public.usuario_es_admin())
);

drop policy if exists "perfiles_admin" on public.perfiles_usuario;
create policy "perfiles_admin" on public.perfiles_usuario
for all using (
  empresa_id = public.usuario_empresa_id() and public.usuario_es_admin()
) with check (
  empresa_id = public.usuario_empresa_id() and public.usuario_es_admin()
);

drop policy if exists "modulos_autenticados" on public.modulos_erp;
create policy "modulos_autenticados" on public.modulos_erp
for select using (auth.uid() is not null);

drop policy if exists "permisos_propios" on public.usuario_permisos;
create policy "permisos_propios" on public.usuario_permisos
for select using (
  usuario_id = auth.uid()
  or public.usuario_es_admin()
);

drop policy if exists "permisos_admin" on public.usuario_permisos;
create policy "permisos_admin" on public.usuario_permisos
for all using (public.usuario_es_admin())
with check (public.usuario_es_admin());

drop policy if exists "auditoria_empresa" on public.auditoria_erp;
create policy "auditoria_empresa" on public.auditoria_erp
for select using (
  empresa_id = public.usuario_empresa_id()
  and public.usuario_es_admin()
);

drop policy if exists "auditoria_insertar" on public.auditoria_erp;
create policy "auditoria_insertar" on public.auditoria_erp
for insert with check (
  usuario_id = auth.uid()
  and empresa_id = public.usuario_empresa_id()
);

create or replace function public.auditar_cambio_erp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_empresa uuid;
  v_funcionario uuid;
  v_registro_id text;
begin
  if v_usuario is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select empresa_id, funcionario_id
    into v_empresa, v_funcionario
  from public.perfiles_usuario
  where id = v_usuario;

  v_registro_id := coalesce(
    case when tg_op <> 'DELETE' then to_jsonb(new)->>'id' end,
    case when tg_op <> 'INSERT' then to_jsonb(old)->>'id' end
  );

  insert into public.auditoria_erp (
    empresa_id,
    usuario_id,
    funcionario_id,
    modulo,
    accion,
    tabla,
    registro_id,
    descripcion,
    datos_anteriores,
    datos_nuevos
  ) values (
    v_empresa,
    v_usuario,
    v_funcionario,
    tg_argv[0],
    lower(tg_op),
    tg_table_name,
    v_registro_id,
    tg_op || ' en ' || tg_table_name,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  configuracion record;
begin
  for configuracion in
    select * from (values
      ('productos', 'productos'),
      ('compras', 'compras'),
      ('compra_detalle', 'compras'),
      ('recetas', 'recetas'),
      ('receta_ingredientes', 'recetas'),
      ('receta_subproductos', 'recetas'),
      ('producciones', 'produccion'),
      ('planillas', 'planillas'),
      ('planilla_turnos', 'planillas'),
      ('planilla_insumos', 'planillas'),
      ('planilla_detalles', 'planillas'),
      ('funcionarios', 'usuarios'),
      ('perfiles_usuario', 'usuarios'),
      ('usuario_permisos', 'usuarios')
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

-- Ejecutar una vez después de crear el primer usuario en Supabase Auth:
-- insert into public.perfiles_usuario
--   (id, empresa_id, nombre_visible, rol)
-- select
--   'UUID_DEL_USUARIO_AUTH',
--   id,
--   'Administrador Maruxa',
--   'superadmin'
-- from public.empresas
-- where slug = 'maruxa';
