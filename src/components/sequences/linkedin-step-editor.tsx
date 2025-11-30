'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LinkedInStepConfig, SequenceStepType } from '@/lib/types/sequences';

interface LinkedInStepEditorProps {
    stepType: SequenceStepType;
    config?: LinkedInStepConfig | null;
    onChange: (config: LinkedInStepConfig) => void;
}

export function LinkedInStepEditor({ stepType, config, onChange }: LinkedInStepEditorProps) {
    const [localConfig, setLocalConfig] = useState<LinkedInStepConfig>({
        action_type: getActionTypeFromStepType(stepType),
        automation_mode: 'semi_auto',
        skip_if_connected: true,
        require_connection: true,
        view_duration_seconds: 5,
        scroll_profile: true,
        ...config,
    });

    useEffect(() => {
        // Update local config when step type changes to ensure action_type matches
        setLocalConfig(prev => ({
            ...prev,
            action_type: getActionTypeFromStepType(stepType),
        }));
    }, [stepType]);

    const updateConfig = (updates: Partial<LinkedInStepConfig>) => {
        const newConfig = { ...localConfig, ...updates };
        setLocalConfig(newConfig);
        onChange(newConfig);
    };

    function getActionTypeFromStepType(type: SequenceStepType): any {
        switch (type) {
            case 'linkedin_connection': return 'connect';
            case 'linkedin_message': return 'message';
            case 'linkedin_profile_view': return 'view_profile';
            case 'linkedin_engagement': return 'like_post'; // Default to like, can be comment
            default: return 'view_profile';
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Automation Mode</Label>
                <Select
                    value={localConfig.automation_mode}
                    onValueChange={(value: any) => updateConfig({ automation_mode: value })}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="semi_auto">Semi-Automatic (Review Required)</SelectItem>
                        <SelectItem value="full_auto">Fully Automatic</SelectItem>
                        <SelectItem value="manual">Manual Task</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    Semi-automatic tasks are queued for your approval before execution.
                </p>
            </div>

            {stepType === 'linkedin_connection' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Connection Note (Optional)</Label>
                        <Textarea
                            placeholder="Hi {first_name}, I'd love to connect..."
                            value={localConfig.connection_note_template || ''}
                            onChange={(e) => updateConfig({ connection_note_template: e.target.value })}
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty to send a connection request without a note.
                        </p>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="skip-connected">Skip if already connected</Label>
                        <Switch
                            id="skip-connected"
                            checked={localConfig.skip_if_connected}
                            onCheckedChange={(checked) => updateConfig({ skip_if_connected: checked })}
                        />
                    </div>
                </div>
            )}

            {stepType === 'linkedin_message' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Message Template</Label>
                        <Textarea
                            placeholder="Hi {first_name}..."
                            value={localConfig.message_template || ''}
                            onChange={(e) => updateConfig({ message_template: e.target.value })}
                            rows={6}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="require-connection">Require connection</Label>
                        <Switch
                            id="require-connection"
                            checked={localConfig.require_connection}
                            onCheckedChange={(checked) => updateConfig({ require_connection: checked })}
                        />
                    </div>
                </div>
            )}

            {stepType === 'linkedin_profile_view' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>View Duration (seconds)</Label>
                        <Input
                            type="number"
                            min={1}
                            max={60}
                            value={localConfig.view_duration_seconds}
                            onChange={(e) => updateConfig({ view_duration_seconds: parseInt(e.target.value) || 5 })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="scroll-profile">Scroll profile</Label>
                        <Switch
                            id="scroll-profile"
                            checked={localConfig.scroll_profile}
                            onCheckedChange={(checked) => updateConfig({ scroll_profile: checked })}
                        />
                    </div>
                </div>
            )}

            {stepType === 'linkedin_engagement' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Action</Label>
                        <Select
                            value={localConfig.action_type}
                            onValueChange={(value: any) => updateConfig({ action_type: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="like_post">Like Recent Post</SelectItem>
                                <SelectItem value="comment">Comment on Post</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {localConfig.action_type === 'like_post' && (
                        <div className="space-y-2">
                            <Label>Number of posts to like</Label>
                            <Select
                                value={localConfig.like_recent_posts?.toString() || '1'}
                                onValueChange={(value) => updateConfig({ like_recent_posts: parseInt(value) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 (Most Recent)</SelectItem>
                                    <SelectItem value="2">2 Posts</SelectItem>
                                    <SelectItem value="3">3 Posts</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {localConfig.action_type === 'comment' && (
                        <div className="space-y-2">
                            <Label>Comment Templates</Label>
                            <Textarea
                                placeholder="Great post, {first_name}!"
                                value={localConfig.comment_templates?.[0] || ''}
                                onChange={(e) => updateConfig({ comment_templates: [e.target.value] })}
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                AI will try to generate a relevant comment based on this template/tone.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
