import { Toaster } from 'sonner';
import './globals.css';
import type { Metadata } from 'next';

export const metadata = {
    title: 'Panadería Maruxa',
    description:
      'Panadería artesanal chilena. Tortas, pastelería y productos frescos con retiro en local.',
  
    openGraph: {
      title: 'Panadería Maruxa',
      description:
        'Panadería artesanal chilena premium.',
      url: 'https://www.panaderiamaruxa.cl',
      siteName: 'Maruxa',
      images: [
        {
          url: '/og-maruxa.png',
          width: 1200,
          height: 630,
        },
      ],
      locale: 'es_CL',
      type: 'website',
    },
  };

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-CL"><body>{children}
<Toaster
  richColors
  position="top-center"
/></body></html>}


