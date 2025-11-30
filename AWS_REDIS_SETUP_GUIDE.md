# AWS ElastiCache Redis Setup Guide

## Overview
This guide will help you set up Redis on AWS ElastiCache for your Chimera application. Due to IAM permission requirements, you have three options for deployment.

## Option 1: CloudFormation (Recommended)

The easiest way to deploy Redis is using the CloudFormation template.

### Prerequisites
1. AWS account with appropriate permissions
2. VPC ID and at least 2 Subnet IDs

### Steps

1. **Deploy via AWS Console:**
   - Go to AWS CloudFormation Console
   - Click "Create Stack"
   - Upload `aws/elasticache-cloudformation.yaml`
   - Fill in parameters:
     - **VPCId**: Your VPC ID
     - **SubnetIds**: Select at least 2 subnets
     - **NodeType**: `cache.t3.micro` for testing, `cache.r6g.large` for production
     - **AllowedCIDR**: Your application's IP range (don't use 0.0.0.0/0 in production)
   - Review and create stack

2. **Deploy via AWS CLI:**
```bash
# First, get your VPC and Subnet IDs
aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text
aws ec2 describe-subnets --query 'Subnets[*].SubnetId' --output text

# Deploy the stack
aws cloudformation create-stack \
  --stack-name chimera-redis \
  --template-body file://aws/elasticache-cloudformation.yaml \
  --parameters \
    ParameterKey=VPCId,ParameterValue=vpc-xxxxxx \
    ParameterKey=SubnetIds,ParameterValue=\"subnet-xxxxx,subnet-yyyyy\" \
    ParameterKey=NodeType,ParameterValue=cache.t3.micro \
    ParameterKey=AllowedCIDR,ParameterValue=0.0.0.0/0

# Check stack status
aws cloudformation describe-stacks \
  --stack-name chimera-redis \
  --query 'Stacks[0].StackStatus'

# Get outputs after creation
aws cloudformation describe-stacks \
  --stack-name chimera-redis \
  --query 'Stacks[0].Outputs'
```

## Option 2: Manual AWS CLI Commands

If you prefer to run commands manually or need more control:

1. **Get your VPC and Subnet information:**
```bash
# List VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table

# List Subnets
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,VpcId,AvailabilityZone]' --output table
```

2. **Run the setup commands:**
   - Open `aws/elasticache-manual-setup.sh`
   - Replace the VPC_ID and SUBNET_IDs with your values
   - Run each command sequentially

## Option 3: Request IAM Permissions

Ask your AWS administrator to grant these permissions to your IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:CreateSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups",
        "elasticache:CreateCacheCluster",
        "elasticache:CreateCacheParameterGroup",
        "elasticache:CreateCacheSubnetGroup",
        "elasticache:ModifyCacheParameterGroup",
        "elasticache:DescribeCacheClusters",
        "elasticache:DescribeCacheParameterGroups",
        "elasticache:DescribeCacheSubnetGroups",
        "elasticache:AddTagsToResource",
        "cloudwatch:PutMetricAlarm"
      ],
      "Resource": "*"
    }
  ]
}
```

Then run: `./scripts/setup-elasticache.sh`

## After Deployment

Once your Redis cluster is created:

1. **Get the endpoint:**
```bash
aws elasticache describe-cache-clusters \
  --cache-cluster-id chimera-redis-cluster \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint'
```

2. **Update your `.env.local`:**
```env
# AWS ElastiCache Redis
REDIS_HOST=your-cluster.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_URL=redis://your-cluster.xxxxx.cache.amazonaws.com:6379

# Optional: Enable TLS if configured
REDIS_TLS=false
```

3. **Test the connection:**
```bash
# Using redis-cli
redis-cli -h your-cluster.xxxxx.cache.amazonaws.com -p 6379 ping

# Using the test script
npx tsx test-apollo-integration.ts
```

## Production Considerations

### Security
- **Never use 0.0.0.0/0 for AllowedCIDR in production**
- Restrict access to your application's security group or specific IPs
- Enable encryption in transit (TLS)
- Enable encryption at rest
- Use VPC endpoints or AWS PrivateLink

### Performance
- Use larger instance types for production (cache.r6g.large or higher)
- Enable automatic failover with Multi-AZ
- Configure proper maxmemory-policy (allkeys-lru recommended)
- Monitor CloudWatch metrics

### High Availability
- Deploy with multiple nodes (NumCacheNodes > 1)
- Enable automatic failover
- Set up cross-region replication for DR
- Configure snapshot backups

### Cost Optimization
- Use Reserved Instances for predictable workloads (up to 55% savings)
- Right-size your instances based on actual usage
- Use cache.t3 instances for development/testing
- Monitor and optimize based on CloudWatch metrics

## Monitoring

The CloudFormation template creates three CloudWatch alarms:
- **CPU Utilization** > 70%
- **Memory Usage** > 80%
- **Evictions** > 1000 per 5 minutes

Access CloudWatch to view metrics and set up additional alarms as needed.

## Troubleshooting

### Connection Refused
- Check security group allows port 6379 from your application
- Verify cluster status is "available"
- Ensure you're using the correct endpoint

### Permission Denied
- Verify IAM permissions are correct
- Check if MFA is required for your account

### High Latency
- Ensure your application and Redis are in the same region
- Check if cluster is under high load (CloudWatch metrics)
- Consider upgrading instance type

## Support

For issues or questions:
1. Check CloudWatch logs and metrics
2. Review AWS ElastiCache documentation
3. Contact AWS Support if needed

## Next Steps

1. ✅ Deploy Redis using one of the options above
2. ✅ Update your `.env.local` with the Redis endpoint
3. ✅ Test the connection
4. ✅ Start your application and worker
5. ✅ Monitor via the Queue Dashboard at `/dashboard/queues`