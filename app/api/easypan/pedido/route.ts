import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const pedido = await request.json();

    const pedidoEasyPan = {
      origen: 'panaderia-maruxa',
      pedido_id: pedido.id,
      empresa_id: pedido.empresa_id,

      cliente: {
        nombre: pedido.cliente,
        email: pedido.email,
        telefono: pedido.telefono,
      },

      retiro: {
        fecha: pedido.fecha_retiro,
        hora: pedido.hora_retiro,
      },

      productos: pedido.productos?.map((item: any) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        tamano: item.tamano || null,
        subtotal: item.precio * item.cantidad,
      })),

      total: pedido.total,
      observaciones: pedido.observaciones || '',
      estado: pedido.estado,
      creado_en: pedido.created_at,
    };

    console.log('Pedido preparado para EasyPan:', pedidoEasyPan);

    return NextResponse.json({
      ok: true,
      pedido: pedidoEasyPan,
    });
  } catch (error) {
    console.error('Error EasyPan:', error);

    return NextResponse.json(
      { ok: false, error: 'Error enviando pedido a EasyPan' },
      { status: 500 }
    );
  }
}