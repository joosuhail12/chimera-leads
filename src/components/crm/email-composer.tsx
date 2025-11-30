"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface EmailComposerProps {
    leadId: string;
    leadEmail: string;
}

export function EmailComposer({ leadId, leadEmail }: EmailComposerProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSending(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            leadId,
            to: leadEmail,
            subject: formData.get("subject"),
            body: formData.get("body"),
        };

        try {
            const res = await fetch("/api/crm/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error("Failed to send email");

            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to send email. Please check console.");
        } finally {
            setIsSending(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Send Email</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>To</Label>
                        <Input value={leadEmail} disabled className="bg-gray-50" />
                    </div>

                    <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input name="subject" placeholder="Subject line" required />
                    </div>

                    <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                            name="body"
                            placeholder="Write your message..."
                            className="min-h-[200px]"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSending} className="gap-2">
                            <Send className="h-4 w-4" />
                            {isSending ? "Sending..." : "Send Email"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
