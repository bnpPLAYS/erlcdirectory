CREATE TABLE public.experience_verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  guild_icon TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','revoked')),
  approver_discord_id TEXT,
  approver_discord_username TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_evr_token ON public.experience_verification_requests(token);
CREATE INDEX idx_evr_experience ON public.experience_verification_requests(experience_id);

ALTER TABLE public.experience_verification_requests ENABLE ROW LEVEL SECURITY;

-- Owner of the experience can see and manage their own requests
CREATE POLICY "Owners can view their own verification requests"
  ON public.experience_verification_requests FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can create verification requests"
  ON public.experience_verification_requests FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can revoke their own verification requests"
  ON public.experience_verification_requests FOR DELETE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Add a column on experiences to track which guild the verified experience is tied to
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS guild_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_by_discord_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_by_discord_username TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
