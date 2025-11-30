'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface Suppression {
    id: string;
    type: 'email' | 'domain' | 'lead';
    value: string;
    reason: string;
    created_at: string;
    expires_at?: string;
}

export function SuppressionManager() {
    const [suppressions, setSuppressions] = useState<Suppression[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newSuppression, setNewSuppression] = useState({
        type: 'email',
        value: '',
        reason: 'manual',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        fetchSuppressions();
    }, []);

    const fetchSuppressions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sequence_suppressions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSuppressions(data || []);
        } catch (error) {
            console.error('Error fetching suppressions:', error);
            toast({
                title: 'Error',
                description: 'Failed to load suppression list',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddSuppression = async () => {
        if (!newSuppression.value) return;

        setIsSubmitting(true);
        try {
            // In a real app, we'd get the current user's org ID
            // For now, we'll rely on RLS or a backend endpoint if needed
            // But since we are using client-side supabase, we assume the user is auth'd

            const { error } = await supabase.from('sequence_suppressions').insert([
                {
                    type: newSuppression.type,
                    value: newSuppression.value,
                    reason: newSuppression.reason,
                    organization_id: (await supabase.auth.getUser()).data.user?.user_metadata?.organization_id, // Best effort to get org_id
                },
            ]);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Suppression added successfully',
            });
            setIsAddDialogOpen(false);
            setNewSuppression({ type: 'email', value: '', reason: 'manual' });
            fetchSuppressions();
        } catch (error) {
            console.error('Error adding suppression:', error);
            toast({
                title: 'Error',
                description: 'Failed to add suppression',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('sequence_suppressions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Suppression removed successfully',
            });
            fetchSuppressions();
        } catch (error) {
            console.error('Error removing suppression:', error);
            toast({
                title: 'Error',
                description: 'Failed to remove suppression',
                variant: 'destructive',
            });
        }
    };

    const filteredSuppressions = suppressions.filter((item) =>
        item.value.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search suppressions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 w-[300px]"
                        />
                    </div>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Suppression
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Suppression</DialogTitle>
                            <DialogDescription>
                                Prevent emails or domains from being enrolled in sequences.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Type</label>
                                <Select
                                    value={newSuppression.type}
                                    onValueChange={(val) =>
                                        setNewSuppression({ ...newSuppression, type: val })
                                    }
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Email Address</SelectItem>
                                        <SelectItem value="domain">Domain</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Value</label>
                                <Input
                                    value={newSuppression.value}
                                    onChange={(e) =>
                                        setNewSuppression({ ...newSuppression, value: e.target.value })
                                    }
                                    placeholder={
                                        newSuppression.type === 'email'
                                            ? 'example@company.com'
                                            : 'company.com'
                                    }
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Reason</label>
                                <Select
                                    value={newSuppression.reason}
                                    onValueChange={(val) =>
                                        setNewSuppression({ ...newSuppression, reason: val })
                                    }
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="competitor">Competitor</SelectItem>
                                        <SelectItem value="customer">Existing Customer</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsAddDialogOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleAddSuppression} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Added On</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filteredSuppressions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No suppressions found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSuppressions.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Badge variant="outline">{item.type}</Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{item.value}</TableCell>
                                    <TableCell className="capitalize">{item.reason}</TableCell>
                                    <TableCell>
                                        {format(new Date(item.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(item.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
