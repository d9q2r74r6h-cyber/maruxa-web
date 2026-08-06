import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const CORREO_ADMIN = 'panaderiamaruxa@hotmail.com';

export async function POST(request: Request) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:'Servicio de registro no configurado.'},{status:503});
  const datos=await request.json();
  const obligatorios=['razon_social','rut','contacto_nombre','email','telefono','empresa_direccion','empresa_comuna','empresa_ciudad','empresa_region','password'];
  if(obligatorios.some((campo)=>!String(datos[campo]||'').trim()))return NextResponse.json({error:'Completa todos los campos obligatorios.'},{status:400});
  if(!datos.despacho_a_empresa&&['despacho_direccion','despacho_comuna','despacho_ciudad','despacho_region'].some((campo)=>!String(datos[campo]||'').trim()))return NextResponse.json({error:'Completa la direccion de despacho.'},{status:400});
  if(String(datos.password).length<8)return NextResponse.json({error:'La contrasena debe tener al menos 8 caracteres.'},{status:400});
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:empresa}=await admin.from('empresas').select('id').eq('slug','maruxa').eq('activo',true).single();
  if(!empresa)return NextResponse.json({error:'Empresa no configurada.'},{status:503});
  const email=String(datos.email).trim().toLowerCase();
  const {data:usuario,error:errorUsuario}=await admin.auth.admin.createUser({email,password:String(datos.password),email_confirm:true,user_metadata:{tipo:'cliente_mayorista',nombre:datos.contacto_nombre}});
  if(errorUsuario)return NextResponse.json({error:errorUsuario.message.includes('already')?'Ya existe una cuenta con este correo.':errorUsuario.message},{status:400});
  const {error}=await admin.from('clientes_mayoristas').insert({empresa_id:empresa.id,auth_user_id:usuario.user.id,razon_social:String(datos.razon_social).trim(),rut:String(datos.rut).trim(),giro:String(datos.giro||'').trim()||null,contacto_nombre:String(datos.contacto_nombre).trim(),email,telefono:String(datos.telefono).trim(),empresa_direccion:String(datos.empresa_direccion).trim(),empresa_comuna:String(datos.empresa_comuna).trim(),empresa_ciudad:String(datos.empresa_ciudad).trim(),empresa_region:String(datos.empresa_region).trim(),despacho_a_empresa:Boolean(datos.despacho_a_empresa),despacho_direccion:datos.despacho_a_empresa?null:String(datos.despacho_direccion).trim(),despacho_comuna:datos.despacho_a_empresa?null:String(datos.despacho_comuna).trim(),despacho_ciudad:datos.despacho_a_empresa?null:String(datos.despacho_ciudad).trim(),despacho_region:datos.despacho_a_empresa?null:String(datos.despacho_region).trim(),despacho_referencia:String(datos.despacho_referencia||'').trim()||null,volumen_estimado:String(datos.volumen_estimado||'').trim()||null});
  if(error){await admin.auth.admin.deleteUser(usuario.user.id);return NextResponse.json({error:error.code==='23505'?'Ya existe una solicitud con ese RUT o correo.':error.message},{status:400});}
  if(process.env.RESEND_API_KEY){const resend=new Resend(process.env.RESEND_API_KEY);await resend.emails.send({from:'Panaderia Maruxa <admin@panaderiamaruxa.cl>',to:[CORREO_ADMIN],subject:`Nueva solicitud mayorista: ${datos.razon_social}`,html:`<h2>Nueva solicitud de Pasteleria Mayorista</h2><p><strong>Empresa:</strong> ${datos.razon_social}<br><strong>RUT:</strong> ${datos.rut}<br><strong>Contacto:</strong> ${datos.contacto_nombre}<br><strong>Correo:</strong> ${email}<br><strong>Telefono:</strong> ${datos.telefono}</p><p>Ingresa al modulo Clientes mayoristas para revisarla.</p>`});}
  return NextResponse.json({ok:true});
}
