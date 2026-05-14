-- Baseline schema (idempotent where safe for preview / re-linked DBs that already have tables).
-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  discord_avatar TEXT,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  timezone TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create experiences table
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL,
  server_icon TEXT,
  role TEXT NOT NULL,
  department TEXT,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create servers table
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  banner TEXT,
  discord_invite TEXT,
  roblox_link TEXT,
  member_count INTEGER DEFAULT 0,
  staff_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_hiring BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  server_id UUID REFERENCES public.servers(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('hiring', 'looking', 'announcement', 'discussion')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  requirements TEXT[] DEFAULT '{}',
  is_open BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversations view helper table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_one UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(participant_one, participant_two)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Experiences policies
DROP POLICY IF EXISTS "Experiences are viewable by everyone" ON public.experiences;
CREATE POLICY "Experiences are viewable by everyone" ON public.experiences FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage their own experiences" ON public.experiences;
CREATE POLICY "Users can manage their own experiences" ON public.experiences FOR ALL USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Servers policies
DROP POLICY IF EXISTS "Servers are viewable by everyone" ON public.servers;
CREATE POLICY "Servers are viewable by everyone" ON public.servers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners can manage their servers" ON public.servers;
CREATE POLICY "Owners can manage their servers" ON public.servers FOR ALL USING (
  owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Authenticated users can create servers" ON public.servers;
CREATE POLICY "Authenticated users can create servers" ON public.servers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Posts policies
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authors can manage their posts" ON public.posts;
CREATE POLICY "Authors can manage their posts" ON public.posts FOR ALL USING (
  author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Messages policies
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (
  sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (
  sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
CREATE POLICY "Users can update their received messages" ON public.messages FOR UPDATE USING (
  receiver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations" ON public.conversations FOR SELECT USING (
  participant_one IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  participant_two IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (
  participant_one IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  participant_two IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_servers_updated_at ON public.servers;
CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON public.servers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, discord_id, discord_username, discord_avatar, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
