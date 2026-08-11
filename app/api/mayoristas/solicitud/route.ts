import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createHmac } from 'crypto';

const CORREO_ADMIN = 'panaderiamaruxa@hotmail.com';
const REGIONES_CHILE = new Set([
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo','Valparaíso',
  'Metropolitana de Santiago','O’Higgins','Maule','Ñuble','Biobío','La Araucanía',
  'Los Ríos','Los Lagos','Aysén','Magallanes y de la Antártica Chilena',
]);

function texto(valor: unknown) { return String(valor ?? '').trim().replace(/\s+/g, ' '); }
function decodificar(valor: string) { try { return decodeURIComponent(valor); } catch { return valor; } }
function escapar(valor: unknown) { return texto(valor).replace(/[&<>"']/g,(caracter)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[caracter] || caracter)); }
function rutLimpio(valor: unknown) { return texto(valor).replace(/[^0-9kK]/g,'').toUpperCase(); }
function rutValido(valor: unknown) {
  const rut=rutLimpio(valor);
  if(!/^\d{7,8}[0-9K]$/.test(rut))return false;
  const cuerpo=rut.slice(0,-1),verificador=rut.slice(-1);
  let suma=0,multiplicador=2;
  for(let indice=cuerpo.length-1;indice>=0;indice-=1){suma+=Number(cuerpo[indice])*multiplicador;multiplicador=multiplicador===7?2:multiplicador+1;}
  const resto=11-(suma%11),esperado=resto===11?'0':resto===10?'K':String(resto);
  return verificador===esperado;
}
function formatoRut(valor: unknown) { const rut=rutLimpio(valor); return `${Number(rut.slice(0,-1)).toLocaleString('es-CL')}-${rut.slice(-1)}`; }
function pareceTextoHumano(valor: unknown,minimo:number,maximo:number) {
  const dato=texto(valor);
  if(dato.length<minimo||dato.length>maximo||!/[a-záéíóúñ]/iu.test(dato)||/\S{28,}/.test(dato)||/(.)\1{5,}/iu.test(dato))return false;
  const palabras=dato.split(/\s+/).filter(Boolean);
  return !palabras.some((palabra)=>{
    const letras=palabra.replace(/[^a-záéíóúñ]/giu,'');
    if(letras.length<10)return false;
    const cambiosMayuscula=[...letras].slice(1).reduce((total,letra,indice)=>{
      const anterior=letras[indice];
      return total+(/[A-ZÁÉÍÓÚÑ]/.test(letra)!==/[A-ZÁÉÍÓÚÑ]/.test(anterior)?1:0);
    },0);
    const proporcionVocales=(letras.match(/[aeiouáéíóú]/giu)||[]).length/letras.length;
    return cambiosMayuscula>=4||proporcionVocales<0.12||proporcionVocales>0.75;
  });
}
function pareceNombreCompleto(valor:unknown){
  const dato=texto(valor);
  return pareceTextoHumano(dato,5,100)&&dato.split(/\s+/).filter((parte)=>/[a-záéíóúñ]{2,}/iu.test(parte)).length>=2;
}

export async function POST(request: Request) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:'Servicio de registro no configurado.'},{status:503});
  const datos=await request.json();
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:empresa}=await admin.from('empresas').select('id').eq('slug','maruxa').eq('activo',true).single();
  if(!empresa)return NextResponse.json({error:'Empresa no configurada.'},{status:503});
  const registrarIntento=async(motivo:string)=>{
    const ip=(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'').split(',')[0].trim();
    const ipHash=ip?createHmac('sha256',key).update(`${empresa.id}:${ip}`).digest('hex'):null;
    const resumen={
      duracion_ms:Math.max(0,Date.now()-Number(datos.form_started_at||Date.now())),
      ubicacion_conexion:{
        pais:(request.headers.get('x-vercel-ip-country')||request.headers.get('cf-ipcountry')||'').slice(0,8)||null,
        region:(request.headers.get('x-vercel-ip-country-region')||'').slice(0,80)||null,
        ciudad:decodificar(request.headers.get('x-vercel-ip-city')||'').slice(0,100)||null,
        zona_horaria:(request.headers.get('x-vercel-ip-timezone')||'').slice(0,80)||null,
      },
      ubicacion_declarada:{
        pais:texto(datos.empresa_pais).slice(0,80)||null,
        region:texto(datos.empresa_region).slice(0,100)||null,
        comuna:texto(datos.empresa_comuna).slice(0,100)||null,
      },
      razon_social_longitud:texto(datos.razon_social).length,
      contacto_palabras:texto(datos.contacto_nombre).split(/\s+/).filter(Boolean).length,
      direccion_longitud:texto(datos.empresa_direccion).length,
      email_dominio:texto(datos.email).toLowerCase().split('@')[1]?.slice(0,120)||null,
      despacho_a_empresa:Boolean(datos.despacho_a_empresa),
    };
    await admin.from('eventos_seguridad').insert({
      empresa_id:empresa.id,tipo:'formulario_automatizado',ruta:'/api/mayoristas/solicitud',motivo,
      ip_hash:ipHash,user_agent:(request.headers.get('user-agent')||'').slice(0,500)||null,
      referer:(request.headers.get('referer')||'').slice(0,500)||null,detalles:resumen,
    });
  };

  // Campo trampa y tiempo mínimo: los usuarios no lo ven; los bots suelen completarlo o enviar instantáneamente.
  const iniciado=Number(datos.form_started_at||0);
  if(texto(datos.sitio_web)||!iniciado||Date.now()-iniciado<3000||Date.now()-iniciado>86_400_000){
    await registrarIntento(texto(datos.sitio_web)?'campo_trampa_completado':'tiempo_formulario_invalido');
    return NextResponse.json({error:'No fue posible validar la solicitud. Recarga la página e inténtalo nuevamente.'},{status:400});
  }

  const obligatorios=['razon_social','rut','contacto_nombre','email','telefono','empresa_direccion','empresa_comuna','empresa_ciudad','empresa_region','empresa_pais','password'];
  if(obligatorios.some((campo)=>!texto(datos[campo])))return NextResponse.json({error:'Completa todos los campos obligatorios.'},{status:400});
  if(!datos.despacho_a_empresa&&['despacho_direccion','despacho_comuna','despacho_ciudad','despacho_region','despacho_pais'].some((campo)=>!texto(datos[campo])))return NextResponse.json({error:'Completa la dirección de despacho.'},{status:400});
  if(!rutValido(datos.rut))return NextResponse.json({error:'El RUT ingresado no es válido. Revisa el número y su dígito verificador.'},{status:400});

  const email=texto(datos.email).toLowerCase();
  const telefono=texto(datos.telefono).replace(/[\s()-]/g,'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>160)return NextResponse.json({error:'Ingresa un correo electrónico válido.'},{status:400});
  if(!/^\+?\d{8,15}$/.test(telefono))return NextResponse.json({error:'Ingresa un teléfono válido, idealmente con código de país.'},{status:400});
  if(!pareceTextoHumano(datos.razon_social,3,120)||!pareceNombreCompleto(datos.contacto_nombre)||!pareceTextoHumano(datos.empresa_direccion,5,160)||!pareceTextoHumano(datos.empresa_comuna,2,80)||!pareceTextoHumano(datos.empresa_ciudad,2,80)){
    await registrarIntento('contenido_aleatorio_o_no_humano');
    return NextResponse.json({error:'Revisa la razón social, el nombre completo del contacto y la dirección. Hay datos que no parecen válidos.'},{status:400});
  }
  if(texto(datos.empresa_pais)!=='Chile'||!REGIONES_CHILE.has(texto(datos.empresa_region)))return NextResponse.json({error:'Selecciona un país y una región válidos.'},{status:400});
  if(!datos.despacho_a_empresa&&(texto(datos.despacho_pais)!=='Chile'||!REGIONES_CHILE.has(texto(datos.despacho_region))||!pareceTextoHumano(datos.despacho_direccion,5,160)||!pareceTextoHumano(datos.despacho_comuna,2,80)||!pareceTextoHumano(datos.despacho_ciudad,2,80)))return NextResponse.json({error:'Revisa la dirección de despacho y selecciona una región válida.'},{status:400});
  if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,72}$/.test(String(datos.password)))return NextResponse.json({error:'La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula y un número.'},{status:400});

  const rut=formatoRut(datos.rut);
  const {data:existente}=await admin.from('clientes_mayoristas').select('id').eq('empresa_id',empresa.id).or(`rut.eq.${rut},email.eq.${email}`).maybeSingle();
  if(existente)return NextResponse.json({error:'Ya existe una solicitud con ese RUT o correo.'},{status:400});

  const {data:usuario,error:errorUsuario}=await admin.auth.admin.createUser({email,password:String(datos.password),email_confirm:true,user_metadata:{tipo:'cliente_mayorista',nombre:texto(datos.contacto_nombre)}});
  if(errorUsuario)return NextResponse.json({error:errorUsuario.message.includes('already')?'Ya existe una cuenta con este correo.':errorUsuario.message},{status:400});
  const registro={empresa_id:empresa.id,auth_user_id:usuario.user.id,razon_social:texto(datos.razon_social),rut,giro:texto(datos.giro)||null,contacto_nombre:texto(datos.contacto_nombre),email,telefono,empresa_direccion:texto(datos.empresa_direccion),empresa_comuna:texto(datos.empresa_comuna),empresa_ciudad:texto(datos.empresa_ciudad),empresa_region:texto(datos.empresa_region),empresa_pais:'Chile',despacho_a_empresa:Boolean(datos.despacho_a_empresa),despacho_direccion:datos.despacho_a_empresa?null:texto(datos.despacho_direccion),despacho_comuna:datos.despacho_a_empresa?null:texto(datos.despacho_comuna),despacho_ciudad:datos.despacho_a_empresa?null:texto(datos.despacho_ciudad),despacho_region:datos.despacho_a_empresa?null:texto(datos.despacho_region),despacho_pais:datos.despacho_a_empresa?null:'Chile',despacho_referencia:texto(datos.despacho_referencia)||null,volumen_estimado:texto(datos.volumen_estimado)||null};
  const {error}=await admin.from('clientes_mayoristas').insert(registro);
  if(error){await admin.auth.admin.deleteUser(usuario.user.id);return NextResponse.json({error:error.code==='23505'?'Ya existe una solicitud con ese RUT o correo.':error.message},{status:400});}
  if(process.env.RESEND_API_KEY){const resend=new Resend(process.env.RESEND_API_KEY);await resend.emails.send({from:'Panadería Maruxa <admin@panaderiamaruxa.cl>',to:[CORREO_ADMIN],subject:`Nueva solicitud mayorista: ${texto(datos.razon_social)}`,html:`<h2>Nueva solicitud de Pastelería Mayorista</h2><p><strong>Empresa:</strong> ${escapar(datos.razon_social)}<br><strong>RUT:</strong> ${escapar(rut)}<br><strong>Contacto:</strong> ${escapar(datos.contacto_nombre)}<br><strong>Correo:</strong> ${escapar(email)}<br><strong>Teléfono:</strong> ${escapar(telefono)}<br><strong>Ubicación:</strong> ${escapar(datos.empresa_comuna)}, ${escapar(datos.empresa_region)}, Chile</p><p>Ingresa al módulo Clientes mayoristas para revisarla.</p>`});}
  return NextResponse.json({ok:true});
}
