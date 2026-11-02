function normalizarNombre(valor: string | null | undefined) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

export function correspondeRepartidor(
  nombreFuncionario: string | null | undefined,
  repartidorAsignado: string | null | undefined
) {
  const funcionario = normalizarNombre(nombreFuncionario);
  const repartidor = normalizarNombre(repartidorAsignado);
  if (!funcionario || !repartidor || repartidor === 'panaderia') return false;
  if (funcionario === repartidor) return true;

  const partes = repartidor.split(' ').filter((parte) => parte.length > 2);
  return partes.length >= 2 && partes.every((parte) => funcionario.includes(parte));
}
