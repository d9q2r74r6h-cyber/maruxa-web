insert into public.modulos_erp (codigo, nombre, grupo, ruta, orden)
values ('whatsapp', 'Mensajes WhatsApp', 'Comercial', '/admin/whatsapp', 21)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  grupo = excluded.grupo,
  ruta = excluded.ruta,
  orden = excluded.orden,
  activo = true;

insert into public.usuario_permisos (
  usuario_id,
  modulo_codigo,
  puede_ver,
  puede_crear,
  puede_editar,
  puede_eliminar
)
select
  perfil.id,
  'whatsapp',
  true,
  true,
  true,
  false
from public.perfiles_usuario perfil
where perfil.rol in ('superadmin', 'administrador')
on conflict (usuario_id, modulo_codigo) do update set
  puede_ver = excluded.puede_ver,
  puede_crear = excluded.puede_crear,
  puede_editar = excluded.puede_editar,
  puede_eliminar = excluded.puede_eliminar;

insert into public.usuario_permisos (
  usuario_id,
  modulo_codigo,
  puede_ver,
  puede_crear,
  puede_editar,
  puede_eliminar
)
select
  permiso.usuario_id,
  'whatsapp',
  permiso.puede_ver,
  permiso.puede_crear,
  permiso.puede_editar,
  false
from public.usuario_permisos permiso
where permiso.modulo_codigo = 'pedidos'
  and permiso.puede_ver = true
on conflict (usuario_id, modulo_codigo) do nothing;
