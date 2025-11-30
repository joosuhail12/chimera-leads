"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    CheckSquare,
    Square,
    Calendar as CalendarIcon,
    Plus,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Task {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    priority: "low" | "medium" | "high";
}

interface TaskListProps {
    leadId: string;
    tasks: Task[];
}

export function TaskList({ leadId, tasks }: TaskListProps) {
    const router = useRouter();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function toggleTask(taskId: string, currentStatus: string) {
        const newStatus = currentStatus === "completed" ? "pending" : "completed";

        try {
            await fetch(`/api/crm/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            router.refresh();
        } catch (error) {
            console.error("Failed to toggle task", error);
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            lead_id: leadId,
            title: formData.get("title"),
            due_date: formData.get("due_date") || null,
            priority: "medium", // Default for now
        };

        try {
            const res = await fetch("/api/crm/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error("Failed to create task");

            setIsDialogOpen(false);
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Tasks
                </h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Task</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input name="title" placeholder="Follow up on contract" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Input name="due_date" type="datetime-local" />
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
                                    {isSubmitting ? "Saving..." : "Create Task"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-3">
                {tasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No tasks pending.</p>
                ) : (
                    tasks.map((task) => (
                        <div
                            key={task.id}
                            className={cn(
                                "group flex items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                                task.status === "completed" && "opacity-60"
                            )}
                        >
                            <button
                                onClick={() => toggleTask(task.id, task.status)}
                                className="mt-0.5 text-gray-400 hover:text-sky-600 dark:text-gray-500 dark:hover:text-sky-400"
                            >
                                {task.status === "completed" ? (
                                    <CheckSquare className="h-4 w-4" />
                                ) : (
                                    <Square className="h-4 w-4" />
                                )}
                            </button>
                            <div className="flex-1 space-y-1">
                                <p
                                    className={cn(
                                        "text-sm font-medium text-gray-900 dark:text-gray-200",
                                        task.status === "completed" && "line-through"
                                    )}
                                >
                                    {task.title}
                                </p>
                                {task.due_date && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <CalendarIcon className="h-3 w-3" />
                                        {format(new Date(task.due_date), "MMM d")}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
