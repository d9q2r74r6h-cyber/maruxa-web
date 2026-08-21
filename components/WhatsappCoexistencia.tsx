'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const META_APP_ID = '883388000861812';
const CONFIG_ID = '1344035874530274';

type EmbeddedSignupData = {
  waba_id?: string;
  phone_number_id?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opciones: Record<string, unknown>) => void;
      login: (
        callback: (respuesta: { authResponse?: { code?: string } }) => void,
        opciones: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function WhatsappCoexistencia() {
  const [sdkListo, setSdkListo] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [resultado, setResultado] = useState<{
    phoneNumberId?: string | null;
    telefono?: string | null;
  } | null>(null);
  const datosSignupRef = useRef<EmbeddedSignupData>({});

  useEffect(() => {
    function recibirMensaje(evento: MessageEvent) {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(evento.origin)) {
        return;
      }

      let datos = evento.data;
      if (typeof datos === 'string') {
        try {
          datos = JSON.parse(datos);
        } catch {
          return;
        }
      }

      if (datos?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (datos?.event === 'FINISH') {
        datosSignupRef.current = datos.data || {};
      }
      if (datos?.event === 'ERROR') {
        toast.error(datos?.data?.error_message || 'Meta no completo la conexion.');
      }
    }

    window.addEventListener('message', recibirMensaje);
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v23.0',
      });
      setSdkListo(true);
    };

    if (window.FB) {
      window.fbAsyncInit();
    } else if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      document.body.appendChild(script);
    }

    return () => window.removeEventListener('message', recibirMensaje);
  }, []);

  async function intercambiarCodigo(code: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Tu sesion expiro. Vuelve a iniciar sesion.');

    const respuesta = await fetch('/api/whatsapp/coexistencia', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        wabaId: datosSignupRef.current.waba_id,
        phoneNumberId: datosSignupRef.current.phone_number_id,
      }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la conexion.');

    setResultado(datos);
    toast.success('5041 autorizado y suscrito al webhook.');
  }

  function conectar() {
    if (!window.FB || !sdkListo) {
      toast.error('Meta todavia se esta cargando. Intenta nuevamente.');
      return;
    }

    datosSignupRef.current = {};
    setConectando(true);
    window.FB.login(
      (respuesta) => {
        const code = respuesta.authResponse?.code;
        if (!code) {
          setConectando(false);
          toast.error('La autorizacion fue cancelada o no entrego un codigo.');
          return;
        }

        intercambiarCodigo(code)
          .catch((error) => toast.error(error.message))
          .finally(() => setConectando(false));
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    );
  }

  return (
    <div className="rounded-2xl border border-maruxa-rojo/15 bg-white p-4 shadow-premium">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-maruxa-chocolate">Automatizar WhatsApp 5041</p>
          <p className="mt-1 text-xs font-bold text-maruxa-cafe/65">
            Autoriza coexistencia sin desconectar la aplicacion WhatsApp Business del telefono.
          </p>
        </div>
        <button
          type="button"
          onClick={conectar}
          disabled={!sdkListo || conectando}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#A51F2B] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {conectando ? 'Conectando...' : 'Conectar 5041 a la web'}
        </button>
      </div>
      {resultado && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          Meta autorizo {resultado.telefono || 'el 5041'} (Phone Number ID{' '}
          {resultado.phoneNumberId || 'pendiente'}). Falta activar las variables del canal secundario.
        </p>
      )}
    </div>
  );
}
