/**
 * Members upload profile gallery images to storage bucket `profile-custom`.
 */
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_FREE = 6
const MAX_PRO = 12
const MAX_BYTES = 4_500_000

function extForMime(m: string): string {
  if (m === 'image/png') return 'png'
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  return 'bin'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'Server configuration error.' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) return json({ ok: false, error: 'Invalid session.' }, 401)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ ok: false, error: 'Expected multipart form data.' }, 400)
  }

  const profileId = String(form.get('profile_id') ?? '').trim()
  const file = form.get('file')
  if (!UUID_RE.test(profileId)) return json({ ok: false, error: 'Invalid profile id.' }, 400)
  if (!file || !(file instanceof File)) return json({ ok: false, error: 'Missing file.' }, 400)
  if (file.size > MAX_BYTES) return json({ ok: false, error: 'Image is too large (max ~4.5 MB).' }, 400)

  const mime = file.type || 'application/octet-stream'
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
  if (!allowed.includes(mime)) return json({ ok: false, error: 'Use PNG, JPEG, WebP, or GIF.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: meProf, error: meErr } = await admin
    .from('profiles')
    .select('id, profile_gallery_urls, is_pro')
    .eq('user_id', user.id)
    .maybeSingle()
  if (meErr || !meProf?.id) return json({ ok: false, error: 'Profile not found.' }, 400)
  if (meProf.id !== profileId) return json({ ok: false, error: 'You can only upload to your own profile.' }, 403)

  const isPro = !!(meProf as { is_pro?: boolean }).is_pro
  const maxSlots = isPro ? MAX_PRO : MAX_FREE

  const urls = Array.isArray(meProf.profile_gallery_urls) ? (meProf.profile_gallery_urls as unknown[]) : []
  if (urls.length >= maxSlots) {
    return json(
      {
        ok: false,
        error: isPro
          ? `Gallery is full (${maxSlots} images). Remove one to add another.`
          : `Gallery is full (${maxSlots} images). Pro members can use up to ${MAX_PRO}.`,
      },
      400,
    )
  }

  const ext = extForMime(mime === 'image/jpg' ? 'image/jpeg' : mime)
  const objectPath = `${profileId}/${crypto.randomUUID()}.${ext}`
  const buf = new Uint8Array(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from('profile-custom').upload(objectPath, buf, {
    contentType: mime === 'image/jpg' ? 'image/jpeg' : mime,
    upsert: false,
  })
  if (upErr) {
    console.error('[upload-profile-gallery]', upErr)
    return json({ ok: false, error: 'Upload failed. Try a smaller image or different format.' }, 500)
  }

  const { data: pub } = admin.storage.from('profile-custom').getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) return json({ ok: false, error: 'Could not build public URL.' }, 500)

  return json({ ok: true, url: publicUrl, path: objectPath })
})
