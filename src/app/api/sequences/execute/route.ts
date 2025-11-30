/**
 * API endpoint to trigger sequence execution
 * This should be called by a cron job (e.g., every 5 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { SequenceExecutor } from '@/lib/services/sequence-executor';

// Optional: Add a secret key for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/sequences/execute
 * Execute all due sequence steps
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron job secret
    if (CRON_SECRET) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');

      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Execute scheduled steps
    const results = await SequenceExecutor.processScheduledSteps();

    return NextResponse.json({
      success: true,
      processed: results.processed,
      errors: results.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error executing sequences:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to execute sequences',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sequences/execute
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ready',
    message: 'Sequence executor is ready. POST to this endpoint to trigger execution.',
    timestamp: new Date().toISOString(),
  });
}