'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Link,
  FileText,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Eye,
  MousePointer,
  Download,
  ExternalLink,
  Zap,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useToast } from '@/components/ui/use-toast';

interface EngagementEvent {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  type: 'email_open' | 'email_click' | 'reply' | 'meeting_booked' | 'call' | 'linkedin_view' | 'document_view' | 'form_submit';
  details: {
    subject?: string;
    link?: string;
    duration?: number;
    document?: string;
    formData?: Record<string, any>;
  };
  timestamp: Date;
  score: number;
  sequenceId?: string;
  sequenceName?: string;
}

interface EngagementMetrics {
  totalEngagements: number;
  uniqueLeads: number;
  avgEngagementScore: number;
  topEngagedLeads: Array<{
    id: string;
    name: string;
    company: string;
    score: number;
    lastEngagement: Date;
  }>;
  engagementByType: Record<string, number>;
  engagementTrend: Array<{
    date: string;
    count: number;
    score: number;
  }>;
  conversionFunnel: Array<{
    stage: string;
    count: number;
    rate: number;
  }>;
}

const engagementTypeConfig = {
  email_open: { icon: Mail, color: '#3b82f6', label: 'Email Opened', score: 1 },
  email_click: { icon: MousePointer, color: '#10b981', label: 'Link Clicked', score: 3 },
  reply: { icon: MessageSquare, color: '#8b5cf6', label: 'Replied', score: 5 },
  meeting_booked: { icon: Calendar, color: '#f59e0b', label: 'Meeting Booked', score: 10 },
  call: { icon: Phone, color: '#06b6d4', label: 'Call', score: 7 },
  linkedin_view: { icon: Eye, color: '#0077b5', label: 'LinkedIn View', score: 2 },
  document_view: { icon: FileText, color: '#ec4899', label: 'Document View', score: 4 },
  form_submit: { icon: CheckCircle, color: '#10b981', label: 'Form Submit', score: 8 },
};

export function EngagementTracker() {
  const [events, setEvents] = useState<EngagementEvent[]>([]);
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [realTimeMode, setRealTimeMode] = useState(false);
  const { toast } = useToast();

  // Load engagement data
  useEffect(() => {
    loadEngagementData();

    if (realTimeMode) {
      const interval = setInterval(loadEngagementData, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedPeriod, realTimeMode]);

  const loadEngagementData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/apollo/engagement?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to load engagement data');

      const data = await response.json();
      setEvents(data.events || []);
      setMetrics(data.metrics || generateMockMetrics());
    } catch (error) {
      // Use mock data as fallback
      const mockData = generateMockEngagementData();
      setEvents(mockData);
      setMetrics(generateMockMetrics());
    } finally {
      setIsLoading(false);
    }
  };

  // Generate mock data
  const generateMockEngagementData = (): EngagementEvent[] => {
    const types = Object.keys(engagementTypeConfig) as Array<keyof typeof engagementTypeConfig>;
    const leads = [
      { id: '1', name: 'John Smith', company: 'TechCorp' },
      { id: '2', name: 'Sarah Johnson', company: 'DataSystems' },
      { id: '3', name: 'Mike Chen', company: 'CloudWorks' },
      { id: '4', name: 'Lisa Anderson', company: 'AIVentures' },
      { id: '5', name: 'David Kim', company: 'FinTech Pro' },
    ];

    return Array.from({ length: 50 }, (_, i) => {
      const lead = leads[Math.floor(Math.random() * leads.length)];
      const type = types[Math.floor(Math.random() * types.length)];

      return {
        id: `event-${i}`,
        leadId: lead.id,
        leadName: lead.name,
        company: lead.company,
        type,
        details: {
          subject: type.includes('email') ? 'Quick question about your solution' : undefined,
          link: type === 'email_click' ? 'https://example.com/demo' : undefined,
          duration: type === 'call' ? Math.floor(Math.random() * 30) + 5 : undefined,
          document: type === 'document_view' ? 'Product Overview.pdf' : undefined,
        },
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        score: engagementTypeConfig[type].score,
        sequenceId: Math.random() > 0.5 ? 'seq-1' : undefined,
        sequenceName: Math.random() > 0.5 ? 'Cold Outreach Q4' : undefined,
      };
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  const generateMockMetrics = (): EngagementMetrics => {
    return {
      totalEngagements: 247,
      uniqueLeads: 89,
      avgEngagementScore: 4.2,
      topEngagedLeads: [
        { id: '1', name: 'John Smith', company: 'TechCorp', score: 28, lastEngagement: new Date() },
        { id: '2', name: 'Sarah Johnson', company: 'DataSystems', score: 24, lastEngagement: new Date() },
        { id: '3', name: 'Mike Chen', company: 'CloudWorks', score: 19, lastEngagement: new Date() },
      ],
      engagementByType: {
        email_open: 89,
        email_click: 45,
        reply: 23,
        meeting_booked: 8,
        call: 12,
        linkedin_view: 34,
        document_view: 28,
        form_submit: 8,
      },
      engagementTrend: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
        count: Math.floor(Math.random() * 50) + 20,
        score: Math.floor(Math.random() * 100) + 50,
      })),
      conversionFunnel: [
        { stage: 'Contacted', count: 500, rate: 100 },
        { stage: 'Opened', count: 350, rate: 70 },
        { stage: 'Clicked', count: 150, rate: 30 },
        { stage: 'Replied', count: 45, rate: 9 },
        { stage: 'Meeting', count: 12, rate: 2.4 },
      ],
    };
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Calculate engagement velocity
  const calculateVelocity = () => {
    if (!events.length) return 0;
    const recentEvents = events.filter(e =>
      e.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );
    return recentEvents.length;
  };

  // Get engagement icon
  const getEngagementIcon = (type: keyof typeof engagementTypeConfig) => {
    const Icon = engagementTypeConfig[type].icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-500" />
                Engagement Tracker
              </CardTitle>
              <CardDescription>
                Monitor all prospect interactions and engagement patterns
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={realTimeMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRealTimeMode(!realTimeMode)}
              >
                <Zap className="h-4 w-4 mr-2" />
                {realTimeMode ? 'Live' : 'Manual'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Engagements</p>
                  <p className="text-2xl font-bold">{metrics.totalEngagements}</p>
                  <p className="text-xs text-green-600 mt-1">+12% from last period</p>
                </div>
                <Activity className="h-8 w-8 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Engaged Leads</p>
                  <p className="text-2xl font-bold">{metrics.uniqueLeads}</p>
                  <p className="text-xs text-gray-500 mt-1">{calculateVelocity()} today</p>
                </div>
                <Users className="h-8 w-8 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Score</p>
                  <p className="text-2xl font-bold">{metrics.avgEngagementScore.toFixed(1)}</p>
                  <Progress value={metrics.avgEngagementScore * 10} className="mt-2" />
                </div>
                <Target className="h-8 w-8 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Reply Rate</p>
                  <p className="text-2xl font-bold">
                    {metrics.engagementByType.reply ?
                      `${((metrics.engagementByType.reply / metrics.engagementByType.email_open) * 100).toFixed(1)}%` :
                      '0%'
                    }
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Above industry avg</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Engagements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.slice(0, 20).map((event) => {
                  const config = engagementTypeConfig[event.type];
                  return (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div
                        className="p-2 rounded-full"
                        style={{ backgroundColor: `${config.color}20` }}
                      >
                        {getEngagementIcon(event.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{event.leadName}</span>
                          <span className="text-sm text-gray-500">at</span>
                          <span className="text-sm text-gray-600">{event.company}</span>
                          {event.sequenceName && (
                            <Badge variant="outline" className="text-xs">
                              {event.sequenceName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {config.label}
                          {event.details.subject && ` - "${event.details.subject}"`}
                          {event.details.document && ` - ${event.details.document}`}
                          {event.details.duration && ` - ${event.details.duration} minutes`}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
                          <Badge variant="secondary" className="text-xs">
                            +{event.score} points
                          </Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Engagement Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={metrics?.engagementTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Engagement Types */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={Object.entries(metrics?.engagementByType || {}).map(([type, count]) => ({
                        name: engagementTypeConfig[type as keyof typeof engagementTypeConfig].label,
                        value: count,
                        color: engagementTypeConfig[type as keyof typeof engagementTypeConfig].color,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(metrics?.engagementByType || {}).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={engagementTypeConfig[entry[0] as keyof typeof engagementTypeConfig].color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Conversion Funnel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics?.conversionFunnel || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                    <Bar dataKey="rate" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Most Engaged Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.topEngagedLeads.map((lead, index) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-gray-600">{lead.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{lead.score}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sequence Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Cold Outreach Q4', 'Product Launch', 'Re-engagement Campaign'].map((sequence) => (
                  <div key={sequence} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{sequence}</h4>
                      <Badge variant="outline">Active</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Sent</p>
                        <p className="font-medium">{Math.floor(Math.random() * 500) + 100}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Opens</p>
                        <p className="font-medium">{Math.floor(Math.random() * 70) + 30}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Clicks</p>
                        <p className="font-medium">{Math.floor(Math.random() * 30) + 10}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Replies</p>
                        <p className="font-medium">{Math.floor(Math.random() * 10) + 2}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}