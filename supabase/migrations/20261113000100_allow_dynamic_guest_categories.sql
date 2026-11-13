-- EventCheckRijan: allow free-form guest categories.
-- Category names are supplied by each event's Excel import or manual entry.
ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_category_check;
