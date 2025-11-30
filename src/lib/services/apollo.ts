import { createClient } from '@/lib/supabase/server';
import { CacheManager, RateLimiter, redisConfig } from '@/lib/redis/client';
import { queueManager } from '@/lib/queue/apollo-queue';

const APOLLO_API_BASE = 'https://api.apollo.io/v1';

export interface ApolloPerson {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url: string;
    title: string;
    email_status: string;
    photo_url: string;
    twitter_url: string | null;
    github_url: string | null;
    facebook_url: string | null;
    extrapolated_email_confidence: number | null;
    headline: string;
    email: string;
    organization: {
        id: string;
        name: string;
        website_url: string;
        logo_url: string;
        facebook_url: string | null;
        twitter_url: string | null;
        linkedin_url: string | null;
        primary_domain: string;
    };
}

export interface ApolloCompany {
    id: string;
    name: string;
    website_url: string;
    logo_url: string;
    domain: string;
    industry: string;
    employee_count: number;
    revenue_range: string;
    founded_year: number;
    headquarters_location: string;
    linkedin_url: string;
    twitter_url: string | null;
    facebook_url: string | null;
    technologies?: string[];
    keywords?: string[];
    sic_codes?: string[];
    naics_codes?: string[];
}

export interface ApolloList {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    contact_count: number;
}

export interface ApolloSearchResponse {
    people: ApolloPerson[];
    pagination: {
        page: number;
        per_page: number;
        total_entries: number;
        total_pages: number;
    };
}

export interface ApolloCompanySearchResponse {
    organizations: ApolloCompany[];
    pagination: {
        page: number;
        per_page: number;
        total_entries: number;
        total_pages: number;
    };
}

export class ApolloService {
    private apiKey: string;
    private cache: CacheManager;
    private rateLimiter: RateLimiter;
    private organizationId?: string;

    constructor(apiKey?: string, organizationId?: string) {
        this.apiKey = apiKey || process.env.APOLLO_API_KEY || '';
        this.organizationId = organizationId;
        this.cache = new CacheManager();
        // Apollo API rate limits: 100 requests per minute for most endpoints
        this.rateLimiter = new RateLimiter(60000, 100);
    }

    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST',
        body?: any,
        options?: {
            useCache?: boolean;
            cacheTTL?: number;
            priority?: 'realtime' | 'batch';
        }
    ): Promise<T> {
        const { useCache = true, cacheTTL, priority = 'realtime' } = options || {};

        // Generate cache key
        const cacheKey = CacheManager.generateKey('apollo', endpoint, JSON.stringify(body || {}));

        // Check cache first
        if (useCache && method === 'POST') {
            const cached = await this.cache.get<T>(cacheKey);
            if (cached) {
                console.log(`Cache hit for ${endpoint}`);
                await this.trackApiUsage(endpoint, method, 200, true);
                return cached;
            }
        }

        // For batch priority, add to queue instead of making direct request
        if (priority === 'batch' && this.organizationId) {
            const jobId = await queueManager.addToEnrichmentQueue({
                id: `batch-${Date.now()}`,
                type: endpoint.includes('company') ? 'company' : 'person',
                identifier: body?.email || body?.domain || '',
                priority: 'low',
                metadata: {
                    userId: 'system',
                    orgId: this.organizationId,
                },
            });
            throw new Error(`Request queued for batch processing: ${jobId}`);
        }

        // Check rate limit
        const rateLimitResult = await this.rateLimiter.checkLimit(this.apiKey);
        if (!rateLimitResult.allowed) {
            const waitTime = rateLimitResult.resetAt.getTime() - Date.now();
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitTime / 1000)} seconds`);
        }

        const startTime = Date.now();
        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': this.apiKey,
        };

        try {
            const response = await fetch(`${APOLLO_API_BASE}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });

            const responseTime = Date.now() - startTime;

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unknown error' }));
                await this.trackApiUsage(endpoint, method, response.status, false, error.message);

                // Handle rate limiting with exponential backoff
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                    throw new Error(`Rate limited. Retry after ${waitTime}ms`);
                }

                throw new Error(`Apollo API Error: ${response.status} - ${error.message || response.statusText}`);
            }

            const data = await response.json();

            // Cache successful responses
            if (useCache && method === 'POST') {
                const ttl = cacheTTL || this.getCacheTTL(endpoint);
                await this.cache.set(cacheKey, data, ttl);
            }

            await this.trackApiUsage(endpoint, method, response.status, false, undefined, responseTime);
            return data;
        } catch (error) {
            if (error instanceof Error && error.message.includes('Rate limited')) {
                // Implement exponential backoff
                await this.sleep(5000); // Wait 5 seconds before retrying
                return this.request<T>(endpoint, method, body, options);
            }
            throw error;
        }
    }

    private getCacheTTL(endpoint: string): number {
        if (endpoint.includes('search')) return redisConfig.cache.ttl.search;
        if (endpoint.includes('people')) return redisConfig.cache.ttl.person;
        if (endpoint.includes('organizations')) return redisConfig.cache.ttl.company;
        return 3600; // Default 1 hour
    }

    private async trackApiUsage(
        endpoint: string,
        method: string,
        statusCode: number,
        cached: boolean,
        errorMessage?: string,
        responseTimeMs?: number
    ): Promise<void> {
        if (!this.organizationId) return;

        try {
            const supabase = await createClient();
            await supabase.from('apollo_api_usage').insert({
                organization_id: this.organizationId,
                endpoint,
                method,
                status_code: statusCode,
                cached,
                error_message: errorMessage,
                response_time_ms: responseTimeMs,
            });
        } catch (error) {
            console.error('Failed to track API usage:', error);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Search for people in Apollo's database with caching and rate limiting
     */
    async searchPeople(
        params: {
            q_keywords?: string;
            person_titles?: string[];
            organization_ids?: string[];
            organization_domains?: string[];
            page?: number;
            per_page?: number;
        },
        priority: 'realtime' | 'batch' = 'realtime'
    ): Promise<ApolloSearchResponse> {
        return this.request<ApolloSearchResponse>(
            '/mixed_people/search',
            'POST',
            {
                ...params,
                page: params.page || 1,
                per_page: params.per_page || 10,
            },
            { priority }
        );
    }

    /**
     * Search for companies in Apollo's database
     */
    async searchCompanies(
        params: {
            q_keywords?: string;
            industries?: string[];
            employee_count_min?: number;
            employee_count_max?: number;
            revenue_min?: number;
            revenue_max?: number;
            technologies?: string[];
            page?: number;
            per_page?: number;
        },
        priority: 'realtime' | 'batch' = 'realtime'
    ): Promise<ApolloCompanySearchResponse> {
        return this.request<ApolloCompanySearchResponse>(
            '/mixed_companies/search',
            'POST',
            {
                ...params,
                page: params.page || 1,
                per_page: params.per_page || 10,
            },
            { priority }
        );
    }

    /**
     * Enrich a person by email with caching
     */
    async enrichPerson(email: string, useCache: boolean = true): Promise<ApolloPerson | null> {
        try {
            const response = await this.request<{ person: ApolloPerson }>(
                '/people/match',
                'POST',
                { email },
                { useCache }
            );
            return response.person;
        } catch (error) {
            console.error('Error enriching person:', error);
            return null;
        }
    }

    /**
     * Enrich a company by domain
     */
    async enrichCompany(domain: string, useCache: boolean = true): Promise<ApolloCompany | null> {
        try {
            const response = await this.request<{ organization: ApolloCompany }>(
                '/organizations/enrich',
                'POST',
                { domain },
                { useCache }
            );
            return response.organization;
        } catch (error) {
            console.error('Error enriching company:', error);
            return null;
        }
    }

    /**
     * Get Apollo lists
     */
    async getLists(): Promise<ApolloList[]> {
        try {
            const response = await this.request<{ lists: ApolloList[] }>(
                '/lists',
                'GET',
                undefined,
                { useCache: true, cacheTTL: redisConfig.cache.ttl.list }
            );
            return response.lists;
        } catch (error) {
            console.error('Error fetching lists:', error);
            return [];
        }
    }

    /**
     * Get members of a specific list
     */
    async getListMembers(
        listId: string,
        page: number = 1,
        perPage: number = 100
    ): Promise<ApolloPerson[]> {
        try {
            const response = await this.request<{ contacts: ApolloPerson[] }>(
                `/lists/${listId}/contacts`,
                'GET',
                { page, per_page: perPage },
                { useCache: true }
            );
            return response.contacts;
        } catch (error) {
            console.error('Error fetching list members:', error);
            return [];
        }
    }

    /**
     * Sync Apollo lists to database
     */
    async syncLists(): Promise<{ synced: number; failed: number }> {
        if (!this.organizationId) {
            throw new Error('Organization ID required for list sync');
        }

        const supabase = await createClient();
        const lists = await this.getLists();
        let synced = 0;
        let failed = 0;

        for (const list of lists) {
            try {
                await supabase.from('apollo_lists').upsert({
                    organization_id: this.organizationId,
                    apollo_list_id: list.id,
                    name: list.name,
                    member_count: list.contact_count,
                    last_synced_at: new Date().toISOString(),
                });
                synced++;
            } catch (error) {
                console.error(`Failed to sync list ${list.id}:`, error);
                failed++;
            }
        }

        // Update sync state
        await supabase.from('apollo_sync_state').upsert({
            organization_id: this.organizationId,
            sync_type: 'lists',
            last_sync_at: new Date().toISOString(),
            sync_status: 'completed',
            records_synced: synced,
        });

        return { synced, failed };
    }

    /**
     * Handle Apollo webhook
     */
    async handleWebhook(event: {
        id: string;
        type: string;
        data: any;
        signature?: string;
    }): Promise<void> {
        if (!this.organizationId) {
            throw new Error('Organization ID required for webhook processing');
        }

        // Verify webhook signature if provided
        if (event.signature) {
            // Implement signature verification based on Apollo's webhook security
            // This is a placeholder - actual implementation depends on Apollo's docs
            const isValid = this.verifyWebhookSignature(event);
            if (!isValid) {
                throw new Error('Invalid webhook signature');
            }
        }

        // Store webhook event
        const supabase = await createClient();
        await supabase.from('apollo_webhooks').insert({
            organization_id: this.organizationId,
            webhook_id: event.id,
            event_type: event.type,
            event_data: event.data,
            processed: false,
        });

        // Queue for processing
        await queueManager.addWebhookJob({
            id: event.id,
            webhookId: event.id,
            eventType: event.type,
            eventData: event.data,
            orgId: this.organizationId,
        });
    }

    /**
     * Verify webhook signature (placeholder - implement based on Apollo docs)
     */
    private verifyWebhookSignature(event: any): boolean {
        // Implement actual signature verification
        // This typically involves HMAC-SHA256 validation
        return true;
    }

    /**
     * Bulk enrich contacts
     */
    async bulkEnrich(
        contacts: Array<{ email?: string; domain?: string }>,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): Promise<string[]> {
        if (!this.organizationId) {
            throw new Error('Organization ID required for bulk operations');
        }

        const jobs = contacts.map((contact, index) => ({
            id: `bulk-enrich-${Date.now()}-${index}`,
            type: (contact.email ? 'person' : 'company') as 'person' | 'company',
            identifier: contact.email || contact.domain || '',
            priority,
            metadata: {
                userId: 'system',
                orgId: this.organizationId,
            },
        }));

        const jobIds: string[] = [];
        for (const job of jobs) {
            const id = await queueManager.addToEnrichmentQueue(job);
            jobIds.push(id);
        }

        return jobIds;
    }

    /**
     * Get cached data
     */
    async getCachedData<T>(key: string): Promise<T | null> {
        return this.cache.get<T>(key);
    }

    /**
     * Set cached data
     */
    async setCachedData<T>(key: string, data: T, ttl?: number): Promise<void> {
        await this.cache.set(key, data, ttl);
    }

    /**
     * Clear cache for specific pattern
     */
    async clearCache(pattern?: string): Promise<number> {
        if (pattern) {
            return this.cache.deletePattern(pattern);
        }
        return this.cache.deletePattern('apollo:*');
    }

    /**
     * Get API usage statistics
     */
    async getApiUsageStats(days: number = 7): Promise<any> {
        if (!this.organizationId) {
            throw new Error('Organization ID required for usage stats');
        }

        const supabase = await createClient();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('apollo_api_usage')
            .select('*')
            .eq('organization_id', this.organizationId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate statistics
        const stats = {
            totalRequests: data.length,
            cachedRequests: data.filter((r) => r.cached).length,
            failedRequests: data.filter((r) => r.status_code >= 400).length,
            averageResponseTime: data
                .filter((r) => r.response_time_ms)
                .reduce((sum, r) => sum + r.response_time_ms, 0) / data.length || 0,
            byEndpoint: {} as Record<string, number>,
            byDay: {} as Record<string, number>,
        };

        // Group by endpoint
        data.forEach((record) => {
            stats.byEndpoint[record.endpoint] = (stats.byEndpoint[record.endpoint] || 0) + 1;
            const day = new Date(record.created_at).toISOString().split('T')[0];
            stats.byDay[day] = (stats.byDay[day] || 0) + 1;
        });

        return stats;
    }

    /**
     * Import a person from Apollo to Sales Leads
     */
    async importPersonToLeads(person: ApolloPerson, organizationId: string): Promise<string> {
        const supabase = await createClient();

        // Check if lead already exists
        const { data: existingLead } = await supabase
            .from('sales_leads')
            .select('id')
            .or(`email.eq.${person.email},apollo_id.eq.${person.id}`)
            .single();

        if (existingLead) {
            // Update existing lead with enrichment data
            await supabase
                .from('sales_leads')
                .update({
                    apollo_id: person.id,
                    apollo_data: person,
                    linkedin_url: person.linkedin_url || undefined,
                    twitter_url: person.twitter_url || undefined,
                    facebook_url: person.facebook_url || undefined,
                    github_url: person.github_url || undefined,
                    enriched_at: new Date().toISOString(),
                    // Don't overwrite core fields if they exist, but fill gaps
                    title: person.title, // Assuming title field exists or will be added
                    company: person.organization?.name,
                })
                .eq('id', existingLead.id);

            return existingLead.id;
        }

        // Create new lead
        const { data: newLead, error } = await supabase
            .from('sales_leads')
            .insert({
                organization_id: organizationId,
                name: person.name || `${person.first_name} ${person.last_name}`,
                email: person.email,
                company: person.organization?.name,
                // Map other fields as needed
                apollo_id: person.id,
                apollo_data: person,
                linkedin_url: person.linkedin_url,
                twitter_url: person.twitter_url,
                facebook_url: person.facebook_url,
                github_url: person.github_url,
                enriched_at: new Date().toISOString(),
                source: 'apollo_import',
            })
            .select('id')
            .single();

        if (error) throw error;
        return newLead.id;
    }
}
