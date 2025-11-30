import { NextRequest, NextResponse } from 'next/server';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { redisConfig } from '@/lib/redis/client';
import { auth } from '@clerk/nextjs/server';

// Initialize queues for monitoring
const createQueue = (name: string) => {
  return new Queue(name, {
    connection: {
      host: redisConfig.connection.host,
      port: redisConfig.connection.port,
      password: redisConfig.connection.password,
      db: redisConfig.connection.db,
    },
  });
};

// Create queue instances
const queues = [
  createQueue(redisConfig.queues.enrichment),
  createQueue(redisConfig.queues.bulk),
  createQueue(redisConfig.queues.webhooks),
  createQueue(redisConfig.queues.scoring),
];

// Set up Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/queues/board');

createBullBoard({
  queues: queues.map((queue) => new BullMQAdapter(queue)),
  serverAdapter,
});

export async function GET(req: NextRequest) {
  // Check authentication
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user has admin role (you might want to implement proper role checking)
  // For now, we'll allow any authenticated user from the organization

  try {
    // Convert Express middleware to Next.js response
    const expressApp = serverAdapter.getRouter();

    // Create a mock Express request/response
    const mockReq: any = {
      method: 'GET',
      url: req.nextUrl.pathname.replace('/api/queues/board', ''),
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    };

    const mockRes: any = {
      statusCode: 200,
      headers: {},
      setHeader: (key: string, value: string) => {
        mockRes.headers[key] = value;
      },
      end: (data: any) => {
        mockRes.body = data;
      },
      write: (data: any) => {
        mockRes.body = (mockRes.body || '') + data;
      },
    };

    // Execute the Express app
    await new Promise((resolve) => {
      expressApp(mockReq, mockRes, resolve);
    });

    // Return the response
    return new NextResponse(mockRes.body, {
      status: mockRes.statusCode,
      headers: mockRes.headers,
    });
  } catch (error) {
    console.error('Queue board error:', error);
    return NextResponse.json(
      { error: 'Failed to load queue board' },
      { status: 500 }
    );
  }
}

// Also support POST for Bull Board actions
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expressApp = serverAdapter.getRouter();
    const body = await req.text();

    const mockReq: any = {
      method: 'POST',
      url: req.nextUrl.pathname.replace('/api/queues/board', ''),
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
      body,
    };

    const mockRes: any = {
      statusCode: 200,
      headers: {},
      setHeader: (key: string, value: string) => {
        mockRes.headers[key] = value;
      },
      end: (data: any) => {
        mockRes.body = data;
      },
      json: (data: any) => {
        mockRes.headers['Content-Type'] = 'application/json';
        mockRes.body = JSON.stringify(data);
      },
    };

    await new Promise((resolve) => {
      expressApp(mockReq, mockRes, resolve);
    });

    return new NextResponse(mockRes.body, {
      status: mockRes.statusCode,
      headers: mockRes.headers,
    });
  } catch (error) {
    console.error('Queue board POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}