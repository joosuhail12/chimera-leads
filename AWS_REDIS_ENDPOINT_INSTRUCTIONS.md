# Getting Your Redis Endpoint - Quick Guide

## For Root User: suhail@pullse.ai

Since your CloudFormation stack has already been created, you just need to retrieve the Redis endpoint.

### Option 1: AWS Console (Easiest)

1. **Log into AWS Console** with your root account (suhail@pullse.ai)
2. Go to **ElastiCache** service
3. Click on **Redis clusters** in the left menu
4. Look for a cluster named `chimera-redis-cluster` or similar
5. Click on the cluster name
6. Copy the **Primary Endpoint** (it will look like: `chimera-redis-cluster.xxxxx.cache.amazonaws.com`)

### Option 2: CloudFormation Console

1. **Log into AWS Console** with your root account
2. Go to **CloudFormation** service
3. Find the stack `chimera-production-`
4. Click on the **Outputs** tab
5. Look for `RedisEndpoint` - copy this value

### Option 3: AWS CLI (with root account credentials)

Configure AWS CLI with your root account credentials, then run:

```bash
# Get endpoint from CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name "arn:aws:cloudformation:us-east-1:222727886779:stack/chimera-production-/75ea5920-ce0b-11f0-a0a0-0afffba0be9b" \
  --query 'Stacks[0].Outputs' \
  --output table \
  --region us-east-1

# Or directly from ElastiCache
aws elasticache describe-cache-clusters \
  --show-cache-node-info \
  --query 'CacheClusters[*].[CacheClusterId,CacheNodes[0].Endpoint.Address]' \
  --output table \
  --region us-east-1
```

## After Getting the Endpoint

1. **Update your `.env.local` file:**

```env
# Replace chimera-redis-cluster.xxxxx.cache.amazonaws.com with your actual endpoint
REDIS_HOST=chimera-redis-cluster.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_URL=redis://chimera-redis-cluster.xxxxx.cache.amazonaws.com:6379

# Also add these for BullMQ
BULL_REDIS_HOST=chimera-redis-cluster.xxxxx.cache.amazonaws.com
BULL_REDIS_PORT=6379

# Add your Apollo API key
APOLLO_API_KEY=your_apollo_api_key_here
```

2. **Test the connection:**

```bash
# Test with redis-cli
redis-cli -h your-endpoint.cache.amazonaws.com -p 6379 ping

# Should return: PONG
```

3. **Start your application:**

```bash
# Terminal 1: Start the app
npm run dev

# Terminal 2: Start the worker
npm run worker:dev
```

4. **Access the dashboards:**
- Queue Dashboard: http://localhost:3000/dashboard/queues
- Bull Board: http://localhost:3000/api/queues/board

## Grant IAM Permissions (Optional)

To avoid using root account credentials in the future, grant these permissions to your IAM user `chimera-email-service`:

1. Log into AWS Console as root
2. Go to **IAM** → **Users** → `chimera-email-service`
3. Click **Add permissions** → **Attach existing policies directly**
4. Click **Create policy** and use the JSON from `aws/iam-permission-request.json`
5. Attach the new policy to the user

This will allow the IAM user to manage ElastiCache in the future.

## Need Help?

If you can't find the Redis endpoint:
1. Check if the CloudFormation stack completed successfully
2. Look in the us-east-1 region (N. Virginia)
3. The cluster might be named differently - check all Redis clusters

## Security Note

Once you have the endpoint, keep it secure. Don't commit it to version control. Always use environment variables.