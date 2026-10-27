-- La lista 5041 es opt-in: solo se publican los productos cuyo precio
-- se configure expresamente en la pantalla administrativa.
update public.producto_precios_whatsapp
set precio = 0,
    precio_10 = null,
    precio_15 = null,
    precio_20 = null,
    precio_25 = null,
    updated_at = now()
where canal = '5041';

