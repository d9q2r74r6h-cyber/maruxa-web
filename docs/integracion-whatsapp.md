# Integración de WhatsApp Business

## URL del webhook

`https://DOMINIO/api/whatsapp/webhook`

## Variables de Vercel

```text
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_EMPRESA_ID=
SUPABASE_SERVICE_ROLE_KEY=
```

`WHATSAPP_VERIFY_TOKEN` es una frase secreta definida por Maruxa y debe
coincidir con la ingresada al registrar el webhook en Meta.

`WHATSAPP_APP_SECRET` se obtiene desde la configuración de la aplicación de
Meta. Se usa para comprobar la firma `X-Hub-Signature-256`.

`WHATSAPP_EMPRESA_ID` corresponde al UUID de Maruxa en la tabla `empresas`.
Si se omite, el receptor busca la empresa activa con slug `maruxa`.

## Carros de compra

El receptor procesa mensajes de tipo `order`. Cada
`product_retailer_id` debe coincidir con `productos.codigo`.

Si un código no existe, el pedido igualmente se registra como pendiente y la
observación indica cuáles productos requieren revisión.

## Configuración en Meta

1. Registrar la URL del webhook.
2. Ingresar el mismo `WHATSAPP_VERIFY_TOKEN` configurado en Vercel.
3. Suscribir el webhook al campo `messages`.
4. Mantener el secreto de la aplicación únicamente en Vercel.
