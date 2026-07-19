import { Header } from '@/components/Header';
import { Home } from '@/components/Home';
import { RecoveryRedirect } from '@/components/RecoveryRedirect';

export default function Page() {
  return (
    <>
      <RecoveryRedirect />
      <Header />
      <Home />
    </>
  );
}
