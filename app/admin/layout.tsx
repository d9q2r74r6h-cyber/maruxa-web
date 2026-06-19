import { AdminMenu } from '@/components/AdminMenu';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-maruxa-crema px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <AdminMenu />
        {children}
      </div>
    </main>
  );
}