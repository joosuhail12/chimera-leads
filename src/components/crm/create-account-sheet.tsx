"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { createAccount } from "@/lib/services/crm-accounts";

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    domain: z.string().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    location: z.string().optional(),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
    linkedin_url: z.string().url("Invalid URL").optional().or(z.literal("")),
    description: z.string().optional(),
});

interface CreateAccountSheetProps {
    userId: string;
    orgId: string;
}

export function CreateAccountSheet({ userId, orgId }: CreateAccountSheetProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            domain: "",
            industry: "",
            size: "",
            location: "",
            website: "",
            linkedin_url: "",
            description: "",
        },
    });

    const { isSubmitting } = form.formState;

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            // We need to call a server action or API route here. 
            // Since we can't call the service directly from client component easily without server actions,
            // we'll assume we have a server action wrapper or API route.
            // For this implementation, I'll create a server action wrapper in the same file or separate file if needed.
            // But wait, `createAccount` is a server-side function (uses `createAdminClient`).
            // I should probably make this a client component that calls a server action.
            // Let's assume we'll pass a server action as a prop or import it if it's a server action.
            // Actually, let's just use fetch to call an API route we'll create, OR use a server action.
            // Given the constraints, I'll create a simple API route for this or use a server action.
            // Let's use a server action approach. I'll define the action in a separate file `src/app/actions/crm.ts` later.
            // For now, I'll fetch to an API route `POST /api/crm/accounts`.

            const response = await fetch("/api/crm/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                throw new Error("Failed to create account");
            }

            toast({
                title: "Account created",
                description: "The account has been successfully created.",
            });

            setOpen(false);
            form.reset();
            router.refresh();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create account. Please try again.",
                variant: "destructive",
            });
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto sm:max-w-[540px]">
                <SheetHeader>
                    <SheetTitle>Create Account</SheetTitle>
                    <SheetDescription>
                        Add a new organization or company to your CRM.
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Account Name</Label>
                            <Input id="name" placeholder="Acme Corp" {...form.register("name")} />
                            {form.formState.errors.name && (
                                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="domain">Domain</Label>
                                <Input id="domain" placeholder="acme.com" {...form.register("domain")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input id="industry" placeholder="Software" {...form.register("industry")} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="size">Size</Label>
                                <Input id="size" placeholder="100-500" {...form.register("size")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <Input id="location" placeholder="San Francisco, CA" {...form.register("location")} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input id="website" placeholder="https://acme.com" {...form.register("website")} />
                            {form.formState.errors.website && (
                                <p className="text-sm text-red-500">{form.formState.errors.website.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                            <Input id="linkedin_url" placeholder="https://linkedin.com/company/acme" {...form.register("linkedin_url")} />
                            {form.formState.errors.linkedin_url && (
                                <p className="text-sm text-red-500">{form.formState.errors.linkedin_url.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" placeholder="Brief description of the company..." {...form.register("description")} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
