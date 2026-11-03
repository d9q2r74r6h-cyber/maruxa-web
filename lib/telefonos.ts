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
