export function cumpleAnticipacionRetiro(fecha: Date, hora: string, ahora = new Date()) {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const [horas, minutos] = hora.split(':').map(Number);
  if (horas > 23 || minutos > 59) return false;
  const retiro = new Date(fecha);
  retiro.setHours(horas, minutos, 0, 0);
  return retiro.getTime() - ahora.getTime() >= 24 * 60 * 60 * 1000;
}
