# Presentaciones configurables

La ficha permite agregar presentaciones con nombre, precio final y disponibilidad. La ficha pública y el catálogo muestran solo opciones activas. El pedido valida el identificador y precio en servidor, guardando el nombre y precio como fotografía del momento de la compra. Los carritos anteriores se aceptan por nombre cuando no incluyen identificador.

## Orden de puesta en producción

1. Aplicar `supabase/migrations/20260923_presentaciones_productos.sql` en Supabase. Añade la columna y migra únicamente tamaños con precio. No elimina campos anteriores ni modifica pedidos históricos. Si se detecta un dato inválido, la transacción revierte completa.
2. Verificar en una copia de prueba un producto con un solo tamaño, otro con varios, uno sin presentaciones y uno con todas desactivadas.
3. Desplegar el código. No desplegar antes de la migración: el catálogo y la API consultan la columna nueva.
4. Comprobar edición y reapertura, catálogo, carrito anterior y pedido con presentación libre. Los pedidos de prueba deben realizarse en el ambiente de pruebas para no enviar notificaciones reales.

Las presentaciones comparten stock y costo del producto principal. No se han añadido inventarios ni recetas por presentación. Los datos anteriores de tamaños se mantienen como compatibilidad; las presentaciones son la fuente de precios en el nuevo flujo.

Validación local: `node --experimental-strip-types --test tests/*.test.ts`; comprobación TypeScript. La migración y la navegación autenticada requieren acceso al entorno de Supabase y al navegador.
