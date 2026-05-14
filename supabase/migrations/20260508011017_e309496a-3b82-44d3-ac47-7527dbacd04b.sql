
-- Allow admins to delete posts, servers, profiles, experiences
CREATE POLICY "Admins can delete posts" ON public.posts FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete servers" ON public.servers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update servers" ON public.servers FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update posts" ON public.posts FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
