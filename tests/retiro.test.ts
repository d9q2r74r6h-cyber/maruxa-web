import assert from 'node:assert/strict';
import test from 'node:test';
import { cumpleAnticipacionRetiro } from '../lib/retiro.ts';

test('considera la hora elegida y permite retirar mañana después de 24 horas', () => {
  const ahora = new Date(2026, 8, 22, 15, 30);
  const manana = new Date(2026, 8, 23);
  assert.equal(cumpleAnticipacionRetiro(manana, '16:00', ahora), true);
  assert.equal(cumpleAnticipacionRetiro(manana, '15:30', ahora), true);
  assert.equal(cumpleAnticipacionRetiro(manana, '15:29', ahora), false);
  assert.equal(cumpleAnticipacionRetiro(manana, '', ahora), false);
  assert.equal(cumpleAnticipacionRetiro(manana, '25:00', ahora), false);
});

test('calcula el plazo al cambiar de mes o año', () => {
  assert.equal(cumpleAnticipacionRetiro(new Date(2027, 0, 1), '10:00', new Date(2026, 11, 31, 9)), true);
  assert.equal(cumpleAnticipacionRetiro(new Date(2026, 9, 1), '08:00', new Date(2026, 8, 30, 9)), false);
});
