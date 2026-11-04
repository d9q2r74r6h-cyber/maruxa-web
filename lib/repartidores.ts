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

type FuncionarioConCargos = {
  cargo?: string | null;
  funcionario_cargos?: Array<{
    cargos_empresa?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null;
  }> | null;
};

export function funcionarioEsRepartidor(funcionario: FuncionarioConCargos) {
  const cargos = [funcionario.cargo || ''];
  for (const relacion of funcionario.funcionario_cargos || []) {
    const relacionados = Array.isArray(relacion.cargos_empresa)
      ? relacion.cargos_empresa
      : relacion.cargos_empresa
        ? [relacion.cargos_empresa]
        : [];
    cargos.push(...relacionados.map((cargo) => cargo.nombre || ''));
  }
  return cargos.some((cargo) => normalizarNombre(cargo).includes('repartidor'));
}

export function debeRecibirPedido(
  funcionario: FuncionarioConCargos & {
    nombre_completo?: string | null;
    recibe_avisos_pedidos_whatsapp?: boolean | null;
  },
  repartidorAsignado: string | null | undefined
) {
  const esAsignado = correspondeRepartidor(
    funcionario.nombre_completo,
    repartidorAsignado
  );
  if (funcionarioEsRepartidor(funcionario)) return esAsignado;
  return Boolean(funcionario.recibe_avisos_pedidos_whatsapp);
}
