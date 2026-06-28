export const telefonoVisible = '+56 2 3366 3241';
export const whatsapp = '56986232447';
export const instagram = 'https://www.instagram.com/panaderiamaruxa/';
export const facebook = 'https://www.facebook.com/panaderiamaruxa';

export const productos = [
  { id:1, nombre:'Pan amasado', categoria:'Panadería', precio:2490, etiqueta:'Tradicional', imagen:'🥖' },
  { id:2, nombre:'Marraquetas', categoria:'Panadería', precio:2190, etiqueta:'Diario', imagen:'🍞' },
  { id:3, nombre:'Torta amor', categoria:'Tortas', precio:24900, etiqueta:'24 horas', imagen:'🎂' },
  { id:4, nombre:'Torta chocolate', categoria:'Tortas', precio:27900, etiqueta:'Favorita', imagen:'🍫' },
  { id:5, nombre:'Empolvados', categoria:'Pastelería', precio:1290, etiqueta:'Clásico', imagen:'🍰' },
  { id:6, nombre:'Kuchen', categoria:'Pastelería', precio:15900, etiqueta:'Familiar', imagen:'🥧' },
];

export const pedidos = [
  { id:'MX-1029', cliente:'Camila R.', telefono:'+56 9 8765 4321', tipo:'Torta chocolate', retiro:'Mañana 17:00', estado:'Pendiente', total:27900 },
  { id:'MX-1030', cliente:'Jorge M.', telefono:'+56 9 5555 1111', tipo:'Torta amor', retiro:'Viernes 12:30', estado:'Confirmado', total:24900 },
  { id:'MX-1031', cliente:'Valentina P.', telefono:'+56 9 2222 7777', tipo:'Kuchen familiar', retiro:'Sábado 10:00', estado:'Listo', total:15900 },
];

export const estados = ['Pendiente','Confirmado','En preparación','Listo','Entregado'];
