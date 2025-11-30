import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { queueManager } from '@/lib/queue/apollo-queue';

const VALID_QUEUES = new Set(['enrichment', 'bulk', 'webhooks', 'scoring']);

export async function POST(
  _: Request,
  { params }: { params: Promise<{ queue: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { queue: queueName } = await params;
  if (!VALID_QUEUES.has(queueName)) {
    return NextResponse.json({ error: 'Invalid queue name' }, { status: 400 });
  }

  try {
    const retried = await queueManager.retryFailedJobs(queueName);
    return NextResponse.json({ success: true, retried });
  } catch (error) {
    console.error('Queue retry error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry queue jobs' },
      { status: 500 }
    );
  }
}
