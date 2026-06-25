# Factura electrónica en Maruxa ERP

## Estado implementado

- Maestro de clientes tributarios.
- Facturas, facturas exentas, guías, notas de crédito y débito.
- Cabecera, detalle y referencias de documentos.
- Totales neto, exento, IVA y total.
- Borradores internos y seguimiento de estado SII.
- Almacenamiento de CAF, XML, Track ID y respuestas.
- Control de permisos y auditoría.

## Variables de servidor

```env
SUPABASE_SERVICE_ROLE_KEY=
SII_AMBIENTE=certificacion
SII_RUT_EMISOR=
SII_NUMERO_RESOLUCION=
SII_FECHA_RESOLUCION=
SII_CERTIFICADO_PFX_BASE64=
SII_CERTIFICADO_PASSWORD=
```

El certificado digital y su contraseña deben existir únicamente en el
servidor. Nunca deben exponerse con prefijo `NEXT_PUBLIC_`.

## Trabajo pendiente para emisión real

1. Inscribir o confirmar a la empresa como facturador electrónico.
2. Completar el proceso de certificación del sistema de mercado/desarrollo
   propio ante el SII.
3. Descargar y cargar CAF por tipo de DTE.
4. Generar XML según el esquema vigente del SII.
5. Crear el TED y timbrar cada documento con el CAF.
6. Firmar XML con el certificado digital vigente.
7. Obtener semilla y token de autenticación.
8. Enviar el sobre DTE y almacenar el Track ID.
9. Consultar el estado hasta aceptación, reparos o rechazo.
10. Generar representación impresa y entregar XML/PDF al receptor.

## Referencias oficiales

- https://www.sii.cl/servicios_online/1039-1182.html
- https://www.sii.cl/servicios_online/1039-1184.html
- https://www3.sii.cl/sispadinternet/index.html

