import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!token||!url||!key)return NextResponse.json({error:'Sesion requerida.'},{status:401});
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user}}=await admin.auth.getUser(token);
  if(!user)return NextResponse.json({error:'Sesion invalida.'},{status:401});
  const {data:mayorista}=await admin.from('clientes_mayoristas').select('*').eq('auth_user_id',user.id).maybeSingle();
  if(!mayorista)return NextResponse.json({error:'Solicitud no encontrada.'},{status:404});
  if(mayorista.estado!=='aprobado')return NextResponse.json({mayorista,productos:[]});
  const [{data:productos},{data:especiales}]=await Promise.all([
    admin.from('productos').select('id,nombre,descripcion,precio,imagen,categoria').eq('empresa_id',mayorista.empresa_id).eq('activo',true).eq('tipo_producto','producto').gt('precio',0).order('nombre'),
    admin.from('mayorista_producto_precios').select('producto_id,precio').eq('mayorista_id',mayorista.id).eq('activo',true),
  ]);
  const porProducto=new Map((especiales||[]).map((item)=>[String(item.producto_id),Number(item.precio)]));
  const descuento=Number(mayorista.descuento_porcentaje||0);
  return NextResponse.json({mayorista,productos:(productos||[]).map((producto)=>({...producto,precio_publico:Number(producto.precio),precio:porProducto.get(String(producto.id))??Math.round(Number(producto.precio)*(1-descuento/100))}))});
}
