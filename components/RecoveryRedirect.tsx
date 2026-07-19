'use client';

import { useEffect } from 'react';

export function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    const esRecuperacion =
      hash.includes('type=recovery') ||
      hash.includes('type=invite') ||
      hash.includes('access_token=');

    if (esRecuperacion && window.location.pathname === '/') {
      window.location.replace(`/admin/crear-contrasena${hash}`);
    }
  }, []);

  return null;
}
