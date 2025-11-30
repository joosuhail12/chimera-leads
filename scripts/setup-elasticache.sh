#!/bin/bash

# AWS ElastiCache Redis Setup Script for Chimera
# This script creates a production-ready Redis cluster with proper security and configuration

set -e

# Configuration variables
CLUSTER_ID="chimera-redis-cluster"
NODE_TYPE="cache.t3.micro"  # Change to larger instance for production (e.g., cache.r6g.large)
NUM_CACHE_NODES=1
ENGINE="redis"
ENGINE_VERSION="7.0"
PORT=6379
PARAMETER_GROUP="chimera-redis-params"
SUBNET_GROUP="chimera-cache-subnet"
SECURITY_GROUP_NAME="chimera-redis-sg"
REGION=${AWS_REGION:-"us-east-1"}
SNAPSHOT_RETENTION_DAYS=7
AUTOMATIC_FAILOVER="false"  # Set to true for multi-AZ with replicas

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AWS ElastiCache Redis Setup for Chimera${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# Function to check if resource exists
check_resource() {
    local resource_type=$1
    local resource_id=$2
    local check_command=$3

    if eval $check_command 2>/dev/null; then
        echo -e "${YELLOW}$resource_type '$resource_id' already exists${NC}"
        return 0
    else
        return 1
    fi
}

# 1. Get default VPC and subnets
echo -e "\n${GREEN}Step 1: Getting VPC information${NC}"
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text --region $REGION)
if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
    echo -e "${YELLOW}No default VPC found. Getting first available VPC...${NC}"
    VPC_ID=$(aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text --region $REGION)
fi
echo "Using VPC: $VPC_ID"

# Get subnet IDs (at least 2 for subnet group)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text --region $REGION | head -n 2)
SUBNET_ID_ARRAY=($SUBNET_IDS)
echo "Using Subnets: ${SUBNET_ID_ARRAY[@]}"

# 2. Create Security Group for Redis
echo -e "\n${GREEN}Step 2: Creating Security Group${NC}"
if ! check_resource "Security Group" "$SECURITY_GROUP_NAME" "aws ec2 describe-security-groups --group-names $SECURITY_GROUP_NAME --region $REGION"; then
    SG_ID=$(aws ec2 create-security-group \
        --group-name $SECURITY_GROUP_NAME \
        --description "Security group for Chimera Redis cluster" \
        --vpc-id $VPC_ID \
        --region $REGION \
        --output text)

    echo "Created Security Group: $SG_ID"

    # Add ingress rules for Redis port
    # Note: In production, restrict source to your application's security group or specific IPs
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port $PORT \
        --cidr 0.0.0.0/0 \
        --region $REGION

    echo "Added ingress rule for port $PORT"
else
    SG_ID=$(aws ec2 describe-security-groups --group-names $SECURITY_GROUP_NAME --query 'SecurityGroups[0].GroupId' --output text --region $REGION)
    echo "Using existing Security Group: $SG_ID"
fi

# 3. Create Parameter Group
echo -e "\n${GREEN}Step 3: Creating Parameter Group${NC}"
if ! check_resource "Parameter Group" "$PARAMETER_GROUP" "aws elasticache describe-cache-parameter-groups --cache-parameter-group-name $PARAMETER_GROUP --region $REGION"; then
    aws elasticache create-cache-parameter-group \
        --cache-parameter-group-name $PARAMETER_GROUP \
        --cache-parameter-group-family redis7 \
        --description "Custom parameters for Chimera Redis cluster" \
        --region $REGION

    # Modify parameters for better performance
    aws elasticache modify-cache-parameter-group \
        --cache-parameter-group-name $PARAMETER_GROUP \
        --parameter-name-values \
            "ParameterName=maxmemory-policy,ParameterValue=allkeys-lru" \
            "ParameterName=timeout,ParameterValue=300" \
            "ParameterName=tcp-keepalive,ParameterValue=300" \
            "ParameterName=tcp-backlog,ParameterValue=511" \
            "ParameterName=databases,ParameterValue=16" \
        --region $REGION

    echo "Created and configured Parameter Group: $PARAMETER_GROUP"
fi

# 4. Create Subnet Group
echo -e "\n${GREEN}Step 4: Creating Subnet Group${NC}"
if ! check_resource "Subnet Group" "$SUBNET_GROUP" "aws elasticache describe-cache-subnet-groups --cache-subnet-group-name $SUBNET_GROUP --region $REGION"; then
    aws elasticache create-cache-subnet-group \
        --cache-subnet-group-name $SUBNET_GROUP \
        --cache-subnet-group-description "Subnet group for Chimera Redis cluster" \
        --subnet-ids ${SUBNET_ID_ARRAY[@]} \
        --region $REGION

    echo "Created Subnet Group: $SUBNET_GROUP"
fi

# 5. Create ElastiCache Redis Cluster
echo -e "\n${GREEN}Step 5: Creating ElastiCache Redis Cluster${NC}"
if ! check_resource "Cache Cluster" "$CLUSTER_ID" "aws elasticache describe-cache-clusters --cache-cluster-id $CLUSTER_ID --region $REGION"; then
    CREATION_OUTPUT=$(aws elasticache create-cache-cluster \
        --cache-cluster-id $CLUSTER_ID \
        --cache-node-type $NODE_TYPE \
        --engine $ENGINE \
        --engine-version $ENGINE_VERSION \
        --num-cache-nodes $NUM_CACHE_NODES \
        --cache-parameter-group-name $PARAMETER_GROUP \
        --cache-subnet-group-name $SUBNET_GROUP \
        --security-group-ids $SG_ID \
        --port $PORT \
        --preferred-maintenance-window "sun:05:00-sun:06:00" \
        --snapshot-retention-limit $SNAPSHOT_RETENTION_DAYS \
        --snapshot-window "03:00-05:00" \
        --tags "Key=Name,Value=Chimera-Redis" "Key=Environment,Value=Production" "Key=Project,Value=Chimera" \
        --region $REGION \
        --output json)

    echo "Redis cluster creation initiated: $CLUSTER_ID"
    echo -e "${YELLOW}Note: Cluster creation takes 5-10 minutes to complete${NC}"
else
    echo -e "${YELLOW}Cluster '$CLUSTER_ID' already exists${NC}"
fi

# 6. Wait for cluster to be available
echo -e "\n${GREEN}Step 6: Waiting for cluster to be available${NC}"
echo "This may take several minutes..."

while true; do
    STATUS=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id $CLUSTER_ID \
        --show-cache-node-info \
        --query 'CacheClusters[0].CacheClusterStatus' \
        --output text \
        --region $REGION 2>/dev/null || echo "creating")

    if [ "$STATUS" = "available" ]; then
        echo -e "${GREEN}Cluster is now available!${NC}"
        break
    elif [ "$STATUS" = "creating" ] || [ "$STATUS" = "modifying" ]; then
        echo -n "."
        sleep 10
    else
        echo -e "\n${YELLOW}Cluster status: $STATUS${NC}"
        sleep 10
    fi
done

# 7. Get cluster endpoint
echo -e "\n${GREEN}Step 7: Getting cluster endpoint${NC}"
ENDPOINT=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id $CLUSTER_ID \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
    --output text \
    --region $REGION)

PORT_NUMBER=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id $CLUSTER_ID \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Port' \
    --output text \
    --region $REGION)

# 8. Generate .env configuration
echo -e "\n${GREEN}Step 8: Generating environment configuration${NC}"
ENV_FILE=".env.elasticache"

cat > $ENV_FILE << EOF
# AWS ElastiCache Redis Configuration
# Generated on $(date)

# Redis Connection
REDIS_HOST=$ENDPOINT
REDIS_PORT=$PORT_NUMBER
REDIS_PASSWORD=
REDIS_DB=0

# AWS Configuration
AWS_REGION=$REGION
ELASTICACHE_CLUSTER_ID=$CLUSTER_ID
ELASTICACHE_SECURITY_GROUP=$SG_ID

# Connection URL (for libraries that support it)
REDIS_URL=redis://$ENDPOINT:$PORT_NUMBER

# BullMQ Configuration
BULL_REDIS_HOST=$ENDPOINT
BULL_REDIS_PORT=$PORT_NUMBER

# Additional Settings
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
EOF

echo -e "${GREEN}Configuration saved to $ENV_FILE${NC}"

# 9. Display summary
echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo -e "Cluster ID:        ${YELLOW}$CLUSTER_ID${NC}"
echo -e "Endpoint:          ${YELLOW}$ENDPOINT${NC}"
echo -e "Port:              ${YELLOW}$PORT_NUMBER${NC}"
echo -e "Security Group:    ${YELLOW}$SG_ID${NC}"
echo -e "Parameter Group:   ${YELLOW}$PARAMETER_GROUP${NC}"
echo -e "Subnet Group:      ${YELLOW}$SUBNET_GROUP${NC}"

echo -e "\n${GREEN}Next Steps:${NC}"
echo "1. Copy the environment variables from $ENV_FILE to your .env.local file"
echo "2. Test the connection using: redis-cli -h $ENDPOINT -p $PORT_NUMBER ping"
echo "3. For production, consider:"
echo "   - Enabling encryption in transit"
echo "   - Setting up authentication (AUTH token)"
echo "   - Configuring automatic backups"
echo "   - Enabling Multi-AZ with automatic failover"
echo "   - Using a larger instance type"

echo -e "\n${YELLOW}Important Security Notes:${NC}"
echo "- The security group currently allows connections from anywhere (0.0.0.0/0)"
echo "- For production, restrict this to your application's security group or specific IPs"
echo "- Consider enabling VPC peering or AWS PrivateLink for secure connectivity"

# 10. Optional: Create CloudWatch alarms
echo -e "\n${GREEN}Step 10: Setting up CloudWatch monitoring (optional)${NC}"
read -p "Do you want to set up CloudWatch alarms? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # CPU Utilization Alarm
    aws cloudwatch put-metric-alarm \
        --alarm-name "$CLUSTER_ID-cpu-high" \
        --alarm-description "Alarm when CPU exceeds 70%" \
        --metric-name CPUUtilization \
        --namespace AWS/ElastiCache \
        --statistic Average \
        --period 300 \
        --threshold 70 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --dimensions Name=CacheClusterId,Value=$CLUSTER_ID \
        --region $REGION

    # Memory Usage Alarm
    aws cloudwatch put-metric-alarm \
        --alarm-name "$CLUSTER_ID-memory-high" \
        --alarm-description "Alarm when memory usage exceeds 80%" \
        --metric-name DatabaseMemoryUsagePercentage \
        --namespace AWS/ElastiCache \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --dimensions Name=CacheClusterId,Value=$CLUSTER_ID \
        --region $REGION

    echo -e "${GREEN}CloudWatch alarms configured${NC}"
fi

echo -e "\n${GREEN}Script execution completed successfully!${NC}"