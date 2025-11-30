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
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Edit, Play } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface AutoEnrollmentRule {
    id: string;
    name: string;
    trigger_type: string;
    is_active: boolean;
    template_id: string;
    created_at: string;
    template?: { name: string };
}

interface SequenceTemplate {
    id: string;
    name: string;
}

export function AutoEnrollmentRules() {
    const [rules, setRules] = useState<AutoEnrollmentRule[]>([]);
    const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newRule, setNewRule] = useState({
        name: '',
        trigger_type: 'lead_created',
        template_id: '',
        is_active: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        fetchRules();
        fetchTemplates();
    }, []);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sequence_auto_enrollment_rules')
                .select('*, template:sequence_templates(name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRules(data || []);
        } catch (error) {
            console.error('Error fetching rules:', error);
            toast({
                title: 'Error',
                description: 'Failed to load auto-enrollment rules',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('sequence_templates')
                .select('id, name')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    const handleAddRule = async () => {
        if (!newRule.name || !newRule.template_id) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('sequence_auto_enrollment_rules')
                .insert([
                    {
                        name: newRule.name,
                        trigger_type: newRule.trigger_type,
                        template_id: newRule.template_id,
                        is_active: newRule.is_active,
                        organization_id: (await supabase.auth.getUser()).data.user?.user_metadata?.organization_id,
                        trigger_config: {}, // Default empty config for now
                    },
                ]);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Rule created successfully',
            });
            setIsAddDialogOpen(false);
            setNewRule({
                name: '',
                trigger_type: 'lead_created',
                template_id: '',
                is_active: true,
            });
            fetchRules();
        } catch (error) {
            console.error('Error adding rule:', error);
            toast({
                title: 'Error',
                description: 'Failed to create rule',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleRuleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('sequence_auto_enrollment_rules')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            setRules(rules.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
            toast({
                title: 'Success',
                description: `Rule ${!currentStatus ? 'activated' : 'deactivated'}`,
            });
        } catch (error) {
            console.error('Error updating rule:', error);
            toast({
                title: 'Error',
                description: 'Failed to update rule status',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('sequence_auto_enrollment_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'Rule deleted successfully',
            });
            fetchRules();
        } catch (error) {
            console.error('Error deleting rule:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete rule',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    {/* Header content if needed */}
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Rule
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Auto-Enrollment Rule</DialogTitle>
                            <DialogDescription>
                                Automatically enroll leads into sequences based on triggers.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Name</label>
                                <Input
                                    value={newRule.name}
                                    onChange={(e) =>
                                        setNewRule({ ...newRule, name: e.target.value })
                                    }
                                    placeholder="e.g. New Lead Nurture"
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Trigger</label>
                                <Select
                                    value={newRule.trigger_type}
                                    onValueChange={(val) =>
                                        setNewRule({ ...newRule, trigger_type: val })
                                    }
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lead_created">Lead Created</SelectItem>
                                        <SelectItem value="lead_status_change">Status Changed</SelectItem>
                                        <SelectItem value="lead_score_threshold">Score Threshold</SelectItem>
                                        <SelectItem value="form_submission">Form Submission</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Sequence</label>
                                <Select
                                    value={newRule.template_id}
                                    onValueChange={(val) =>
                                        setNewRule({ ...newRule, template_id: val })
                                    }
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select sequence..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm font-medium">Active</label>
                                <div className="col-span-3 flex items-center space-x-2">
                                    <Switch
                                        checked={newRule.is_active}
                                        onCheckedChange={(checked) =>
                                            setNewRule({ ...newRule, is_active: checked })
                                        }
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        Enable rule immediately
                                    </span>
                                </div>
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
                            <Button onClick={handleAddRule} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Rule
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Trigger</TableHead>
                            <TableHead>Target Sequence</TableHead>
                            <TableHead>Created On</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : rules.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No automation rules found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rules.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell>
                                        <Switch
                                            checked={rule.is_active}
                                            onCheckedChange={() => toggleRuleStatus(rule.id, rule.is_active)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{rule.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{rule.trigger_type.replace(/_/g, ' ')}</Badge>
                                    </TableCell>
                                    <TableCell>{rule.template?.name || 'Unknown'}</TableCell>
                                    <TableCell>
                                        {format(new Date(rule.created_at), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(rule.id)}
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
