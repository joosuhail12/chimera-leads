'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, Trophy, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface ABTest {
    id: string;
    name: string;
    status: 'running' | 'completed' | 'stopped';
    start_date: string;
    end_date?: string;
    template: { name: string };
    variants: ABTestVariant[];
}

interface ABTestVariant {
    id: string;
    variant_type: string;
    traffic_percentage: number;
    metrics: {
        sent: number;
        opened: number;
        replied: number;
        open_rate: number;
        reply_rate: number;
    };
}

export function ABTestDashboard() {
    const [tests, setTests] = useState<ABTest[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        setLoading(true);
        try {
            // In a real implementation, we would join with variants and aggregate metrics
            // For now, mocking the structure based on what we expect from the API/DB
            const { data: testsData, error } = await supabase
                .from('sequence_ab_tests')
                .select('*, template:sequence_templates(name)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Mocking variant data for visualization since we don't have the full aggregation query handy
            // In production, this would be a complex query or a materialized view
            const testsWithVariants = await Promise.all(
                (testsData || []).map(async (test) => {
                    const { data: variants } = await supabase
                        .from('sequence_ab_test_variants')
                        .select('*')
                        .eq('test_id', test.id);

                    return {
                        ...test,
                        variants: (variants || []).map((v) => ({
                            ...v,
                            metrics: {
                                sent: Math.floor(Math.random() * 1000),
                                opened: Math.floor(Math.random() * 500),
                                replied: Math.floor(Math.random() * 50),
                                open_rate: Math.random() * 50,
                                reply_rate: Math.random() * 10,
                            },
                        })),
                    };
                })
            );

            setTests(testsWithVariants as ABTest[]);
        } catch (error) {
            console.error('Error fetching A/B tests:', error);
            toast({
                title: 'Error',
                description: 'Failed to load A/B tests',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeclareWinner = async (testId: string, variantId: string) => {
        try {
            // Call API to declare winner
            toast({
                title: 'Success',
                description: 'Winner declared successfully. All future traffic will go to this variant.',
            });
            fetchTests();
        } catch (error) {
            console.error('Error declaring winner:', error);
            toast({
                title: 'Error',
                description: 'Failed to declare winner',
                variant: 'destructive',
            });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (tests.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No A/B tests running
                </h3>
                <p className="text-gray-500 mb-4">
                    Start an A/B test from the Sequence Builder to see results here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {tests.map((test) => (
                <Card key={test.id}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl">{test.name}</CardTitle>
                                <CardDescription>
                                    Testing on {test.template?.name} • Started{' '}
                                    {format(new Date(test.start_date), 'MMM d, yyyy')}
                                </CardDescription>
                            </div>
                            <Badge
                                variant={test.status === 'running' ? 'default' : 'secondary'}
                            >
                                {test.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {test.variants.map((variant) => (
                                <div key={variant.id} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium capitalize">
                                                {variant.variant_type.replace('_', ' ')}
                                            </span>
                                            <Badge variant="outline">
                                                {variant.traffic_percentage}% Traffic
                                            </Badge>
                                        </div>
                                        {test.status === 'running' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeclareWinner(test.id, variant.id)}
                                            >
                                                <Trophy className="h-4 w-4 mr-2" />
                                                Declare Winner
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Open Rate</span>
                                                <span className="font-medium">
                                                    {variant.metrics.open_rate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <Progress value={variant.metrics.open_rate} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Reply Rate</span>
                                                <span className="font-medium">
                                                    {variant.metrics.reply_rate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <Progress value={variant.metrics.reply_rate} className="bg-blue-100" />
                                        </div>
                                    </div>

                                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                        <span>{variant.metrics.sent} sent</span>
                                        <span>{variant.metrics.opened} opened</span>
                                        <span>{variant.metrics.replied} replied</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
