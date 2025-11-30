import { NextResponse } from 'next/server';
import { addSequenceJob } from '@/lib/queue/sequence-queue';

export async function GET() {
    // Instead of processing directly, we add a job to the queue
    await addSequenceJob({ type: 'process_scheduled_steps' });

    return NextResponse.json({ success: true, message: 'Sequence execution job queued' });
}
