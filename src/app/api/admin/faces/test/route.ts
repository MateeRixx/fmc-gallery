// Simple test for clustering endpoint
export async function POST() {
  try {
    // Basic environment check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({
        error: "Environment variables missing",
        details: {
          supabaseUrl: !!supabaseUrl,
          serviceRoleKey: !!serviceRoleKey
        }
      }, { status: 500 });
    }

    return Response.json({
      message: "Clustering endpoint accessible",
      timestamp: new Date().toISOString(),
      config: {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey
      }
    });
  } catch (error) {
    return Response.json({
      error: "Clustering endpoint error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}