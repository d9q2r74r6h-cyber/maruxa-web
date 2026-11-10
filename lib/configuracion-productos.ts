export type GrupoConfiguracionProducto = 'tipo' | 'unidad';

export type ConfiguracionProducto = {
  id?: string;
  empresa_id?: string;
  grupo: GrupoConfiguracionProducto;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export const configuracionProductosPredeterminada: ConfiguracionProducto[] = [
  { grupo: 'tipo', codigo: 'producto', nombre: 'Producto terminado', orden: 10, activo: true },
  { grupo: 'tipo', codigo: 'ingrediente', nombre: 'Materia prima', orden: 20, activo: true },
  { grupo: 'tipo', codigo: 'envase', nombre: 'Insumo', orden: 30, activo: true },
  { grupo: 'tipo', codigo: 'mano_obra', nombre: 'Mano de obra', orden: 40, activo: true },
  { grupo: 'unidad', codigo: 'UN', nombre: 'UND', orden: 10, activo: true },
  { grupo: 'unidad', codigo: 'GR', nombre: 'GRS', orden: 20, activo: true },
  { grupo: 'unidad', codigo: 'ML', nombre: 'ML', orden: 30, activo: true },
  { grupo: 'unidad', codigo: 'KG', nombre: 'KG', orden: 40, activo: true },
  { grupo: 'unidad', codigo: 'LT', nombre: 'LT', orden: 50, activo: true },
  { grupo: 'unidad', codigo: 'CC', nombre: 'CC', orden: 60, activo: true },
  { grupo: 'unidad', codigo: 'MIN', nombre: 'MIN', orden: 70, activo: true },
];

export function configuracionPorGrupo(
  configuraciones: ConfiguracionProducto[],
  grupo: GrupoConfiguracionProducto
) {
  const encontradas = configuraciones.filter((item) => item.grupo === grupo);
  const fuente = encontradas.length
    ? encontradas
    : configuracionProductosPredeterminada.filter((item) => item.grupo === grupo);
  return [...fuente].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

export function nombreTipoProducto(codigo: string | null | undefined, configuraciones: ConfiguracionProducto[] = []) {
  const tipo = configuracionPorGrupo(configuraciones, 'tipo').find((item) => item.codigo === codigo);
  return tipo?.nombre || (codigo === 'ingrediente' ? 'Materia prima' : codigo === 'envase' ? 'Insumo' : codigo === 'mano_obra' ? 'Mano de obra' : 'Producto terminado');
}
