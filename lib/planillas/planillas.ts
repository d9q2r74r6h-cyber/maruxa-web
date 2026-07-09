export type DatosTurno = {
  amasado: number;
  masaOcupa: number;
  masaQueda: number;
  panRacion: number;
  panSobrante?: number;
  panSobranteAnterior?: number;
  merma?: number;
  cacho?: number;
  centeno?: number;
  meson?: number;
  otroskg?: number;
  repartos?: number[];
};

export type DatosPlanillaRinde = {
  primera: DatosTurno;
  segunda: DatosTurno;
  panSobrante: number;
};

function n(valor: number | undefined) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

export function ajusteDeMasa(masaOcupa: number, masaQueda: number) {
  return Number(
    ((((n(masaOcupa) - n(masaQueda)) / 100) / 3) * 2).toFixed(2)
  );
}

// EasyPan registra medio saco como .5 y lo convierte a dos amasadas.
export function calcularFactorAmasado(
  amasado: number,
  masaOcupa: number,
  masaQueda: number
) {
  const ajusteMasa = ajusteDeMasa(masaOcupa, masaQueda);
  const texto = String(n(amasado));

  if (texto.includes('.')) {
    const [entero, decimal] = texto.split('.');
    return (
      Number(entero || 0) +
      (Number(`0.${decimal || 0}`) + ajusteMasa) * 2
    );
  }

  return n(amasado) + ajusteMasa * 2;
}

function resultado(kilos: number, factorAmasado: number) {
  const rinde = factorAmasado > 0 ? kilos / factorAmasado : 0;

  return {
    kilos: Number(kilos.toFixed(2)),
    factorAmasado: Number(factorAmasado.toFixed(2)),
    rinde: Number(rinde.toFixed(2)),
    estadoRinde: clasificarRinde(rinde),
  };
}

export function calcularTurno(turno: DatosTurno) {
  const kilosRepartos =
    turno.repartos?.reduce((total, valor) => total + n(valor), 0) || 0;
  const kilos =
    n(turno.panRacion) +
    n(turno.otroskg) +
    kilosRepartos +
    n(turno.merma) +
    n(turno.cacho) -
    n(turno.panSobranteAnterior);

  return resultado(
    kilos,
    calcularFactorAmasado(turno.amasado, turno.masaOcupa, turno.masaQueda)
  );
}

export function calcularPlanillaRinde(datos: DatosPlanillaRinde) {
  const repartosPrimera =
    datos.primera.repartos?.reduce((total, valor) => total + n(valor), 0) || 0;
  const repartosSegunda =
    datos.segunda.repartos?.reduce((total, valor) => total + n(valor), 0) || 0;

  const kilosPrimera =
    n(datos.primera.panRacion) +
    n(datos.primera.otroskg) +
    repartosPrimera +
    n(datos.primera.merma) +
    n(datos.primera.cacho);
  const kilosSegunda =
    n(datos.segunda.panRacion) -
    n(datos.panSobrante) +
    n(datos.segunda.otroskg) +
    repartosSegunda +
    n(datos.segunda.merma) +
    n(datos.segunda.cacho);

  const primera = resultado(
    kilosPrimera,
    calcularFactorAmasado(
      datos.primera.amasado,
      datos.primera.masaOcupa,
      datos.primera.masaQueda
    )
  );
  const segunda = resultado(
    kilosSegunda,
    calcularFactorAmasado(
      datos.segunda.amasado,
      datos.segunda.masaOcupa,
      datos.segunda.masaQueda
    )
  );

  const amasadoTotal = n(datos.primera.amasado) + n(datos.segunda.amasado);
  const masaOcupaTotal =
    n(datos.primera.masaOcupa) + n(datos.segunda.masaOcupa);
  const masaQuedaTotal =
    n(datos.primera.masaQueda) + n(datos.segunda.masaQueda);
  const total = resultado(
    kilosPrimera + kilosSegunda,
    calcularFactorAmasado(amasadoTotal, masaOcupaTotal, masaQuedaTotal)
  );

  return { primera, segunda, total };
}

export function clasificarRinde(rinde: number) {
  if (rinde >= 64) return 'ideal';
  if (rinde >= 63) return 'aceptable';
  return 'bajo';
}
