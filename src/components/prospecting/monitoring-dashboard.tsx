'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  Server,
  TrendingUp,
  Zap,
  XCircle,
  Users,
  DollarSign,
  Cpu,
  HardDrive,
  Wifi,
  GitBranch
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface SystemHealth {
  apollo: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    rateLimitRemaining: number;
    rateLimitTotal: number;
  };
  redis: {
    status: 'healthy' | 'degraded' | 'down';
    memoryUsage: number;
    totalMemory: number;
    connectedClients: number;
    cacheHitRate: number;
  };
  database: {
    status: 'healthy' | 'degraded' | 'down';
    activeConnections: number;
    maxConnections: number;
    queryTime: number;
  };
  queues: {
    enrichment: QueueMetrics;
    bulk: QueueMetrics;
    webhooks: QueueMetrics;
    scoring: QueueMetrics;
  };
}

interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number;
  averageTime: number;
}

interface ApiUsageStats {
  today: {
    requests: number;
    cached: number;
    failed: number;
    cost: number;
  };
  thisWeek: {
    requests: number;
    cached: number;
    failed: number;
    cost: number;
  };
  thisMonth: {
    requests: number;
    cached: number;
    failed: number;
    cost: number;
  };
  byEndpoint: Record<string, number>;
  byHour: Record<string, number>;
}

interface PlaybookMetrics {
  active: number;
  total: number;
  recentExecutions: {
    id: string;
    name: string;
    status: 'running' | 'completed' | 'failed';
    startedAt: Date;
    duration?: number;
    itemsProcessed?: number;
  }[];
  successRate: number;
  averageDuration: number;
}

export function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [apiUsage, setApiUsage] = useState<ApiUsageStats | null>(null);
  const [playbookMetrics, setPlaybookMetrics] = useState<PlaybookMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);

      // Fetch system health
      const healthResponse = await fetch('/api/apollo/health');
      const health = await healthResponse.json();
      setSystemHealth(health);

      // Fetch API usage
      const usageResponse = await fetch('/api/apollo/usage');
      const usage = await usageResponse.json();
      setApiUsage(usage);

      // Fetch playbook metrics
      const playbookResponse = await fetch('/api/playbooks/metrics');
      const playbooks = await playbookResponse.json();
      setPlaybookMetrics(playbooks);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch monitoring data',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearQueue = async (queueName: string) => {
    try {
      const response = await fetch(`/api/apollo/queues/${queueName}/clear`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Queue Cleared',
          description: `Successfully cleared ${queueName} queue`,
        });
        fetchMetrics();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear queue',
        variant: 'destructive',
      });
    }
  };

  const retryFailedJobs = async (queueName: string) => {
    try {
      const response = await fetch(`/api/apollo/queues/${queueName}/retry`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Jobs Retried',
          description: `Retrying failed jobs in ${queueName} queue`,
        });
        fetchMetrics();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry jobs',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'down': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'down': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Apollo Integration Monitor
              </CardTitle>
              <CardDescription>
                Real-time system health and performance metrics
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-blue-50' : ''}
              >
                {autoRefresh ? (
                  <>
                    <Wifi className="h-4 w-4 mr-2 text-blue-500" />
                    Live
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Auto Refresh
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMetrics}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Apollo API Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Apollo API
                {getStatusIcon(systemHealth.apollo.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Response Time</span>
                <span className="font-medium">{systemHealth.apollo.responseTime}ms</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rate Limit</span>
                  <span className="font-medium">
                    {systemHealth.apollo.rateLimitRemaining}/{systemHealth.apollo.rateLimitTotal}
                  </span>
                </div>
                <Progress
                  value={(systemHealth.apollo.rateLimitRemaining / systemHealth.apollo.rateLimitTotal) * 100}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Redis Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Redis Cache
                {getStatusIcon(systemHealth.redis.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Hit Rate</span>
                <span className="font-medium">{(systemHealth.redis.cacheHitRate * 100).toFixed(1)}%</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Memory</span>
                  <span className="font-medium">
                    {(systemHealth.redis.memoryUsage / 1024 / 1024).toFixed(0)}MB
                  </span>
                </div>
                <Progress
                  value={(systemHealth.redis.memoryUsage / systemHealth.redis.totalMemory) * 100}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Database Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Database
                {getStatusIcon(systemHealth.database.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Query Time</span>
                <span className="font-medium">{systemHealth.database.queryTime}ms</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Connections</span>
                  <span className="font-medium">
                    {systemHealth.database.activeConnections}/{systemHealth.database.maxConnections}
                  </span>
                </div>
                <Progress
                  value={(systemHealth.database.activeConnections / systemHealth.database.maxConnections) * 100}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="queues" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="queues">
            <GitBranch className="h-4 w-4 mr-2" />
            Queues
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="h-4 w-4 mr-2" />
            API Usage
          </TabsTrigger>
          <TabsTrigger value="playbooks">
            <Zap className="h-4 w-4 mr-2" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertCircle className="h-4 w-4 mr-2" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Queues Tab */}
        <TabsContent value="queues" className="space-y-4">
          {systemHealth?.queues && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(systemHealth.queues).map(([name, queue]) => (
                <Card key={name}>
                  <CardHeader>
                    <CardTitle className="text-lg capitalize flex items-center justify-between">
                      {name} Queue
                      {queue.paused && <Badge variant="secondary">Paused</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Queue Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Waiting</p>
                        <p className="text-2xl font-bold">{queue.waiting}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Active</p>
                        <p className="text-2xl font-bold">{queue.active}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{queue.completed}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{queue.failed}</p>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Processing Rate</span>
                        <span className="font-medium">{queue.processingRate}/min</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Avg Time</span>
                        <span className="font-medium">{queue.averageTime}ms</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {queue.failed > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryFailedJobs(name)}
                        >
                          Retry Failed
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => clearQueue(name)}
                        >
                          Clear Failed
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* API Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          {apiUsage && (
            <>
              {/* Usage Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Today</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Requests</span>
                      <span className="font-medium">{apiUsage.today.requests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cached</span>
                      <span className="font-medium">{apiUsage.today.cached}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cost</span>
                      <span className="font-medium">${apiUsage.today.cost.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">This Week</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Requests</span>
                      <span className="font-medium">{apiUsage.thisWeek.requests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cached</span>
                      <span className="font-medium">{apiUsage.thisWeek.cached}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cost</span>
                      <span className="font-medium">${apiUsage.thisWeek.cost.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">This Month</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Requests</span>
                      <span className="font-medium">{apiUsage.thisMonth.requests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cached</span>
                      <span className="font-medium">{apiUsage.thisMonth.cached}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cost</span>
                      <span className="font-medium">${apiUsage.thisMonth.cost.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Endpoint Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">API Endpoint Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(apiUsage.byEndpoint)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([endpoint, count]) => (
                        <div key={endpoint}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{endpoint}</span>
                            <span className="text-sm text-gray-600">{count} calls</span>
                          </div>
                          <Progress
                            value={(count / Math.max(...Object.values(apiUsage.byEndpoint))) * 100}
                            className="h-2"
                          />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Playbooks Tab */}
        <TabsContent value="playbooks" className="space-y-4">
          {playbookMetrics && (
            <>
              {/* Playbook Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Active</p>
                        <p className="text-2xl font-bold">{playbookMetrics.active}</p>
                      </div>
                      <Zap className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-2xl font-bold">{playbookMetrics.total}</p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Success Rate</p>
                        <p className="text-2xl font-bold">{playbookMetrics.successRate}%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Avg Duration</p>
                        <p className="text-2xl font-bold">{Math.round(playbookMetrics.averageDuration / 1000)}s</p>
                      </div>
                      <Clock className="h-8 w-8 text-orange-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Executions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Executions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {playbookMetrics.recentExecutions.map((execution) => (
                      <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {execution.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                          {execution.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {execution.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                          <div>
                            <p className="font-medium">{execution.name}</p>
                            <p className="text-sm text-gray-600">
                              Started {new Date(execution.startedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {execution.itemsProcessed && (
                            <p className="text-sm font-medium">{execution.itemsProcessed} items</p>
                          )}
                          {execution.duration && (
                            <p className="text-sm text-gray-600">{Math.round(execution.duration / 1000)}s</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Rate Limit Warning</AlertTitle>
            <AlertDescription>
              Apollo API rate limit is at 20% remaining. Consider reducing request frequency.
            </AlertDescription>
          </Alert>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Cache Performance</AlertTitle>
            <AlertDescription>
              Cache hit rate is excellent at 82%. This is saving approximately $45/day in API costs.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Failed Jobs Alert</AlertTitle>
            <AlertDescription>
              15 enrichment jobs have failed in the last hour. Review and retry failed jobs.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}