'use client';

import { useState } from 'react';
import { Search, Loader2, Plus, Check, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ApolloPerson } from '@/lib/services/apollo';

// Mock data for development since we don't have a real API key in this environment
const MOCK_RESULTS: ApolloPerson[] = [
    {
        id: '1',
        first_name: 'Sarah',
        last_name: 'Connor',
        name: 'Sarah Connor',
        title: 'CTO',
        email: 'sarah@skynet.com',
        email_status: 'verified',
        linkedin_url: 'https://linkedin.com/in/sarahconnor',
        photo_url: '',
        twitter_url: null,
        github_url: null,
        facebook_url: null,
        extrapolated_email_confidence: null,
        headline: 'Chief Technology Officer at Skynet',
        organization: {
            id: 'org1',
            name: 'Skynet',
            website_url: 'skynet.com',
            logo_url: '',
            primary_domain: 'skynet.com',
            facebook_url: null,
            twitter_url: null,
            linkedin_url: null,
        },
    },
    {
        id: '2',
        first_name: 'John',
        last_name: 'Doe',
        name: 'John Doe',
        title: 'VP of Engineering',
        email: 'john@example.com',
        email_status: 'verified',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        photo_url: '',
        twitter_url: null,
        github_url: null,
        facebook_url: null,
        extrapolated_email_confidence: null,
        headline: 'VP Engineering at Example Corp',
        organization: {
            id: 'org2',
            name: 'Example Corp',
            website_url: 'example.com',
            logo_url: '',
            primary_domain: 'example.com',
            facebook_url: null,
            twitter_url: null,
            linkedin_url: null,
        },
    },
];

export function ApolloSearch() {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<ApolloPerson[]>([]);
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        try {
            // In a real app, this would call an API route that uses ApolloService
            // const response = await fetch('/api/apollo/search', { ... });
            // const data = await response.json();

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            setResults(MOCK_RESULTS);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to search Apollo',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async (person: ApolloPerson) => {
        try {
            // In a real app, this would call an API route to import the person
            // await fetch('/api/leads/import-apollo', { ... });

            setImportedIds(prev => new Set(prev).add(person.id));
            toast({
                title: 'Success',
                description: `Imported ${person.name} as a lead`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to import lead',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Search by job title, company, or keywords..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
                <Button onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Search Apollo
                </Button>
            </div>

            <div className="grid gap-4">
                {results.map((person) => (
                    <Card key={person.id}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">
                                    {person.first_name[0]}{person.last_name[0]}
                                </div>
                                <div>
                                    <h3 className="font-medium">{person.name}</h3>
                                    <p className="text-sm text-gray-500">{person.title} at {person.organization.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
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
                                </div>
                            </div>

                            <Button
                                variant={importedIds.has(person.id) ? "secondary" : "default"}
                                size="sm"
                                onClick={() => handleImport(person)}
                                disabled={importedIds.has(person.id)}
                            >
                                {importedIds.has(person.id) ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Imported
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Import Lead
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ))}

                {results.length === 0 && !isLoading && query && (
                    <div className="text-center py-12 text-gray-500">
                        No results found. Try adjusting your search terms.
                    </div>
                )}
            </div>
        </div>
    );
}
