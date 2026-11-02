'use client';

type ColumnaListado = {
  titulo: string;
  clave: string;
};

function escaparHtml(valor: unknown) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function imprimirListado({
  titulo,
  subtitulo,
  columnas,
  filas,
}: {
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaListado[];
  filas: Array<Record<string, unknown>>;
}) {
  const ventana = window.open('', '_blank', 'width=1200,height=800');
  if (!ventana) {
    window.alert('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e inténtalo nuevamente.');
    return;
  }

  const encabezados = columnas
    .map((columna) => `<th>${escaparHtml(columna.titulo)}</th>`)
    .join('');
  const cuerpo = filas
    .map(
      (fila) =>
        `<tr>${columnas
          .map((columna) => `<td>${escaparHtml(fila[columna.clave])}</td>`)
          .join('')}</tr>`
    )
    .join('');

  ventana.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escaparHtml(titulo)}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #1f1713; font-family: Arial, sans-serif; font-size: 10px; }
          header { margin-bottom: 14px; border-bottom: 3px solid #217346; padding-bottom: 9px; }
          h1 { margin: 0; font-size: 22px; }
          p { margin: 4px 0 0; color: #5f514a; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; table-layout: auto; }
          th { background: #217346; color: white; font-size: 9px; text-align: left; text-transform: uppercase; }
          th, td { border: 1px solid #b8c8be; padding: 6px 7px; vertical-align: top; overflow-wrap: anywhere; }
          tbody tr:nth-child(even) { background: #eef7f1; }
          .total { margin-top: 10px; font-weight: 700; }
        </style>
      </head>
      <body>
        <header>
          <h1>${escaparHtml(titulo)}</h1>
          <p>${escaparHtml(subtitulo || '')}</p>
          <p>Emitido: ${escaparHtml(new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()))}</p>
        </header>
        <table><thead><tr>${encabezados}</tr></thead><tbody>${cuerpo}</tbody></table>
        <div class="total">Total: ${filas.length} registro${filas.length === 1 ? '' : 's'}</div>
        <script>window.addEventListener('load', () => { window.focus(); window.print(); });<\/script>
      </body>
    </html>`);
  ventana.document.close();
}
