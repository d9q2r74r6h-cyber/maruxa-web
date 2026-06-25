-- Bucket publico para las fotos del catalogo y escritura por empresa.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'productos',
  'productos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "imagenes_productos_lectura_publica" on storage.objects;
create policy "imagenes_productos_lectura_publica"
on storage.objects
for select
to public
using (bucket_id = 'productos');

drop policy if exists "imagenes_productos_insertar_empresa" on storage.objects;
create policy "imagenes_productos_insertar_empresa"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'productos'
  and (storage.foldername(name))[1] = public.usuario_empresa_id()::text
);

drop policy if exists "imagenes_productos_actualizar_empresa" on storage.objects;
create policy "imagenes_productos_actualizar_empresa"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'productos'
  and (storage.foldername(name))[1] = public.usuario_empresa_id()::text
)
with check (
  bucket_id = 'productos'
  and (storage.foldername(name))[1] = public.usuario_empresa_id()::text
);

drop policy if exists "imagenes_productos_eliminar_empresa" on storage.objects;
create policy "imagenes_productos_eliminar_empresa"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'productos'
  and (storage.foldername(name))[1] = public.usuario_empresa_id()::text
);
