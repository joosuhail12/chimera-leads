/**
 * API endpoints for sequence metrics and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSequenceMetrics, getSequencePerformance } from '@/lib/services/sequences';

/**
 * GET /api/sequences/metrics
 * Get sequence metrics and performance data
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'summary';

    if (type === 'performance') {
      // Get performance metrics for all sequences
      const performance = await getSequencePerformance(userId);
      return NextResponse.json({ performance });
    } else {
      // Get summary metrics
      const metrics = await getSequenceMetrics(userId);
      return NextResponse.json({ metrics });
    }
  } catch (error: any) {
    console.error('Error fetching sequence metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}