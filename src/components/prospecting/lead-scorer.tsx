'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Building2,
  User,
  Activity,
  Cpu,
  Target,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  BarChart3,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadScore {
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  score: number;
  previousScore?: number;
  confidence: number;
  category: 'hot' | 'warm' | 'cold';
  scoreBreakdown: {
    firmographic: number;
    behavioral: number;
    technographic: number;
    intent: number;
    engagement: number;
  };
  factors: Array<{
    category: string;
    factor: string;
    score: number;
    weight: number;
    reason: string;
  }>;
  aiInsights: string;
  recommendations: string[];
  scoredAt: Date;
  nextReviewAt: Date;
}

interface ScoringStats {
  totalScored: number;
  averageScore: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  averageConfidence: number;
  scoringTrend: 'up' | 'down' | 'stable';
  topFactors: Array<{ factor: string; impact: number }>;
}

// Mock data for demonstration
const MOCK_LEADS: LeadScore[] = [
  {
    leadId: '1',
    leadName: 'Sarah Johnson',
    leadEmail: 'sarah@techcorp.com',
    leadCompany: 'TechCorp',
    score: 85,
    previousScore: 78,
    confidence: 0.92,
    category: 'hot',
    scoreBreakdown: {
      firmographic: 22,
      behavioral: 28,
      technographic: 15,
      intent: 16,
      engagement: 4,
    },
    factors: [
      {
        category: 'behavioral',
        factor: 'website_visits',
        score: 30,
        weight: 0.30,
        reason: '12 website visits in last 7 days',
      },
      {
        category: 'firmographic',
        factor: 'company_size',
        score: 25,
        weight: 0.25,
        reason: 'Company size fits ICP (200 employees)',
      },
      {
        category: 'intent',
        factor: 'pricing_interest',
        score: 35,
        weight: 0.20,
        reason: 'Visited pricing page 3 times',
      },
    ],
    aiInsights: 'High-quality lead showing strong buying signals. Recent website activity and pricing page visits indicate active evaluation. Company profile matches ideal customer criteria.',
    recommendations: [
      'Schedule immediate outreach from senior sales rep',
      'Personalize demo around ROI calculator',
      'Reference similar companies in their industry',
      'Offer limited-time trial or discount',
    ],
    scoredAt: new Date(Date.now() - 3600000),
    nextReviewAt: new Date(Date.now() + 86400000 * 7),
  },
  {
    leadId: '2',
    leadName: 'Michael Chen',
    leadEmail: 'michael@startupinc.com',
    leadCompany: 'StartupInc',
    score: 62,
    previousScore: 65,
    confidence: 0.78,
    category: 'warm',
    scoreBreakdown: {
      firmographic: 15,
      behavioral: 20,
      technographic: 12,
      intent: 10,
      engagement: 5,
    },
    factors: [
      {
        category: 'behavioral',
        factor: 'content_downloads',
        score: 20,
        weight: 0.30,
        reason: 'Downloaded 2 whitepapers',
      },
      {
        category: 'firmographic',
        factor: 'company_size',
        score: 15,
        weight: 0.25,
        reason: 'Small company (25 employees)',
      },
    ],
    aiInsights: 'Moderate interest with educational content engagement. Company size suggests possible budget constraints. Requires nurturing before sales engagement.',
    recommendations: [
      'Add to nurture campaign with case studies',
      'Schedule follow-up in 2-3 weeks',
      'Share ROI calculator and testimonials',
    ],
    scoredAt: new Date(Date.now() - 7200000),
    nextReviewAt: new Date(Date.now() + 86400000 * 14),
  },
];

export function LeadScorer() {
  const [leads, setLeads] = useState<LeadScore[]>(MOCK_LEADS);
  const [selectedLead, setSelectedLead] = useState<LeadScore | null>(null);
  const [stats, setStats] = useState<ScoringStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const { toast } = useToast();

  useEffect(() => {
    calculateStats();
  }, [leads]);

  const calculateStats = () => {
    const totalScored = leads.length;
    const averageScore = leads.reduce((sum, l) => sum + l.score, 0) / totalScored;
    const hotLeads = leads.filter(l => l.category === 'hot').length;
    const warmLeads = leads.filter(l => l.category === 'warm').length;
    const coldLeads = leads.filter(l => l.category === 'cold').length;
    const averageConfidence = leads.reduce((sum, l) => sum + l.confidence, 0) / totalScored;

    // Calculate top factors
    const factorImpacts = new Map<string, number>();
    leads.forEach(lead => {
      lead.factors.forEach(factor => {
        const current = factorImpacts.get(factor.factor) || 0;
        factorImpacts.set(factor.factor, current + factor.score);
      });
    });

    const topFactors = Array.from(factorImpacts.entries())
      .map(([factor, impact]) => ({ factor, impact }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5);

    setStats({
      totalScored,
      averageScore: Math.round(averageScore),
      hotLeads,
      warmLeads,
      coldLeads,
      averageConfidence,
      scoringTrend: averageScore > 65 ? 'up' : averageScore > 45 ? 'stable' : 'down',
      topFactors,
    });
  };

  const refreshScores = async () => {
    setIsRefreshing(true);
    toast({
      title: 'Refreshing Scores',
      description: 'Recalculating lead scores with latest data...',
    });

    // Simulate API call
    setTimeout(() => {
      setLeads(prevLeads =>
        prevLeads.map(lead => ({
          ...lead,
          previousScore: lead.score,
          score: Math.min(100, Math.max(0, lead.score + Math.floor(Math.random() * 20 - 10))),
          scoredAt: new Date(),
        }))
      );
      setIsRefreshing(false);
      toast({
        title: 'Scores Updated',
        description: 'All lead scores have been refreshed',
      });
    }, 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'firmographic': return <Building2 className="h-4 w-4" />;
      case 'behavioral': return <Activity className="h-4 w-4" />;
      case 'technographic': return <Cpu className="h-4 w-4" />;
      case 'intent': return <Target className="h-4 w-4" />;
      case 'engagement': return <User className="h-4 w-4" />;
      default: return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot': return 'text-red-600 bg-red-50';
      case 'warm': return 'text-yellow-600 bg-yellow-50';
      case 'cold': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getScoreTrend = (lead: LeadScore) => {
    if (!lead.previousScore) return null;
    const diff = lead.score - lead.previousScore;
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (diff < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const filteredLeads = leads.filter(lead =>
    filterCategory === 'all' || lead.category === filterCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Lead Scoring Dashboard
              </CardTitle>
              <CardDescription>
                Real-time lead qualification powered by machine learning
              </CardDescription>
            </div>
            <Button onClick={refreshScores} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Scores
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Scored</p>
                  <p className="text-2xl font-bold">{stats.totalScored}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold">{stats.averageScore}</p>
                </div>
                {stats.scoringTrend === 'up' && <TrendingUp className="h-8 w-8 text-green-500" />}
                {stats.scoringTrend === 'down' && <TrendingDown className="h-8 w-8 text-red-500" />}
                {stats.scoringTrend === 'stable' && <Minus className="h-8 w-8 text-gray-400" />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Hot Leads</p>
                  <p className="text-2xl font-bold text-red-600">{stats.hotLeads}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Warm Leads</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.warmLeads}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cold Leads</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.coldLeads}</p>
                </div>
                <XCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scored Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filter Tabs */}
              <Tabs value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="hot">Hot</TabsTrigger>
                  <TabsTrigger value="warm">Warm</TabsTrigger>
                  <TabsTrigger value="cold">Cold</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Lead Cards */}
              <div className="space-y-2">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.leadId}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedLead?.leadId === lead.leadId ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.leadName}</span>
                        {getScoreTrend(lead)}
                      </div>
                      <Badge className={getCategoryColor(lead.category)}>
                        {lead.score}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{lead.leadCompany}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="text-xs">
                        {(lead.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lead Details */}
        <div className="lg:col-span-2">
          {selectedLead ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedLead.leadName}</CardTitle>
                    <CardDescription>
                      {selectedLead.leadEmail} • {selectedLead.leadCompany}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {selectedLead.score}
                    </div>
                    <Badge className={getCategoryColor(selectedLead.category)}>
                      {selectedLead.category.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Score Breakdown */}
                <div>
                  <h3 className="font-medium mb-3">Score Breakdown</h3>
                  <div className="space-y-3">
                    {Object.entries(selectedLead.scoreBreakdown).map(([category, score]) => (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category)}
                            <span className="text-sm capitalize">{category}</span>
                          </div>
                          <span className="text-sm font-medium">{score}</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI Insights
                  </h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {selectedLead.aiInsights}
                  </p>
                </div>

                {/* Top Factors */}
                <div>
                  <h3 className="font-medium mb-3">Top Scoring Factors</h3>
                  <div className="space-y-2">
                    {selectedLead.factors.slice(0, 3).map((factor, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(factor.category)}
                          <div>
                            <p className="text-sm font-medium">{factor.reason}</p>
                            <p className="text-xs text-gray-500">
                              Weight: {(factor.weight * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">+{factor.score}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="font-medium mb-3">Recommended Actions</h3>
                  <div className="space-y-2">
                    {selectedLead.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-green-500 mt-0.5" />
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t">
                  <span>
                    Scored {new Date(selectedLead.scoredAt).toLocaleDateString()}
                  </span>
                  <span>
                    Next review {new Date(selectedLead.nextReviewAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12 text-gray-500">
                Select a lead to view detailed scoring information
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Top Factors */}
      {stats && stats.topFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Scoring Factors</CardTitle>
            <CardDescription>
              Factors with the highest impact on lead scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topFactors.map((factor) => (
                <div key={factor.factor}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">
                      {factor.factor.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-600">
                      Impact: {factor.impact}
                    </span>
                  </div>
                  <Progress value={factor.impact / 2} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}