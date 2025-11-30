# Apollo Integration API Documentation

## Overview
This document describes all API endpoints for the Apollo.io integration, including authentication, request/response formats, and error handling.

## Authentication
All API endpoints require Clerk authentication. The API automatically uses the authenticated user's organization context.

## Base URL
```
http://localhost:3000/api/apollo
```

---

## 1. Search API

### Search People or Companies
Search Apollo's database for contacts or companies with advanced filtering.

**Endpoint:** `POST /api/apollo/search`

**Request Body:**
```json
{
  "type": "people" | "companies",
  "q_keywords": "string (optional)",
  "page": 1,
  "per_page": 25,
  "priority": "realtime" | "batch",

  // For people search:
  "person_titles": ["VP Sales", "Director"],
  "organization_ids": ["org_id1"],
  "organization_domains": ["example.com"],

  // For company search:
  "industries": ["SaaS", "Technology"],
  "employee_count_min": 50,
  "employee_count_max": 500,
  "revenue_min": 1000000,
  "revenue_max": 10000000,
  "technologies": ["Salesforce", "HubSpot"]
}
```

**Response:**
```json
{
  "success": true,
  "type": "people",
  "data": {
    "people": [
      {
        "id": "string",
        "name": "John Doe",
        "email": "john@example.com",
        "title": "VP Sales",
        "organization": {
          "name": "Example Corp",
          "domain": "example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 25,
      "total_entries": 150,
      "total_pages": 6
    }
  },
  "cached": false
}
```

**Error Responses:**
- `400` - Invalid request parameters
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `500` - Server error

### Get Cached Search Results
Retrieve previously cached search results by cache key.

**Endpoint:** `GET /api/apollo/search?cache_key={key}`

**Response:**
```json
{
  "success": true,
  "data": {...},
  "cached": true
}
```

---

## 2. Enrichment API

### Enrich Contact or Company
Enrich a single contact (by email) or company (by domain) with Apollo data.

**Endpoint:** `POST /api/apollo/enrich`

**Request Body:**
```json
{
  "type": "person" | "company",
  "identifier": "email@example.com",
  "leadId": "uuid (optional)",
  "useCache": true
}
```

**Response:**
```json
{
  "success": true,
  "type": "person",
  "data": {
    "id": "apollo_id",
    "name": "John Doe",
    "email": "john@example.com",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "company": "Example Corp",
    // ... full Apollo person/company data
  }
}
```

### Bulk Enrichment
Queue multiple contacts for enrichment.

**Endpoint:** `POST /api/apollo/enrich`

**Request Body:**
```json
{
  "type": "bulk",
  "contacts": [
    {"email": "john@example.com"},
    {"domain": "example.com"},
    {"email": "jane@company.com", "leadId": "uuid"}
  ],
  "priority": "high" | "normal" | "low"
}
```

**Response:**
```json
{
  "success": true,
  "type": "bulk",
  "jobIds": ["job1", "job2", "job3"],
  "message": "3 contacts queued for enrichment"
}
```

### Check Enrichment Status
Check the status of enrichment jobs.

**Endpoint:** `GET /api/apollo/enrich?job_id={id}&queue=enrichment`

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "job_id",
    "state": "completed",
    "progress": 100,
    "data": {...},
    "createdAt": "2024-01-01T00:00:00Z",
    "finishedAt": "2024-01-01T00:01:00Z"
  }
}
```

---

## 3. Webhook API

### Receive Apollo Webhooks
Endpoint for Apollo to send real-time data updates.

**Endpoint:** `POST /api/apollo/webhooks`

**Headers:**
```
x-apollo-signature: webhook_signature
```

**Request Body:**
```json
{
  "id": "event_id",
  "type": "person.updated",
  "data": {
    // Event-specific data
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "eventId": "event_id"
}
```

### Get Webhook Status
Check webhook processing status.

**Endpoint:** `GET /api/apollo/webhooks?webhook_id={id}&org_id={orgId}`

**Response:**
```json
{
  "success": true,
  "webhook": {
    "webhook_id": "id",
    "event_type": "person.updated",
    "processed": true,
    "processed_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## 4. Lists API

### Get Synced Lists
Retrieve all Apollo lists synced to your organization.

**Endpoint:** `GET /api/apollo/lists`

**Response:**
```json
{
  "success": true,
  "lists": [
    {
      "id": "uuid",
      "apollo_list_id": "apollo_id",
      "name": "Hot Prospects",
      "member_count": 250,
      "last_synced_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 5
}
```

### Get List Members
Retrieve members of a specific Apollo list.

**Endpoint:** `GET /api/apollo/lists?list_id={id}&page=1&per_page=100`

**Response:**
```json
{
  "success": true,
  "listId": "list_id",
  "members": [...],
  "pagination": {
    "page": 1,
    "per_page": 100,
    "total": 250
  }
}
```

### Sync Lists
Sync Apollo lists to your database.

**Endpoint:** `POST /api/apollo/lists`

**Request Body:**
```json
{
  "action": "sync"
}
```

**Response:**
```json
{
  "success": true,
  "action": "sync",
  "synced": 5,
  "failed": 0,
  "message": "Successfully synced 5 lists"
}
```

### Import List Members
Import members from an Apollo list to your leads.

**Endpoint:** `POST /api/apollo/lists`

**Request Body:**
```json
{
  "action": "import_members",
  "listId": "apollo_list_id",
  "importOptions": {
    "updateExisting": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "action": "import_members",
  "imported": 45,
  "skipped": 5,
  "failed": 0,
  "total": 50
}
```

### Delete Synced List
Remove a synced Apollo list.

**Endpoint:** `DELETE /api/apollo/lists?list_id={id}`

**Response:**
```json
{
  "success": true,
  "message": "List removed successfully",
  "listId": "list_id"
}
```

---

## 5. Rate Limiting

All Apollo API endpoints are rate-limited to prevent API quota exhaustion.

**Default Limits:**
- 100 requests per minute per API key
- Cached responses don't count toward rate limit

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

**Rate Limit Response:**
```json
{
  "error": "Rate limit exceeded. Retry after 30 seconds",
  "retryAfter": 30
}
```

---

## 6. Error Handling

### Error Response Format
```json
{
  "error": "Error message",
  "details": {...},  // Optional detailed error information
  "code": "ERROR_CODE"  // Optional error code
}
```

### Common Error Codes
- `UNAUTHORIZED` - Missing or invalid authentication
- `RATE_LIMITED` - Too many requests
- `INVALID_PARAMETERS` - Request validation failed
- `NOT_FOUND` - Resource not found
- `APOLLO_API_ERROR` - Apollo API returned an error
- `QUEUE_ERROR` - Failed to queue job
- `CACHE_ERROR` - Cache operation failed

---

## 7. Webhooks Configuration

### Setting Up Webhooks in Apollo

1. Go to Apollo Settings > Integrations > Webhooks
2. Add your webhook URL: `https://your-domain.com/api/apollo/webhooks`
3. Select events to subscribe to:
   - `person.updated` - Contact information updated
   - `company.updated` - Company information updated
   - `list.members_added` - New members added to list
   - `list.members_removed` - Members removed from list

### Webhook Signature Verification
Apollo signs webhooks using HMAC-SHA256. Verify signatures using:

```typescript
import crypto from 'crypto';

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

---

## 8. Caching Strategy

### Cache Keys Format
```
apollo:search:{endpoint}:{params_hash}
apollo:person:{email}
apollo:company:{domain}
apollo:list:{list_id}
apollo:score:{lead_id}:{version}
```

### Default TTLs
- Search results: 1 hour
- Person data: 24 hours
- Company data: 24 hours
- List data: 6 hours
- Lead scores: 2 hours

### Cache Invalidation
- Webhooks automatically invalidate relevant cache entries
- Manual cache clear via Redis commands
- Cache bypassed when `useCache: false`

---

## 9. Queue Management

### Queue Names
- `apollo:enrichment` - Contact/company enrichment
- `apollo:bulk` - Bulk operations
- `apollo:webhooks` - Webhook processing
- `ai:scoring` - Lead scoring

### Job Priorities
- `high` - Processed immediately
- `normal` - Standard processing (default)
- `low` - Processed when queue is idle

### Monitoring Queues
```bash
# Check queue status
GET /api/apollo/enrich

# Response
{
  "success": true,
  "metrics": {
    "enrichment": {
      "waiting": 10,
      "active": 2,
      "completed": 150,
      "failed": 3
    }
  }
}
```

---

## 10. Best Practices

### 1. Use Caching
- Always use caching for repeated searches
- Cache person/company data for 24 hours
- Implement cache warming for frequently accessed data

### 2. Batch Operations
- Use bulk enrichment for multiple contacts
- Queue non-urgent operations with `priority: "batch"`
- Process webhooks asynchronously

### 3. Error Handling
- Implement exponential backoff for retries
- Log all API errors for monitoring
- Handle rate limits gracefully

### 4. Security
- Never expose Apollo API key to client
- Verify webhook signatures
- Use environment variables for sensitive data
- Implement proper access controls

### 5. Performance
- Use pagination for large result sets
- Implement virtual scrolling in UI
- Optimize database queries with indexes
- Monitor API usage and costs

---

## 11. Testing

### Test Endpoints
```bash
# Test search
curl -X POST http://localhost:3000/api/apollo/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "people",
    "q_keywords": "sales director",
    "page": 1,
    "per_page": 10
  }'

# Test enrichment
curl -X POST http://localhost:3000/api/apollo/enrich \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "person",
    "identifier": "john@example.com"
  }'
```

### Mock Data
Use `priority: "batch"` in development to avoid API calls and return mock data.

---

## 12. Troubleshooting

### Common Issues

**1. Rate Limit Errors**
- Check API usage in Apollo dashboard
- Increase cache TTLs
- Use batch priority for non-urgent requests

**2. Webhook Not Received**
- Verify webhook URL is publicly accessible
- Check webhook secret configuration
- Review Apollo webhook logs

**3. Cache Not Working**
- Ensure Redis is running
- Check Redis connection settings
- Verify cache key format

**4. Queue Processing Slow**
- Increase worker concurrency
- Check Redis memory usage
- Monitor queue backlogs

---

## Support

For issues or questions:
1. Check error logs in application
2. Review Apollo API status: https://status.apollo.io
3. Contact support with request IDs and timestamps