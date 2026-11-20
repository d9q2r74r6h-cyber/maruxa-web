import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cumpleAnticipacionRetiro,
  fechaMinimaRetiro,
  retiroEsPosteriorAhoraEnChile,
} from '../lib/retiro.ts';

test('calcula la primera hora disponible exactamente 24 horas después', () => {
  const ahora = new Date(2026, 8, 22, 15, 30);
  const minimo = fechaMinimaRetiro(ahora);

  assert.equal(minimo.getTime(), new Date(2026, 8, 23, 15, 30).getTime());
});

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

test('distingue una hora futura de una hora que ya pasó en Chile', () => {
  const ahora = new Date('2026-11-20T10:15:00-03:00');
  assert.equal(retiroEsPosteriorAhoraEnChile('2026-11-20', '10:14', ahora), false);
  assert.equal(retiroEsPosteriorAhoraEnChile('2026-11-20', '10:15', ahora), false);
  assert.equal(retiroEsPosteriorAhoraEnChile('2026-11-20', '10:16', ahora), true);
});
