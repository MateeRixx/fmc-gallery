/**
 * Image optimization and caching headers
 * Serves images with proper cache control headers
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const imagePath = url.searchParams.get('src');

  if (!imagePath) {
    return new Response('Missing src parameter', { status: 400 });
  }

  // Redirect to image with cache headers
  return new Response(null, {
    status: 307,
    headers: {
      Location: imagePath,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
