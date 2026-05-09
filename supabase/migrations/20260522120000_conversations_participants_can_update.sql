-- Allow conversation participants to bump last_message_at after sending a message.
DROP POLICY IF EXISTS "Participants can update their conversations" ON public.conversations;
CREATE POLICY "Participants can update their conversations"
ON public.conversations
FOR UPDATE
USING (
  participant_one IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR participant_two IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  participant_one IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR participant_two IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
