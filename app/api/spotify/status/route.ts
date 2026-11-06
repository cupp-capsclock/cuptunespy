/**
 * app/api/spotify/status/route.ts
 * GET /api/spotify/status
 * Selalu configured=true karena tidak butuh API key.
 */

import { isConfigured } from '@/lib/server/spotify';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { configured: isConfigured() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
