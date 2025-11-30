"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    Phone,
    Mail,
    Calendar,
    FileText,
    CheckCircle2,
    Plus,
    MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActivityType = "note" | "call" | "meeting" | "email" | "status_change";

interface Activity {
    id: string;
    type: ActivityType;
    content: string | null;
    outcome: string | null;
    occurred_at: string;
    created_by: string | null;
}

interface ActivityTimelineProps {
    leadId: string;
    activities: Activity[];
}

const ACTIVITY_ICONS = {
    note: FileText,
    call: Phone,
    meeting: Calendar,
    email: Mail,
    status_change: CheckCircle2,
};

const ACTIVITY_COLORS = {
    note: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    call: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    meeting: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    email: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    status_change: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
};

export function ActivityTimeline({ leadId, activities }: ActivityTimelineProps) {
    const router = useRouter();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newActivityType, setNewActivityType] = useState<ActivityType>("note");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            lead_id: leadId,
            type: newActivityType,
            content: formData.get("content"),
            outcome: formData.get("outcome"),
            occurred_at: new Date().toISOString(),
        };

        try {
            const res = await fetch("/api/crm/activities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error("Failed to create activity");

            setIsDialogOpen(false);
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Timeline
                </h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Log Activity
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Log Activity</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                    value={newActivityType}
                                    onValueChange={(v) => setNewActivityType(v as ActivityType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="note">Note</SelectItem>
                                        <SelectItem value="call">Call</SelectItem>
                                        <SelectItem value="meeting">Meeting</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {(newActivityType === "call" || newActivityType === "meeting") && (
                                <div className="space-y-2">
                                    <Label>Outcome</Label>
                                    <Input name="outcome" placeholder="e.g. Connected, Left Voicemail" />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Details</Label>
                                <Textarea
                                    name="content"
                                    placeholder="What happened?"
                                    className="min-h-[100px]"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Saving..." : "Save Activity"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="relative space-y-8 pl-2">
                {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
                        <MessageSquare className="mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">No activities logged yet.</p>
                    </div>
                ) : (
                    activities.map((activity, index) => {
                        const Icon = ACTIVITY_ICONS[activity.type] || FileText;
                        const colorClass = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.note;

                        return (
                            <div key={activity.id} className="relative flex gap-4">
                                {index < activities.length - 1 && (
                                    <div className="absolute left-[19px] top-10 h-[calc(100%+16px)] w-px bg-gray-200 dark:bg-gray-800" />
                                )}

                                <div
                                    className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white shadow-sm ring-4 ring-gray-50 dark:border-gray-900 dark:ring-gray-950 ${colorClass}`}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>

                                <div className="flex flex-col gap-1 pt-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                                            {activity.type.replace("_", " ")}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {format(new Date(activity.occurred_at), "MMM d, yyyy 'at' h:mm a")}
                                        </span>
                                    </div>

                                    {activity.outcome && (
                                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                            Outcome: {activity.outcome}
                                        </div>
                                    )}

                                    {activity.content && (
                                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                            {activity.content}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
