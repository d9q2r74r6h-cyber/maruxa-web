import assert from 'node:assert/strict';
import test from 'node:test';
import { prepararFacturaRecibida, leerRespuestaLimitada, decodificarXml } from '../lib/facturas-correo.ts';
import { leerXmlFactura } from '../lib/importar-factura.ts';
import { recibirFacturasCorreo } from '../lib/recibir-facturas-correo.ts';
const xml = `<DTE><Documento><Encabezado><IdDoc><TipoDTE>33</TipoDTE><Folio>000123</Folio><FchEmis>2026-09-24</FchEmis></IdDoc><Emisor><RUTEmisor>76.123.456-0</RUTEmisor><RznSoc>Prueba</RznSoc></Emisor><Receptor><RUTRecep>76.123.456-0</RUTRecep></Receptor><Totales><MntNeto>1000</MntNeto><IVA>190</IVA><MntTotal>1190</MntTotal></Totales></Encabezado><Detalle><NmbItem>Harina</NmbItem><QtyItem>2</QtyItem><MontoItem>1000</MontoItem></Detalle></Documento></DTE>`;
function basePrueba() {
 const tablas: Record<string, any[]> = { empresas: [{id:'empresa',rut:'76.123.456-0'}], facturas_correo_adjuntos: [], facturas_recibidas: [] };
 let secuencia=0;
 const admin = { from(tabla: string) {
  assert.ok(tabla in tablas, 'El receptor no debe escribir costos ni stock');
  let accion='select', valores:any, opciones:any, filtros: [string, any][]=[];
  const q:any = {
   select(){return q;}, eq(k:string,v:any){filtros.push([k,v]);return q;},
   upsert(v:any,o:any){accion='upsert';valores=v;opciones=o;return q;},
   insert(v:any){accion='insert';valores=v;return q;}, update(v:any){accion='update';valores=v;return q;},
   single(){return Promise.resolve(ejecutar(true));}, then(ok:any,fail:any){return Promise.resolve(ejecutar(false)).then(ok,fail);},
  };
  function ejecutar(single:boolean) {
   const filas=tablas[tabla];
   if(accion==='upsert') {
    assert.equal(opciones.ignoreDuplicates,true);
    const existe=filas.find(f=>f.empresa_id===valores.empresa_id&&f.email_id===valores.email_id&&f.adjunto_id===valores.adjunto_id);
    if(!existe) filas.push({id:String(++secuencia),xml:null,...valores});
   }
   if(accion==='insert') {
    const existe=filas.find(f=>['empresa_id','rut_emisor','tipo','folio'].every(k=>f[k]===valores[k]));
    if(existe) return {data:null,error:{code:'23505'}};
    filas.push({id:String(++secuencia),...valores});
   }
   const resultado=filas.filter(f=>filtros.every(([k,v])=>f[k]===v));
   if(accion==='update') resultado.forEach(f=>Object.assign(f,valores));
   return {data:single?resultado[0]:resultado,error:null};
  }
  return q;
 }};
 const resend={emails:{receiving:{attachments:{get:async()=>({data:{download_url:'https://example.invalid/factura.xml',size:xml.length},error:null})}}}};
 const correo=(id='email1')=>({id,from:'proveedor@example.invalid',subject:'Factura de prueba',attachments:[{id:'adjunto1',filename:'factura.xml',size:xml.length,content_type:'text/xml'}]});
 return {admin:admin as any,resend:resend as any,tablas,correo};
}
test('normaliza RUT y folio para una clave de duplicación estable',()=>{
 const f=prepararFacturaRecibida(leerXmlFactura(xml)[0],'76123456-0');
 assert.equal(f.rut_emisor,'761234560');assert.equal(f.folio,'123');assert.equal(f.estado,'pendiente');
 assert.equal('original' in f.datos,false);
});
test('rechaza XML dirigido a otra empresa y RUT receptor ausente',()=>{
 const f=leerXmlFactura(xml)[0];
 assert.throws(()=>prepararFacturaRecibida({...f,rutReceptor:'11111111-1'},'76123456-0'),/receptor/);
 assert.throws(()=>prepararFacturaRecibida({...f,rutReceptor:''},'76123456-0'),/receptor/);
});
test('líneas descuadradas quedan para revisión',()=>{
 const f=leerXmlFactura(xml)[0];f.lineas[0].montoNeto=800;
 assert.equal(prepararFacturaRecibida(f,'76123456-0').estado,'revision');
});
test('descarga limitada incluso sin Content-Length y decodificación Latin-1',async()=>{
 await assert.rejects(()=>leerRespuestaLimitada(new Response('123456'),5),RangeError);
 const latin=Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><nombre>Piñón</nombre>','latin1');
 assert.ok(decodificarXml(latin).includes('Piñón'));
});
test('recepción, reintento y reenvío no duplican factura ni tocan existencias',async(t)=>{
 const b=basePrueba();let descargas=0;
 t.mock.method(globalThis,'fetch',async()=>{descargas++;return new Response(xml);});
 await recibirFacturasCorreo(b.admin,b.resend,'empresa',b.correo());
 await recibirFacturasCorreo(b.admin,b.resend,'empresa',b.correo());
 assert.equal(descargas,1);assert.equal(b.tablas.facturas_recibidas.length,1);
 await recibirFacturasCorreo(b.admin,b.resend,'empresa',b.correo('email2'));
 assert.equal(b.tablas.facturas_recibidas.length,1);
 assert.equal(b.tablas.facturas_correo_adjuntos[1].duplicadas,1);
 assert.equal(b.tablas.facturas_correo_adjuntos[0].xml,xml);
});
test('adjunto corrupto queda visible como error y no crea facturas',async(t)=>{
 const b=basePrueba();t.mock.method(globalThis,'fetch',async()=>new Response('<DTE>'));
 await recibirFacturasCorreo(b.admin,b.resend,'empresa',b.correo());
 assert.equal(b.tablas.facturas_correo_adjuntos[0].estado,'error');
 assert.equal(b.tablas.facturas_recibidas.length,0);
});
test('fallo temporal de descarga deja el adjunto pendiente para reintento',async(t)=>{
 const b=basePrueba();t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
 await assert.rejects(()=>recibirFacturasCorreo(b.admin,b.resend,'empresa',b.correo()),/descargar/);
 assert.equal(b.tablas.facturas_correo_adjuntos[0].estado,'pendiente');
});
test('correo sin XML se registra sin crear facturas',async()=>{
 const b=basePrueba();await recibirFacturasCorreo(b.admin,b.resend,'empresa',{...b.correo(),attachments:[]});
 assert.equal(b.tablas.facturas_correo_adjuntos[0].estado,'sin_xml');
 assert.equal(b.tablas.facturas_recibidas.length,0);
});
