#!/bin/bash

# AWS ElastiCache Redis Manual Setup Commands
# Run these commands with an IAM user that has proper permissions

# Variables - MODIFY THESE
REGION="us-east-1"
VPC_ID="vpc-xxxxxx"  # Replace with your VPC ID
SUBNET_ID_1="subnet-xxxxxx"  # Replace with your first subnet ID
SUBNET_ID_2="subnet-yyyyyy"  # Replace with your second subnet ID

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}AWS ElastiCache Redis Setup - Manual Commands${NC}"
echo -e "${YELLOW}Note: Replace VPC_ID and SUBNET_IDs with your actual values${NC}"
echo ""

# 1. Create Security Group
echo "Step 1: Create Security Group"
echo "aws ec2 create-security-group \\"
echo "  --group-name chimera-redis-sg \\"
echo "  --description \"Security group for Chimera Redis cluster\" \\"
echo "  --vpc-id $VPC_ID \\"
echo "  --region $REGION"
echo ""

# 2. Add Ingress Rule
echo "Step 2: Add Security Group Rule (after getting SG_ID from step 1)"
echo "aws ec2 authorize-security-group-ingress \\"
echo "  --group-id sg-xxxxxx \\"  # Replace with security group ID from step 1
echo "  --protocol tcp \\"
echo "  --port 6379 \\"
echo "  --cidr 0.0.0.0/0 \\"  # WARNING: Open to all - restrict in production
echo "  --region $REGION"
echo ""

# 3. Create Parameter Group
echo "Step 3: Create Cache Parameter Group"
echo "aws elasticache create-cache-parameter-group \\"
echo "  --cache-parameter-group-name chimera-redis-params \\"
echo "  --cache-parameter-group-family redis7 \\"
echo "  --description \"Custom parameters for Chimera Redis cluster\" \\"
echo "  --region $REGION"
echo ""

# 4. Modify Parameter Group
echo "Step 4: Configure Parameters"
echo "aws elasticache modify-cache-parameter-group \\"
echo "  --cache-parameter-group-name chimera-redis-params \\"
echo "  --parameter-name-values \\"
echo "    ParameterName=maxmemory-policy,ParameterValue=allkeys-lru \\"
echo "    ParameterName=timeout,ParameterValue=300 \\"
echo "    ParameterName=tcp-keepalive,ParameterValue=300 \\"
echo "    ParameterName=databases,ParameterValue=16 \\"
echo "  --region $REGION"
echo ""

# 5. Create Subnet Group
echo "Step 5: Create Cache Subnet Group"
echo "aws elasticache create-cache-subnet-group \\"
echo "  --cache-subnet-group-name chimera-cache-subnet \\"
echo "  --cache-subnet-group-description \"Subnet group for Chimera Redis cluster\" \\"
echo "  --subnet-ids $SUBNET_ID_1 $SUBNET_ID_2 \\"
echo "  --region $REGION"
echo ""

# 6. Create ElastiCache Cluster
echo "Step 6: Create Redis Cluster (replace sg-xxxxxx with your security group ID)"
echo "aws elasticache create-cache-cluster \\"
echo "  --cache-cluster-id chimera-redis-cluster \\"
echo "  --cache-node-type cache.t3.micro \\"
echo "  --engine redis \\"
echo "  --engine-version 7.0 \\"
echo "  --num-cache-nodes 1 \\"
echo "  --cache-parameter-group-name chimera-redis-params \\"
echo "  --cache-subnet-group-name chimera-cache-subnet \\"
echo "  --security-group-ids sg-xxxxxx \\"  # Replace with security group ID from step 1
echo "  --port 6379 \\"
echo "  --preferred-maintenance-window sun:05:00-sun:06:00 \\"
echo "  --snapshot-retention-limit 7 \\"
echo "  --snapshot-window 03:00-05:00 \\"
echo "  --tags \"Key=Name,Value=Chimera-Redis\" \"Key=Environment,Value=Production\" \\"
echo "  --region $REGION"
echo ""

# 7. Get Cluster Endpoint
echo "Step 7: Get Cluster Endpoint (after cluster is available)"
echo "aws elasticache describe-cache-clusters \\"
echo "  --cache-cluster-id chimera-redis-cluster \\"
echo "  --show-cache-node-info \\"
echo "  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \\"
echo "  --output text \\"
echo "  --region $REGION"
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Required IAM Permissions:${NC}"
echo "Your IAM user needs these permissions:"
echo "- ec2:DescribeVpcs"
echo "- ec2:DescribeSubnets"
echo "- ec2:CreateSecurityGroup"
echo "- ec2:AuthorizeSecurityGroupIngress"
echo "- ec2:DescribeSecurityGroups"
echo "- elasticache:CreateCacheCluster"
echo "- elasticache:CreateCacheParameterGroup"
echo "- elasticache:CreateCacheSubnetGroup"
echo "- elasticache:ModifyCacheParameterGroup"
echo "- elasticache:DescribeCacheClusters"
echo "- elasticache:AddTagsToResource"
echo ""
echo -e "${YELLOW}CloudFormation Alternative:${NC}"
echo "For easier deployment, use the CloudFormation template:"
echo "aws/elasticache-cloudformation.yaml"
echo ""