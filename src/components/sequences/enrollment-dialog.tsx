"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { SequenceTemplate } from "@/lib/types/sequences";
import { cn } from "@/lib/utils";

interface SequenceEnrollmentDialogProps {
    leadId: string;
    leadName: string;
    trigger?: React.ReactNode;
    onEnrollmentComplete?: () => void;
}

export function SequenceEnrollmentDialog({
    leadId,
    leadName,
    trigger,
    onEnrollmentComplete
}: SequenceEnrollmentDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            setSuccess(false);
            setError(null);
            setSelectedTemplateId("");
        }
    }, [isOpen]);

    async function fetchTemplates() {
        setIsLoading(true);
        try {
            // Assuming we have an endpoint to list templates
            // If not, we might need to create one or use the existing one if it supports listing
            const res = await fetch("/api/sequences/templates");
            if (!res.ok) throw new Error("Failed to fetch templates");
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (err) {
            console.error(err);
            setError("Failed to load sequence templates");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleEnroll() {
        if (!selectedTemplateId) return;

        setIsEnrolling(true);
        setError(null);

        try {
            const res = await fetch("/api/sequences/enrollments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lead_id: leadId,
                    template_id: selectedTemplateId
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to enroll lead");
            }

            setSuccess(true);
            if (onEnrollmentComplete) onEnrollmentComplete();

            // Close after a brief delay
            setTimeout(() => {
                setIsOpen(false);
            }, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsEnrolling(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Play className="h-4 w-4" /> Enroll in Sequence
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Enroll {leadName}</DialogTitle>
                    <DialogDescription>
                        Select a sequence to start automated outreach for this lead.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="mb-4 rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-medium">Enrollment Successful</h3>
                        <p className="text-sm text-muted-foreground">
                            {leadName} has been added to the sequence.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        {error && (
                            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Select Sequence</Label>
                            <Select
                                value={selectedTemplateId}
                                onValueChange={setSelectedTemplateId}
                                disabled={isLoading || isEnrolling}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoading ? "Loading templates..." : "Choose a sequence..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.length === 0 && !isLoading ? (
                                        <div className="p-2 text-center text-sm text-muted-foreground">
                                            No active sequences found.
                                        </div>
                                    ) : (
                                        templates.map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {templates.length === 0 && !isLoading && (
                                <p className="text-xs text-muted-foreground">
                                    Create a sequence template first in the Sequences tab.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {!success && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isEnrolling}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEnroll}
                            disabled={!selectedTemplateId || isEnrolling || isLoading}
                            className="gap-2"
                        >
                            {isEnrolling && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEnrolling ? "Enrolling..." : "Start Sequence"}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
