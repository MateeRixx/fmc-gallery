// In browser console or a test file
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// This should return only is_public = true events
const { data, error } = await supabase.from('events').select('*')
console.log(data, error)