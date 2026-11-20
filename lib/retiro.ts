const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

export function fechaMinimaRetiro(ahora = new Date()) {
  return new Date(ahora.getTime() + MILISEGUNDOS_POR_DIA);
}

export function cumpleAnticipacionRetiro(fecha: Date, hora: string, ahora = new Date()) {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const [horas, minutos] = hora.split(':').map(Number);
  if (horas > 23 || minutos > 59) return false;
  const retiro = new Date(fecha);
  retiro.setHours(horas, minutos, 0, 0);
  return retiro.getTime() - ahora.getTime() >= MILISEGUNDOS_POR_DIA;
}

function partesEnChile(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value || 0);

  return {
    year: valor('year'),
    month: valor('month'),
    day: valor('day'),
    hour: valor('hour'),
    minute: valor('minute'),
  };
}

export function cumpleAnticipacionRetiroEnChile(
  fecha: string,
  hora: string,
  ahora = new Date()
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return false;
  }

  const [year, month, day] = fecha.split('-').map(Number);
  const [hour, minute] = hora.split(':').map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    hour > 23 ||
    minute > 59
  ) {
    return false;
  }

  const actual = partesEnChile(ahora);
  const retiroLocal = Date.UTC(year, month - 1, day, hour, minute);
  const actualLocal = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute
  );

  return retiroLocal - actualLocal >= MILISEGUNDOS_POR_DIA;
}
