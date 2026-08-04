'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Plus, Printer, Save, Trash2, WalletCards } from 'lucide-react';
import { useAdminSession } from '@/components/AdminSession';
import { supabase } from '@/lib/supabase';

type Origen = 'casa' | 'externo';
type Funcion = 'batea' | 'cocedor' | 'oficial';
type ConceptoBono = { id: string; nombre: string; monto: number; activo: boolean };
type BonoAsignado = { id: string; concepto_id: string; nombre: string; monto: number };
type Linea = { id: string; nombre: string; monto: number; monto_es_base?: boolean; total_pago?: number; dominical?: number; bonos?: BonoAsignado[]; monto_manual?: boolean; funcionario_id?: string; origen?: Origen; funcion?: Funcion; tipo_eventual?: 'externo' | 'aprendiz'; participa_demasia?: boolean };
type Turno = { id: string; nombre: string; qq?: number; lineas: Linea[] };
type TurnoPlan = { id: string; nombre: string; panaderos: Array<{ id: string; funcionario_id: string; nombre: string; origen: Origen; funcion: Funcion }> };
type Plantilla = { id: string; nombre: string; turnos: TurnoPlan[] };
type PlantillaDb = Partial<Plantilla> & { id: string; semana_desde?: string | null; dotacion?: Record<string, TurnoPlan[]> };
type CargoRelacionado = { nombre: string };
type Funcionario = { id: string; nombre_completo: string; nombre_corto?: string | null; cargo: string; recibe_dominical?: boolean; ciclo_dominical?: 'impar' | 'par' | null; funcionario_cargos?: { cargos_empresa?: CargoRelacionado | CargoRelacionado[] | null }[] };
type Cierre = {
  id: string;
  fecha: string;
  cajera_id: string | null;
  cajera_nombre: string;
  panaderos_primer_turno: Linea[];
  panaderos_segundo_turno: Linea[];
  turnos_panaderos?: Turno[];
  compras_gastos: Linea[];
  total_ventas: number;
  efectivo: number;
  tarjetas: number;
  observacion: string | null;
  estado: 'borrador' | 'cerrada';
  es_festivo?: boolean;
  dotacion_id?: string | null;
};

const hoy = new Date().toISOString().slice(0, 10);
const nuevaLinea = (panadero = false): Linea => ({ id: crypto.randomUUID(), nombre: '', monto: 0, ...(panadero ? { origen: 'casa' as Origen, funcion: 'oficial' as Funcion, participa_demasia: true } : {}) });
const nuevoTurno = (numeroTurno: number): Turno => ({
  id: crypto.randomUUID(),
  nombre: `${numeroTurno}° turno`,
  qq: 0,
  lineas: [nuevaLinea(true)],
});
const dinero = (valor: number) => `$${Math.round(valor || 0).toLocaleString('es-CL')}`;
const numero = (valor: unknown) => Number(String(valor ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const numeroDecimal = (valor: unknown) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? '').trim().replace(/\s/g, '');
  if (!texto) return 0;
  return Number(texto.replace(',', '.')) || 0;
};
const TARIFAS = {
  normal: { casa: { batea: 26800, cocedor: 25700, oficial: 22500 }, externo: { batea: 31300, cocedor: 29000, oficial: 26000 } },
  festivo: { casa: { batea: 36600, cocedor: 35000, oficial: 30000 }, externo: { batea: 43400, cocedor: 41400, oficial: 35400 } },
};
type ConfigPago = { normal: typeof TARIFAS.normal; festivo: typeof TARIFAS.festivo; demasia_normal_qq: number; demasia_festivo_qq: number };
const CONFIG_PAGO_BASE: ConfigPago = { ...TARIFAS, demasia_normal_qq: 8000, demasia_festivo_qq: 12000 };
function montoBase(linea: Linea, esFestivo: boolean, demasia: number, config: ConfigPago = CONFIG_PAGO_BASE) {
  if (linea.monto_manual) return linea.monto_es_base ? numero(linea.monto) : Math.max(0, numero(linea.monto) - demasia);
  if (!linea.origen || !linea.funcion) return numero(linea.monto);
  return config[esFestivo ? 'festivo' : 'normal'][linea.origen][linea.funcion];
}
function montoLinea(linea: Linea, esFestivo: boolean, demasia: number, config: ConfigPago = CONFIG_PAGO_BASE) {
  return montoBase(linea, esFestivo, demasia, config) + demasia;
}
const recibeDemasia = (linea: Linea) => linea.participa_demasia !== false;
const totalBonos = (linea: Linea) => (linea.bonos || []).reduce((suma, bono) => suma + numero(bono.monto), 0);
function esPenultimoDomingo(fecha: string) { const dia=new Date(`${fecha}T12:00:00`); if(dia.getDay()!==0)return false; const siguiente=new Date(dia); const subsiguiente=new Date(dia); siguiente.setDate(dia.getDate()+7); subsiguiente.setDate(dia.getDate()+14); return siguiente.getMonth()===dia.getMonth()&&subsiguiente.getMonth()!==dia.getMonth(); }
function correspondeDominical(linea: Linea, fecha: string, funcionarios: Funcionario[]) { const persona=funcionarios.find((item)=>item.id===linea.funcionario_id); if(!persona?.recibe_dominical||!persona.ciclo_dominical||!esPenultimoDomingo(fecha))return false; const mes=new Date(`${fecha}T12:00:00`).getMonth()+1; return persona.ciclo_dominical===(mes%2?'impar':'par'); }
function lineasCalculadas(turno: Turno, esFestivo: boolean, config: ConfigPago = CONFIG_PAGO_BASE, fecha = hoy, funcionarios: Funcionario[] = []) {
  const participantes = turno.lineas.filter((item) => item.nombre.trim() && recibeDemasia(item));
  const demasia = participantes.length ? numeroDecimal(turno.qq) * (esFestivo ? config.demasia_festivo_qq : config.demasia_normal_qq) / participantes.length : 0;
  return turno.lineas.map((item) => {
    const demasiaIndividual = recibeDemasia(item) ? demasia : 0;
    const monto = item.nombre.trim() ? montoBase(item, esFestivo, demasiaIndividual, config) : 0;
    const dominical = correspondeDominical(item, fecha, funcionarios) ? monto : 0;
    return { ...item, monto, monto_es_base: true, dominical, total_pago: monto + demasiaIndividual + totalBonos(item) + dominical };
  });
}
function pascua(anio: number) { const a=anio%19,b=Math.floor(anio/100),c=anio%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=(h+l-7*m+114)%31+1; return new Date(anio,mes-1,dia,12); }
function feriadoTrasladable(anio: number, mes: number, dia: number) { const base=new Date(anio,mes-1,dia,12), semana=base.getDay(); if(semana>=2&&semana<=4) base.setDate(base.getDate()-(semana-1)); else if(semana===5) base.setDate(base.getDate()+3); return base.toISOString().slice(0,10); }
function esFeriadoChile(fecha: string) { const valor=new Date(`${fecha}T12:00:00`); if(valor.getDay()===0) return true; const anio=valor.getFullYear(), clave=fecha.slice(5), fijos=new Set(['01-01','05-01','05-21','06-21','07-16','08-15','09-18','09-19','10-31','11-01','12-08','12-25']); const domingo=pascua(anio), viernes=new Date(domingo), sabado=new Date(domingo); viernes.setDate(domingo.getDate()-2); sabado.setDate(domingo.getDate()-1); return fijos.has(clave)||fecha===feriadoTrasladable(anio,6,29)||fecha===feriadoTrasladable(anio,10,12)||fecha===viernes.toISOString().slice(0,10)||fecha===sabado.toISOString().slice(0,10); }
function normalizarPlantilla(item: PlantillaDb): Plantilla { const anteriores=item.dotacion ? Object.values(item.dotacion).find((turnos) => Array.isArray(turnos)&&turnos.length) : undefined; return { id:item.id, nombre:item.nombre || `DOTACIÓN ${item.semana_desde || ''}`.trim(), turnos:item.turnos?.length ? item.turnos : anteriores || [] }; }
function esFuncionarioPanadero(funcionario: Funcionario) { return (funcionario.funcionario_cargos || []).some((relacion) => { const cargos=Array.isArray(relacion.cargos_empresa) ? relacion.cargos_empresa : relacion.cargos_empresa ? [relacion.cargos_empresa] : []; return cargos.some((cargo) => cargo.nombre.toLocaleLowerCase('es').includes('panadero')); }); }
function esFuncionarioCajera(funcionario: Funcionario) { return (funcionario.funcionario_cargos || []).some((relacion) => { const cargos=Array.isArray(relacion.cargos_empresa) ? relacion.cargos_empresa : relacion.cargos_empresa ? [relacion.cargos_empresa] : []; return cargos.some((cargo) => cargo.nombre.toLocaleLowerCase('es').includes('cajera')); }); }
const nombreBreve = (funcionario: Funcionario) => funcionario.nombre_corto?.trim() || funcionario.nombre_completo.split(/\s+/)[0];
const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
function textoComparable(valor: string) { return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
function dotacionParaFecha(plantillas: Plantilla[], fecha: string) {
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  const nombreDia = DIAS_SEMANA[dia];
  const festivo = esFeriadoChile(fecha);
  const datos = plantillas.map((plantilla) => ({ plantilla, nombre: textoComparable(plantilla.nombre) }));

  if (festivo) {
    const especial = datos.find(({ nombre }) => /FESTIV|FERIAD/.test(nombre))
      || (dia === 0 ? datos.find(({ nombre }) => /DOMINGO/.test(nombre)) : undefined);
    if (especial) return especial.plantilla;
  }

  const rango = datos.find(({ nombre }) => {
    for (let inicio = 0; inicio < DIAS_SEMANA.length; inicio += 1) {
      for (let fin = 0; fin < DIAS_SEMANA.length; fin += 1) {
        if (!new RegExp(`${DIAS_SEMANA[inicio]}\\s*(?:A|AL|-)\\s*${DIAS_SEMANA[fin]}`).test(nombre)) continue;
        const dias = inicio <= fin
          ? Array.from({ length: fin - inicio + 1 }, (_, indice) => inicio + indice)
          : [...Array.from({ length: 7 - inicio }, (_, indice) => inicio + indice), ...Array.from({ length: fin + 1 }, (_, indice) => indice)];
        if (dias.includes(dia)) return true;
      }
    }
    return false;
  });
  if (rango) return rango.plantilla;

  return datos.find(({ nombre }) => new RegExp(`(^|[^A-Z])${nombreDia}S?([^A-Z]|$)`).test(nombre))?.plantilla;
}
function funcionPanadero(funcionario?: Funcionario): Funcion | undefined {
  if (!funcionario) return undefined;
  const nombres = (funcionario.funcionario_cargos || []).flatMap((relacion) => {
    const cargos = Array.isArray(relacion.cargos_empresa) ? relacion.cargos_empresa : relacion.cargos_empresa ? [relacion.cargos_empresa] : [];
    return cargos.map((cargo) => cargo.nombre.toLocaleLowerCase('es'));
  });
  if (nombres.some((nombre) => nombre.includes('batea'))) return 'batea';
  if (nombres.some((nombre) => nombre.includes('cocedor'))) return 'cocedor';
  if (nombres.some((nombre) => nombre.includes('oficial'))) return 'oficial';
  return undefined;
}

function SueldoInput({ valor, nombre, manual, onCommit }: { valor: number; nombre: string; manual?: boolean; onCommit: (valor: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (!editando) setTexto(String(Math.round(valor || 0)));
  }, [valor, editando]);

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={!nombre.trim()}
      aria-label={`Sueldo de ${nombre || 'panadero'}`}
      title="Sueldo editable"
      value={editando ? texto : nombre.trim() ? dinero(valor) : ''}
      onFocus={(event) => {
        const input = event.currentTarget;
        setTexto(String(Math.round(valor || 0)));
        setEditando(true);
        requestAnimationFrame(() => input.select());
      }}
      onChange={(event) => {
        if (/^[\d.]*$/.test(event.target.value)) setTexto(event.target.value);
      }}
      onBlur={() => {
        onCommit(Math.max(0, numero(texto)));
        setEditando(false);
      }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      placeholder="$0"
      className={`h-10 rounded-md border px-2 text-right text-sm font-black outline-none focus:border-[#A51F2B] focus:ring-2 focus:ring-[#A51F2B]/15 disabled:cursor-not-allowed disabled:opacity-60 ${manual ? 'border-[#A51F2B]/45 bg-[#FFF1F2] text-[#A51F2B]' : 'border-[#E9D7BC] bg-[#FFF3DF]'}`}
    />
  );
}

function escaparHtml(valor: string) { return valor.replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[caracter] || caracter); }
function imprimirHojaTurno(titulo: string, fecha: string, qq: number, lineas: Linea[], esFestivo: boolean, configPago: ConfigPago, funcionarios: Funcionario[]) {
  const calculadas = lineasCalculadas({ id: '', nombre: titulo, qq, lineas }, esFestivo, configPago, fecha, funcionarios).filter((linea) => linea.nombre.trim());
  if (!calculadas.length) return alert('Agrega al menos un panadero antes de imprimir la hoja.');
  const ventana = window.open('', '_blank', 'width=1000,height=750');
  if (!ventana) return alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
  const participantes = calculadas.filter(recibeDemasia).length;
  const demasiaTotal = numeroDecimal(qq) * (esFestivo ? configPago.demasia_festivo_qq : configPago.demasia_normal_qq);
  const demasiaIndividual = participantes ? demasiaTotal / participantes : 0;
  const filas = calculadas.map((linea) => {
    const demasia = recibeDemasia(linea) ? demasiaIndividual : 0;
    const base = numero(linea.monto);
    const bonos = totalBonos(linea);
    const detalleBonos = (linea.bonos || []).map((bono) => escaparHtml(`${bono.nombre} ${dinero(bono.monto)}`)).join('<br>');
    return `<tr><td>${escaparHtml(linea.nombre)}</td><td>${escaparHtml((linea.funcion || '').toUpperCase())}</td><td class="monto">${dinero(base)}</td><td class="signo">+</td><td class="monto">${dinero(demasia)}</td><td class="signo">+</td><td class="monto bonos">${dinero(bonos)}${detalleBonos ? `<small>${detalleBonos}</small>` : ''}</td><td class="signo">+</td><td class="monto">${dinero(linea.dominical||0)}</td><td class="signo">=</td><td class="monto total-fila">${dinero(linea.total_pago ?? linea.monto)}</td><td class="firma"></td></tr>`;
  }).join('');
  const total = calculadas.reduce((suma, linea) => suma + numero(linea.total_pago ?? linea.monto), 0);
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de pago ${escaparHtml(titulo)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#24150f;margin:0}header{border-bottom:3px solid #9f1d2b;padding-bottom:10px;margin-bottom:14px}h1{font-family:Georgia,serif;margin:0 0 8px;font-size:23px}.datos{display:flex;gap:24px;font-weight:700;font-size:12px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#2a1710;color:#fff;text-align:left;padding:8px 5px}td{border:1px solid #bcae9e;padding:9px 5px;height:58px}.monto{text-align:right;font-size:13px;font-weight:700}.bonos small{display:block;margin-top:4px;font-size:8px;font-weight:400;line-height:1.3}.total-fila{color:#9f1d2b;font-size:15px}.signo{text-align:center;border-left:0;border-right:0;font-size:16px;font-weight:700}.firma{min-width:140px}tfoot td{height:auto;background:#fff4df;font-weight:700}.declaracion{margin-top:16px;font-size:11px;line-height:1.5}.pie{display:flex;justify-content:space-between;margin-top:36px}.linea{width:250px;border-top:1px solid #222;padding-top:6px;text-align:center;font-size:10px}</style></head><body><header><h1>Panadería Maruxa · Hoja de pago y recepción</h1><div class="datos"><span>Fecha: ${new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL')}</span><span>${escaparHtml(titulo)}</span><span>QQ: ${String(qq).replace('.', ',')}</span><span>${esFestivo ? 'Día festivo' : 'Día normal'}</span></div></header><table><thead><tr><th>Panadero</th><th>Función</th><th>Base</th><th></th><th>Demasía</th><th></th><th>Bonos</th><th></th><th>Dominical</th><th></th><th>Total</th><th>Firma</th></tr></thead><tbody>${filas}</tbody><tfoot><tr><td colspan="10">TOTAL PAGADO DEL TURNO</td><td class="monto">${dinero(total)}</td><td></td></tr></tfoot></table><p class="declaracion">Cada trabajador declara haber recibido conforme el monto indicado en esta hoja por el turno señalado.</p><div class="pie"><div class="linea">Nombre y firma de la cajera responsable</div><div class="linea">Fecha y hora de entrega</div></div><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  ventana.document.close();
}

function EditorLineas({ titulo, fecha, lineas, onChange, onRemove, panaderos, qq = 0, esFestivo = false, onQq, configPago = CONFIG_PAGO_BASE, funcionariosPanaderos = [], conceptosBono = [] }: { titulo: string; fecha?: string; lineas: Linea[]; onChange: (lineas: Linea[]) => void; onRemove?: () => void; panaderos?: boolean; qq?: number; esFestivo?: boolean; onQq?: (valor: number) => void; configPago?: ConfigPago; funcionariosPanaderos?: Funcionario[]; conceptosBono?: ConceptoBono[] }) {
  const [qqTexto, setQqTexto] = useState(qq ? String(qq).replace('.', ',') : '');
  useEffect(() => { setQqTexto(qq ? String(qq).replace('.', ',') : ''); }, [qq]);
  const cantidad = lineas.filter((linea) => linea.nombre.trim() && recibeDemasia(linea)).length;
  const demasiaTotal = qq * (esFestivo ? configPago.demasia_festivo_qq : configPago.demasia_normal_qq);
  const demasia = cantidad ? demasiaTotal / cantidad : 0;
  const dominicalTotal = lineas.reduce((suma,linea)=>{const demasiaLinea=recibeDemasia(linea)?demasia:0;return suma+(correspondeDominical(linea,fecha||hoy,funcionariosPanaderos)?montoBase(linea,esFestivo,demasiaLinea,configPago):0)},0);
  const total = lineas.reduce((suma, linea) => { const demasiaLinea=recibeDemasia(linea)?demasia:0; const base=montoBase(linea,esFestivo,demasiaLinea,configPago); const dominical=correspondeDominical(linea,fecha||hoy,funcionariosPanaderos)?base:0; return suma+(panaderos&&!linea.nombre.trim()?0:base+demasiaLinea+totalBonos(linea)+dominical); }, 0);
  return (
    <section className="rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black text-[#2A1710]">{titulo}</h2>
        <div className="flex items-center gap-2">{panaderos && <><label className="flex items-center gap-2 text-xs font-black">QQ<input value={qqTexto} inputMode="decimal" onChange={(event) => { if (/^\d*(?:[.,]\d*)?$/.test(event.target.value)) setQqTexto(event.target.value); }} onBlur={() => onQq?.(Math.max(0, numeroDecimal(qqTexto)))} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} placeholder="Ej: 1,5" className="h-8 w-20 rounded border px-2 text-right" /></label><button type="button" onClick={() => imprimirHojaTurno(titulo, fecha || hoy, qq, lineas, esFestivo, configPago, funcionariosPanaderos)} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#A51F2B]/30 px-2 text-[10px] font-black uppercase text-[#A51F2B]" title="Imprimir hoja para firma"><Printer className="h-3.5 w-3.5" />Firmas</button></>}{!panaderos && <span className="rounded-full bg-[#FFF3DF] px-3 py-1 text-sm font-black text-[#A51F2B]">{dinero(total)}</span>}{onRemove && <button type="button" onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-md text-red-700 hover:bg-red-50" aria-label={`Eliminar ${titulo}`}><Trash2 className="h-4 w-4" /></button>}</div>
      </div>
      <div className="mt-3 space-y-2">
        {panaderos && <div className="grid grid-cols-[minmax(110px,1fr)_68px_78px_82px_88px_92px_26px] gap-1.5 px-1 text-[9px] font-black uppercase text-[#4B2818]/55"><span>Panadero</span><span>Origen</span><span>Función</span><span>Demasía</span><span className="text-right">Base</span><span className="text-right">Total</span><span></span></div>}
        {lineas.map((linea, indice) => (
          <div key={linea.id} className={`grid gap-1.5 ${panaderos ? 'grid-cols-[minmax(110px,1fr)_68px_78px_82px_88px_92px_26px]' : 'grid-cols-[minmax(0,1fr)_130px_36px]'}`}>
            {panaderos ? <div className="min-w-0 space-y-2"><select value={linea.tipo_eventual ? `__${linea.tipo_eventual}__` : linea.funcionario_id || ''} onChange={(event) => { const valor=event.target.value; const funcionario=funcionariosPanaderos.find((item)=>item.id===valor); const funcion=funcionPanadero(funcionario); const eventual=valor==='__externo__'?'externo':valor==='__aprendiz__'?'aprendiz':undefined; onChange(lineas.map((item,posicion)=>posicion===indice?{...item,funcionario_id:eventual?undefined:valor,nombre:funcionario?.nombre_completo||'',tipo_eventual:eventual,origen:eventual==='externo'?'externo':'casa',participa_demasia:eventual==='aprendiz'?false:true,monto:eventual==='aprendiz'?0:item.monto,monto_manual:eventual==='aprendiz',...(funcion ? { funcion } : {})}:item)); }} className="h-10 w-full min-w-0 rounded-md border border-[#4B2818]/20 bg-white px-2 text-xs font-bold"><option value="">Seleccionar</option>{funcionariosPanaderos.map((item)=><option key={item.id} value={item.id}>{nombreBreve(item)}</option>)}<option value="__externo__">+ Externo por el día</option><option value="__aprendiz__">+ En aprendizaje</option></select>{linea.tipo_eventual&&<input value={linea.nombre} onChange={(event)=>onChange(lineas.map((item,posicion)=>posicion===indice?{...item,nombre:event.target.value}:item))} placeholder={linea.tipo_eventual==='externo'?'Nombre del externo':'Nombre del aprendiz'} className="h-9 w-full min-w-0 rounded-md border border-[#4B2818]/20 px-2 text-xs font-bold"/>}</div> : <input value={linea.nombre} onChange={(event) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, nombre: event.target.value } : item))} placeholder="Detalle del gasto" className="h-10 min-w-0 rounded-md border border-[#4B2818]/20 px-3 text-sm font-bold" />}
            {panaderos && <><select value={linea.origen || 'casa'} onChange={(event) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, origen: event.target.value as Origen, monto_manual: item.tipo_eventual === 'aprendiz' } : item))} className="h-10 rounded-md border bg-white px-2 text-xs font-black"><option value="casa">Casa</option><option value="externo">Externo</option></select><select value={linea.funcion || 'oficial'} onChange={(event) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, funcion: event.target.value as Funcion, monto_manual: item.tipo_eventual === 'aprendiz' } : item))} className="h-10 rounded-md border bg-white px-2 text-xs font-black"><option value="batea">Batea</option><option value="cocedor">Cocedor</option><option value="oficial">Oficial</option></select></>}
            {panaderos&&<label className={`flex h-10 items-center justify-center gap-1 rounded-md border px-1 text-[9px] font-black uppercase ${recibeDemasia(linea)?'border-emerald-300 bg-emerald-50 text-emerald-800':'border-stone-300 bg-stone-50 text-stone-500'}`} title="Define si participa en la división de la demasía"><input type="checkbox" checked={recibeDemasia(linea)} onChange={(event)=>onChange(lineas.map((item,posicion)=>posicion===indice?{...item,participa_demasia:event.target.checked}:item))} className="h-4 w-4 shrink-0 accent-emerald-700"/>Demasía</label>}
            {panaderos ? <><SueldoInput valor={linea.nombre.trim() ? montoBase(linea, esFestivo, recibeDemasia(linea) ? demasia : 0, configPago) : 0} nombre={linea.nombre} manual={linea.monto_manual} onCommit={(monto) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, monto, monto_manual: true, monto_es_base: true } : item))} /><div title="Total del panadero: base + demasía + bonos + dominical" className="grid h-10 place-items-center rounded-md bg-[#2A1710] px-1 text-right text-xs font-black text-white">{linea.nombre.trim()?dinero(montoLinea(linea,esFestivo,recibeDemasia(linea)?demasia:0,configPago)+totalBonos(linea)+(correspondeDominical(linea,fecha||hoy,funcionariosPanaderos)?montoBase(linea,esFestivo,recibeDemasia(linea)?demasia:0,configPago):0)):dinero(0)}</div></> : <input type="text" inputMode="numeric" value={linea.monto || ''} onChange={(event) => onChange(lineas.map((item, posicion) => posicion === indice ? { ...item, monto: Math.max(0, numero(event.target.value)) } : item))} placeholder="$0" className="h-10 rounded-md border border-[#4B2818]/20 px-3 text-right text-sm font-black" />}
            <button type="button" aria-label="Eliminar fila" onClick={() => onChange(lineas.filter((_, posicion) => posicion !== indice))} className="grid h-10 place-items-center rounded-md text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      {panaderos && lineas.some((linea) => linea.nombre.trim()) && <div className="mt-3 rounded-lg border border-[#E9D7BC] bg-[#FFF9EF] p-3"><p className="text-[10px] font-black uppercase tracking-wide text-[#4B2818]/60">Bonos pagados por Caja</p><div className="mt-2 space-y-2">{lineas.filter((linea) => linea.nombre.trim()).map((linea) => <div key={linea.id} className="grid items-center gap-2 sm:grid-cols-[120px_160px_1fr]"><span className="truncate text-xs font-black">{linea.nombre}</span><select value="" onChange={(event) => { const concepto=conceptosBono.find((item)=>item.id===event.target.value); if(!concepto || (linea.bonos||[]).some((bono)=>bono.concepto_id===concepto.id)) return; onChange(lineas.map((item)=>item.id===linea.id?{...item,bonos:[...(item.bonos||[]),{id:crypto.randomUUID(),concepto_id:concepto.id,nombre:concepto.nombre,monto:concepto.monto}]}:item)); }} className="h-8 rounded-md border bg-white px-2 text-xs font-bold"><option value="">+ Asignar bono</option>{conceptosBono.filter((concepto)=>concepto.activo).map((concepto)=><option key={concepto.id} value={concepto.id}>{concepto.nombre} · {dinero(concepto.monto)}</option>)}</select><div className="flex flex-wrap gap-1">{(linea.bonos||[]).map((bono)=><span key={bono.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#A51F2B]">{bono.nombre} {dinero(bono.monto)}<button type="button" onClick={()=>onChange(lineas.map((item)=>item.id===linea.id?{...item,bonos:(item.bonos||[]).filter((actual)=>actual.id!==bono.id)}:item))} aria-label={`Quitar ${bono.nombre}`}>×</button></span>)}</div></div>)}</div></div>}
      {panaderos && <div className="mt-3 ml-auto w-full max-w-xs overflow-hidden rounded-lg border border-[#E9D7BC]"><div className="flex items-center justify-between bg-[#FFF9EF] px-4 py-2 text-sm"><span className="font-black text-[#4B2818]/70">Demasía distribuida</span><span className="font-black text-[#A51F2B]">{dinero(cantidad ? demasiaTotal : 0)}</span></div>{dominicalTotal>0&&<div className="flex items-center justify-between border-t border-[#E9D7BC] bg-amber-50 px-4 py-2 text-sm"><span className="font-black text-[#4B2818]/70">Dominical</span><span className="font-black text-[#A51F2B]">{dinero(dominicalTotal)}</span></div>}<div className="flex items-center justify-between border-t border-[#E9D7BC] bg-[#2A1710] px-4 py-3 text-white"><span className="font-black">Total</span><span className="text-lg font-black">{dinero(total)}</span></div></div>}
      <button type="button" onClick={() => onChange([...lineas, nuevaLinea(Boolean(panaderos))])} className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#A51F2B]/30 px-3 py-2 text-xs font-black text-[#A51F2B]"><Plus className="h-4 w-4" />Agregar fila</button>
    </section>
  );
}

export default function CajaDiariaPage() {
  const { perfil } = useAdminSession();
  const [fecha, setFecha] = useState(hoy);
  const [cajeras, setCajeras] = useState<Funcionario[]>([]);
  const [funcionariosPanaderos, setFuncionariosPanaderos] = useState<Funcionario[]>([]);
  const [conceptosBono, setConceptosBono] = useState<ConceptoBono[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [errorDotaciones, setErrorDotaciones] = useState('');
  const [dotacionId, setDotacionId] = useState('');
  const [cajeraId, setCajeraId] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([nuevoTurno(1), nuevoTurno(2)]);
  const [gastos, setGastos] = useState<Linea[]>([nuevaLinea()]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [efectivo, setEfectivo] = useState(0);
  const [tarjetas, setTarjetas] = useState(0);
  const [esFestivo, setEsFestivo] = useState(false);
  const [configPago, setConfigPago] = useState<ConfigPago>(CONFIG_PAGO_BASE);
  const [observacion, setObservacion] = useState('');
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [historial, setHistorial] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const totalesTurnos = turnos.map((turno) => lineasCalculadas(turno, esFestivo, configPago, fecha, funcionariosPanaderos).reduce((suma, item) => suma + numero(item.total_pago ?? item.monto), 0));
  const totalPanaderos = totalesTurnos.reduce((suma, monto) => suma + monto, 0);
  const totalComprasGastos = gastos.reduce((suma, item) => suma + numero(item.monto), 0);
  const totalGastos = totalPanaderos + totalComprasGastos;
  const totalComprobado = efectivo + tarjetas + totalGastos;
  const diferencia = totalVentas - totalComprobado;
  const cuadrada = Math.abs(diferencia) < 0.5;
  const bloqueada = cierre?.estado === 'cerrada';
  const festivoObligatorio = esFeriadoChile(fecha);

  function aplicarDotacion(id: string) {
    setDotacionId(id);
    const plantilla = plantillas.find((item) => item.id === id);
    if (!plantilla) return;
    setTurnos(plantilla.turnos.map((turno) => ({ id: crypto.randomUUID(), nombre: turno.nombre, qq: 0, lineas: turno.panaderos.map((item) => ({ ...item, id: crypto.randomUUID(), monto: 0 })) })));
  }

  async function cargarBase() {
    if (!perfil) return;
    const [{ data: funcionarios }, { data: cierres }, respuestaDotaciones, { data: bonos }] = await Promise.all([
      supabase.from('funcionarios').select('id,nombre_completo,nombre_corto,cargo,recibe_dominical,ciclo_dominical,funcionario_cargos(cargos_empresa(nombre))').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre_completo'),
      supabase.from('caja_cierres').select('*').eq('empresa_id', perfil.empresa_id).order('fecha', { ascending: false }).limit(31),
      supabase.from('caja_dotaciones_semanales').select('*').eq('empresa_id', perfil.empresa_id).order('created_at'),
      supabase.from('caja_conceptos_bono').select('id,nombre,monto,activo').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre'),
    ]);
    const { data: dotaciones, error: errorDotacion } = respuestaDotaciones;
    const lista = (funcionarios || []) as unknown as Funcionario[];
    const listaCajeras = lista.filter(esFuncionarioCajera);
    setCajeras(listaCajeras);
    setFuncionariosPanaderos(lista.filter(esFuncionarioPanadero));
    setConceptosBono((bonos || []) as ConceptoBono[]);
    setHistorial((cierres || []) as Cierre[]);
    setPlantillas(((dotaciones || []) as PlantillaDb[]).map(normalizarPlantilla));
    setErrorDotaciones(errorDotacion?.message || '');
    const predeterminada = listaCajeras.some((item) => item.id === perfil.funcionario_id) ? perfil.funcionario_id : listaCajeras[0]?.id || '';
    setCajeraId((actual) => actual || predeterminada);
    setCargando(false);
  }

  function cargarCierre(item: Cierre | null) {
    setCierre(item);
    setTurnos(
      item?.turnos_panaderos?.length
        ? item.turnos_panaderos
        : [
            { id: crypto.randomUUID(), nombre: '1° turno', qq: 0, lineas: item?.panaderos_primer_turno?.length ? item.panaderos_primer_turno : [nuevaLinea(true)] },
            { id: crypto.randomUUID(), nombre: '2° turno', qq: 0, lineas: item?.panaderos_segundo_turno?.length ? item.panaderos_segundo_turno : [nuevaLinea(true)] },
          ]
    );
    setGastos(item?.compras_gastos?.length ? item.compras_gastos : [nuevaLinea()]);
    setCajeraId((actual) => {
      if (item?.cajera_id) return item.cajera_id;
      if (cajeras.some((cajera) => cajera.id === actual)) return actual;
      if (cajeras.some((cajera) => cajera.id === perfil?.funcionario_id)) return perfil?.funcionario_id || '';
      return cajeras[0]?.id || '';
    });
    setTotalVentas(numero(item?.total_ventas));
    setEfectivo(numero(item?.efectivo));
    setTarjetas(numero(item?.tarjetas));
    setEsFestivo(Boolean(item?.es_festivo));
    setDotacionId(item?.dotacion_id || '');
    setObservacion(item?.observacion || '');
  }

  useEffect(() => { void cargarBase(); }, [perfil]);
  useEffect(() => { if (!perfil) return; void (async()=>{ const { data }=await supabase.from('cargo_remuneraciones_especiales').select('configuracion').eq('empresa_id',perfil.empresa_id).lte('vigente_desde',fecha).order('vigente_desde',{ascending:false}).limit(1).maybeSingle(); setConfigPago((data?.configuracion as ConfigPago)||CONFIG_PAGO_BASE); })(); }, [perfil,fecha]);
  useEffect(() => {
    if (cargando || !perfil) return;
    const existente = historial.find((item) => item.fecha === fecha) || null;
    if (existente) return cargarCierre(existente);
    cargarCierre(null);
    setEsFestivo(esFeriadoChile(fecha));
    const sugerida = dotacionParaFecha(plantillas, fecha);
    if (sugerida) aplicarDotacion(sugerida.id);
  }, [fecha, cargando, historial, perfil, plantillas]);

  async function guardar(estado: 'borrador' | 'cerrada') {
    if (!perfil || !cajeraId) return alert('Selecciona la cajera responsable.');
    if (estado === 'cerrada' && !cuadrada && !observacion.trim()) return alert('Explica la diferencia antes de cerrar la caja.');
    if (estado === 'cerrada' && !confirm(cuadrada ? '¿Cerrar y bloquear la caja del día?' : 'La caja tiene diferencia. ¿Cerrar igualmente con la observación ingresada?')) return;
    const cajera = cajeras.find((item) => item.id === cajeraId);
    setGuardando(true);
    const datos = {
      empresa_id: perfil.empresa_id,
      fecha,
      cajera_id: cajeraId,
      cajera_nombre: cajera?.nombre_completo || perfil.nombre_visible,
      turnos_panaderos: turnos.map((turno) => ({ ...turno, lineas: lineasCalculadas(turno, esFestivo, configPago, fecha, funcionariosPanaderos).filter((item) => item.nombre.trim() || item.monto) })),
      panaderos_primer_turno: lineasCalculadas(turnos[0] || nuevoTurno(1), esFestivo, configPago, fecha, funcionariosPanaderos).filter((item) => item.nombre.trim() || item.monto),
      panaderos_segundo_turno: lineasCalculadas(turnos[1] || nuevoTurno(2), esFestivo, configPago, fecha, funcionariosPanaderos).filter((item) => item.nombre.trim() || item.monto),
      compras_gastos: gastos.filter((item) => item.nombre.trim() || item.monto),
      total_ventas: totalVentas,
      efectivo,
      tarjetas,
      observacion: observacion.trim() || null,
      estado,
      es_festivo: esFestivo,
      dotacion_id: dotacionId || null,
      cerrado_en: estado === 'cerrada' ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('caja_cierres').upsert(datos, { onConflict: 'empresa_id,fecha' });
    setGuardando(false);
    if (error) return alert(error.message);
    await cargarBase();
    alert(estado === 'cerrada' ? 'Caja cerrada.' : 'Borrador guardado.');
  }

  if (cargando) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#A51F2B]" /></div>;

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-widest text-[#A51F2B]">Comercial</p><h1 className="mt-1 text-3xl font-black text-[#2A1710]">Caja diaria</h1><p className="mt-2 text-sm font-bold text-[#4B2818]/65">Cuadre manual de ventas, pagos a panaderos y gastos del día.</p><Link href="/admin/caja/dotacion" className="mt-3 inline-flex text-sm font-black text-[#A51F2B] underline">Configurar dotaciones</Link></div>
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${cuadrada ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{cuadrada ? <CheckCircle2 className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}{cuadrada ? 'Caja cuadrada' : `Diferencia ${dinero(diferencia)}`}</div>
      </header>

      <section className="grid gap-3 rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-[#4B2818]/60">Fecha<input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="h-11 w-full min-w-0 rounded-md border px-3 text-sm font-bold normal-case" /></label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-[#4B2818]/60">Cajera responsable<select value={cajeraId} disabled={bloqueada} onChange={(event) => setCajeraId(event.target.value)} className="h-11 w-full min-w-0 rounded-md border bg-white px-3 text-sm font-bold normal-case disabled:bg-stone-100"><option value="">Seleccionar</option>{cajeras.map((item) => <option key={item.id} value={item.id}>{item.nombre_completo}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-xs font-black uppercase text-[#4B2818]/60">Dotación del día<select value={dotacionId} disabled={bloqueada} onChange={(event) => aplicarDotacion(event.target.value)} className="h-11 w-full min-w-0 rounded-md border bg-white px-3 text-sm font-bold normal-case disabled:bg-stone-100"><option value="">Seleccionar dotación</option>{plantillas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="flex h-11 items-center gap-3 self-end rounded-md border px-3 text-sm font-black"><input type="checkbox" checked={esFestivo} disabled={bloqueada || festivoObligatorio} onChange={(event) => setEsFestivo(event.target.checked)} className="h-4 w-4 accent-[#A51F2B]" />{festivoObligatorio ? 'Festivo automático' : 'Día festivo'}</label>
      </section>
      {errorDotaciones && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-800">No se pudieron cargar las dotaciones: {errorDotaciones}. Ejecuta la migración 20260803_dotaciones_por_nombre_feriados.sql.</div>}

      <fieldset disabled={bloqueada} className="space-y-5 disabled:opacity-75">
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            {turnos.map((turno) => <EditorLineas key={turno.id} titulo={`Panaderos · ${turno.nombre}`} fecha={fecha} lineas={turno.lineas} panaderos qq={turno.qq || 0} esFestivo={esFestivo} configPago={configPago} funcionariosPanaderos={funcionariosPanaderos} conceptosBono={conceptosBono} onQq={(qq) => setTurnos((actuales) => actuales.map((item) => item.id === turno.id ? { ...item, qq } : item))} onChange={(lineas) => setTurnos((actuales) => actuales.map((item) => item.id === turno.id ? { ...item, lineas } : item))} onRemove={turnos.length > 1 ? () => setTurnos((actuales) => actuales.filter((item) => item.id !== turno.id)) : undefined} />)}
            <button type="button" onClick={() => setTurnos((actuales) => [...actuales, nuevoTurno(actuales.length + 1)])} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#A51F2B]/35 bg-white text-sm font-black text-[#A51F2B] hover:bg-[#FFF3DF]"><Plus className="h-4 w-4" />Agregar turno de panaderos</button>
          </div>
          <EditorLineas titulo="Compras y Gastos" lineas={gastos} onChange={setGastos} />
        </div>

        <section className="overflow-hidden rounded-xl border border-[#4B2818]/15 bg-white shadow-sm">
          <div className="border-b border-[#4B2818]/10 bg-[#2A1710] px-5 py-4 text-white"><h2 className="text-lg font-black">Cuadre del día</h2><p className="text-xs font-bold text-white/65">Efectivo + Tarjetas + Panaderos + Compras/Gastos</p></div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            {[['Total ventas', totalVentas, setTotalVentas], ['Efectivo', efectivo, setEfectivo], ['Tarjetas', tarjetas, setTarjetas]].map(([etiqueta, valor, setter]) => <label key={String(etiqueta)} className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">{String(etiqueta)}<input type="text" inputMode="numeric" value={Number(valor) || ''} onChange={(event) => (setter as (valor: number) => void)(Math.max(0, numero(event.target.value)))} className="h-14 rounded-lg border-2 border-[#D9C4A7] px-4 text-right text-xl font-black text-[#2A1710] outline-none focus:border-[#A51F2B]" /></label>)}
          </div>
          <div className="grid gap-3 border-t border-[#4B2818]/10 bg-[#FFF9EF] p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">Panaderos · {turnos.length} turno(s)</p><p className="text-lg font-black">{dinero(totalPanaderos)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">Compras/Gastos</p><p className="text-lg font-black">{dinero(totalComprasGastos)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-[#4B2818]/55">Total comprobado</p><p className="text-lg font-black">{dinero(totalComprobado)}</p></div>
            <div className={`rounded-lg px-4 py-3 ${cuadrada ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}><p className="text-[10px] font-black uppercase">Diferencia</p><p className="text-xl font-black">{dinero(diferencia)}</p></div>
          </div>
        </section>

        <label className="grid gap-1 text-xs font-black uppercase text-[#4B2818]/60">Observación<textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} placeholder={cuadrada ? 'Opcional' : 'Obligatoria si existe diferencia'} className="min-h-24 rounded-lg border border-[#4B2818]/20 p-3 text-sm font-bold normal-case" /></label>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3">
        {!bloqueada && <><button type="button" disabled={guardando} onClick={() => void guardar('borrador')} className="inline-flex h-11 items-center gap-2 rounded-md border border-[#A51F2B] bg-white px-5 text-sm font-black text-[#A51F2B]"><Save className="h-4 w-4" />Guardar borrador</button><button type="button" disabled={guardando} onClick={() => void guardar('cerrada')} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#A51F2B] px-6 text-sm font-black text-white"><CheckCircle2 className="h-4 w-4" />Cerrar caja</button></>}
        {bloqueada && <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">Cierre bloqueado</span>}
      </div>

      <section className="rounded-xl border border-[#4B2818]/15 bg-white p-4 shadow-sm"><h2 className="font-black text-[#2A1710]">Últimos cierres</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-[#FFF3DF]"><tr><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Cajera</th><th className="px-3 py-2 text-right">Ventas</th><th className="px-3 py-2 text-right">Estado</th></tr></thead><tbody>{historial.map((item) => <tr key={item.id} className="cursor-pointer border-b hover:bg-[#FFF9EF]" onClick={() => setFecha(item.fecha)}><td className="px-3 py-2 font-black">{new Date(`${item.fecha}T12:00:00`).toLocaleDateString('es-CL')}</td><td className="px-3 py-2">{item.cajera_nombre}</td><td className="px-3 py-2 text-right font-black">{dinero(item.total_ventas)}</td><td className="px-3 py-2 text-right"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.estado === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.estado}</span></td></tr>)}</tbody></table></div></section>
    </div>
  );
}
