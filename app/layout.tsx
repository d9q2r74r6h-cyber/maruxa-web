import { Toaster } from 'sonner';
import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title:'Panadería Maruxa | Panadería y pastelería artesanal', description:'Panadería Maruxa: panes, pastelería y tortas con retiro en local.' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-CL"><body>{children}
<Toaster
  richColors
  position="top-center"
/></body></html>}


