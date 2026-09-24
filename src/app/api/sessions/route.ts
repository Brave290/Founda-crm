import { NextResponse } from 'next/server'
import { createClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

// Initialize Supabase client
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return {}
      },
      setAll() {
        // No-op for server-side
      },
    },
  }
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const userId = searchParams.get('user_id')

  try {
    switch (action) {
      case 'list':
        const { data, error } = await supa
          .from('sessions')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })

        if (error) throw error
        return NextResponse.json({ sessions: data })

      case 'export':
        if (!userId) {
          return NextResponse.json({ error: 'user_id required' }, { status: 400 })
        }
        const sessions = await getSessions(userId)
        return NextResponse.json({ sessions })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { action, userId, sessionId, state } = body

  try {
    switch (action) {
      case 'create':
        const newSession = await createSession(userId, state)
        return NextResponse.json({ session: newSession })

      case 'get':
        const session = await getSession(userId, sessionId!)
        return NextResponse.json({ session })

      case 'update':
        const updated = await updateSession(userId, sessionId!, state)
        return NextResponse.json({ session: updated })

      case 'delete':
        await deleteSession(userId, sessionId!)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Helper to fetch sessions
async function getSessions(userId: string) {
  const { data, error } = await supa
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}