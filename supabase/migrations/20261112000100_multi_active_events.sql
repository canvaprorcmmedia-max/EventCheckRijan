-- Izinkan lebih dari satu event berstatus active.
DROP INDEX IF EXISTS public.events_only_one_active_idx;

-- Aktivasi hanya mengubah status event yang diminta.
-- Event aktif lainnya tidak diturunkan menjadi draft.
CREATE OR REPLACE FUNCTION public.activate_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya Admin yang boleh mengaktifkan acara.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = p_event_id
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Acara tidak ditemukan atau sudah diarsipkan.';
  END IF;

  UPDATE public.events
  SET status = 'active',
      updated_at = now()
  WHERE id = p_event_id;
END;
$function$;
