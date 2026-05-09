-- One server-linked experience per member per Discord guild (prevents double-submit duplicates).
-- Keeps the row with verification or the most recently created.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, guild_id
      ORDER BY
        (CASE WHEN is_verified THEN 1 ELSE 0 END) DESC,
        verified_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.experiences
  WHERE guild_id IS NOT NULL
    AND guild_id <> ''
)
DELETE FROM public.experiences e
USING ranked r
WHERE e.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS experiences_profile_guild_unique
  ON public.experiences (profile_id, guild_id)
  WHERE guild_id IS NOT NULL AND guild_id <> '';
