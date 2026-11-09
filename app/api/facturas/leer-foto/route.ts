import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { FacturaLectura, LineaFactura } from '@/lib/importar-factura';

export const runtime = 'nodejs';

const MAX_FOTOS = 5;
const MAX_BYTES_POR_FOTO = 12_000_000;
const FORMATOS_ADMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

const esquemaFactura = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tipo: { type: 'string', enum: ['33', '34'] },
    folio: { type: 'string' },
    fecha: { type: 'string' },
    rutEmisor: { type: 'string' },
    proveedor: { type: 'string' },
    rutReceptor: { type: 'string' },
    neto: { type: 'number' },
    exento: { type: 'number' },
    iva: { type: 'number' },
    otros: { type: 'number' },
    total: { type: 'number' },
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nombre: { type: 'string' },
          codigo: { type: 'string' },
          unidad: { type: 'string' },
          cantidad: { type: 'number' },
          montoNeto: { type: 'number' },
          exento: { type: 'boolean' },
        },
        required: ['nombre', 'codigo', 'unidad', 'cantidad', 'montoNeto', 'exento'],
      },
    },
    avisos: { type: 'array', items: { type: 'string' } },
  },
  required: ['tipo', 'folio', 'fecha', 'rutEmisor', 'proveedor', 'rutReceptor', 'neto', 'exento', 'iva', 'otros', 'total', 'lineas', 'avisos'],
} as const;

const instrucciones = `Extrae una factura de compra chilena desde las fotos entregadas. Devuelve una sola factura y todas sus líneas de detalle visibles.

Reglas obligatorias:
- Usa tipo "33" para factura afecta y "34" para factura exenta/no afecta. Si el tipo no es legible, usa "33" y adviértelo en avisos.
- Entrega fecha como YYYY-MM-DD. No inventes datos: usa cadena vacía, 0 o una advertencia cuando algo no se pueda leer.
- RUT, folio, razón social, cantidades, códigos, unidades, precios y montos deben venir de la foto. Normaliza montos a números CLP sin símbolo, puntos ni separadores.
- montoNeto de cada línea es el total neto de la línea, no el precio unitario. Considera descuentos por línea cuando sean visibles.
- Separa neto afecto, exento, IVA, otros y total de la cabecera. "otros" puede ser negativo por descuentos o positivo por recargos.
- Incluye todas las líneas visibles, incluso las exentas. No agrupes productos diferentes.
- No agregues explicaciones fuera del JSON.`;

type FacturaVision = Omit<FacturaLectura, 'origen' | 'original' | 'lineas'> & {
  lineas: Omit<LineaFactura, 'productoId'>[];
};

const comoTexto = (valor: unknown) => typeof valor === 'string' ? valor.trim() : '';
const comoNumero = (valor: unknown) => typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
const esArchivo = (valor: FormDataEntryValue): valor is File => typeof valor !== 'string' && typeof valor.arrayBuffer === 'function';

function facturaSegura(datos: FacturaVision): FacturaLectura {
  const lineas = Array.isArray(datos.lineas) ? datos.lineas.slice(0, 200).map((linea): LineaFactura => ({
    nombre: comoTexto(linea?.nombre),
    codigo: comoTexto(linea?.codigo),
    unidad: comoTexto(linea?.unidad),
    cantidad: comoNumero(linea?.cantidad),
    montoNeto: comoNumero(linea?.montoNeto),
    exento: Boolean(linea?.exento),
    productoId: '',
  })) : [];
  const avisos = Array.isArray(datos.avisos)
    ? datos.avisos.filter((aviso): aviso is string => typeof aviso === 'string').map(aviso => aviso.trim()).filter(Boolean).slice(0, 20)
    : [];

  return {
    origen: 'foto',
    tipo: datos.tipo === '34' ? '34' : '33',
    folio: comoTexto(datos.folio).replace(/\D/g, ''),
    fecha: comoTexto(datos.fecha),
    rutEmisor: comoTexto(datos.rutEmisor),
    proveedor: comoTexto(datos.proveedor),
    rutReceptor: comoTexto(datos.rutReceptor),
    neto: comoNumero(datos.neto),
    exento: comoNumero(datos.exento),
    iva: comoNumero(datos.iva),
    otros: comoNumero(datos.otros),
    total: comoNumero(datos.total),
    lineas,
    avisos: ['Lectura visual asistida: confirma los datos contra el documento antes de cargar costos.', ...avisos],
    original: 'Lectura visual de foto. La imagen no se conserva en la aplicación.',
  };
}

function textoDeRespuesta(respuesta: unknown): string {
  if (!respuesta || typeof respuesta !== 'object') return '';
  const datos = respuesta as { output_text?: unknown; output?: unknown[] };
  if (typeof datos.output_text === 'string') return datos.output_text;
  for (const salida of datos.output || []) {
    if (!salida || typeof salida !== 'object') continue;
    const contenido = (salida as { content?: unknown[] }).content;
    for (const parte of contenido || []) {
      if (parte && typeof parte === 'object' && typeof (parte as { text?: unknown }).text === 'string') return (parte as { text: string }).text;
    }
  }
  return '';
}

function detalleErrorOpenAI(respuesta: unknown): { codigo: string; mensaje: string } {
  const error = respuesta && typeof respuesta === 'object' ? (respuesta as { error?: unknown }).error : null;
  if (!error || typeof error !== 'object') return { codigo: '', mensaje: '' };
  const datos = error as { code?: unknown; message?: unknown };
  return {
    codigo: typeof datos.code === 'string' ? datos.code : '',
    mensaje: typeof datos.message === 'string' ? datos.message.slice(0, 240) : '',
  };
}

function mensajeErrorOpenAI(estado: number, detalle: { codigo: string; mensaje: string }): string {
  if (estado === 401) return 'OpenAI rechazó la clave configurada. Revisa OPENAI_API_KEY en Vercel.';
  if (estado === 429) return 'OpenAI no tiene saldo disponible o alcanzó su límite. Revisa la facturación de la cuenta de API.';
  if (estado === 400 || estado === 404) return `OpenAI rechazó la configuración del lector${detalle.mensaje ? `: ${detalle.mensaje}` : '.'}`;
  return `El lector visual fue rechazado por OpenAI (${estado})${detalle.codigo ? `: ${detalle.codigo}` : '.'}`;
}

async function pedirLecturaVisual(imagenes: { type: string; image_url: string; detail: string }[]) {
  const modelos = process.env.OPENAI_VISION_MODEL ? [process.env.OPENAI_VISION_MODEL] : ['gpt-6.1-sol', 'gpt-4o'];
  let ultimaRespuesta: Response | null = null;
  let ultimosDatos: unknown = null;

  for (const modelo of modelos) {
    const respuesta = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        store: false,
        input: [{ role: 'user', content: [{ type: 'input_text', text: instrucciones }, ...imagenes] }],
        text: { format: { type: 'json_schema', name: 'factura_compra_chile', strict: true, schema: esquemaFactura } },
      }),
    });
    const datos: unknown = await respuesta.json().catch(() => null);
    if (respuesta.ok || process.env.OPENAI_VISION_MODEL || ![400, 404].includes(respuesta.status)) return { respuesta, datos };
    ultimaRespuesta = respuesta;
    ultimosDatos = datos;
  }

  return { respuesta: ultimaRespuesta!, datos: ultimosDatos };
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  if (!url || !serviceRoleKey) return NextResponse.json({ error: 'No se pudo validar la sesión en el servidor.' }, { status: 503 });

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: autenticacion } = await admin.auth.getUser(token);
  if (!autenticacion.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { data: perfil } = await admin
    .from('perfiles_usuario')
    .select('activo')
    .eq('id', autenticacion.user.id)
    .maybeSingle();
  if (!perfil?.activo) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'La lectura visual aún no está configurada. Falta la clave segura de OpenAI en el servidor.' }, { status: 503 });

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudieron recibir las fotos.' }, { status: 400 });
  }

  const fotos = formulario.getAll('fotos').filter(esArchivo);
  if (!fotos.length || fotos.length > MAX_FOTOS) return NextResponse.json({ error: `Selecciona entre 1 y ${MAX_FOTOS} fotos.` }, { status: 400 });
  if (fotos.some(foto => !FORMATOS_ADMITIDOS.has(foto.type) || foto.size <= 0 || foto.size > MAX_BYTES_POR_FOTO)) {
    return NextResponse.json({ error: 'Cada foto debe ser JPG, PNG o WebP y pesar como máximo 12 MB.' }, { status: 400 });
  }

  const imagenes = await Promise.all(fotos.map(async foto => ({
    type: 'input_image',
    image_url: `data:${foto.type};base64,${Buffer.from(await foto.arrayBuffer()).toString('base64')}`,
    detail: 'high',
  })));

  let lectura: { respuesta: Response; datos: unknown };
  try {
    lectura = await pedirLecturaVisual(imagenes);
  } catch {
    return NextResponse.json({ error: 'No fue posible contactar el lector visual. Inténtalo nuevamente.' }, { status: 502 });
  }

  if (!lectura.respuesta.ok) {
    const detalle = detalleErrorOpenAI(lectura.datos);
    console.error('Lector visual de factura rechazado por OpenAI.', { estado: lectura.respuesta.status, codigo: detalle.codigo });
    return NextResponse.json({ error: mensajeErrorOpenAI(lectura.respuesta.status, detalle) }, { status: 502 });
  }

  const salida = textoDeRespuesta(lectura.datos);
  if (!salida) return NextResponse.json({ error: 'El lector visual no devolvió datos utilizables. Prueba otra foto.' }, { status: 422 });

  try {
    return NextResponse.json(facturaSegura(JSON.parse(salida) as FacturaVision));
  } catch {
    return NextResponse.json({ error: 'No se pudo interpretar la respuesta de la foto. Inténtalo nuevamente.' }, { status: 422 });
  }
}
