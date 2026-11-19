'use client';

import { Check, Copy, Landmark } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type CuentaTransferencia = {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  rut_titular: string | null;
  email_notificacion: string | null;
};

export function DatosTransferencia({ referencia }: { referencia?: string } = {}) {
  const [cuenta, setCuenta] = useState<CuentaTransferencia | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let activa = true;

    async function cargarCuenta() {
      try {
        const respuesta = await fetch('/api/transferencia', { cache: 'no-store' });
        const resultado = await respuesta.json().catch(() => ({}));
        if (activa && respuesta.ok) {
          setCuenta((resultado.cuenta || null) as CuentaTransferencia | null);
        }
      } catch {
        // La transferencia es una alternativa informativa: el pedido sigue disponible.
      }
    }

    void cargarCuenta();
    return () => {
      activa = false;
    };
  }, []);

  const textoParaCopiar = useMemo(() => {
    if (!cuenta) return '';
    return [
      'Datos para transferencia Panadería Maruxa',
      `Banco: ${cuenta.banco}`,
      `Tipo de cuenta: ${cuenta.tipo_cuenta}`,
      `Número de cuenta: ${cuenta.numero_cuenta}`,
      `Titular: ${cuenta.titular}`,
      cuenta.rut_titular ? `RUT: ${cuenta.rut_titular}` : null,
      cuenta.email_notificacion ? `Correo para comprobante: ${cuenta.email_notificacion}` : null,
      referencia ? `Referencia: ${referencia}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }, [cuenta, referencia]);

  async function copiarDatos() {
    if (!textoParaCopiar) return;
    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      setCopiado(false);
    }
  }

  if (!cuenta) return null;

  const filas = [
    ['Banco', cuenta.banco],
    ['Tipo de cuenta', cuenta.tipo_cuenta],
    ['N.º de cuenta', cuenta.numero_cuenta],
    ['Titular', cuenta.titular],
    ...(cuenta.rut_titular ? [['RUT', cuenta.rut_titular]] : []),
    ...(cuenta.email_notificacion ? [['Correo para comprobante', cuenta.email_notificacion]] : []),
  ];

  return (
    <section className="rounded-[28px] border border-maruxa-rojo/15 bg-white p-5 shadow-premium sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-maruxa-rojo/10 text-maruxa-rojo">
            <Landmark size={21} />
          </span>
          <div>
            <h2 className="text-xl font-black text-maruxa-chocolate">Pago por transferencia</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-maruxa-cafe/70">
              Puedes transferir el total después de enviar tu solicitud.
              {referencia ? ` Usa ${referencia} como referencia.` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void copiarDatos()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-maruxa-rojo/20 bg-maruxa-crema px-4 py-3 text-sm font-black text-maruxa-rojo transition hover:bg-maruxa-rojo/10"
        >
          {copiado ? <Check size={17} /> : <Copy size={17} />}
          {copiado ? 'Copiado' : 'Copiar datos'}
        </button>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-maruxa-rojo/10 pt-5 text-sm sm:grid-cols-2">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className="text-xs font-black uppercase tracking-wide text-maruxa-cafe/55">{etiqueta}</dt>
            <dd className="mt-1 break-words font-black text-maruxa-chocolate">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
