'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Search, MoreVertical, Play, Pause, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Workflow {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'draft' | 'paused';
    stats: {
        enrolled: number;
        active: number;
        completed: number;
    };
    updatedAt: string;
}

export default function WorkflowsPage() {
    const router = useRouter();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch('/api/sequences');
            if (res.ok) {
                const data = await res.json();
                // Transform data to match Workflow interface if needed
                setWorkflows(data.map((seq: any) => ({
                    id: seq.id,
                    name: seq.name,
                    description: seq.description,
                    status: seq.is_active ? 'active' : 'draft',
                    stats: {
                        enrolled: seq.total_enrolled || 0,
                        active: 0, // Need to fetch real active count
                        completed: seq.total_completed || 0,
                    },
                    updatedAt: seq.updated_at,
                })));
            }
        } catch (error) {
            console.error('Failed to fetch workflows', error);
        } finally {
            setLoading(false);
        }
    };

    const createWorkflow = async () => {
        // Navigate to new workflow builder
        router.push('/dashboard/workflows/new');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-900">Workflows</h1>
                    <p className="text-sm text-slate-500">
                        Automate your outreach with visual sequences.
                    </p>
                </div>
                <Button onClick={createWorkflow}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search workflows..." className="pl-10" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((workflow) => (
                    <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-lg font-medium">
                                        <Link href={`/dashboard/workflows/${workflow.id}`} className="hover:underline">
                                            {workflow.name}
                                        </Link>
                                    </CardTitle>
                                    <CardDescription className="line-clamp-2 mt-1">
                                        {workflow.description || 'No description'}
                                    </CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}>
                                            <Edit className="h-4 w-4 mr-2" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600">
                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mb-4">
                                <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                                    {workflow.status}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                    Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                <div className="bg-slate-50 p-2 rounded">
                                    <div className="font-semibold text-slate-900">{workflow.stats.enrolled}</div>
                                    <div className="text-xs text-slate-500">Enrolled</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded">
                                    <div className="font-semibold text-slate-900">{workflow.stats.active}</div>
                                    <div className="text-xs text-slate-500">Active</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded">
                                    <div className="font-semibold text-slate-900">{workflow.stats.completed}</div>
                                    <div className="text-xs text-slate-500">Done</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
