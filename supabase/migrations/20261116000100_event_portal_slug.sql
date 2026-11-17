-- Portal Undangan Digital: slug unik untuk setiap event.
-- Tidak mengubah UUID event, invitation_code, maupun invite_token tamu.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS portal_slug text;

-- Isi slug untuk event yang sudah ada. Sufiks UUID pendek menjaga keunikan.
UPDATE public.events
SET portal_slug =
  COALESCE(
    NULLIF(
      trim(BOTH '-' FROM regexp_replace(
        lower(trim(COALESCE(name, ''))),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    'event'
  ) || '-' || left(replace(id::text, '-', ''), 8)
WHERE portal_slug IS NULL OR btrim(portal_slug) = '';

ALTER TABLE public.events
  ALTER COLUMN portal_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_portal_slug_lower_uidx
  ON public.events (lower(portal_slug));

-- Slug dibuat otomatis saat event baru disimpan, bukan setiap kali nama event diedit.
CREATE OR REPLACE FUNCTION public.set_event_portal_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
BEGIN
  IF NEW.portal_slug IS NULL OR btrim(NEW.portal_slug) = '' THEN
    base_slug := trim(BOTH '-' FROM regexp_replace(
      lower(trim(COALESCE(NEW.name, ''))),
      '[^a-z0-9]+', '-', 'g'
    ));

    IF base_slug = '' THEN
      base_slug := 'event';
    END IF;

    NEW.portal_slug := base_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_set_portal_slug ON public.events;
CREATE TRIGGER events_set_portal_slug
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_event_portal_slug();

COMMENT ON COLUMN public.events.portal_slug IS
  'Slug URL publik untuk portal undangan event; dibuat sekali dan tidak berubah otomatis.';
