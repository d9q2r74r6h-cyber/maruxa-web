'use client';

import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

type Props = {
  fecha: Date | undefined;
  setFecha: (fecha: Date | undefined) => void;
};

export function CalendarioRetiro({ fecha, setFecha }: Props) {
  const minimo = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
        Retiro con mínimo 24 horas. Domingos no disponibles.
      </p>
    </div>
  );
}