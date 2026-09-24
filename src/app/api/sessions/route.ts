import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Service-role client for API routes (bypasses RLS; user scoping done in queries)
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const userId = searchParams.get('user_id')

  try {
    switch (action) {
      case 'list': {
        if (!userId) {
          return NextResponse.json({ error: 'user_id required' }, { status: 400 })
        }
        const { data, error } = await supa
          .from('sessions')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })

        if (error) throw error
        return NextResponse.json({ sessions: data })
      }

      case 'export': {
        if (!userId) {
          return NextResponse.json({ error: 'user_id required' }, { status: 400 })
        }
        const sessions = await getSessions(userId)
        return NextResponse.json({ sessions })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { action, userId, sessionId, state, title, agentName, model } = body

  try {
    switch (action) {
      case 'create': {
        const newSession = await createSession(userId, {
          title,
          agentName,
          model,
          state,
        })
        return NextResponse.json({ session: newSession })
      }

      case 'get': {
        const session = await getSession(userId, sessionId!)
        return NextResponse.json({ session })
      }

      case 'update': {
        const updated = await updateSession(userId, sessionId!, state)
        return NextResponse.json({ session: updated })
      }

      case 'delete': {
        await deleteSession(userId, sessionId!)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getSessions(userId: string) {
  const { data, error } = await supa
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

async function createSession(
  userId: string,
  opts: {
    title?: string
    agentName?: string
    model?: string
    state?: any
  }
) {
  const { data, error } = await supa
    .from('sessions')
    .insert({
      user_id: userId,
      title: opts.title || 'Untitled Session',
      agent_name: opts.agentName || 'default',
      model: opts.model || 'anthropic/claude-sonnet-4',
      state: opts.state || {},
      message_count: 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function getSession(userId: string, sessionId: string) {
  const { data, error } = await supa
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

async function updateSession(userId: string, sessionId: string, state: any) {
  const { data, error } = await supa
    .from('sessions')
    .update({ state })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

async function deleteSession(userId: string, sessionId: string) {
  const { error } = await supa
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)

  if (error) throw error
}
