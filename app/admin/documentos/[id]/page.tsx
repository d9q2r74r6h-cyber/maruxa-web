'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Detalle = {
  id: string;
  numero_linea: number;
  codigo: string | null;
  nombre: string;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number;
  descuento_monto: number;
  exento: boolean;
  monto_item: number;
};

type Documento = {
  id: string;
  tipo_dte: number;
  folio: number | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  forma_pago: string | null;
  estado: string;
  rut_receptor: string;
  razon_social_receptor: string;
  giro_receptor: string | null;
  direccion_receptor: string | null;
  comuna_receptor: string | null;
  ciudad_receptor: string | null;
  monto_exento: number;
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  observaciones: string | null;
  estado_sii: string | null;
  glosa_sii: string | null;
  documento_tributario_detalles: Detalle[];
};

const tipos: Record<number, string> = {
  33: 'Factura electrónica',
  34: 'Factura exenta electrónica',
  52: 'Guía de despacho electrónica',
  56: 'Nota de débito electrónica',
  61: 'Nota de crédito electrónica',
};

export default function DocumentoDetallePage() {
  const params = useParams<{ id: string }>();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from('documentos_tributarios')
        .select(`
          *,
          documento_tributario_detalles (
            id,
            numero_linea,
            codigo,
            nombre,
            cantidad,
            unidad,
            precio_unitario,
            descuento_monto,
            exento,
            monto_item
          )
        `)
        .eq('id', params.id)
        .maybeSingle();

      if (error) alert(error.message);
      else if (data) {
        setDocumento({
          ...data,
          documento_tributario_detalles: (
            data.documento_tributario_detalles || []
          ).sort(
            (a: Detalle, b: Detalle) => a.numero_linea - b.numero_linea
          ),
        } as Documento);
      }
      setCargando(false);
    }

    cargar();
  }, [params.id]);

  if (cargando) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-7 w-7 animate-spin text-[#A51F2B]" />
      </div>
    );
  }

  if (!documento) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 font-black text-red-800">
        Documento no encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 border-b border-[#4B2818]/15 pb-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
            {tipos[documento.tipo_dte] || `DTE ${documento.tipo_dte}`}
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
            Folio {documento.folio || 'pendiente'}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
            Emitido el {documento.fecha_emision}
          </p>
        </div>
        <span className="rounded-full bg-[#FFF3DF] px-3 py-1 text-xs font-black uppercase text-[#A51F2B]">
          {documento.estado_sii || documento.estado}
        </span>
      </header>

      <section className="grid gap-4 rounded-lg border border-[#4B2818]/15 bg-white p-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase text-[#4B2818]/50">
            Receptor
          </p>
          <h2 className="mt-1 text-xl font-black text-[#2A1710]">
            {documento.razon_social_receptor}
          </h2>
          <p className="font-bold text-[#A51F2B]">
            {documento.rut_receptor}
          </p>
          <p className="mt-2 text-sm font-semibold text-[#4B2818]/65">
            {documento.giro_receptor || 'Sin giro'}
          </p>
        </div>
        <div className="md:text-right">
          <p className="text-xs font-black uppercase text-[#4B2818]/50">
            Dirección
          </p>
          <p className="mt-1 font-bold text-[#2A1710]">
            {documento.direccion_receptor || '-'}
          </p>
          <p className="text-sm font-semibold text-[#4B2818]/65">
            {[documento.comuna_receptor, documento.ciudad_receptor]
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <FileText className="h-5 w-5 text-[#A51F2B]" />
          <h2 className="font-black text-[#2A1710]">Detalle</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[#4B2818]/10 text-xs uppercase text-[#4B2818]/60">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-3 py-3 text-left">Producto</th>
                <th className="px-3 py-3 text-right">Cantidad</th>
                <th className="px-3 py-3 text-right">Precio neto</th>
                <th className="px-3 py-3 text-right">Descuento</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4B2818]/10">
              {documento.documento_tributario_detalles.map((detalle) => (
                <tr key={detalle.id}>
                  <td className="px-4 py-3 font-bold">
                    {detalle.codigo || '-'}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black">{detalle.nombre}</p>
                    <p className="text-[10px] font-bold uppercase text-[#4B2818]/50">
                      {detalle.exento ? 'Exento' : 'Afecto'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {detalle.cantidad} {detalle.unidad || ''}
                  </td>
                  <td className="px-3 py-3 text-right">
                    ${Math.round(detalle.precio_unitario).toLocaleString('es-CL')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    ${Math.round(detalle.descuento_monto).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right font-black">
                    ${Math.round(detalle.monto_item).toLocaleString('es-CL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ml-auto w-full max-w-sm rounded-lg border border-[#4B2818]/15 bg-white p-5">
        {[
          ['Neto', documento.monto_neto],
          ['Exento', documento.monto_exento],
          ['IVA', documento.monto_iva],
          ['Total', documento.monto_total],
        ].map(([etiqueta, valor]) => (
          <div
            key={etiqueta}
            className="flex justify-between border-b border-[#4B2818]/10 py-2 last:border-0"
          >
            <span className="font-bold text-[#4B2818]/65">{etiqueta}</span>
            <strong>${Number(valor).toLocaleString('es-CL')}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}
