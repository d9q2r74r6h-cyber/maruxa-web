import { Toaster } from 'sonner';
import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>
        {children}

        <Toaster richColors position="top-center" />

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

        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;
            n.push=n;
            n.loaded=!0;
            n.version='2.0';
            n.queue=[];
            t=b.createElement(e);
            t.async=!0;
            t.src=v;
            s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}
            (window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');

            fbq('init', '322565593442022');
            fbq('track', 'PageView');
          `}
        </Script>
      </body>
    </html>
  );
}