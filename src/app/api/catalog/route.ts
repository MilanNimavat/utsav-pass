// GET /api/catalog - Live inventory stock, unit prices, and festival dates
import { NextResponse } from 'next/server';
import { getLiveCatalog } from '@/server/booking-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const catalog = await getLiveCatalog();

    return NextResponse.json(
      {
        ok: true,
        ...catalog,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to retrieve catalog' },
      { status: 500 }
    );
  }
}
