'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  DollarSign,
  Clock,
  Zap,
  Award,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Activity,
  Eye,
  Mail,
  Phone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

// Mock data - in production, this would come from your API
const mockAnalyticsData = {
  overview: {
    totalLeads: 12453,
    qualifiedLeads: 3789,
    conversionRate: 30.4,
    avgDealSize: 45000,
    pipelineValue: 4250000,
    roi: 450,
  },
  trends: {
    daily: [
      { date: 'Mon', leads: 145, qualified: 42, conversions: 8 },
      { date: 'Tue', leads: 189, qualified: 58, conversions: 12 },
      { date: 'Wed', leads: 203, qualified: 61, conversions: 15 },
      { date: 'Thu', leads: 178, qualified: 53, conversions: 11 },
      { date: 'Fri', leads: 195, qualified: 59, conversions: 14 },
      { date: 'Sat', leads: 112, qualified: 34, conversions: 6 },
      { date: 'Sun', leads: 98, qualified: 29, conversions: 5 },
    ],
    monthly: [
      { month: 'Jan', leads: 2834, revenue: 340000 },
      { month: 'Feb', leads: 3122, revenue: 385000 },
      { month: 'Mar', leads: 3456, revenue: 425000 },
      { month: 'Apr', leads: 3789, revenue: 468000 },
      { month: 'May', leads: 4023, revenue: 512000 },
      { month: 'Jun', leads: 4250, revenue: 545000 },
    ],
  },
  sources: [
    { name: 'Apollo Search', value: 35, leads: 4358 },
    { name: 'Webhooks', value: 25, leads: 3113 },
    { name: 'List Import', value: 20, leads: 2491 },
    { name: 'Enrichment', value: 15, leads: 1868 },
    { name: 'Manual', value: 5, leads: 623 },
  ],
  scoreDistribution: [
    { range: '90-100', count: 342, color: '#10b981' },
    { range: '80-89', count: 567, color: '#3b82f6' },
    { range: '70-79', count: 892, color: '#f59e0b' },
    { range: '60-69', count: 1234, color: '#ef4444' },
    { range: '< 60', count: 754, color: '#6b7280' },
  ],
  playbookPerformance: [
    { name: 'ICP Hunter', runs: 145, success: 132, leads: 3450, conversion: 28 },
    { name: 'Competitor Displacement', runs: 89, success: 78, leads: 1890, conversion: 35 },
    { name: 'Event Follow-up', runs: 234, success: 221, leads: 5670, conversion: 22 },
    { name: 'Account Expansion', runs: 67, success: 61, leads: 890, conversion: 45 },
    { name: 'Weekly Enrichment', runs: 52, success: 51, leads: 2340, conversion: 18 },
  ],
  engagement: {
    email: { sent: 45678, opened: 18271, clicked: 5481, replied: 1644 },
    calls: { made: 3456, connected: 1382, meetings: 415 },
    sequences: { active: 234, completed: 567, inProgress: 892 },
  },
  teamPerformance: [
    { name: 'Sarah Johnson', score: 92, leads: 456, deals: 23, revenue: 780000 },
    { name: 'Mike Chen', score: 88, leads: 423, deals: 19, revenue: 620000 },
    { name: 'Lisa Rodriguez', score: 85, leads: 398, deals: 17, revenue: 540000 },
    { name: 'Tom Wilson', score: 79, leads: 342, deals: 14, revenue: 430000 },
    { name: 'Emily Davis', score: 76, leads: 312, deals: 12, revenue: 380000 },
  ],
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  subtitle?: string;
}

function MetricCard({ title, value, change, icon, trend, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-600">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {trend === 'up' ? (
                  <ChevronUp className="h-4 w-4 text-green-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {Math.abs(change)}%
                </span>
              </div>
            )}
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('leads');
  const { toast } = useToast();

  const refreshData = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    toast({
      title: 'Data Refreshed',
      description: 'Analytics data has been updated.',
    });
  };

  const exportData = () => {
    // Create CSV data
    const csvData = [
      ['Metric', 'Value'],
      ['Total Leads', mockAnalyticsData.overview.totalLeads],
      ['Qualified Leads', mockAnalyticsData.overview.qualifiedLeads],
      ['Conversion Rate', mockAnalyticsData.overview.conversionRate],
      ['Pipeline Value', mockAnalyticsData.overview.pipelineValue],
      ['ROI', mockAnalyticsData.overview.roi],
    ];

    const csv = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apollo-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Apollo Analytics Dashboard
              </CardTitle>
              <CardDescription>
                Track performance, ROI, and prospecting metrics
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Leads"
          value={mockAnalyticsData.overview.totalLeads.toLocaleString()}
          change={12.5}
          trend="up"
          icon={<Users className="h-5 w-5 text-blue-600" />}
          subtitle="All time"
        />
        <MetricCard
          title="Qualified Leads"
          value={mockAnalyticsData.overview.qualifiedLeads.toLocaleString()}
          change={8.3}
          trend="up"
          icon={<Target className="h-5 w-5 text-green-600" />}
          subtitle={`${mockAnalyticsData.overview.conversionRate}% qualification rate`}
        />
        <MetricCard
          title="Pipeline Value"
          value={`$${(mockAnalyticsData.overview.pipelineValue / 1000000).toFixed(1)}M`}
          change={15.7}
          trend="up"
          icon={<DollarSign className="h-5 w-5 text-purple-600" />}
          subtitle={`Avg deal: $${(mockAnalyticsData.overview.avgDealSize / 1000).toFixed(0)}k`}
        />
        <MetricCard
          title="ROI"
          value={`${mockAnalyticsData.overview.roi}%`}
          change={22.4}
          trend="up"
          icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
          subtitle="Return on investment"
        />
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Generation Trends</CardTitle>
              <CardDescription>Daily lead generation and qualification metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockAnalyticsData.trends.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="qualified"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="conversions"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Growth</CardTitle>
              <CardDescription>Monthly revenue trends from Apollo-sourced leads</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockAnalyticsData.trends.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="leads"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
                <CardDescription>Distribution of leads by source</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockAnalyticsData.sources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {mockAnalyticsData.sources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Source Performance</CardTitle>
                <CardDescription>Lead count by source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockAnalyticsData.sources.map((source, index) => (
                    <div key={source.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{source.name}</span>
                        <span className="text-sm text-gray-600">{source.leads.toLocaleString()} leads</span>
                      </div>
                      <Progress value={source.value} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Score Distribution</CardTitle>
              <CardDescription>Breakdown of leads by score range</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockAnalyticsData.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6">
                    {mockAnalyticsData.scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Playbooks Tab */}
        <TabsContent value="playbooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Playbook Performance</CardTitle>
              <CardDescription>Success rates and lead generation by playbook</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAnalyticsData.playbookPerformance.map((playbook) => (
                  <div key={playbook.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{playbook.name}</h4>
                        <p className="text-sm text-gray-600">
                          {playbook.runs} runs • {playbook.leads.toLocaleString()} leads generated
                        </p>
                      </div>
                      <Badge variant={playbook.success / playbook.runs > 0.9 ? 'default' : 'secondary'}>
                        {Math.round((playbook.success / playbook.runs) * 100)}% success
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Success Rate</span>
                        <Progress value={(playbook.success / playbook.runs) * 100} className="mt-1 h-2" />
                      </div>
                      <div>
                        <span className="text-gray-600">Conversion</span>
                        <p className="font-medium">{playbook.conversion}%</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Avg Leads/Run</span>
                        <p className="font-medium">{Math.round(playbook.leads / playbook.runs)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Leaderboard</CardTitle>
              <CardDescription>Top performers using Apollo integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAnalyticsData.teamPerformance.map((member, index) => (
                  <div key={member.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-sm text-gray-600">
                          {member.leads} leads • {member.deals} deals closed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${(member.revenue / 1000).toFixed(0)}k</p>
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">{member.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Email Engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Open Rate</span>
                  <span className="font-medium">
                    {((mockAnalyticsData.engagement.email.opened / mockAnalyticsData.engagement.email.sent) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Click Rate</span>
                  <span className="font-medium">
                    {((mockAnalyticsData.engagement.email.clicked / mockAnalyticsData.engagement.email.opened) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Reply Rate</span>
                  <span className="font-medium">
                    {((mockAnalyticsData.engagement.email.replied / mockAnalyticsData.engagement.email.sent) * 100).toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Call Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Connect Rate</span>
                  <span className="font-medium">
                    {((mockAnalyticsData.engagement.calls.connected / mockAnalyticsData.engagement.calls.made) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Meeting Rate</span>
                  <span className="font-medium">
                    {((mockAnalyticsData.engagement.calls.meetings / mockAnalyticsData.engagement.calls.connected) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Meetings</span>
                  <span className="font-medium">{mockAnalyticsData.engagement.calls.meetings}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Sequences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Active</span>
                  <span className="font-medium">{mockAnalyticsData.engagement.sequences.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="font-medium">{mockAnalyticsData.engagement.sequences.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="font-medium">{mockAnalyticsData.engagement.sequences.completed}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}