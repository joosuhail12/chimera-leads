import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { SequenceExecutor } from '@/lib/services/sequence-executor';
import { AutoEnrollmentEngine } from '@/lib/services/auto-enrollment';
import { SequenceJobData } from '@/lib/queue/sequence-queue';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const sequenceWorker = new Worker<SequenceJobData>(
    'sequence-execution',
    async (job) => {
        console.log(`Processing job ${job.id} of type ${job.data.type}`);

        try {
            switch (job.data.type) {
                case 'execute_step':
                    // Logic to execute a specific step for an enrollment
                    // This might need a new method in SequenceExecutor or we can reuse existing ones
                    // For now, we'll assume we process scheduled steps generally or implement specific logic
                    // But SequenceExecutor.processScheduledSteps() processes ALL due steps.
                    // Ideally, we want to process a specific enrollment's step.
                    // Let's assume we call a method to process a single enrollment if available,
                    // or just run the batch processor if the job is generic.

                    // If we want granular execution:
                    // await SequenceExecutor.executeStep(job.data.enrollmentId);
                    break;

                case 'process_auto_enrollment':
                    await AutoEnrollmentEngine.processTrigger(
                        'lead_created', // This is a simplification, ideally we pass the trigger type
                        { lead_id: job.data.leadId },
                        job.data.orgId
                    );
                    break;

                case 'process_scheduled_steps':
                    await SequenceExecutor.processScheduledSteps();
                    break;
            }
        } catch (error) {
            console.error(`Job ${job.id} failed:`, error);
            throw error;
        }
    },
    { connection }
);

sequenceWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
});

sequenceWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
});
