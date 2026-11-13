-- Status akun petugas. Profil dan riwayat check-in tetap dipertahankan.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

-- Semua pemeriksaan akses petugas/admin juga memeriksa status akun.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_event_staff(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_staff es
    JOIN public.profiles p ON p.id = es.staff_id
    WHERE es.event_id = p_event_id
      AND es.staff_id = auth.uid()
      AND p.role = 'staff'
      AND p.is_active = true
  );
$function$;

-- Check-in QR: menolak akun nonaktif melalui is_event_staff().
CREATE OR REPLACE FUNCTION public.confirm_check_in(
  p_event_id uuid,
  p_invite_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_guest public.guests%ROWTYPE;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  IF NOT (public.is_admin() OR public.is_event_staff(p_event_id)) THEN
    RAISE EXCEPTION 'Akun tidak aktif atau tidak memiliki akses ke acara ini.';
  END IF;

  SELECT * INTO v_guest
  FROM public.guests
  WHERE event_id = p_event_id
    AND invite_token = p_invite_token::text
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR tidak valid atau bukan milik acara ini.';
  END IF;

  IF v_guest.status = 'Hadir' THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_checked_in', true,
      'guest_name', v_guest.name
    );
  END IF;

  INSERT INTO public.check_ins (event_id, guest_id, checked_in_by)
  VALUES (p_event_id, v_guest.id, v_user_id);

  UPDATE public.guests
  SET status = 'Hadir'
  WHERE id = v_guest.id AND event_id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_checked_in', false,
    'guest_name', v_guest.name
  );
END;
$function$;

-- Check-in manual: memastikan akun petugas masih aktif dan ditugaskan.
CREATE OR REPLACE FUNCTION public.staff_add_guest_manual(
  p_event_id uuid,
  p_name text,
  p_institution text DEFAULT NULL,
  p_category text DEFAULT 'Reguler',
  p_guest_group text DEFAULT NULL
)
RETURNS public.guests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_guest public.guests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan.';
  END IF;

  IF NOT public.is_event_staff(p_event_id) THEN
    RAISE EXCEPTION 'Akun tidak aktif atau Anda tidak ditugaskan pada acara ini.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND e.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Acara tidak ditemukan atau sudah diarsipkan.';
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nama tamu wajib diisi.';
  END IF;

  INSERT INTO public.guests (
    event_id, name, institution, category, guest_group,
    invitation_code, invite_token, status, source
  ) VALUES (
    p_event_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_institution, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_category, '')), ''), 'Reguler'),
    NULLIF(trim(COALESCE(p_guest_group, '')), ''),
    'ER-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(),
    'Belum hadir',
    'Walk-in'
  ) RETURNING * INTO v_guest;

  RETURN v_guest;
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_add_guest_manual(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_add_guest_manual(uuid, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_check_in(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_check_in(uuid, uuid) TO authenticated;
