export type DatosTurno = {
    amasado: number;
    masaOcupa: number;
    masaQueda: number;
    panRacion: number;
    panMeson: number;
    cacho?: number;
    otroskg?: number;
    repartos?: number[];
  };
  
  function n(valor: number | undefined) {
    return Number(valor || 0);
  }
  
  function calcularFactorAmasado(
    amasado: number,
    masaOcupa: number,
    masaQueda: number
  ) {
    const ajusteMasa = Number(
      (((n(masaOcupa) - n(masaQueda)) / 100 / 3) * 2).toFixed(2)
    );
  
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
  
  export function calcularTurno(turno: DatosTurno) {
    const kilosRepartos =
      turno.repartos?.reduce(
        (acc, valor) => acc + n(valor),
        0
      ) || 0;
  
    const kilos =
      n(turno.panMeson) +
      n(turno.panRacion) +
      n(turno.cacho) +
      n(turno.otroskg) +
      kilosRepartos;
  
    const factorAmasado = calcularFactorAmasado(
      turno.amasado,
      turno.masaOcupa,
      turno.masaQueda
    );
  
    const rinde =
      factorAmasado > 0
        ? kilos / factorAmasado
        : 0;
  
    return {
      kilos,
      factorAmasado,
      rinde: Number(rinde.toFixed(2)),
      estadoRinde: clasificarRinde(rinde),
    };
  }
  
  export function clasificarRinde(rinde: number) {
    if (rinde >= 64) return 'ideal';
    if (rinde >= 63) return 'aceptable';
    return 'bajo';
  }