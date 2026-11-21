export function formatearTelefonoChile(valor: string | null | undefined) {
  const original = String(valor || '').trim();
  if (!original) return '';
  if (original.startsWith('+') && !original.replace(/\s/g, '').startsWith('+56')) return original;

  let digitos = original.replace(/\D/g, '');
  if (digitos.startsWith('56')) digitos = digitos.slice(2);
  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  if (digitos.length === 8) digitos = `9${digitos}`;
  if (digitos.length !== 9) return original;

  return `+56 ${digitos.slice(0, 1)} ${digitos.slice(1, 5)} ${digitos.slice(5, 9)}`;
}

/**
 * Identificador comparable para teléfonos chilenos. Permite relacionar, por
 * ejemplo, "9 1234 5678" con el número que entrega WhatsApp: "+56 9 1234 5678".
 * Los teléfonos de otros países se conservan por completo para no crear
 * coincidencias accidentales.
 */
export function claveTelefono(valor: string | null | undefined) {
  let digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return '';

  if (digitos.startsWith('56')) digitos = digitos.slice(2);
  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  if (digitos.length === 8) digitos = `9${digitos}`;

  return digitos.length === 9 && digitos.startsWith('9')
    ? digitos
    : String(valor || '').replace(/\D/g, '');
}

export function telefonosCoinciden(
  primero: string | null | undefined,
  segundo: string | null | undefined
) {
  const clavePrimero = claveTelefono(primero);
  const claveSegundo = claveTelefono(segundo);
  return Boolean(clavePrimero && clavePrimero === claveSegundo);
}
