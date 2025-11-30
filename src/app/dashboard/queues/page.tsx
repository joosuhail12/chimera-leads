'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity
} from 'lucide-react';

interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  total: number;
}

interface MetricsData {
  metrics: {
    enrichment: QueueMetrics;
    bulk: QueueMetrics;
    webhooks: QueueMetrics;
    scoring: QueueMetrics;
  };
  timestamp: string;
  redis: {
    host: string;
    connected: boolean;
  };
}

export default function QueuesPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/queues');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleQueueAction = async (action: string, queueName?: string) => {
    try {
      const response = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, queueName }),
      });
      if (!response.ok) throw new Error('Action failed');
      await fetchMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const getQueueHealth = (queue: QueueMetrics) => {
    const failureRate = queue.completed > 0 ? (queue.failed / queue.completed) * 100 : 0;
    if (queue.paused) return 'paused';
    if (failureRate > 10) return 'critical';
    if (failureRate > 5) return 'warning';
    if (queue.waiting > 100) return 'busy';
    return 'healthy';
  };

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'healthy': return 'default';
      case 'busy': return 'secondary';
      case 'warning': return 'destructive';
      case 'critical': return 'destructive';
      case 'paused': return 'outline';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Queue Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and manage background job processing
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => fetchMetrics()}
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => window.open('/api/queues/board', '_blank')}
            variant="default"
          >
            <Activity className="h-4 w-4 mr-2" />
            Bull Board
          </Button>
        </div>
      </div>

      {/* Redis Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Redis Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${metrics.redis.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {metrics.redis.connected ? 'Connected' : 'Disconnected'}
              </span>
              <span className="text-sm text-muted-foreground">
                {metrics.redis.host}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Queue Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(metrics.metrics).map(([queueName, queueMetrics]) => {
          const health = getQueueHealth(queueMetrics);
          return (
            <Card key={queueName}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium capitalize">
                    {queueName}
                  </CardTitle>
                  <Badge variant={getHealthBadgeVariant(health)}>
                    {health}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Active</span>
                    <span className="font-medium">{queueMetrics.active}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Waiting</span>
                    <span className="font-medium">{queueMetrics.waiting}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-medium text-green-600">{queueMetrics.completed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="font-medium text-red-600">{queueMetrics.failed}</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {queueMetrics.paused ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleQueueAction('resume', queueName)}
                    >
                      <PlayCircle className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleQueueAction('pause', queueName)}
                    >
                      <PauseCircle className="h-3 w-3" />
                    </Button>
                  )}
                  {queueMetrics.failed > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleQueueAction('retry-failed', queueName)}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Queue Actions */}
      <Tabs defaultValue="actions" className="w-full">
        <TabsList>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="test">Test Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue Management</CardTitle>
              <CardDescription>
                Perform bulk actions on all queues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => handleQueueAction('retry-failed')}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry All Failed Jobs
                </Button>
                <Button
                  onClick={() => handleQueueAction('clear-failed')}
                  variant="outline"
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Failed Jobs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Queue System</CardTitle>
              <CardDescription>
                Send test jobs to verify queue processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => handleQueueAction('enrich', undefined)}
                variant="default"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Send Test Enrichment Job
              </Button>
              <p className="text-sm text-muted-foreground">
                This will create a test job in the enrichment queue to verify processing.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Queue Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Total Processed</p>
              <p className="text-2xl font-bold">
                {Object.values(metrics.metrics).reduce((sum, q) => sum + q.completed, 0).toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Total Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {Object.values(metrics.metrics).reduce((sum, q) => sum + q.failed, 0).toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {(() => {
                  const total = Object.values(metrics.metrics).reduce((sum, q) => sum + q.completed, 0);
                  const failed = Object.values(metrics.metrics).reduce((sum, q) => sum + q.failed, 0);
                  const rate = total > 0 ? ((total - failed) / total * 100).toFixed(1) : '0';
                  return `${rate}%`;
                })()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}