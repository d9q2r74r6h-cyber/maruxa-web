alter table public.empresas
  add column if not exists whatsapp text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

update public.empresas
set
  whatsapp = coalesce(nullif(whatsapp, ''), '56986232447'),
  instagram_url = coalesce(nullif(instagram_url, ''), 'https://www.instagram.com/panaderiamaruxa/'),
  facebook_url = coalesce(nullif(facebook_url, ''), 'https://www.facebook.com/panaderiamaruxa')
where slug = 'maruxa';
