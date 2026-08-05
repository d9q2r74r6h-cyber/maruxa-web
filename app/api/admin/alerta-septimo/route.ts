import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

type Trabajador = { nombre: string; dias_trabajados: number; fechas: string[]; monto: number };
const CORREO_ADMINISTRATIVO = 'panaderiamaruxa@hotmail.com';

function dinero(valor: number) {
  return `$${Math.round(Number(valor || 0)).toLocaleString('es-CL')}`;
}

function escapar(valor: string) {
  return String(valor || '').replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[caracter] || caracter);
}

export async function POST(request: Request) {
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!token||!url||!anon)return NextResponse.json({error:'No autorizado.'},{status:401});

  const supabase=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user}}=await supabase.auth.getUser(token);
  if(!user)return NextResponse.json({error:'No autorizado.'},{status:401});
  if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'Correo administrativo no configurado.'},{status:503});

  const cuerpo=await request.json() as { fecha:string; cajera:string; trabajadores:Trabajador[] };
  const filas=(cuerpo.trabajadores||[]).map((item)=>`<tr><td>${escapar(item.nombre)}</td><td>${item.dias_trabajados} de 6</td><td>${escapar(item.fechas.join(', '))}</td><td style="text-align:right;font-weight:700">${dinero(item.monto)}</td></tr>`).join('');
  const resend=new Resend(process.env.RESEND_API_KEY);
  const {error}=await resend.emails.send({
    from:'Panaderia Maruxa <admin@panaderiamaruxa.cl>',
    to:[CORREO_ADMINISTRATIVO],
    subject:`Alerta: pago de 7mo excepcional ${cuerpo.fecha}`,
    html:`<h2>Pago de 7mo autorizado con menos de seis dias</h2><p><strong>Fecha de Caja:</strong> ${escapar(cuerpo.fecha)}<br><strong>Cajera:</strong> ${escapar(cuerpo.cajera)}</p><table style="border-collapse:collapse;width:100%"><thead><tr><th style="text-align:left">Panadero</th><th style="text-align:left">Dias</th><th style="text-align:left">Fechas trabajadas</th><th style="text-align:right">7mo</th></tr></thead><tbody>${filas}</tbody></table><p>El monto fue calculado dividiendo siempre por 6 y la cajera confirmo continuar con el pago.</p>`,
  });
  if(error)return NextResponse.json({error:error.message},{status:502});
  return NextResponse.json({ok:true});
}
