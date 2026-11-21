-- Registro informativo de boletas anuladas dentro del cierre diario.
-- No modifica total_ventas, efectivo, tarjetas ni el cálculo de cuadre.
alter table public.caja_cierres
  add column if not exists boletas_nulas jsonb not null default '[]'::jsonb;
