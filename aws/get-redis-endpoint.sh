#!/bin/bash

# Script to retrieve Redis endpoint from existing CloudFormation stack
# Run this with appropriate AWS permissions or ask your admin to run it

STACK_ARN="arn:aws:cloudformation:us-east-1:222727886779:stack/chimera-production-/75ea5920-ce0b-11f0-a0a0-0afffba0be9b"
REGION="us-east-1"

echo "================================================"
echo "Redis Endpoint Retrieval Script"
echo "================================================"
echo ""
echo "Stack ARN: $STACK_ARN"
echo ""

# Method 1: Get from CloudFormation Outputs
echo "Method 1: CloudFormation Stack Outputs"
echo "---------------------------------------"
echo "Run this command with proper permissions:"
echo ""
echo "aws cloudformation describe-stacks \\"
echo "  --stack-name \"$STACK_ARN\" \\"
echo "  --query 'Stacks[0].Outputs[?OutputKey==\`RedisEndpoint\`].OutputValue' \\"
echo "  --output text \\"
echo "  --region $REGION"
echo ""

# Method 2: Get all stack outputs
echo "Method 2: All Stack Outputs"
echo "----------------------------"
echo "aws cloudformation describe-stacks \\"
echo "  --stack-name \"$STACK_ARN\" \\"
echo "  --query 'Stacks[0].Outputs' \\"
echo "  --output table \\"
echo "  --region $REGION"
echo ""

# Method 3: List all ElastiCache clusters
echo "Method 3: List ElastiCache Clusters"
echo "------------------------------------"
echo "aws elasticache describe-cache-clusters \\"
echo "  --show-cache-node-info \\"
echo "  --query 'CacheClusters[*].[CacheClusterId,CacheNodes[0].Endpoint.Address,CacheNodes[0].Endpoint.Port]' \\"
echo "  --output table \\"
echo "  --region $REGION"
echo ""

# Method 4: Get specific cluster (if you know the name)
echo "Method 4: Get Specific Cluster (likely 'chimera-redis-cluster')"
echo "----------------------------------------------------------------"
echo "aws elasticache describe-cache-clusters \\"
echo "  --cache-cluster-id chimera-redis-cluster \\"
echo "  --show-cache-node-info \\"
echo "  --query 'CacheClusters[0].CacheNodes[0].Endpoint' \\"
echo "  --output json \\"
echo "  --region $REGION"
echo ""

echo "================================================"
echo "After getting the endpoint, update your .env.local:"
echo "================================================"
echo ""
echo "REDIS_HOST=<your-endpoint>.cache.amazonaws.com"
echo "REDIS_PORT=6379"
echo "REDIS_URL=redis://<your-endpoint>.cache.amazonaws.com:6379"
echo "BULL_REDIS_HOST=<your-endpoint>.cache.amazonaws.com"
echo "BULL_REDIS_PORT=6379"
echo ""
echo "================================================"
echo "To test the connection:"
echo "================================================"
echo ""
echo "redis-cli -h <your-endpoint>.cache.amazonaws.com -p 6379 ping"
echo ""