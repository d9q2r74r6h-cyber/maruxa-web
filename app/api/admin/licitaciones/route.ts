import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Registro = Record<string, any>;

const RUBRO_PREDETERMINADO = [
  'panaderia', 'pasteleria', 'reposteria', 'productos de panaderia',
  'productos de pasteleria', 'pan amasado', 'tortas',
];

const SENALES_DESCUBRIMIENTO = [
  'alimento', 'alimentacion', 'abarrote', 'economato', 'casino', 'colacion',
  'coffee break', 'catering', 'insumo', 'comestible', 'productos alimenticios',
];

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function fecha(valor: unknown) {
  const d = new Date(String(valor || ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasHasta(valor: unknown) {
  const cierre = fecha(valor);
  if (!cierre) return null;
  return Math.ceil((cierre.getTime() - Date.now()) / 86400000);
}

function puntuar(texto: string, palabrasRubro: string[], monto: number, dias: number | null, region: string, regionPreferida: string) {
  const limpio = normalizar(texto);
  let afinidad = 0;
  const coincidencias: string[] = [];
  for (const palabra of palabrasRubro) {
    if (limpio.includes(palabra) && !coincidencias.includes(palabra)) {
      afinidad += 28;
      coincidencias.push(palabra);
    }
  }
  afinidad = Math.min(afinidad, 65);
  const plazo = dias === null ? 3 : dias >= 4 && dias <= 21 ? 15 : dias > 21 ? 10 : dias >= 2 ? 7 : 0;
  const presupuesto = monto >= 500000 && monto <= 50000000 ? 10 : monto > 0 ? 5 : 2;
  const cercania = regionPreferida && normalizar(region).includes(normalizar(regionPreferida)) ? 10 : 0;
  return { puntaje: Math.min(100, afinidad + plazo + presupuesto + cercania), coincidencias };
}

async function mercado(path: string, ticket: string) {
  const separador = path.includes('?') ? '&' : '?';
  const respuesta = await fetch(
    `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json${path}${separador}ticket=${encodeURIComponent(ticket)}`,
    { next: { revalidate: 3600 } }
  );
  const texto = await respuesta.text();
  if (!respuesta.ok) throw new Error(`Mercado Público respondió ${respuesta.status}: ${texto.slice(0, 180)}`);
  const datos = JSON.parse(texto);
  if (datos?.Codigo !== undefined && numero(datos.Codigo) !== 0) {
    throw new Error(datos.Mensaje || 'Mercado Público rechazó la consulta.');
  }
  return datos;
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
  const regionPreferida = url.searchParams.get('region') || '';
  const palabrasConfiguradas = [...new Set(
    (url.searchParams.get('rubros') || '').split(',').map(normalizar).filter((palabra) => palabra.length >= 3)
  )].slice(0, 30);
  const rubro = palabrasConfiguradas.length ? palabrasConfiguradas : RUBRO_PREDETERMINADO;
  try {
    const resumen = await mercado('?estado=publicada', ticket);
    const lista = (resumen?.Listado || []) as Registro[];
    const terminosBusqueda = busqueda.split(/\s+/).filter(Boolean);
    const candidatos = lista
      .filter((item) => {
        const texto = normalizar(`${item.Nombre || ''} ${item.CodigoExterno || ''}`);
        const coincideDescubrimiento = [...rubro, ...SENALES_DESCUBRIMIENTO].some((termino) => texto.includes(termino));
        const coincideBusqueda = !terminosBusqueda.length || terminosBusqueda.every((termino) => texto.includes(termino));
        return coincideDescubrimiento && coincideBusqueda;
      })
      .slice(0, 100);

    const detalles = await Promise.all(
      candidatos.map(async (item) => {
        try {
          const data = await mercado(`?codigo=${encodeURIComponent(item.CodigoExterno)}`, ticket);
          return (data?.Listado?.[0] || item) as Registro;
        } catch {
          return item;
        }
      })
    );

    const licitaciones = detalles.map((item) => {
      const comprador = item.Comprador || {};
      const fechas = item.Fechas || {};
      const items = item.Items?.Listado || [];
      const productos = items.map((x: Registro) => `${x.NombreProducto || ''} ${x.Descripcion || ''}`).join(' ');
      const textoAnalisis = `${item.Nombre || ''} ${item.Descripcion || ''} ${productos}`;
      const monto = numero(item.MontoEstimado);
      const cierre = fechas.FechaCierre || item.FechaCierre;
      const dias = diasHasta(cierre);
      const region = comprador.RegionUnidad || comprador.ComunaUnidad || '';
      const analisis = puntuar(textoAnalisis, rubro, monto, dias, region, regionPreferida);
      const recomendacion =
        analisis.puntaje >= 60 ? 'Muy recomendada' :
        analisis.puntaje >= 40 ? 'Recomendada' :
        analisis.puntaje >= 25 ? 'Revisar' : 'Baja afinidad';
      return {
        codigo: item.CodigoExterno,
        nombre: item.Nombre,
        descripcion: item.Descripcion || '',
        organismo: comprador.NombreOrganismo || item.NombreOrganismo || '',
        region,
        fecha_cierre: cierre || null,
        dias_restantes: dias,
        monto_estimado: monto || null,
        moneda: item.Moneda || 'CLP',
        estado: item.Estado || item.CodigoEstado,
        productos: items.slice(0, 8).map((x: Registro) => x.NombreProducto || x.Descripcion).filter(Boolean),
        puntaje: analisis.puntaje,
        coincidencias: analisis.coincidencias,
        recomendacion,
        url: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${encodeURIComponent(item.CodigoExterno)}`,
      };
    }).filter((item) => item.codigo && item.coincidencias.length > 0)
      .sort((a, b) => b.puntaje - a.puntaje || (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999));

    return NextResponse.json({
      actualizado_en: new Date().toISOString(),
      total_publicadas: numero(resumen?.Cantidad),
      encontradas: licitaciones.length,
      licitaciones,
      palabras_clave: rubro,
      criterio: 'Coincidencia obligatoria con el rubro configurado, plazo disponible, monto y cercanía regional.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible consultar Mercado Público.' },
      { status: 502 }
    );
  }
}
