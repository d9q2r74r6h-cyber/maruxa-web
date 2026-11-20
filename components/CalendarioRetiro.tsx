'use client';

import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { fechaMinimaRetiro } from '@/lib/retiro';

type Props = {
  fecha: Date | undefined;
  setFecha: (fecha: Date | undefined) => void;
  requiereAnticipacion?: boolean;
};

export function CalendarioRetiro({
  fecha,
  setFecha,
  requiereAnticipacion = false,
}: Props) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const minimo = requiereAnticipacion ? fechaMinimaRetiro() : hoy;

  return (
    <div className="rounded-[30px] bg-white p-5 shadow-premium">
      <p className="mb-4 text-sm font-black uppercase tracking-widest text-maruxa-rojo">
        Fecha de retiro
      </p>

      <DayPicker
        mode="single"
        selected={fecha}
        onSelect={setFecha}
        locale={es}
        disabled={[
          { before: minimo },
          { dayOfWeek: [0] },
        ]}
        className="maruxa-calendar"
      />

      <p className="mt-4 text-sm font-bold text-maruxa-cafe/70">
        {requiereAnticipacion
          ? 'Las tortas requieren mínimo 24 horas. Domingos no disponibles.'
          : 'Puedes elegir retiro desde hoy. Domingos no disponibles.'}
      </p>
    </div>
  );
}
