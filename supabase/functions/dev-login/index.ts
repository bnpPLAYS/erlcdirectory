import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const DEV_EMAIL = 'dev-preview@erlcdirectory.local'
const DEV_USERNAME = 'devpreview'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Backend not configured.' }, 500)

    const body = await req.json().catch(() => ({}))
    const appRedirectTo = typeof body.appRedirectTo === 'string' ? body.appRedirectTo : ''
    if (!appRedirectTo.startsWith('http')) return json({ error: 'Invalid redirect.' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    // Find or create the dev user
    let userId: string | null = null
    const { data: users } = await admin.auth.admin.listUsers()
    userId = users?.users.find((u) => u.email?.toLowerCase() === DEV_EMAIL)?.id ?? null

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: DEV_EMAIL,
        email_confirm: true,
        user_metadata: { provider: 'dev', full_name: 'Dev Preview' },
      })
      if (createError) return json({ error: createError.message }, 500)
      userId = created.user?.id ?? null
    }

    if (!userId) return json({ error: 'Could not provision dev user.' }, 500)

    // Ensure a profile exists
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingProfile) {
      await admin.from('profiles').insert({
        user_id: userId,
        discord_username: DEV_USERNAME,
        display_name: 'Dev Preview',
      })
    }

    const { data: magicLink, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: DEV_EMAIL,
      options: { redirectTo: appRedirectTo },
    })

    if (linkError || !magicLink?.properties?.action_link) {
      return json({ error: 'Could not generate sign-in link.' }, 500)
    }

    return json({ success: true, actionLink: magicLink.properties.action_link })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})
