import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function rutValido(valor:unknown){const rut=String(valor||'').replace(/[^0-9kK]/g,'').toUpperCase();if(!/^\d{7,8}[0-9K]$/.test(rut))return false;let suma=0,multiplicador=2;for(let indice=rut.length-2;indice>=0;indice-=1){suma+=Number(rut[indice])*multiplicador;multiplicador=multiplicador===7?2:multiplicador+1;}const resto=11-(suma%11),esperado=resto===11?'0':resto===10?'K':String(resto);return rut.at(-1)===esperado;}

export async function POST(request:Request){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!token||!url||!key)return NextResponse.json({error:'Sesion requerida.'},{status:401});
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user}}=await admin.auth.getUser(token);if(!user)return NextResponse.json({error:'Sesion invalida.'},{status:401});
  const {data:perfil}=await admin.from('perfiles_usuario').select('empresa_id,rol,activo').eq('id',user.id).maybeSingle();if(!perfil?.activo||!['superadmin','administrador'].includes(perfil.rol))return NextResponse.json({error:'Acceso denegado.'},{status:403});
  const datos=await request.json();const {data:anterior}=await admin.from('clientes_mayoristas').select('email,contacto_nombre,estado,rut,empresa_pais,empresa_region').eq('id',datos.id).eq('empresa_id',perfil.empresa_id).single();
  if(datos.estado==='aprobado'&&(!anterior||!rutValido(anterior.rut)||anterior.empresa_pais!=='Chile'||!anterior.empresa_region))return NextResponse.json({error:'No se puede aprobar: el RUT o la ubicación del cliente no fueron validados.'},{status:400});
  const {error}=await admin.from('clientes_mayoristas').update({estado:datos.estado,descuento_porcentaje:Number(datos.descuento_porcentaje||0),pedido_minimo:Number(datos.pedido_minimo||0),despacho_habilitado:Boolean(datos.despacho_habilitado),condicion_pago:String(datos.condicion_pago||'').trim()||null,observaciones_internas:String(datos.observaciones_internas||'').trim()||null,aprobado_en:datos.estado==='aprobado'?new Date().toISOString():null}).eq('id',datos.id).eq('empresa_id',perfil.empresa_id);if(error)return NextResponse.json({error:error.message},{status:400});
  if(anterior&&anterior.estado!==datos.estado&&process.env.RESEND_API_KEY){const aprobado=datos.estado==='aprobado';const resend=new Resend(process.env.RESEND_API_KEY);await resend.emails.send({from:'Panaderia Maruxa <admin@panaderiamaruxa.cl>',to:[anterior.email],subject:aprobado?'Tu cuenta mayorista fue aprobada':'Actualizacion de tu solicitud mayorista',html:aprobado?`<h2>¡Bienvenido, ${anterior.contacto_nombre}!</h2><p>Tu cuenta de Pasteleria Mayorista fue aprobada. Ya puedes ingresar para consultar tus precios especiales.</p><p><a href="${new URL(request.url).origin}/mayoristas">Ingresar a mi cuenta</a></p>`:`<p>Tu solicitud mayorista ahora se encuentra en estado: <strong>${datos.estado}</strong>.</p>`});}
  return NextResponse.json({ok:true});
}
