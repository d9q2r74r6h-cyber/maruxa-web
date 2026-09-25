# Prueba de captura de facturas en Compras

## Uso

En `/admin/compras`, abrir **Capturar factura / Importar XML**.

- **Tomar foto / Subir fotos:** JPG, PNG o WebP; hasta cinco páginas de una misma factura, 12 MB por imagen. El reconocimiento en español ocurre en el navegador. La primera lectura descarga el motor y el idioma desde los servidores predeterminados de Tesseract; no envía las imágenes a un servicio OCR.
- **Importar XML:** hasta 5 MB. Admite DTE individual o EnvioDTE con selección explícita del documento. Se leen facturas 33 y 34 en pesos chilenos, incluyendo namespaces y codificación declarada (UTF-8/ISO-8859-1).
- Revisar proveedor, RUT, folio, fecha, totales y detalle. La foto produce sugerencias conservadoras: los campos ambiguos quedan vacíos y el detalle puede requerir completar filas manualmente.
- Asociar proveedor por su RUT y cada línea con un producto existente. Convertir las cantidades a la unidad del catálogo si la factura usa cajas, paquetes u otra unidad.
- Los montos por línea son netos, después de descuentos de línea. Los descuentos/recargos globales requieren distribuir su efecto manualmente y cuadrar el detalle. Revisar el signo del campo Otros cuando haya impuestos o retenciones especiales.
- Confirmar la revisión y cargar los costos. Se impide reemplazar un formulario con productos pendientes. Se conserva el precio de venta actual de cada producto; el usuario puede modificarlo antes de guardar.

## Alcance de esta prueba

La pantalla actual guarda costos/precios e historial, no una cabecera de factura. La carga manual no registra facturas contables, no modifica stock ni almacena fotos/XML en Supabase. La recepción por correo sí conserva XML y evita duplicados, como se describe más abajo. Ninguna de las dos vías verifica firmas XML ni aceptación SII. El botón **Descargar revisión** conserva un JSON con los campos y el texto/XML original; las fotos deben conservarse por separado. La carga manual no requiere migraciones ni una clave de API. La recepción por correo requiere la migración indicada más abajo.

No se aceptan notas de crédito, guías ni moneda extranjera para impedir tratarlas como compras positivas. Los documentos cuyo receptor difiere de la empresa, RUT emisor inválido, totales descuadrados o productos sin asociar no se transfieren al formulario.

## Validación

- `node --experimental-strip-types --test tests/importar-factura.test.ts`
- `npm run build`
- Prueba de navegador con Supabase simulado: importar XML, vincular proveedor/producto, confirmar y transferir total 1190; ancho móvil sin desbordamiento.
- OCR real de imagen sintética probado tanto en Node como en navegador (encabezado y total reconocidos).

Falta calibrar la extracción de líneas con facturas reales de los proveedores; no se ha medido precisión sobre documentos reales.

Referencias de implementación: [formato XML SII](https://www.sii.cl/servicios_online/3532-formato_xml-3811.html), [API de Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/api.md).

## Recepción por Resend

La ruta existente `/api/resend/inbound` acepta ahora `recepcion@panaderiamaruxa.cl` después de verificar la firma de Resend. No reenvía los correos dirigidos únicamente a esa dirección. Los flujos existentes de contacto y revisión Meta se conservan.

Antes de publicar, ejecutar `supabase/migrations/20260924_facturas_recibidas.sql` en el proyecto Supabase correcto. Crea `facturas_correo_adjuntos` (XML original y resultado por adjunto) y `facturas_recibidas` (cabecera y detalle para revisión). Solo el servicio escribe; usuarios activos de la misma empresa con acceso a Compras pueden leer.

Usa las variables de recepción existentes: `RESEND_RECEIVING_API_KEY` (o `RESEND_API_KEY`), `RESEND_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` y `RESEND_EMPRESA_ID` cuando haya más de una empresa. No requiere otro webhook ni otra clave si la recepción del dominio ya está configurada.

El control de duplicación es persistente por empresa + RUT emisor normalizado + tipo + folio normalizado. La base de datos impone unicidad ante entregas concurrentes. Un reintento no reemplaza la factura original. Un segundo correo con la misma factura registra el duplicado y conserva su propio XML. Los fallos temporales generan 503 para que Resend reintente; los XML inválidos quedan como errores visibles y no se reintentan indefinidamente. Para un fallo operativo no recuperado, repetir el evento desde Resend una vez resuelto.

Hasta 20 archivos XML por correo, 5 MB por archivo. No se descomprimen ZIP. El receptor del XML debe coincidir con el RUT de la empresa configurada. La firma del correo/webhook no valida la firma tributaria del DTE; esa validación SII sigue fuera de este alcance.

La bandeja abre los datos en la revisión existente. No tiene una acción de recepción física ni confirmación de compra: no incrementa inventario, no actualiza costos automáticamente y no marca documentos como contabilizados. Los datos de una carga manual siguen siendo temporales; los XML llegados por correo sí se conservan después de activar las tablas.

Pruebas adicionales: `node --experimental-strip-types --test tests/facturas-correo.test.ts`. Los casos de persistencia usan un repositorio simulado; falta la prueba de extremo a extremo con Resend y Supabase después de aplicar la migración y publicar.
