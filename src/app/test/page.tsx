'use client'
import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TestRLS() {
  const [log, setLog] = useState<string[]>([])
  const addLog = (msg: string) => setLog(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`])

  const testPublicRead = async () => {
    try {
      addLog('Testing public read...')
      const { data, error } = await supabase.from('events').select('*')
      if (error) {
        addLog(`❌ Public read failed: ${error.message}`)
      } else {
        addLog(`✅ Public read success: ${data?.length} events found`)
      }
    } catch (e) {
      addLog(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const testSignInAndRead = async () => {
    try {
      addLog('Testing sign in...')
      // Replace with your test account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      })
      
      if (signInError) {
        addLog(`❌ Sign in failed: ${signInError.message}`)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      addLog(`✅ Signed in as: ${user?.email}`)

      const { data, error } = await supabase.from('events').select('*')
      if (error) {
        addLog(`❌ Read after sign in failed: ${error.message}`)
      } else {
        addLog(`✅ Read after sign in: ${data?.length} events`)
      }
    } catch (e) {
      addLog(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const testInsertCorrectUserId = async () => {
    try {
      addLog('Testing insert with correct user_id...')
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        addLog('❌ Not logged in')
        return
      }

      const { data, error } = await supabase.from('events').insert([{
        title: `Test Event ${Date.now()}`,
        slug: `test-${Date.now()}`,
        description: 'Test description',
        user_id: user.id,
        is_public: false
      }])

      if (error) {
        addLog(`❌ Insert failed: ${error.message}`)
      } else {
        addLog(`✅ Insert success with correct user_id`)
      }
    } catch (e) {
      addLog(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const testInsertWrongUserId = async () => {
    try {
      addLog('Testing insert with wrong user_id (should fail)...')
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        addLog('❌ Not logged in')
        return
      }

      const { data, error } = await supabase.from('events').insert([{
        title: `Hacked Event ${Date.now()}`,
        slug: `hacked-${Date.now()}`,
        description: 'Hacked',
        user_id: '00000000-0000-0000-0000-000000000000', // Different user
        is_public: false
      }])

      if (error) {
        addLog(`✅ Insert correctly rejected: ${error.message}`)
      } else {
        addLog(`❌ Insert should have failed but succeeded!`)
      }
    } catch (e) {
      addLog(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const clearLog = () => setLog([])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">RLS Policy Tests</h1>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button onClick={testPublicRead} className="p-3 bg-blue-600 hover:bg-blue-700 rounded">
            1. Test Public Read
          </button>
          <button onClick={testSignInAndRead} className="p-3 bg-blue-600 hover:bg-blue-700 rounded">
            2. Sign In & Read
          </button>
          <button onClick={testInsertCorrectUserId} className="p-3 bg-green-600 hover:bg-green-700 rounded">
            3. Insert (Correct User ID)
          </button>
          <button onClick={testInsertWrongUserId} className="p-3 bg-red-600 hover:bg-red-700 rounded">
            4. Insert (Wrong User ID)
          </button>
        </div>

        <button onClick={clearLog} className="p-2 bg-gray-700 hover:bg-gray-600 rounded mb-4">
          Clear Log
        </button>

        <div className="bg-gray-800 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
          {log.length === 0 ? (
            <div className="text-gray-500">Click buttons above to start testing...</div>
          ) : (
            log.map((msg, i) => (
              <div key={i} className="mb-2 text-gray-300">
                {msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
