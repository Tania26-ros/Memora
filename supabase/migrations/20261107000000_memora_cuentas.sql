-- ─────────────────────────────────────────────────────────────
-- Memora · Etapa 5: cuentas y copia en la nube.
-- Cada persona solo puede leer y escribir lo suyo (RLS).
-- ─────────────────────────────────────────────────────────────

-- Perfil público mínimo (se usará en la comunidad, etapa 6).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Cada quien ve su perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Cada quien crea su perfil" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Cada quien edita su perfil" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Carpeta privada para las copias: backups/<id del usuario>/memora.json
insert into storage.buckets (id, name, public, file_size_limit)
values ('backups', 'backups', false, 52428800)
on conflict (id) do nothing;

create policy "Leer mi copia" on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Subir mi copia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Actualizar mi copia" on storage.objects
  for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Borrar mi copia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
