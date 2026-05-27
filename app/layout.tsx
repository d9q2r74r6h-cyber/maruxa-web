import { Toaster } from 'sonner';
import './globals.css';
import type { Metadata } from 'next';

export const metadata = {
    
    metadataBase: new URL('https://panaderiamaruxa.cl'),
    title: 'Panadería Maruxa',
    description:
      'Panadería artesanal chilena. Tortas, pastelería y productos frescos con retiro en local.',
  

      verification: {
        google: 'Stvm8-p6J2jlL-EAExP7pu2vb2zPYqMk86fsLPGF4hk',
      },

      
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

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-CL">
    <script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Bakery',
      name: 'Panadería Maruxa',
      url: 'https://panaderiamaruxa.cl',
      image: 'https://panaderiamaruxa.cl/og-maruxa.png',
      description:
        'Panadería artesanal con panes, pastelería y tortas con retiro en local.',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'CL',
      },
    }),
  }}
/>
    
    <body>{children}
<Toaster
  richColors
  position="top-center"
/></body></html>}


