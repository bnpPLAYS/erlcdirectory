-- Connection requests table
CREATE TABLE public.connection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT connection_requests_status_check CHECK (status IN ('pending','accepted','declined','cancelled')),
  CONSTRAINT connection_requests_no_self CHECK (sender_id <> receiver_id)
);

-- Only one active (pending or accepted) request between two profiles in a given direction.
CREATE UNIQUE INDEX connection_requests_unique_active
  ON public.connection_requests (sender_id, receiver_id)
  WHERE status IN ('pending','accepted');

CREATE INDEX connection_requests_receiver_idx ON public.connection_requests(receiver_id, status);
CREATE INDEX connection_requests_sender_idx ON public.connection_requests(sender_id, status);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_my_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _profile_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.are_connected(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE status = 'accepted'
      AND ((sender_id = _a AND receiver_id = _b)
        OR (sender_id = _b AND receiver_id = _a))
  );
$$;

-- RLS for connection_requests
CREATE POLICY "Users see requests they sent or received"
ON public.connection_requests
FOR SELECT
USING (public.is_my_profile(sender_id) OR public.is_my_profile(receiver_id));

CREATE POLICY "Users can send connection requests"
ON public.connection_requests
FOR INSERT
WITH CHECK (public.is_my_profile(sender_id) AND status = 'pending');

-- Sender can cancel; receiver can accept/decline. Both via UPDATE.
CREATE POLICY "Participants can update their requests"
ON public.connection_requests
FOR UPDATE
USING (public.is_my_profile(sender_id) OR public.is_my_profile(receiver_id))
WITH CHECK (public.is_my_profile(sender_id) OR public.is_my_profile(receiver_id));

CREATE POLICY "Sender can delete their pending request"
ON public.connection_requests
FOR DELETE
USING (public.is_my_profile(sender_id) AND status IN ('pending','cancelled','declined'));

-- Tighten messages: only allow sending if a connection is accepted
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages to connections"
ON public.messages
FOR INSERT
WITH CHECK (
  public.is_my_profile(sender_id)
  AND public.are_connected(sender_id, receiver_id)
);

-- Tighten conversations: only allow creating if connected
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations with connections"
ON public.conversations
FOR INSERT
WITH CHECK (
  (public.is_my_profile(participant_one) OR public.is_my_profile(participant_two))
  AND public.are_connected(participant_one, participant_two)
);
