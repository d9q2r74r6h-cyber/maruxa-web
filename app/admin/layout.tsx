import { AdminSessionProvider } from '@/components/AdminSession';
import { AdminLayoutShell } from '@/components/AdminLayoutShell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AdminSessionProvider>
  );
}
