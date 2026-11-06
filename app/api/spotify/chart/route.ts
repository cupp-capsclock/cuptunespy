/**
 * app/api/spotify/chart/route.ts
 * GET /api/spotify/chart?region=ID
 */

import { handle } from '@/lib/server/guard';
import { ApiError, chart } from '@/lib/server/spotify';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(req, async () => {
    const u = new URL(req.url);
    const region = (u.searchParams.get('region') ?? 'ID').toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) throw new ApiError('BAD_REQUEST', 400, 'Kode wilayah tidak valid.');
    return chart(region);
  });
}
