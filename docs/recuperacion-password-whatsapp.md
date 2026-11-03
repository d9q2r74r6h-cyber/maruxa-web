# Recuperación de contraseña por WhatsApp

La pantalla de acceso permite solicitar un enlace temporal de recuperación por WhatsApp. El servidor responde siempre con el mismo mensaje para no revelar si un correo tiene cuenta, teléfono asociado o está activo.

Para habilitar el envío, configura estas variables de entorno en producción:

```text
WHATSAPP_PASSWORD_RECOVERY_TEMPLATE_NAME=recuperar_contrasena_maruxa
WHATSAPP_PASSWORD_RECOVERY_TEMPLATE_LANGUAGE=es_CL
```

Además, crea y aprueba en Meta una plantilla de utilidad con:

- Un parámetro de cuerpo para el nombre de la persona.
- Un botón de tipo URL dinámico, índice `0`.
- URL base: `https://www.panaderiamaruxa.cl/admin/crear-contrasena?token_hash={{1}}&type=recovery`

El enlace se genera para una cuenta activa y se envía solamente al teléfono del funcionario asociado a esa cuenta (o al funcionario de la misma empresa que tenga el mismo correo). Cada cuenta puede pedir un enlace por WhatsApp cada diez minutos. La tabla `recuperaciones_password_whatsapp` guarda solo el resultado técnico, nunca el token ni la URL de recuperación.
