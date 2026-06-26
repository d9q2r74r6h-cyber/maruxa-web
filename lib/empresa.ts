import { supabase } from '@/lib/supabase';
import { supabasePublic } from '@/lib/supabase-public';

export type Empresa = {
  id: string;
  nombre_fantasia: string;
  razon_social: string;
  rut: string;
  giro: string | null;
  slug: string;
  dominio: string | null;
  logo_url: string | null;
  telefono: string | null;
  email: string | null;
  iva_porcentaje?: number | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  pais: string | null;
  activo: boolean;
};

export async function obtenerEmpresaActual(): Promise<Empresa | null> {
  const host =
    typeof window !== 'undefined'
      ? window.location.hostname.replace('www.', '')
      : 'panaderiamaruxa.cl';

  const consultar = (cliente: typeof supabase) =>
    cliente
      .from('empresas')
      .select('*')
      .eq('slug', 'maruxa')
      .eq('activo', true)
      .limit(1)
      .maybeSingle();

  const respuestaSesion = await consultar(supabase);

  if (respuestaSesion.data) {
    return respuestaSesion.data as Empresa;
  }

  const { data, error } = await consultar(supabasePublic);

  if (error) {
    console.error('Error obteniendo empresa:', error.message);
    return null;
  }

  return data;
}
