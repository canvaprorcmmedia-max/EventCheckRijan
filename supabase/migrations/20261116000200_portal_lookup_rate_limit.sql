-- Rate limit persisten untuk pencarian kode undangan pada Portal Undangan.
-- Hanya Edge Function dengan service_role yang dapat memakai tabel/fungsi ini.

begin;

create table if not exists public.portal_lookup_rate_limits (
  ip_hash text not null,
  bucket_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (ip_hash, bucket_start)
);

alter table public.portal_lookup_rate_limits enable row level security;

revoke all on table public.portal_lookup_rate_limits from anon, authenticated, public;
grant all on table public.portal_lookup_rate_limits to service_role;

create or replace function public.consume_portal_lookup(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_start timestamptz;
  v_attempts integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 32 or length(p_ip_hash) > 128 then
    return false;
  end if;

  -- Satu bucket 15 menit; maksimum 20 percobaan per alamat/portal.
  v_bucket_start := to_timestamp(
    floor(extract(epoch from now()) / 900) * 900
  );

  insert into public.portal_lookup_rate_limits (
    ip_hash, bucket_start, attempts, updated_at
  )
  values (p_ip_hash, v_bucket_start, 1, now())
  on conflict (ip_hash, bucket_start)
  do update set
    attempts = public.portal_lookup_rate_limits.attempts + 1,
    updated_at = now()
  returning attempts into v_attempts;

  -- Bersihkan bucket lama secara opportunistic agar tabel tidak tumbuh terus.
  delete from public.portal_lookup_rate_limits
  where bucket_start < now() - interval '2 days';

  return v_attempts <= 20;
end;
$$;

revoke all on function public.consume_portal_lookup(text) from public, anon, authenticated;
grant execute on function public.consume_portal_lookup(text) to service_role;

commit;
