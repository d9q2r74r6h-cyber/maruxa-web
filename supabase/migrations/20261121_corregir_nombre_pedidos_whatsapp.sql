-- Corrige pedidos de carros de WhatsApp que ya tenían una ficha de cliente,
-- pero no coincidieron por estar el teléfono en formatos distintos.
-- Sólo actualiza números chilenos de 9 dígitos con una coincidencia activa única.
with clientes_unicos as (
  select
    empresa_id,
    right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 9) as telefono_clave,
    min(razon_social) as razon_social
  from public.clientes
  where activo = true
    and nullif(trim(razon_social), '') is not null
    and length(right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 9)) = 9
  group by empresa_id, right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 9)
  having count(*) = 1
)
update public.pedidos as pedido
set cliente = cliente.razon_social
from clientes_unicos as cliente
where pedido.origen = 'whatsapp_carrito'
  and pedido.empresa_id = cliente.empresa_id
  and right(regexp_replace(coalesce(pedido.telefono, ''), '\D', '', 'g'), 9) = cliente.telefono_clave
  and length(cliente.telefono_clave) = 9
  and pedido.cliente is distinct from cliente.razon_social;
