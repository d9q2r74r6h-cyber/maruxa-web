export type VentaFepan = { codigo: string; categoria: string; descripcion: string; cantidad: number; total: number; grupo: 'Pan' | 'Cecinas' | 'Pastelería' };

const grupos: Record<string, VentaFepan['grupo']> = {
  Z01: 'Pan', Z02: 'Pan', Z03: 'Pan', Z07: 'Pan', Z08: 'Pan',
  Z04: 'Cecinas', Z05: 'Pastelería',
};

export function leerVentasFepan(filas: unknown[][]): VentaFepan[] {
  const cabecera = filas.findIndex((fila) => String(fila[0] || '').toLowerCase().includes('categoria') && String(fila[3] || '').toLowerCase().includes('cantidad') && String(fila[4] || '').toLowerCase().includes('total'));
  if (cabecera < 0) throw new Error('El archivo no corresponde al reporte Ventas de Productos de FEPAN.');
  const resultados: VentaFepan[] = [];
  for (const fila of filas.slice(cabecera + 1)) {
    const codigo = String(fila[1] || '').trim().toUpperCase();
    const grupo = grupos[codigo];
    if (!grupo) continue;
    const cantidad = Number(fila[3]);
    const total = Number(fila[4]);
    if (fila[3] == null || fila[4] == null || !Number.isFinite(cantidad) || !Number.isFinite(total)) throw new Error(`Revisa los valores de la categoría ${codigo}.`);
    resultados.push({ codigo, categoria: String(fila[0] || ''), descripcion: String(fila[2] || ''), cantidad, total, grupo });
  }
  if (!resultados.length) throw new Error('No se encontraron categorías de pan, cecinas o pastelería.');
  return resultados;
}
