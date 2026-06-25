import { supabase } from '@/lib/supabase';

export async function registrarAuditoria({
  modulo,
  accion,
  tabla,
  registroId,
  descripcion,
  datosAnteriores,
  datosNuevos,
}: {
  modulo: string;
  accion: string;
  tabla?: string;
  registroId?: string | number;
  descripcion?: string;
  datosAnteriores?: unknown;
  datosNuevos?: unknown;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: perfil } = await supabase
    .from('perfiles_usuario')
    .select('empresa_id, funcionario_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil) return;

  await supabase.from('auditoria_erp').insert({
    empresa_id: perfil.empresa_id,
    usuario_id: user.id,
    funcionario_id: perfil.funcionario_id,
    modulo,
    accion,
    tabla: tabla || null,
    registro_id: registroId == null ? null : String(registroId),
    descripcion: descripcion || null,
    datos_anteriores: datosAnteriores || null,
    datos_nuevos: datosNuevos || null,
    user_agent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });
}
