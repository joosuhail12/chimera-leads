'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Loader2,
  Plus,
  Check,
  ExternalLink,
  Building2,
  User,
  Filter,
  Download,
  TrendingUp,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { ApolloPerson, ApolloCompany } from '@/lib/services/apollo';
import { logProspectingEvent } from '@/lib/utils/prospecting-analytics';

interface SearchFilters {
  person_titles?: string[];
  industries?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  technologies?: string[];
  organization_ids?: string[];
  organization_domains?: string[];
}

interface LeadScore {
  score: number;
  confidence: number;
  category: 'hot' | 'warm' | 'cold';
}

export function ApolloSearchAdvanced() {
  const [searchType, setSearchType] = useState<'people' | 'companies'>('people');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [peopleResults, setPeopleResults] = useState<ApolloPerson[]>([]);
  const [companyResults, setCompanyResults] = useState<ApolloCompany[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [enrichmentQueue, setEnrichmentQueue] = useState<string[]>([]);
  const [leadScores, setLeadScores] = useState<Map<string, LeadScore>>(new Map());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const companyParam = searchParams?.get('company');
  const companyPrefillRef = useRef<string | null>(null);
  const fireAnalyticsEvent = (event: string, payload?: Record<string, any>) => {
    logProspectingEvent(event, payload).catch(() => {});
  };

  const handleSearch = async (
    searchPage: number = 1,
    overrides?: {
      searchType?: 'people' | 'companies';
      query?: string;
      filters?: SearchFilters;
    }
  ) => {
    const effectiveType = overrides?.searchType ?? searchType;
    const effectiveQuery = overrides?.query ?? query;
    const effectiveFilters = overrides?.filters ?? filters;

    const hasFilters = Object.values(effectiveFilters || {}).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).length > 0;
      }
      return value !== undefined && value !== null && value !== '';
    });

    if (!effectiveQuery.trim() && !hasFilters) {
      toast({
        title: 'Search Required',
        description: 'Please enter a search query or apply filters',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setPage(searchPage);

    try {
      const response = await fetch('/api/apollo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: effectiveType,
          q_keywords: effectiveQuery,
          ...effectiveFilters,
          page: searchPage,
          per_page: 25,
          priority: 'realtime',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }

      const data = await response.json();

      if (effectiveType === 'people') {
        setPeopleResults(data.data.people || []);
        // Auto-score leads as they come in
        data.data.people?.forEach((person: ApolloPerson) => {
          scoreLeadInBackground(person);
        });
      } else {
        setCompanyResults(data.data.organizations || []);
      }

      setTotalPages(data.data.pagination?.total_pages || 0);
      setTotalResults(data.data.pagination?.total_entries || 0);

      fireAnalyticsEvent('prospecting_search', {
        type: effectiveType,
        query: effectiveQuery,
        totalResults: data.data.pagination?.total_entries || 0,
        filterKeys: Object.keys(effectiveFilters || {}),
      });

      if (data.cached) {
        toast({
          title: 'Cached Results',
          description: 'Showing cached results for faster performance',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search Apollo',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyCompanyFilter = (domain: string) => {
    if (!domain) return;
    const domainFilters: SearchFilters = {
      organization_domains: [domain],
    };

    if (filters.person_titles && filters.person_titles.length > 0) {
      domainFilters.person_titles = filters.person_titles;
    }

    setSearchType('people');
    setQuery('');
    setFilters(domainFilters);
    setSelectedItems(new Set());

    handleSearch(1, {
      searchType: 'people',
      query: '',
      filters: domainFilters,
    });

    fireAnalyticsEvent('prospecting_company_drilldown', { domain });
  };

  useEffect(() => {
    if (!companyParam) {
      companyPrefillRef.current = null;
      return;
    }

    if (companyPrefillRef.current === companyParam) {
      return;
    }

    companyPrefillRef.current = companyParam;
    applyCompanyFilter(companyParam);
  }, [companyParam]);

  const scoreLeadInBackground = async (person: ApolloPerson) => {
    // Simulate scoring - in production this would call the scoring API
    const mockScore: LeadScore = {
      score: Math.floor(Math.random() * 100),
      confidence: Math.random(),
      category: Math.random() > 0.6 ? 'hot' : Math.random() > 0.3 ? 'warm' : 'cold',
    };

    setLeadScores(prev => new Map(prev).set(person.id, mockScore));
  };

  const handleImport = async (item: ApolloPerson | ApolloCompany) => {
    try {
      const response = await fetch('/api/apollo/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email' in item ? 'person' : 'company',
          identifier: 'email' in item ? item.email : item.domain,
          useCache: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      setImportedIds(prev => new Set(prev).add(item.id));
      toast({
        title: 'Import Successful',
        description: `Imported ${item.name} and queued for enrichment`,
      });
      fireAnalyticsEvent('prospecting_import', {
        mode: 'single',
        recordType: 'email' in item ? 'person' : 'company',
        itemId: item.id,
      });
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: 'Failed to import lead',
        variant: 'destructive',
      });
    }
  };

  const handleBulkImport = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select items to import',
        variant: 'destructive',
      });
      return;
    }

    const items = searchType === 'people'
      ? peopleResults.filter(p => selectedItems.has(p.id))
      : companyResults.filter(c => selectedItems.has(c.id));

    try {
      const response = await fetch('/api/apollo/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bulk',
          contacts: items.map(item => ({
            email: 'email' in item ? item.email : undefined,
            domain: 'domain' in item ? item.domain : undefined,
          })),
          priority: 'normal',
        }),
      });

      if (!response.ok) {
        throw new Error('Bulk import failed');
      }

      const data = await response.json();

      // Mark all as imported
      selectedItems.forEach(id => {
        setImportedIds(prev => new Set(prev).add(id));
      });
      setSelectedItems(new Set());

      toast({
        title: 'Bulk Import Started',
        description: `${data.jobIds.length} items queued for import and enrichment`,
      });
      fireAnalyticsEvent('prospecting_import', {
        mode: 'bulk',
        recordType: searchType,
        batchSize: selectedItems.size,
      });
    } catch (error) {
      toast({
        title: 'Bulk Import Failed',
        description: 'Failed to import selected items',
        variant: 'destructive',
      });
    }
  };

  const getScoreBadgeColor = (category: string) => {
    switch (category) {
      case 'hot': return 'destructive';
      case 'warm': return 'warning';
      case 'cold': return 'secondary';
      default: return 'default';
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = searchType === 'people'
      ? peopleResults.map(p => p.id)
      : companyResults.map(c => c.id);
    setSelectedItems(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle>Apollo Search</CardTitle>
          <CardDescription>
            Search 275M+ contacts and 70M+ companies with real-time enrichment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Type Tabs */}
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'people' | 'companies')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="people">
                <User className="h-4 w-4 mr-2" />
                People
              </TabsTrigger>
              <TabsTrigger value="companies">
                <Building2 className="h-4 w-4 mr-2" />
                Companies
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={
                  searchType === 'people'
                    ? "Search by name, title, company, or keywords..."
                    : "Search by company name, industry, or domain..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {Object.keys(filters).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(filters).length}
                </Badge>
              )}
            </Button>
            <Button onClick={() => handleSearch()} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <Card className="p-4 space-y-3 bg-gray-50">
              {searchType === 'people' ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Job Titles</label>
                    <Input
                      placeholder="e.g., VP Sales, Director Marketing"
                      onChange={(e) => setFilters({
                        ...filters,
                        person_titles: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                      })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Min Employees</label>
                      <Input
                        type="number"
                        placeholder="50"
                        onChange={(e) => setFilters({
                          ...filters,
                          employee_count_min: parseInt(e.target.value) || undefined
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Employees</label>
                      <Input
                        type="number"
                        placeholder="500"
                        onChange={(e) => setFilters({
                          ...filters,
                          employee_count_max: parseInt(e.target.value) || undefined
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Industries</label>
                    <Input
                      placeholder="e.g., SaaS, Technology, Healthcare"
                      onChange={(e) => setFilters({
                        ...filters,
                        industries: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Technologies</label>
                    <Input
                      placeholder="e.g., Salesforce, HubSpot, Slack"
                      onChange={(e) => setFilters({
                        ...filters,
                        technologies: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                      })}
                    />
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Results Summary */}
          {totalResults > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Found {totalResults.toLocaleString()} results
                {selectedItems.size > 0 && (
                  <span className="ml-2 font-medium">
                    • {selectedItems.size} selected
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedItems.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={clearSelection}>
                      Clear Selection
                    </Button>
                    <Button size="sm" onClick={handleBulkImport}>
                      <Download className="h-4 w-4 mr-2" />
                      Import {selectedItems.size} Selected
                    </Button>
                  </>
                )}
                {selectedItems.size === 0 && totalResults > 0 && (
                  <Button size="sm" variant="outline" onClick={selectAll}>
                    Select All on Page
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      <div className="space-y-4">
        {searchType === 'people' ? (
          // People Results
          peopleResults.map((person) => {
            const score = leadScores.get(person.id);
            const isSelected = selectedItems.has(person.id);
            const isImported = importedIds.has(person.id);

            return (
              <Card
                key={person.id}
                className={`transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(person.id)}
                        className="mt-1"
                      />

                      {/* Avatar */}
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                        {person.first_name[0]}{person.last_name[0]}
                      </div>

                      {/* Person Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{person.name}</h3>
                          {score && (
                            <Badge variant={getScoreBadgeColor(score.category)}>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {score.score}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {person.title} at {person.organization.name}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm text-gray-500">{person.email}</span>
                          <Badge variant="outline" className="text-xs">
                            {person.email_status}
                          </Badge>
                          {person.linkedin_url && (
                            <a
                              href={person.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              LinkedIn <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {score && score.confidence > 0.7 && (
                          <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {score.confidence > 0.9 ? 'High' : 'Medium'} confidence score
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Actions <ChevronDown className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Lead Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleImport(person)}>
                            Import & Enrich
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Add to Sequence
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            View Full Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Find Similar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant={isImported ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleImport(person)}
                        disabled={isImported}
                      >
                        {isImported ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Imported
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          // Company Results
          companyResults.map((company) => {
            const isSelected = selectedItems.has(company.id);
            const isImported = importedIds.has(company.id);

            return (
              <Card
                key={company.id}
                className={`transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(company.id)}
                        className="mt-1"
                      />

                      {/* Company Logo Placeholder */}
                      <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-gray-400" />
                      </div>

                      {/* Company Details */}
                      <div className="flex-1">
                        <h3 className="font-semibold">{company.name}</h3>
                        <p className="text-sm text-gray-600">{company.industry}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">
                            {company.employee_count?.toLocaleString() || 'N/A'} employees
                          </Badge>
                          {company.revenue_range && (
                            <Badge variant="outline">{company.revenue_range}</Badge>
                          )}
                          {company.headquarters_location && (
                            <Badge variant="outline">{company.headquarters_location}</Badge>
                          )}
                        </div>
                        {company.technologies && company.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {company.technologies.slice(0, 5).map((tech) => (
                              <Badge key={tech} variant="secondary" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                            {company.technologies.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{company.technologies.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyCompanyFilter(company.domain)}
                        disabled={!company.domain}
                      >
                        Find Contacts
                      </Button>
                      <Button
                        variant={isImported ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleImport(company)}
                        disabled={isImported}
                      >
                        {isImported ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Imported
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        {/* No Results */}
        {!isLoading && query && peopleResults.length === 0 && companyResults.length === 0 && (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">
              No results found. Try adjusting your search terms or filters.
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSearch(page - 1)}
              disabled={page === 1 || isLoading}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSearch(page + 1)}
              disabled={page === totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
