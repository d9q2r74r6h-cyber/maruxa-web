# Consolidación del producto

## Objetivo

Convertir el sistema actual en un producto operativamente confiable antes de venderlo como plataforma multiempresa. La prioridad es evitar errores de dinero, acceso y operación; las funciones nuevas quedan después.

## Estado comercial honesto

El sistema sirve hoy como ERP interno de Panadería Maruxa y como piloto controlado. Todavía no debe venderse como SaaS general sin completar los cortes siguientes.

## Corte 1: pedidos y precios

- El navegador envía solamente producto, cantidad y tamaño.
- El servidor vuelve a consultar productos activos de la empresa y define el precio vigente.
- El total se calcula en el servidor y ese mismo total se guarda y notifica.
- Los pedidos con productos eliminados, cantidades anormales, tamaños inventados o precios no vigentes se rechazan.
- Las tortas exigen una fecha posterior al día actual en Chile.
- El HTML de correos escapa todos los datos ingresados por el cliente.
- Los endpoints antiguos de correo y EasyPan quedan deshabilitados de forma explícita.
- El rol anónimo deja de tener acceso directo a la tabla de pedidos.
- Existe una barrera honeypot básica; antes de una campaña masiva se requiere rate limiting distribuido o CAPTCHA.

## Cortes pendientes antes de vender como SaaS

1. Autorización real por acción en servidor y RLS, no solo ocultar menús.
2. Resolver empresa por dominio o configuración, sin slug ni marca hardcodeados.
3. Transacciones atómicas para producción, inventario, compras y cierres.
4. Separar costo de receta, precio sugerido y precio comercial del producto.
5. Definir estados contables de venta y zona horaria única para indicadores.
6. Integrar caja con pedidos, ventas y medios de pago; eliminar doble digitación.
7. Completar DTE real o retirar el módulo de la oferta comercial.
8. Agregar pruebas de integración, monitoreo de errores, alertas y respaldo probado.
9. Preparar migraciones reproducibles y datos iniciales para una empresa nueva.

## Criterio de publicación del corte 1

- Pruebas unitarias de pedidos aprobadas.
- Build de producción aprobado.
- Migración de seguridad aplicada en Supabase.
- Pedido real de prueba creado, revisado en administración y notificado.
- Verificación de que un cliente anónimo no puede insertar directamente en `pedidos`.