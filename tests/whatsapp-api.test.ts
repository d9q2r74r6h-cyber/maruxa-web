import assert from 'node:assert/strict';
import test from 'node:test';
import { resumirErrorWhatsapp } from '../lib/whatsapp-api.ts';

test('resume un error de plantilla de Meta sin exponer el detalle técnico', () => {
  const mensaje = resumirErrorWhatsapp(
    '{"error":{"message":"(#132001) Template name does not exist in the translation"}}'
  );

  assert.equal(
    mensaje,
    'La plantilla de aviso no está disponible o no está aprobada en Meta.'
  );
});

test('resume un error de permisos de WhatsApp', () => {
  assert.equal(
    resumirErrorWhatsapp('OAuthException: Invalid access token'),
    'WhatsApp rechazó la conexión. Revisa los permisos y el token del canal.'
  );
});
