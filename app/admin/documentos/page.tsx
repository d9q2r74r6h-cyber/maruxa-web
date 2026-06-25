'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminSession } from '@/components/AdminSession';

type Documento = {
  id: string;
  tipo_dte: number;
  folio: number | null;
  fecha_emision: string;
  razon_social_receptor: string;
  rut_receptor: string;
  monto_total: number;
  estado: string;
  estado_sii: string | null;
};

type ConfiguracionDte = {
  ambiente: string;
  certificadoConfigurado: boolean;
  claveCertificadoConfigurada: boolean;
  rutEmisorConfigurado: boolean;
  resolucionConfigurada: boolean;
  listoParaFirmar: boolean;
};

const nombresDte: Record<number, string> = {
  33: 'Factura electrónica',
  34: 'Factura exenta electrónica',
  52: 'Guía de despacho electrónica',
  56: 'Nota de débito electrónica',
  61: 'Nota de crédito electrónica',
};

export default function DocumentosPage() {
  const { perfil } = useAdminSession();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionDte | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!perfil) return;
      const [respuestaDocumentos, respuestaConfiguracion] = await Promise.all([
        supabase
          .from('documentos_tributarios')
          .select('id, tipo_dte, folio, fecha_emision, razon_social_receptor, rut_receptor, monto_total, estado, estado_sii')
          .eq('empresa_id', perfil.empresa_id)
          .order('fecha_emision', { ascending: false })
          .limit(100),
        fetch('/api/dte/configuracion').then((respuesta) => respuesta.json()),
      ]);

      if (!respuestaDocumentos.error) {
        setDocumentos((respuestaDocumentos.data || []) as Documento[]);
      }
      setConfiguracion(respuestaConfiguracion as ConfiguracionDte);
      setCargando(false);
    }

    cargar();
  }, [perfil]);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#A51F2B]">
            Ventas y despacho
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#2A1710]">
            Documentos tributarios
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#4B2818]/65">
            Facturas, guías, notas de crédito y seguimiento ante el SII.
          </p>
        </div>
        <Link
          href="/admin/documentos/nuevo"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#A51F2B] px-4 text-sm font-black text-white"
        >
          <FilePlus2 className="h-4 w-4" />
          Nuevo documento
        </Link>
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
        La emisión electrónica quedará habilitada después de cargar CAF,
        certificado digital y completar la certificación ante el SII.
      </div>

      {configuracion && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Ambiente', configuracion.ambiente, true],
            ['Certificado', 'PFX', configuracion.certificadoConfigurado],
            ['Clave', 'Certificado', configuracion.claveCertificadoConfigurada],
            ['RUT emisor', 'Configurado', configuracion.rutEmisorConfigurado],
            ['Resolución', 'SII', configuracion.resolucionConfigurada],
          ].map(([titulo, detalle, listo]) => (
            <div
              key={String(titulo)}
              className={`rounded-lg border p-3 ${
                listo
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              <p className="text-xs font-black uppercase">{titulo}</p>
              <p className="mt-1 text-sm font-bold">{detalle}</p>
            </div>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-[#4B2818]/15 bg-white">
        <div className="flex items-center gap-2 border-b border-[#4B2818]/10 bg-[#FFF3DF] px-5 py-4">
          <FileText className="h-5 w-5 text-[#A51F2B]" />
          <h2 className="font-black text-[#2A1710]">Documentos registrados</h2>
        </div>
        {cargando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#A51F2B]" />
          </div>
        ) : documentos.length === 0 ? (
          <p className="p-10 text-center font-semibold text-[#4B2818]/55">
            No hay documentos tributarios registrados.
          </p>
        ) : (
          <div className="divide-y divide-[#4B2818]/10">
            {documentos.map((documento) => (
              <Link
                key={documento.id}
                href={`/admin/documentos/${documento.id}`}
                className="grid gap-2 px-5 py-4 md:grid-cols-[190px_1fr_150px_130px]"
              >
                <div>
                  <p className="font-black text-[#2A1710]">
                    {nombresDte[documento.tipo_dte] || `DTE ${documento.tipo_dte}`}
                  </p>
                  <p className="text-xs font-bold text-[#A51F2B]">
                    Folio {documento.folio || 'pendiente'}
                  </p>
                </div>
                <div>
                  <p className="font-black">{documento.razon_social_receptor}</p>
                  <p className="text-xs font-semibold text-[#4B2818]/60">
                    {documento.rut_receptor} · {documento.fecha_emision}
                  </p>
                </div>
                <p className="font-black md:text-right">
                  ${Math.round(documento.monto_total).toLocaleString('es-CL')}
                </p>
                <div className="md:text-right">
                  <span className="rounded-full bg-[#FFF3DF] px-2 py-1 text-[10px] font-black uppercase text-[#A51F2B]">
                    {documento.estado_sii || documento.estado}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
