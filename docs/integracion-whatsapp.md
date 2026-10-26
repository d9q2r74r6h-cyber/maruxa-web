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
WHATSAPP_360DIALOG_API_KEY=
WHATSAPP_360DIALOG_PHONE_NUMBER_ID=
WHATSAPP_360DIALOG_DISPLAY_PHONE_NUMBER=
WHATSAPP_360DIALOG_CHANNEL_LABEL=
WHATSAPP_360DIALOG_NOTIFICATION_TEMPLATE_NAME=
WHATSAPP_360DIALOG_NOTIFICATION_TEMPLATE_LANGUAGE=es_CL
WHATSAPP_360DIALOG_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

`WHATSAPP_VERIFY_TOKEN` es una frase secreta definida por Maruxa y debe
coincidir con la ingresada al registrar el webhook en Meta.

`WHATSAPP_APP_SECRET` se obtiene desde la configuración de la aplicación de
Meta. Se usa para comprobar la firma `X-Hub-Signature-256`.

`WHATSAPP_EMPRESA_ID` corresponde al UUID de Maruxa en la tabla `empresas`.
Si se omite, el receptor busca la empresa activa con slug `maruxa`.

Cuando se usa 360dialog, `WHATSAPP_360DIALOG_API_KEY` reemplaza el token de
Meta solo para el canal indicado por `WHATSAPP_360DIALOG_PHONE_NUMBER_ID`.
Esto permite mantener simultáneamente otro canal conectado directamente a
Meta. `WHATSAPP_360DIALOG_WEBHOOK_SECRET` protege el receptor;
la URL configurada en 360dialog debe terminar en
`?d360_token=EL_MISMO_SECRETO`.

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
