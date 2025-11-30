'use client';

import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface EnrichmentPanelProps {
    leadId: string;
    email: string;
    isEnriched: boolean;
    lastEnrichedAt?: string | null;
    onEnrich?: () => void;
}

export function EnrichmentPanel({ leadId, email, isEnriched, lastEnrichedAt, onEnrich }: EnrichmentPanelProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleEnrich = async () => {
        setIsLoading(true);
        try {
            // In a real app, this would call an API route
            // await fetch(`/api/leads/${leadId}/enrich`, { method: 'POST' });

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            toast({
                title: 'Enrichment Complete',
                description: 'Lead data has been updated with Apollo insights.',
            });

            if (onEnrich) onEnrich();
        } catch (error) {
            toast({
                title: 'Enrichment Failed',
                description: 'Could not find additional data for this lead.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    Data Enrichment
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Apollo.io Status</p>
                            <p className="text-xs text-muted-foreground">
                                {isEnriched
                                    ? `Last enriched: ${lastEnrichedAt ? new Date(lastEnrichedAt).toLocaleDateString() : 'Recently'}`
                                    : 'Not yet enriched'}
                            </p>
                        </div>
                        {isEnriched ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-gray-300" />
                        )}
                    </div>

                    <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleEnrich}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Enriching...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                {isEnriched ? 'Re-enrich Data' : 'Enrich with Apollo'}
                            </>
                        )}
                    </Button>

                    <p className="text-[10px] text-muted-foreground text-center">
                        Uses 1 Apollo credit per enrichment
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
