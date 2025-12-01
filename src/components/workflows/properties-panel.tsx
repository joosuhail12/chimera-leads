import { Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PropertiesPanelProps {
    node: Node;
    onChange: (data: any) => void;
}

export function PropertiesPanel({ node, onChange }: PropertiesPanelProps) {
    return (
        <aside className="w-80 border-l bg-white p-4 overflow-y-auto">
            <div className="mb-6">
                <h3 className="font-semibold text-lg mb-1">Properties</h3>
                <p className="text-sm text-gray-500">Edit {node.type} settings</p>
            </div>

            <div className="space-y-4">
                <div>
                    <Label>Label</Label>
                    <Input
                        value={node.data.label || ''}
                        onChange={(e) => onChange({ label: e.target.value })}
                    />
                </div>

                {node.type === 'email' && (
                    <>
                        <div>
                            <Label>Subject</Label>
                            <Input
                                value={node.data.subject || ''}
                                onChange={(e) => onChange({ subject: e.target.value })}
                                placeholder="Email subject..."
                            />
                        </div>
                        <div>
                            <Label>Body</Label>
                            <Textarea
                                value={node.data.body || ''}
                                onChange={(e) => onChange({ body: e.target.value })}
                                placeholder="Email content..."
                                rows={8}
                            />
                        </div>
                    </>
                )}

                {node.type === 'delay' && (
                    <>
                        <div>
                            <Label>Duration</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={node.data.duration || 1}
                                    onChange={(e) => onChange({ duration: parseInt(e.target.value) })}
                                />
                                <Select
                                    value={node.data.unit || 'days'}
                                    onValueChange={(value) => onChange({ unit: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hours">Hours</SelectItem>
                                        <SelectItem value="days">Days</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </>
                )}

                {node.type === 'condition' && (
                    <>
                        <div>
                            <Label>Condition Type</Label>
                            <Select
                                value={node.data.conditionType || 'opened'}
                                onValueChange={(value) => onChange({ conditionType: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="opened">If Opened</SelectItem>
                                    <SelectItem value="clicked">If Clicked</SelectItem>
                                    <SelectItem value="replied">If Replied</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}
