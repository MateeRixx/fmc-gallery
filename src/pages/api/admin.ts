// pages/api/admin.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// IMPORTANT: This file runs server-side only. Do NOT expose SUPABASE_SERVICE_ROLE_KEY to the client.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

/**
 * Example admin API route.
 * - Verifies the incoming request has an Authorization: Bearer <access_token> header (Supabase JWT).
 * - Optionally verifies the user is allowed to perform admin actions (customize as needed).
 * - Runs a privileged query using the service role key.
 *
 * NOTE: Adjust auth/authorization checks to match your app's requirements.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST for this example
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic auth check: expect a Supabase JWT in Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];

  // Verify the token and fetch the user
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = userData.user;

  // Example authorization: require a specific email (replace with your logic)
  const isAdmin = user.email && user.email.endsWith('@yourdomain.com'); // change to your check
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
  }

  // Perform a privileged action using the service role key.
  // Example: fetch sensitive_table rows (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('sensitive_table')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data });
}
