// POST /api/admin/reset-stock - Evaluator utility to reset inventory stock & bookings
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getLiveCatalog } from '@/server/booking-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const db = getDb();
    if (db.resetDatabaseForTesting) {
      await db.resetDatabaseForTesting();
    }

    const catalog = await getLiveCatalog();

    return NextResponse.json(
      {
        ok: true,
        message: 'Database stock reset to initial assessment values successfully.',
        inventory: catalog.inventory,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error resetting database:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to reset database stock' },
      { status: 500 }
    );
  }
}
