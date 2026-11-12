-- Mengizinkan petugas menambahkan tamu walk-in secara manual.
-- Fungsi hanya dapat digunakan oleh petugas yang ditugaskan ke event terkait.
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_staff es
    WHERE es.staff_id = auth.uid()
      AND es.event_id = p_event_id
  ) THEN
    RAISE EXCEPTION 'Anda tidak ditugaskan pada acara ini.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Acara tidak ditemukan atau sudah diarsipkan.';
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nama tamu wajib diisi.';
  END IF;

  INSERT INTO public.guests (
    event_id,
    name,
    institution,
    category,
    guest_group,
    invitation_code,
    invite_token,
    status,
    source
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
  )
  RETURNING * INTO v_guest;

  RETURN v_guest;
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_add_guest_manual(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_add_guest_manual(uuid, text, text, text, text) TO authenticated;
