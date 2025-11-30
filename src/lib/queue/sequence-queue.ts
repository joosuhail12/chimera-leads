import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Use environment variables for Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const sequenceQueue = new Queue('sequence-execution', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export type SequenceJobData =
    | { type: 'execute_step'; enrollmentId: string }
    | { type: 'process_auto_enrollment'; leadId: string; orgId: string }
    | { type: 'process_scheduled_steps' };

export const addSequenceJob = async (data: SequenceJobData) => {
    return sequenceQueue.add(data.type, data);
};
