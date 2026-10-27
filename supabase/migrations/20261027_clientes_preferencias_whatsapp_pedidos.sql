alter table public.clientes
  add column if not exists whatsapp_pedidos_autorizado boolean not null default false,
  add column if not exists whatsapp_recordatorio_diario boolean not null default false;

comment on column public.clientes.whatsapp_pedidos_autorizado is
  'El cliente autorizó recibir mensajes relacionados con pedidos por WhatsApp.';

comment on column public.clientes.whatsapp_recordatorio_diario is
  'El cliente recibe el recordatorio de pedido de domingo a viernes a las 19:00.';
