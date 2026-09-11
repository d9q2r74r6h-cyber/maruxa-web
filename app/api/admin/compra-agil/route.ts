import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Registro = Record<string, any>;

const RUBRO_PREDETERMINADO = [
  'panaderia', 'pasteleria', 'reposteria', 'productos de panaderia',
  'productos de pasteleria', 'pan amasado', 'tortas',
];

const REGION_CODIGO: Record<string, string> = {
  'Tarapaca': '1', 'Antofagasta': '2', 'Atacama': '3', 'Coquimbo': '4',
  'Valparaiso': '5', "O'Higgins": '6', 'Maule': '7', 'Biobio': '8',
  'Araucania': '9', 'Los Lagos': '10', 'Aysen': '11', 'Magallanes': '12',
  'Metropolitana': '13', 'Los Rios': '14', 'Arica y Parinacota': '15', 'Nuble': '16',
};

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function diasHasta(valor: unknown) {
  const cierre = new Date(String(valor || ''));
  if (Number.isNaN(cierre.getTime())) return null;
  return Math.ceil((cierre.getTime() - Date.now()) / 86400000);
}

function regionCodigo(nombre: string) {
  const buscada = normalizar(nombre);
  return Object.entries(REGION_CODIGO).find(([region]) => normalizar(region) === buscada)?.[1] || '';
}

async function consultar(path: string, ticket: string) {
  const respuesta = await fetch(`https://api2.mercadopublico.cl${path}`, {
    headers: { ticket },
    next: { revalidate: 900 },
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || datos?.success !== 'OK') {
    const mensaje = datos?.errors?.[0]?.mensaje || `Compra Ágil respondió ${respuesta.status}.`;
    throw new Error(mensaje);
  }
  return datos.payload;
}

export async function GET(request: Request) {
  const ticket = process.env.MERCADO_PUBLICO_TICKET;
  if (!ticket) {
    return NextResponse.json(
      { error: 'Falta configurar MERCADO_PUBLICO_TICKET en el servidor.', requiere_ticket: true },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const busqueda = normalizar(url.searchParams.get('q'));
  const region = url.searchParams.get('region') || '';
  const palabrasConfiguradas = [...new Set(
    (url.searchParams.get('rubros') || '').split(',').map(normalizar).filter((palabra) => palabra.length >= 3)
  )].slice(0, 30);
  const rubro = palabrasConfiguradas.length ? palabrasConfiguradas : RUBRO_PREDETERMINADO;
  const codigoRegion = regionCodigo(region);

  try {
    const consultas = await Promise.all(
      rubro.map(async (palabra) => {
        const params = new URLSearchParams({
          estado: 'publicada',
          q: palabra,
          tamano_pagina: '50',
          numero_pagina: '1',
          ordenar_por: 'FechaPublicacion',
        });
        if (codigoRegion) params.set('region', codigoRegion);
        const payload = await consultar(`/v2/compra-agil?${params}`, ticket);
        return { palabra, items: (payload?.items || []) as Registro[] };
      })
    );

    const unicas = new Map<string, Registro & { palabras_encontradas: string[] }>();
    for (const consulta of consultas) {
      for (const item of consulta.items) {
        if (!item.codigo) continue;
        const existente = unicas.get(item.codigo);
        if (existente) {
          if (!existente.palabras_encontradas.includes(consulta.palabra)) existente.palabras_encontradas.push(consulta.palabra);
        } else {
          unicas.set(item.codigo, { ...item, palabras_encontradas: [consulta.palabra] });
        }
      }
    }

    let candidatos = Array.from(unicas.values());
    if (busqueda) {
      const terminos = busqueda.split(/\s+/).filter(Boolean);
      candidatos = candidatos.filter((item) =>
        terminos.every((termino) => normalizar(`${item.nombre || ''} ${item.descripcion || ''}`).includes(termino))
      );
    }

    const conDetalle = candidatos.slice(0, 50);

    const oportunidades = conDetalle.map((item) => {
      const cierre = item.fechas?.fecha_cierre;
      const dias = diasHasta(cierre);
      const monto = numero(item.presupuesto?.monto_disponible_clp || item.presupuesto?.monto_disponible || item.montos?.monto_disponible_clp);
      const ofertas = numero(item.resumen?.total_ofertas_recibidas);
      const texto = normalizar(`${item.nombre || ''} ${item.descripcion || ''} ${(item.productos_solicitados || []).map((p: Registro) => `${p.nombre || ''} ${p.descripcion || ''}`).join(' ')}`);
      const coincidencias = rubro.filter((palabra) => texto.includes(palabra));
      for (const palabra of item.palabras_encontradas || []) {
        if (!coincidencias.includes(palabra)) coincidencias.push(palabra);
      }
      const afinidad = Math.min(60, coincidencias.length * 28);
      const plazo = dias !== null && dias >= 2 && dias <= 12 ? 15 : dias !== null && dias > 12 ? 10 : 0;
      const presupuesto = monto >= 100000 && monto <= 7000000 ? 10 : monto > 0 ? 5 : 2;
      const competencia = ofertas <= 2 ? 15 : ofertas <= 5 ? 10 : ofertas <= 10 ? 5 : 0;
      const puntaje = Math.min(100, afinidad + plazo + presupuesto + competencia);
      return {
        codigo: item.codigo,
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        organismo: item.institucion?.organismo_comprador || '',
        region: item.institucion?.nombre_region || '',
        fecha_cierre: cierre || null,
        dias_restantes: dias,
        monto_estimado: monto || null,
        moneda: item.presupuesto?.moneda || item.montos?.moneda || 'CLP',
        puntaje,
        coincidencias,
        recomendacion: puntaje >= 70 ? 'Muy recomendada' : puntaje >= 50 ? 'Recomendada' : 'Revisar',
        ofertas_recibidas: ofertas,
        convocatoria: item.convocatoria?.descripcion || '',
        direccion_entrega: item.entrega?.direccion_entrega || '',
        plazo_entrega_dias: item.entrega?.plazo_entrega_dias ?? null,
        url: `https://buscador.mercadopublico.cl/ficha?code=${encodeURIComponent(item.codigo)}`,
      };
    }).sort((a, b) => b.puntaje - a.puntaje || a.ofertas_recibidas - b.ofertas_recibidas);

    return NextResponse.json({
      actualizado_en: new Date().toISOString(),
      encontradas: oportunidades.length,
      oportunidades,
      palabras_clave: rubro,
      fuente: 'Dirección ChileCompra · API Compra Ágil V2',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible consultar Compra Ágil.' },
      { status: 502 }
    );
  }
}
