export async function GET() {
  return Response.json({
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  });
}

export async function POST() {
  return Response.json({
    message: "POST endpoint working",
    timestamp: new Date().toISOString()
  });
}