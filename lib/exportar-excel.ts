'use client';

type ColumnaExcel = {
  titulo: string;
  clave: string;
};

function valorSeguro(valor: unknown) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  // Evita que Excel interprete teléfonos o datos ingresados por usuarios como fórmulas.
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
}

function celdaCsv(valor: unknown) {
  return `"${valorSeguro(valor).replace(/"/g, '""')}"`;
}

export function exportarParaExcel({
  nombreArchivo,
  columnas,
  filas,
}: {
  nombreArchivo: string;
  columnas: ColumnaExcel[];
  filas: Array<Record<string, unknown>>;
}) {
  const contenido = [
    columnas.map((columna) => celdaCsv(columna.titulo)).join(';'),
    ...filas.map((fila) =>
      columnas.map((columna) => celdaCsv(fila[columna.clave])).join(';')
    ),
  ].join('\r\n');
  const blob = new Blob([`\uFEFF${contenido}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombreArchivo}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
