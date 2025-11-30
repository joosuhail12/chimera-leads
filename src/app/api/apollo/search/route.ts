import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ApolloService } from '@/lib/services/apollo';
import { z } from 'zod';

// Validation schemas
const peopleSearchSchema = z.object({
  type: z.literal('people'),
  q_keywords: z.string().optional(),
  person_titles: z.array(z.string()).optional(),
  organization_ids: z.array(z.string()).optional(),
  organization_domains: z.array(z.string()).optional(),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(25),
  priority: z.enum(['realtime', 'batch']).default('realtime'),
});

const companySearchSchema = z.object({
  type: z.literal('companies'),
  q_keywords: z.string().optional(),
  industries: z.array(z.string()).optional(),
  employee_count_min: z.number().optional(),
  employee_count_max: z.number().optional(),
  revenue_min: z.number().optional(),
  revenue_max: z.number().optional(),
  technologies: z.array(z.string()).optional(),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(25),
  priority: z.enum(['realtime', 'batch']).default('realtime'),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Determine search type and validate
    let searchParams;
    let searchType: 'people' | 'companies';

    if (body.type === 'people') {
      searchParams = peopleSearchSchema.parse(body);
      searchType = 'people';
    } else if (body.type === 'companies') {
      searchParams = companySearchSchema.parse(body);
      searchType = 'companies';
    } else {
      return NextResponse.json(
        { error: 'Invalid search type. Must be "people" or "companies"' },
        { status: 400 }
      );
    }

    // Initialize Apollo service with org context
    const apolloService = new ApolloService(undefined, orgId);

    // Perform search based on type
    let results;
    if (searchType === 'people') {
      const { type, priority, ...params } = searchParams as z.infer<typeof peopleSearchSchema>;
      results = await apolloService.searchPeople(params, priority);
    } else {
      const { type, priority, ...params } = searchParams as z.infer<typeof companySearchSchema>;
      results = await apolloService.searchCompanies(params, priority);
    }

    return NextResponse.json({
      success: true,
      type: searchType,
      data: results,
      cached: false, // This info could come from Apollo service if needed
    });
  } catch (error) {
    console.error('Apollo search error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle rate limiting
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        );
      }

      // Handle queued requests
      if (error.message.includes('queued for batch processing')) {
        return NextResponse.json(
          {
            success: true,
            queued: true,
            message: error.message
          },
          { status: 202 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// GET endpoint to check search status or get cached results
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cacheKey = searchParams.get('cache_key');

    if (!cacheKey) {
      return NextResponse.json(
        { error: 'Cache key is required' },
        { status: 400 }
      );
    }

    const apolloService = new ApolloService(undefined, orgId);
    const cachedData = await apolloService.getCachedData(cacheKey);

    if (!cachedData) {
      return NextResponse.json(
        { error: 'No cached data found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cachedData,
      cached: true,
    });
  } catch (error) {
    console.error('Apollo cache retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve cached data' },
      { status: 500 }
    );
  }
}