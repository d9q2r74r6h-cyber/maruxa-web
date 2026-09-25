import assert from 'node:assert/strict';
import test from 'node:test';
import { leerXmlFactura, leerTextoFactura, problemasFactura, numeroChileno, rutValido } from '../lib/importar-factura.ts';
const documento = (detalle = '<Detalle><NmbItem>Harina &amp; trigo</NmbItem><QtyItem>2.5</QtyItem><UnmdItem>KG</UnmdItem><MontoItem>1000</MontoItem></Detalle>', id = '', totales = '<MntNeto>1000</MntNeto><TasaIVA>19</TasaIVA><IVA>190</IVA><MntTotal>1190</MntTotal>', tipo = '33') => `<DTE xmlns="http://www.sii.cl/SiiDte"><Documento><Encabezado><IdDoc><TipoDTE>${tipo}</TipoDTE><Folio>123</Folio><FchEmis>2026-09-24</FchEmis>${id}</IdDoc><Emisor><RUTEmisor>76.123.456-0</RUTEmisor><RznSoc>Proveedor prueba</RznSoc></Emisor><Receptor><RUTRecep>76.123.456-0</RUTRecep></Receptor><Totales>${totales}</Totales></Encabezado>${detalle}</Documento></DTE>`;
test('lee factura con cantidad decimal, conserva neto y entidades XML', () => {
 const [f] = leerXmlFactura(documento());
 assert.equal(f.lineas[0].nombre, 'Harina & trigo');
 assert.equal(f.lineas[0].cantidad, 2.5);
 assert.equal(f.lineas[0].montoNeto, 1000);
 assert.equal(f.total, 1190);
 assert.equal(rutValido(f.rutEmisor), true);
 assert.deepEqual(problemasFactura(f), []);
});
test('un sobre puede contener varios documentos sin mezclarlos', () => {
 const f = leerXmlFactura(`<EnvioDTE><SetDTE>${documento()}${documento().replace('<Folio>123', '<Folio>124')}</SetDTE></EnvioDTE>`);
 assert.deepEqual(f.map(x => x.folio), ['123', '124']);
});
test('normaliza monto bruto a neto sin volver a aplicar descuentos de línea', () => {
 const [f] = leerXmlFactura(documento('<Detalle><NmbItem>Harina</NmbItem><QtyItem>2</QtyItem><PrcItem>1190</PrcItem><DescuentoMonto>1190</DescuentoMonto><MontoItem>1190</MontoItem></Detalle>', '<MntBruto>1</MntBruto>'));
 assert.equal(f.lineas[0].montoNeto, 1000);
 assert.deepEqual(problemasFactura(f), []);
});
test('reconoce factura exenta y cantidad omitida', () => {
 const [f] = leerXmlFactura(documento('<Detalle><NmbItem>Servicio</NmbItem><MontoItem>1000</MontoItem></Detalle>', '', '<MntExe>1000</MntExe><MntTotal>1000</MntTotal>', '34'));
 assert.equal(f.lineas[0].exento, true);
 assert.equal(f.lineas[0].cantidad, 1);
 assert.deepEqual(problemasFactura(f), []);
});
test('bloquea notas de crédito, entidades externas y archivos corruptos', () => {
 assert.throws(() => leerXmlFactura(documento('', '', '', '61')), /33/);
 assert.throws(() => leerXmlFactura('<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><DTE/>'), /entidades/);
 assert.throws(() => leerXmlFactura('<DTE>'), /válido/);
 assert.throws(() => leerXmlFactura('<html/>'), /DTE/);
});
test('descuentos globales requieren cuadrar el detalle antes de transferir costos', () => {
 const [f] = leerXmlFactura(documento().replace('</Documento>', '<DscRcgGlobal><TpoMov>D</TpoMov><ValorDR>10</ValorDR></DscRcgGlobal></Documento>').replace('<MntNeto>1000', '<MntNeto>900').replace('<IVA>190', '<IVA>171').replace('<MntTotal>1190', '<MntTotal>1071'));
 assert.ok(f.avisos.length);
 assert.ok(problemasFactura(f).some(e => e.includes('detalle')));
});
test('XML con prefijos y folio sin conversión numérica', () => {
 const prefijos = documento().replace(/<(\/?)([A-Z][A-Za-z0-9]*)/g, '<$1sii:$2').replace('xmlns=', 'xmlns:sii=');
 assert.equal(leerXmlFactura(prefijos)[0].folio, '123');
});
test('OCR sugiere solo líneas aritméticamente coherentes y no inventa proveedor', () => {
 const f = leerTextoFactura('FACTURA ELECTRONICA\nN° 18\n24/09/2026\nRUT 76.123.456-0\nHarina 2,5 400 1.000\nDudoso 2 300 900\nNETO 1.000\nIVA 19% 190\nTOTAL 1.190');
 assert.equal(f.folio, '18'); assert.equal(f.fecha, '2026-09-24');
 assert.equal(f.lineas.length, 1); assert.equal(f.lineas[0].cantidad, 2.5);
 assert.equal(f.total, 1190); assert.equal(f.proveedor, '');
 assert.ok(problemasFactura(f).length);
});
test('RUTs ambiguos, fecha imposible y totales incorrectos requieren revisión', () => {
 assert.equal(leerTextoFactura('RUT 76.123.456-0\nRUT 77.123.456-1').rutEmisor, '');
 const f = leerXmlFactura(documento())[0];
 f.fecha = '2026-04-31'; f.total = 2000;
 assert.ok(problemasFactura(f).some(e => e.includes('fecha')));
 assert.ok(problemasFactura(f).some(e => e.includes('total')));
 assert.equal(rutValido('76.123.456-1'), false);
 assert.equal(numeroChileno('1.234,56'), 1234.56);
 assert.ok(Number.isNaN(numeroChileno('1x23')));
});
