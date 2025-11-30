'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  Loader2,
  Users,
  DollarSign,
  Globe,
  Calendar,
  Cpu,
  TrendingUp,
  Filter,
  Target,
  Zap,
  BarChart3,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApolloCompany } from '@/lib/services/apollo';
import { logProspectingEvent } from '@/lib/utils/prospecting-analytics';

interface CompanyInsights {
  fitScore: number;
  buyingSignals: string[];
  competitorUsage: string[];
  technographicMatch: number;
  intentScore: number;
  contactsFound: number;
  decisionMakers: number;
}

interface CompanyFilters {
  industries?: string[];
  employeeRange?: { min: number; max: number };
  revenueRange?: { min: number; max: number };
  technologies?: string[];
  locations?: string[];
  fundingStage?: string[];
}

const PRESET_FILTERS = {
  'Ideal Customer Profile': {
    industries: ['SaaS', 'Technology', 'Software'],
    employeeRange: { min: 50, max: 500 },
    technologies: ['Salesforce', 'HubSpot'],
  },
  'Enterprise Targets': {
    employeeRange: { min: 1000, max: 10000 },
    revenueRange: { min: 100000000, max: 1000000000 },
  },
  'Startup Focus': {
    employeeRange: { min: 10, max: 50 },
    fundingStage: ['Series A', 'Series B'],
  },
  'Competitor Displacement': {
    technologies: ['Competitor1', 'Competitor2'],
  },
};

export function CompanySearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CompanyFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<ApolloCompany[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [companyInsights, setCompanyInsights] = useState<Map<string, CompanyInsights>>(new Map());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'relevance' | 'size' | 'revenue' | 'fit'>('relevance');
  const router = useRouter();
  const fireAnalyticsEvent = (event: string, payload?: Record<string, any>) => {
    logProspectingEvent(event, payload).catch(() => {});
  };
  const { toast } = useToast();

  const searchCompanies = async () => {
    if (!query && Object.keys(filters).length === 0) {
      toast({
        title: 'Search Required',
        description: 'Enter a search term or apply filters',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/apollo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'companies',
          q_keywords: query,
          industries: filters.industries,
          employee_count_min: filters.employeeRange?.min,
          employee_count_max: filters.employeeRange?.max,
          revenue_min: filters.revenueRange?.min,
          revenue_max: filters.revenueRange?.max,
          technologies: filters.technologies,
          page: 1,
          per_page: 20,
        }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setCompanies(data.data.organizations || []);

      // Generate insights for each company
      data.data.organizations?.forEach((company: ApolloCompany) => {
        generateCompanyInsights(company, filters);
      });

      fireAnalyticsEvent('prospecting_company_search', {
        query,
        totalResults: data.data.organizations?.length || 0,
        filterKeys: Object.keys(filters || {}),
      });
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: 'Unable to search companies',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const computeCompanyInsights = (company: ApolloCompany, activeFilters: CompanyFilters) => {
    const targetIndustries = activeFilters.industries || [];
    const targetTechnologies = activeFilters.technologies?.map((tech) => tech.toLowerCase()) || [];
    const companyTechnologies = (company.technologies || []).map((tech) => tech.toLowerCase());

    let fitScore = 60;
    if (targetIndustries.length) {
      fitScore += targetIndustries.includes(company.industry) ? 15 : -5;
    }

    if (activeFilters.employeeRange && company.employee_count) {
      const { min, max } = activeFilters.employeeRange;
      if (
        company.employee_count >= (min ?? 0) &&
        company.employee_count <= (max ?? Number.MAX_SAFE_INTEGER)
      ) {
        fitScore += 10;
      } else {
        fitScore -= 5;
      }
    }

    const overlappingTech = targetTechnologies.filter((tech) =>
      companyTechnologies.includes(tech)
    );

    const technographicMatch = targetTechnologies.length
      ? Math.round((overlappingTech.length / targetTechnologies.length) * 100)
      : Math.min(100, companyTechnologies.length * 5);

    fitScore = clamp(fitScore + Math.round(technographicMatch * 0.2));

    const keywords = company.keywords || [];
    const buyingSignals: string[] = [];
    if (keywords.some((kw) => /hiring|recruit/i.test(kw))) {
      buyingSignals.push('Hiring for growth roles');
    }
    if (keywords.some((kw) => /expansion|launch|opening/i.test(kw))) {
      buyingSignals.push('Market expansion activity');
    }
    if (company.revenue_range?.includes('+')) {
      buyingSignals.push('Enterprise spending capacity');
    }
    if (company.employee_count && company.employee_count > 500) {
      buyingSignals.push('Established revenue team');
    }

    const competitorUsage = overlappingTech.length
      ? overlappingTech
      : (company.technologies || []).slice(0, 3);

    const intentScore = clamp(
      buyingSignals.length * 15 + Math.round(technographicMatch * 0.4)
    );

    const contactsFound = company.employee_count
      ? Math.max(5, Math.round(company.employee_count / 40))
      : 12;
    const decisionMakers = Math.max(2, Math.round(contactsFound * 0.25));

    return {
      fitScore,
      buyingSignals,
      competitorUsage,
      technographicMatch,
      intentScore,
      contactsFound,
      decisionMakers,
    };
  };

  const generateCompanyInsights = (company: ApolloCompany, activeFilters: CompanyFilters) => {
    const insights = computeCompanyInsights(company, activeFilters);
    setCompanyInsights(prev => new Map(prev).set(company.id, insights));
  };

  const findContactsAtCompany = async (company: ApolloCompany) => {
    toast({
      title: 'Finding Contacts',
      description: `Searching for decision makers at ${company.name}`,
    });

    if (company.domain) {
      router.push(`/dashboard/prospecting?company=${encodeURIComponent(company.domain)}`);
      fireAnalyticsEvent('prospecting_company_drilldown', {
        domain: company.domain,
        company: company.name,
      });
    }
  };

  const createAccountPlaybook = (companies: ApolloCompany[]) => {
    toast({
      title: 'Playbook Created',
      description: `Account-based playbook created for ${companies.length} companies`,
    });
  };

  const applyPresetFilter = (presetName: string) => {
    const preset = PRESET_FILTERS[presetName as keyof typeof PRESET_FILTERS];
    if (preset) {
      const presetFilters = preset as CompanyFilters;
      setFilters(presetFilters);
      setCompanyInsights(prev => {
        const next = new Map(prev);
        companies.forEach((company) => {
          next.set(company.id, computeCompanyInsights(company, presetFilters));
        });
        return next;
      });
      toast({
        title: 'Filter Applied',
        description: `Applied "${presetName}" filter preset`,
      });
      fireAnalyticsEvent('prospecting_company_filter', { preset: presetName });
    }
  };

  const getFitScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Discovery
          </CardTitle>
          <CardDescription>
            Find and qualify companies for account-based prospecting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Filters */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESET_FILTERS).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => applyPresetFilter(preset)}
              >
                <Target className="h-3 w-3 mr-1" />
                {preset}
              </Button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by company name, domain, or industry..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCompanies()}
            />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="fit">Fit Score</SelectItem>
                <SelectItem value="size">Company Size</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={searchCompanies} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Active Filters Display */}
          {Object.keys(filters).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.industries?.map((industry) => (
                <Badge key={industry} variant="secondary">
                  {industry}
                </Badge>
              ))}
              {filters.employeeRange && (
                <Badge variant="secondary">
                  {filters.employeeRange.min}-{filters.employeeRange.max} employees
                </Badge>
              )}
              {filters.technologies?.map((tech) => (
                <Badge key={tech} variant="secondary">
                  {tech}
                </Badge>
              ))}
            </div>
          )}

          {/* View Toggle */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Found {companies.length} companies
            </span>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => {
            const insights = companyInsights.get(company.id);
            return (
              <Card key={company.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                      <CardDescription>{company.industry}</CardDescription>
                    </div>
                    {insights && (
                      <div className={`text-2xl font-bold ${getFitScoreColor(insights.fitScore)}`}>
                        {insights.fitScore}%
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Company Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{company.employee_count?.toLocaleString() || 'N/A'}</span>
                    </div>
                    {company.revenue_range && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span>{company.revenue_range}</span>
                      </div>
                    )}
                    {company.founded_year && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{company.founded_year}</span>
                      </div>
                    )}
                    {company.headquarters_location && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <span>{company.headquarters_location}</span>
                      </div>
                    )}
                  </div>

                  {/* Insights */}
                  {insights && (
                    <>
                      {insights.buyingSignals.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-600">Buying Signals</div>
                          <div className="flex flex-wrap gap-1">
                            {insights.buyingSignals.map((signal) => (
                              <Badge key={signal} variant="outline" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                {signal}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Contacts Found</span>
                        <span className="font-medium">{insights.contactsFound}</span>
                      </div>

                      {/* Progress Bars */}
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Tech Match</span>
                            <span>{insights.technographicMatch}%</span>
                          </div>
                          <Progress value={insights.technographicMatch} className="h-1" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Intent Score</span>
                            <span>{insights.intentScore}%</span>
                          </div>
                          <Progress value={insights.intentScore} className="h-1" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => findContactsAtCompany(company)}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Find Contacts
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedCompanies(prev => new Set(prev).add(company.id));
                        toast({
                          title: 'Company Added',
                          description: `${company.name} added to target list`,
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Target
                    </Button>
                  </div>

                  {company.website_url && (
                    <a
                      href={company.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Visit Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // List View
        <div className="space-y-2">
          {companies.map((company) => {
            const insights = companyInsights.get(company.id);
            return (
              <Card key={company.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{company.name}</h3>
                        <p className="text-sm text-gray-600">
                          {company.industry} • {company.employee_count?.toLocaleString()} employees
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {insights && (
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getFitScoreColor(insights.fitScore)}`}>
                            {insights.fitScore}%
                          </div>
                          <div className="text-xs text-gray-600">Fit Score</div>
                        </div>
                      )}
                      <Button onClick={() => findContactsAtCompany(company)}>
                        Find Contacts
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedCompanies.size > 0 && (
        <Card className="fixed bottom-4 right-4 shadow-lg">
          <CardContent className="p-4 flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedCompanies.size} companies selected
            </span>
            <Button
              size="sm"
              onClick={() => {
                const selected = companies.filter(c => selectedCompanies.has(c.id));
                createAccountPlaybook(selected);
              }}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Create Playbook
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
