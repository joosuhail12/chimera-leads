'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApolloSearchAdvanced } from '@/components/prospecting/apollo-search-advanced';
import { CompanySearch } from '@/components/prospecting/company-search';
import { LeadScorer } from '@/components/prospecting/lead-scorer';
import { MonitoringDashboard } from '@/components/prospecting/monitoring-dashboard';
import { PlaybookTemplates } from '@/components/prospecting/playbook-templates';
import { PlaybookBuilder } from '@/components/prospecting/playbook-builder';
import { AnalyticsDashboard } from '@/components/prospecting/analytics-dashboard';
import { AIEmailGenerator } from '@/components/prospecting/ai-email-generator';
import { DataExportImport } from '@/components/prospecting/data-export-import';
import { EngagementTracker } from '@/components/prospecting/engagement-tracker';
import { SequenceBuilder } from '@/components/prospecting/sequence-builder';
import {
    Search,
    Building2,
    Brain,
    Users,
    TrendingUp,
    Sparkles,
    Activity,
    PlayCircle,
    Workflow,
    BarChart3,
    Mail,
    Database,
    Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProspectingPage() {
    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="h-8 w-8 text-purple-500" />
                    AI-Powered Prospecting
                </h1>
                <p className="text-muted-foreground mt-2">
                    Discover, qualify, and engage with your ideal customers using Apollo's 275M+ contact database and AI-powered insights.
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Contacts</p>
                                <p className="text-2xl font-bold">275M+</p>
                            </div>
                            <Users className="h-8 w-8 text-blue-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Companies</p>
                                <p className="text-2xl font-bold">70M+</p>
                            </div>
                            <Building2 className="h-8 w-8 text-green-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">AI Score Accuracy</p>
                                <p className="text-2xl font-bold">92%</p>
                            </div>
                            <Brain className="h-8 w-8 text-purple-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Conversion Rate</p>
                                <p className="text-2xl font-bold">+45%</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-orange-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="search" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 gap-2">
                    <TabsTrigger value="search" className="flex items-center gap-1 text-xs">
                        <Search className="h-3 w-3" />
                        <span className="hidden sm:inline">Search</span>
                    </TabsTrigger>
                    <TabsTrigger value="companies" className="flex items-center gap-1 text-xs">
                        <Building2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Companies</span>
                    </TabsTrigger>
                    <TabsTrigger value="sequences" className="flex items-center gap-1 text-xs">
                        <Zap className="h-3 w-3" />
                        <span className="hidden sm:inline">Sequences</span>
                    </TabsTrigger>
                    <TabsTrigger value="engagement" className="flex items-center gap-1 text-xs">
                        <Activity className="h-3 w-3" />
                        <span className="hidden sm:inline">Engagement</span>
                    </TabsTrigger>
                    <TabsTrigger value="email" className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3" />
                        <span className="hidden sm:inline">Email AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="data" className="flex items-center gap-1 text-xs">
                        <Database className="h-3 w-3" />
                        <span className="hidden sm:inline">Data</span>
                    </TabsTrigger>
                </TabsList>

                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 gap-2 mt-2">
                    <TabsTrigger value="scoring" className="flex items-center gap-1 text-xs">
                        <Brain className="h-3 w-3" />
                        <span className="hidden sm:inline">Scoring</span>
                    </TabsTrigger>
                    <TabsTrigger value="playbooks" className="flex items-center gap-1 text-xs">
                        <PlayCircle className="h-3 w-3" />
                        <span className="hidden sm:inline">Playbooks</span>
                    </TabsTrigger>
                    <TabsTrigger value="builder" className="flex items-center gap-1 text-xs">
                        <Workflow className="h-3 w-3" />
                        <span className="hidden sm:inline">Builder</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs">
                        <BarChart3 className="h-3 w-3" />
                        <span className="hidden sm:inline">Analytics</span>
                    </TabsTrigger>
                    <TabsTrigger value="monitoring" className="flex items-center gap-1 text-xs">
                        <Activity className="h-3 w-3" />
                        <span className="hidden sm:inline">Monitor</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-4">
                    <ApolloSearchAdvanced />
                </TabsContent>

                <TabsContent value="companies" className="space-y-4">
                    <CompanySearch />
                </TabsContent>

                <TabsContent value="sequences" className="space-y-4">
                    <SequenceBuilder />
                </TabsContent>

                <TabsContent value="engagement" className="space-y-4">
                    <EngagementTracker />
                </TabsContent>

                <TabsContent value="email" className="space-y-4">
                    <AIEmailGenerator />
                </TabsContent>

                <TabsContent value="data" className="space-y-4">
                    <DataExportImport />
                </TabsContent>

                <TabsContent value="scoring" className="space-y-4">
                    <LeadScorer />
                </TabsContent>

                <TabsContent value="playbooks" className="space-y-4">
                    <PlaybookTemplates />
                </TabsContent>

                <TabsContent value="builder" className="space-y-4">
                    <PlaybookBuilder />
                </TabsContent>

                <TabsContent value="analytics" className="space-y-4">
                    <AnalyticsDashboard />
                </TabsContent>

                <TabsContent value="monitoring" className="space-y-4">
                    <MonitoringDashboard />
                </TabsContent>
            </Tabs>
        </div>
    );
}
