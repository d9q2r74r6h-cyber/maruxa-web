import { supabase } from '@/lib/supabase';
import { obtenerEmpresaActual } from '@/lib/empresa';

type TipoMovimientoInventario = 'entrada' | 'salida' | 'ajuste';

export async function registrarMovimientoInventario({
  ingredienteId,
  tipo,
  cantidad,
  motivo,
  referenciaTipo,
  referenciaId,
}: {
  ingredienteId: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  motivo?: string;
  referenciaTipo?: string;
  referenciaId?: string;
}) {
  const empresa = await obtenerEmpresaActual();

  if (!empresa) {
    throw new Error('No se pudo identificar la empresa.');
  }

  const { data: ingrediente, error: errorIngrediente } = await supabase
    .from('ingredientes')
    .select('stock_actual')
    .eq('id', ingredienteId)
    .eq('empresa_id', empresa.id)
    .single();

  if (errorIngrediente) throw errorIngrediente;

  const stockActual = Number(ingrediente?.stock_actual || 0);

  let nuevoStock = stockActual;

  if (tipo === 'entrada') {
    nuevoStock = stockActual + cantidad;
  }

  if (tipo === 'salida') {
    nuevoStock = stockActual - cantidad;
  }

  if (tipo === 'ajuste') {
    nuevoStock = cantidad;
  }

  const { error: errorMovimiento } = await supabase
    .from('movimientos_inventario')
    .insert({
      empresa_id: empresa.id,
      ingrediente_id: ingredienteId,
      tipo,
      cantidad,
      motivo: motivo || null,
      referencia_tipo: referenciaTipo || null,
      referencia_id: referenciaId || null,
    });

  if (errorMovimiento) throw errorMovimiento;

  const { error: errorStock } = await supabase
    .from('ingredientes')
    .update({ stock_actual: nuevoStock })
    .eq('id', ingredienteId)
    .eq('empresa_id', empresa.id);

  if (errorStock) throw errorStock;

  return nuevoStock;
}