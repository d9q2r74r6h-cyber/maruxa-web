import assert from 'node:assert/strict';
import test from 'node:test';
import { presentacionesProducto, presentacionesDisponibles, validarPresentaciones } from '../lib/presentaciones.ts';
import { validarItemPedido, type ProductoPedidoFuente } from '../lib/pedidos.ts';
const producto: ProductoPedidoFuente = {
 id: 1, nombre: 'Torta', precio: 28000, imagen: null,
 precio_10: null, precio_15: null, precio_20: null, precio_25: null,
 presentaciones: [{id:'grande',nombre:'30 personas',precio:48000,activo:true},{id:'mini',nombre:'Individual',precio:8000,activo:false}],
};
test('convierte únicamente los tamaños antiguos con precio y permite una presentación única',()=>{
 assert.deepEqual(presentacionesProducto({precio_10:null,precio_15:20000}), [{id:'legacy-15',nombre:'15 personas',precio:20000,activo:true}]);
 assert.equal(presentacionesDisponibles(producto).length,1);
});
test('acepta tamaños libres y usa el precio vigente del servidor',()=>{
 const item=validarItemPedido({id:1,cantidad:2,presentacion_id:'grande',tamano:'nombre viejo'},producto);
 assert.equal(item.precio,48000);assert.equal(item.tamano,'30 personas');assert.equal(item.presentacion_id,'grande');
});
test('acepta carritos antiguos por nombre cuando no tienen identificador',()=>{
 assert.equal(validarItemPedido({id:1,cantidad:1,tamano:'30 personas'},producto).precio,48000);
});
test('rechaza presentaciones retiradas, inventadas o sin selección',()=>{
 for(const id of ['mini','inexistente'])assert.throws(()=>validarItemPedido({id:1,cantidad:1,presentacion_id:id},producto));
 assert.throws(()=>validarItemPedido({id:1,cantidad:1},producto));
 assert.throws(()=>validarItemPedido({id:1,cantidad:1,tamano:'10 personas'},producto));
});
test('una lista nueva vacía no resucita tamaños antiguos',()=>{
 assert.deepEqual(presentacionesProducto({presentaciones:[],precio_10:10000}),[]);
});
test('valida nombres, identificadores y precios',()=>{
 const p={id:'a',nombre:'Grande',precio:10000,activo:true};
 assert.doesNotThrow(()=>validarPresentaciones([p]));
 for(const precio of [0,-1,NaN,Infinity,1.5])assert.throws(()=>validarPresentaciones([{...p,precio}]));
 assert.throws(()=>validarPresentaciones([p,{...p,id:'b',nombre:' grande '}]));
 assert.throws(()=>validarPresentaciones([p,{...p,nombre:'Pequeña'}]));
 assert.throws(()=>validarPresentaciones([{...p,nombre:' '} ]));
});
