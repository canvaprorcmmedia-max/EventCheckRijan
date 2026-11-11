-- EventCheckRijan - Tahap 1: fondasi branding lembaga dan per-event
-- Jalankan satu kali melalui Supabase Dashboard > SQL Editor.
-- Bucket logo bersifat public-read; hanya Admin Utama yang boleh mengelola file.

begin;

-- 1. Identitas resmi lembaga (satu baris untuk seluruh aplikasi).
create table if not exists public.organization_branding (
  id smallint primary key default 1 check (id = 1),
  organization_name text not null default 'Riyadlul Jannah',
  official_logo_path text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organization_branding (id, organization_name)
values (1, 'Riyadlul Jannah')
on conflict (id) do nothing;

-- 2. Pengaturan warna setiap event.
create table if not exists public.event_branding (
  event_id uuid primary key references public.events(id) on delete cascade,
  color_primary text not null default '#2868D8' check (color_primary ~ '^#[0-9A-Fa-f]{6}$'),
  color_secondary text not null default '#3978DF' check (color_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  color_accent text not null default '#20A36F' check (color_accent ~ '^#[0-9A-Fa-f]{6}$'),
  color_background text not null default '#F7F9FC' check (color_background ~ '^#[0-9A-Fa-f]{6}$'),
  color_surface text not null default '#FFFFFF' check (color_surface ~ '^#[0-9A-Fa-f]{6}$'),
  color_text text not null default '#172B4D' check (color_text ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Banyak logo tambahan untuk setiap event.
create table if not exists public.event_branding_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')),
  sort_order integer not null default 0,
  show_on_invitation boolean not null default true,
  show_on_qr boolean not null default true,
  show_on_report boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_branding_assets_event_order_idx
  on public.event_branding_assets (event_id, sort_order, created_at);

-- 4. updated_at otomatis diperbarui.
create or replace function public.touch_eventcheck_branding_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_branding_updated_at
  on public.organization_branding;
create trigger organization_branding_updated_at
before update on public.organization_branding
for each row execute function public.touch_eventcheck_branding_updated_at();

drop trigger if exists event_branding_updated_at
  on public.event_branding;
create trigger event_branding_updated_at
before update on public.event_branding
for each row execute function public.touch_eventcheck_branding_updated_at();

-- 5. RLS: informasi branding boleh dibaca untuk menampilkan undangan publik.
-- Perubahan tetap hanya boleh dilakukan oleh Admin Utama.
alter table public.organization_branding enable row level security;
alter table public.event_branding enable row level security;
alter table public.event_branding_assets enable row level security;

drop policy if exists "branding organization public read"
  on public.organization_branding;
create policy "branding organization public read"
on public.organization_branding
for select
to anon, authenticated
using (true);

drop policy if exists "branding organization admin insert"
  on public.organization_branding;
create policy "branding organization admin insert"
on public.organization_branding
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "branding organization admin update"
  on public.organization_branding;
create policy "branding organization admin update"
on public.organization_branding
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "branding event public read"
  on public.event_branding;
create policy "branding event public read"
on public.event_branding
for select
to anon, authenticated
using (true);

drop policy if exists "branding event admin manage"
  on public.event_branding;
create policy "branding event admin manage"
on public.event_branding
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "branding assets public read"
  on public.event_branding_assets;
create policy "branding assets public read"
on public.event_branding_assets
for select
to anon, authenticated
using (true);

drop policy if exists "branding assets admin manage"
  on public.event_branding_assets;
create policy "branding assets admin manage"
on public.event_branding_assets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 6. Bucket logo. Logo dapat ditampilkan publik, upload/hapus tetap admin-only.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'eventcheck-branding',
  'eventcheck-branding',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "eventcheck branding admin upload"
  on storage.objects;
create policy "eventcheck branding admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'eventcheck-branding'
  and public.is_admin()
);

drop policy if exists "eventcheck branding admin update"
  on storage.objects;
create policy "eventcheck branding admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'eventcheck-branding'
  and public.is_admin()
)
with check (
  bucket_id = 'eventcheck-branding'
  and public.is_admin()
);

drop policy if exists "eventcheck branding admin delete"
  on storage.objects;
create policy "eventcheck branding admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'eventcheck-branding'
  and public.is_admin()
);

commit;
