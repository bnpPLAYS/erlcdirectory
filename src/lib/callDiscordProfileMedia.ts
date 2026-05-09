import { supabase } from '@/integrations/supabase/client';

export type DiscordProfileMediaResult = {
  ok: boolean;
  banner_url?: string | null;
  discord_avatar?: string | null;
  error?: string;
};

/** Pull latest Discord avatar + banner into `profiles` (Edge Function `discord-profile-media`). */
export async function invokeDiscordProfileMediaSync(): Promise<DiscordProfileMediaResult> {
  const { data, error } = await supabase.functions.invoke<DiscordProfileMediaResult>('discord-profile-media', {
    body: {},
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    const err = (data as { error?: string }).error;
    return { ok: false, error: err || 'Sync failed' };
  }

  return {
    ok: true,
    banner_url: data?.banner_url ?? null,
    discord_avatar: data?.discord_avatar ?? null,
  };
}
