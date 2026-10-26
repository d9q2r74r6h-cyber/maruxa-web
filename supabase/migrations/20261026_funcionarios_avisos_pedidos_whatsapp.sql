alter table public.funcionarios
  add column if not exists recibe_avisos_pedidos_whatsapp boolean not null default false;

-- Conserva el comportamiento anterior: quienes ya pertenecen a pastelería
-- continúan recibiendo avisos hasta que un administrador cambie la selección.
update public.funcionarios f
set recibe_avisos_pedidos_whatsapp = true
where lower(coalesce(f.cargo, '')) like '%pastel%'
   or exists (
     select 1
     from public.funcionario_cargos fc
     join public.cargos_empresa ce on ce.id = fc.cargo_id
     where fc.funcionario_id = f.id
       and lower(coalesce(ce.nombre, '')) like '%pastel%'
   );

comment on column public.funcionarios.recibe_avisos_pedidos_whatsapp is
  'Recibe por WhatsApp los avisos automáticos de nuevos pedidos.';
