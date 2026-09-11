import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCanalWhatsapp } from '@/lib/whatsapp-canales';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RUBRO = ['panadería','pastelería','repostería','productos de panadería','productos de pastelería','pan amasado','tortas'];
type Oportunidad = { codigo:string; nombre:string; recomendacion?:string; puntaje?:number; dias_restantes?:number|null; tipo:'licitacion'|'compra_agil' };

function telefono(v:unknown){return String(v||'').replace(/\D/g,'');}
function autorizado(r:Request){
  const secreto=process.env.CRON_SECRET;
  if(!secreto)return false;
  return r.headers.get('authorization')?.replace(/^Bearer\s+/i,'')===secreto;
}
async function whatsapp(destino:string,mensaje:string){
  const canal=obtenerCanalWhatsapp();
  if(!canal)throw new Error('WhatsApp no configurado.');
  const r=await fetch(`https://graph.facebook.com/v20.0/${canal.phoneNumberId}/messages`,{
    method:'POST',headers:{Authorization:`Bearer ${canal.accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:destino,type:'text',text:{preview_url:false,body:mensaje}})
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.error?.message||`WhatsApp rechazó el envío (${r.status}).`);
  return data?.messages?.[0]?.id||`licitaciones-${Date.now()}`;
}
function mensaje(items:Oportunidad[]){
  const lista=items.slice(0,5).map((x,i)=>{
    const tipo=x.tipo==='compra_agil'?'Compra Ágil':'Licitación';
    const plazo=x.dias_restantes==null?'':` · cierra en ${x.dias_restantes} días`;
    return `${i+1}. ${tipo}: ${x.nombre}\n${x.codigo} · ${x.recomendacion||'Revisar'} (${x.puntaje||0}/100)${plazo}`;
  }).join('\n\n');
  const extra=items.length>5?`\n\nY ${items.length-5} oportunidades adicionales.`:'';
  return `🔔 Nuevas oportunidades para Maruxa\n\n${lista}${extra}\n\nRevísalas en https://panaderiamaruxa.cl/admin/licitaciones`;
}

export async function GET(request:Request){
  if(!process.env.CRON_SECRET)return NextResponse.json({error:'CRON_SECRET no configurado.'},{status:503});
  if(!autorizado(request))return NextResponse.json({error:'No autorizado.'},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:'Supabase no configurado.'},{status:503});
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  let consulta=await admin.from('empresas').select('id,licitaciones_palabras_clave').eq('activo',true);
  if(consulta.error?.code==='42703'){
    const respaldo=await admin.from('empresas').select('id').eq('activo',true);
    consulta={...respaldo,data:(respaldo.data||[]).map(e=>({...e,licitaciones_palabras_clave:RUBRO}))} as typeof consulta;
  }
  if(consulta.error)return NextResponse.json({error:consulta.error.message},{status:500});
  const origin=new URL(request.url).origin,resultados=[];

  for(const empresa of consulta.data||[]){
    const rubros=Array.isArray(empresa.licitaciones_palabras_clave)&&empresa.licitaciones_palabras_clave.length?empresa.licitaciones_palabras_clave:RUBRO;
    const qs=new URLSearchParams({rubros:rubros.join(',')});
    const respuestas=await Promise.allSettled([
      fetch(`${origin}/api/admin/licitaciones?${qs}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()),
      fetch(`${origin}/api/admin/compra-agil?${qs}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject())
    ]);
    const todas:Oportunidad[]=[];
    if(respuestas[0].status==='fulfilled')todas.push(...(respuestas[0].value.licitaciones||[]).map((x:Omit<Oportunidad,'tipo'>)=>({...x,tipo:'licitacion' as const})));
    if(respuestas[1].status==='fulfilled')todas.push(...(respuestas[1].value.oportunidades||[]).map((x:Omit<Oportunidad,'tipo'>)=>({...x,tipo:'compra_agil' as const})));

    const inicio=await admin.from('licitacion_alertas_enviadas').select('id').eq('empresa_id',empresa.id).eq('tipo','sistema').eq('codigo','__inicio__').maybeSingle();
    if(!inicio.data){
      await admin.from('licitacion_alertas_enviadas').upsert([
        {empresa_id:empresa.id,tipo:'sistema',codigo:'__inicio__'},
        ...todas.map(x=>({empresa_id:empresa.id,tipo:x.tipo,codigo:x.codigo}))
      ],{onConflict:'empresa_id,tipo,codigo',ignoreDuplicates:true});
      resultados.push({empresa_id:empresa.id,inicializadas:todas.length,nuevas:0});continue;
    }

    const codigos=todas.map(x=>x.codigo);
    const conocidas=codigos.length?await admin.from('licitacion_alertas_enviadas').select('tipo,codigo').eq('empresa_id',empresa.id).in('codigo',codigos):{data:[]};
    const claves=new Set((conocidas.data||[]).map(x=>`${x.tipo}:${x.codigo}`));
    const nuevas=todas.filter(x=>!claves.has(`${x.tipo}:${x.codigo}`));
    if(!nuevas.length){resultados.push({empresa_id:empresa.id,nuevas:0});continue;}

    const perfiles=await admin.from('perfiles_usuario').select('id,nombre_visible,notificacion_whatsapp').eq('empresa_id',empresa.id).eq('activo',true).eq('notificar_whatsapp',true).not('notificacion_whatsapp','is',null).limit(5);
    let enviados=0;const errores:string[]=[];const texto=mensaje(nuevas);
    for(const perfil of perfiles.data||[]){
      const destino=telefono(perfil.notificacion_whatsapp);if(!destino)continue;
      try{
        const messageId=await whatsapp(destino,texto);enviados++;
        await admin.from('whatsapp_eventos').insert({empresa_id:empresa.id,message_id:messageId,telefono:destino,tipo:'aviso_administrador',estado:'enviado',observacion:texto,payload:{direccion:'saliente',origen:'agente_licitaciones',destinatario:perfil.nombre_visible}});
      }catch(e){errores.push(e instanceof Error?e.message:'Error de WhatsApp.');}
    }
    if(enviados)await admin.from('licitacion_alertas_enviadas').upsert(nuevas.map(x=>({empresa_id:empresa.id,tipo:x.tipo,codigo:x.codigo})),{onConflict:'empresa_id,tipo,codigo',ignoreDuplicates:true});
    resultados.push({empresa_id:empresa.id,nuevas:nuevas.length,destinatarios:enviados,errores});
  }
  return NextResponse.json({ok:true,resultados});
}
