"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    from_name: string;
    from_email: string;
    reply_to_email?: string;
  }) => Promise<void>;
}

export function AddEmailDialog({ isOpen, onClose, onSubmit }: AddEmailDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    from_name: "",
    from_email: "",
    reply_to_email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        from_name: formData.from_name,
        from_email: formData.from_email,
        reply_to_email: formData.reply_to_email || undefined,
      });

      // Reset form on success
      setFormData({
        from_name: "",
        from_email: "",
        reply_to_email: "",
      });
    } catch (error) {
      console.error("Error submitting email:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Email Address</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from_name">Display Name</Label>
            <Input
              id="from_name"
              placeholder="e.g., Acme Support"
              value={formData.from_name}
              onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500">
              This name will appear in the "From" field of your emails
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from_email">From Email Address</Label>
            <Input
              id="from_email"
              type="email"
              placeholder="e.g., support@acme.com"
              value={formData.from_email}
              onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500">
              The email address you'll send emails from
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply_to_email">Reply-To Email (Optional)</Label>
            <Input
              id="reply_to_email"
              type="email"
              placeholder="e.g., replies@acme.com"
              value={formData.reply_to_email}
              onChange={(e) => setFormData({ ...formData, reply_to_email: e.target.value })}
            />
            <p className="text-xs text-gray-500">
              Where replies should be sent (defaults to from email if not specified)
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-4">
            <h4 className="text-sm font-medium text-blue-900">Verification Required</h4>
            <p className="mt-1 text-sm text-blue-700">
              After adding this email address, you'll need to verify ownership. For custom domains,
              you'll need to add DNS records. For individual email addresses, you'll receive a
              verification email from AWS.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Email Address"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}