import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalesWhatsapp } from '@/lib/whatsapp-canales';
import { enviarPorWhatsapp } from '@/lib/whatsapp-api';

const PLANTILLA = 'pedidos_catalogo_dia_siguiente';
export const maxDuration = 60;

function crearAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function telefono(valor: string | null | undefined) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return digitos.length === 9 && digitos.startsWith('9') ? `56${digitos}` : digitos;
}

export async function POST(request: Request) {
  const admin = crearAdmin();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!admin || !token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });

  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('empresa_id,activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const canal = obtenerCanalesWhatsapp().find((item) => item.proveedor === '360dialog');
  if (!canal) return NextResponse.json({ error: 'El canal 360dialog no está configurado.' }, { status: 503 });

  const [{ data: clientes }, { data: enviosPrevios }] = await Promise.all([
    admin
      .from('clientes')
      .select('id,razon_social,sigla,telefono')
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true)
      .eq('whatsapp_pedidos_autorizado', true)
      .not('telefono', 'is', null)
      .order('razon_social'),
    admin
      .from('whatsapp_eventos')
      .select('payload,estado')
      .eq('empresa_id', perfil.empresa_id)
      .eq('tipo', 'plantilla_cliente')
      .in('estado', ['aceptado', 'sent', 'delivered', 'read']),
  ]);

  const yaEnviadosIds = new Set(
    (enviosPrevios || [])
      .filter((item: any) => item.payload?.plantilla === PLANTILLA && item.payload?.cliente_id)
      .map((item: any) => String(item.payload.cliente_id))
  );
  const vistos = new Set<string>();
  let yaEnviados = 0;
  let duplicados = 0;
  let invalidos = 0;
  const pendientes = (clientes || []).filter((cliente: any) => {
    if (yaEnviadosIds.has(String(cliente.id))) {
      yaEnviados += 1;
      return false;
    }
    const destino = telefono(cliente.telefono);
    if (!/^569[0-9]{8}$/.test(destino)) {
      invalidos += 1;
      return false;
    }
    if (vistos.has(destino)) {
      duplicados += 1;
      return false;
    }
    vistos.add(destino);
    return true;
  });

  let enviados = 0;
  let errores = 0;
  const detalles: { clienteId: string; error: string }[] = [];

  for (const cliente of pendientes) {
      const destino = telefono(cliente.telefono);
      const nombre = String(cliente.sigla || cliente.razon_social || 'Cliente').trim().split(/\s+/)[0];
      try {
        const payload = {
          messaging_product: 'whatsapp',
          to: destino,
          type: 'template',
          template: {
            name: PLANTILLA,
            language: { code: 'es_CL' },
            components: [
              { type: 'header', parameters: [{ type: 'image', image: { link: 'https://panaderiamaruxa.cl/logo-maruxa-meta.png' } }] },
              { type: 'body', parameters: [{ type: 'text', text: nombre }] },
            ],
          },
        };
        let resultado = await enviarPorWhatsapp(canal, payload);
        for (let intento = 1; intento <= 2 && (resultado.respuesta.status === 429 || resultado.respuesta.status >= 500); intento += 1) {
          await new Promise((resolver) => setTimeout(resolver, intento * 2000));
          resultado = await enviarPorWhatsapp(canal, payload);
        }
        const { respuesta, data, texto } = resultado;
        const messageId = data?.messages?.[0]?.id || null;
        const error = respuesta.ok ? null : `HTTP ${respuesta.status}: ${data?.error?.message || texto || 'Error desconocido'}`;
        await admin.from('whatsapp_eventos').insert({
          empresa_id: perfil.empresa_id,
          message_id: messageId || `campana-error-${crypto.randomUUID()}`,
          telefono: `+${destino}`,
          tipo: 'plantilla_cliente',
          estado: respuesta.ok ? 'aceptado' : 'error',
          observacion: respuesta.ok
            ? `Plantilla ${PLANTILLA} enviada a ${cliente.razon_social}.`
            : error,
          payload: { direccion: 'saliente', origen: 'campana_clientes', cliente_id: cliente.id, plantilla: PLANTILLA },
        });
        if (respuesta.ok) enviados += 1;
        else {
          errores += 1;
          detalles.push({ clienteId: cliente.id, error });
        }
      } catch (errorEnvio) {
        const error = errorEnvio instanceof Error ? errorEnvio.message : 'Error de conexión con 360dialog';
        errores += 1;
        detalles.push({ clienteId: cliente.id, error });
        await admin.from('whatsapp_eventos').insert({
          empresa_id: perfil.empresa_id,
          message_id: `campana-error-${crypto.randomUUID()}`,
          telefono: `+${destino}`,
          tipo: 'plantilla_cliente',
          estado: 'error',
          observacion: error,
          payload: { direccion: 'saliente', origen: 'campana_clientes', cliente_id: cliente.id, plantilla: PLANTILLA },
        });
      }
      await new Promise((resolver) => setTimeout(resolver, 1000));
  }

  return NextResponse.json({ ok: true, enviados, yaEnviados, duplicados, invalidos, errores, detalles });
}
