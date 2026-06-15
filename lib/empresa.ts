import { supabase } from '@/lib/supabase';

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
      : '';

  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .or(`dominio.eq.${host},slug.eq.maruxa`)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo empresa:', error.message);
    return null;
  }

  return data;
}