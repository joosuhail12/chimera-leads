"use client";

import { useState, useEffect } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const formSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    title: z.string().optional(),
    account_id: z.string().optional(),
    linkedin_url: z.string().url("Invalid URL").optional().or(z.literal("")),
    location: z.string().optional(),
});

interface CreateContactSheetProps {
    userId: string;
    orgId: string;
}

export function CreateContactSheet({ userId, orgId }: CreateContactSheetProps) {
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            title: "",
            account_id: "none",
            linkedin_url: "",
            location: "",
        },
    });

    const { isSubmitting } = form.formState;

    // Fetch accounts for the dropdown when sheet opens
    useEffect(() => {
        if (open) {
            fetch("/api/crm/accounts?limit=100")
                .then((res) => res.json())
                .then((data) => {
                    if (data.accounts) {
                        setAccounts(data.accounts);
                    }
                })
                .catch((err) => console.error("Failed to load accounts", err));
        }
    }, [open]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const payload = {
                ...values,
                account_id: values.account_id === "none" ? undefined : values.account_id,
            };

            const response = await fetch("/api/crm/contacts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error("Failed to create contact");
            }

            toast({
                title: "Contact created",
                description: "The contact has been successfully created.",
            });

            setOpen(false);
            form.reset();
            router.refresh();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create contact. Please try again.",
                variant: "destructive",
            });
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto sm:max-w-[540px]">
                <SheetHeader>
                    <SheetTitle>Create Contact</SheetTitle>
                    <SheetDescription>
                        Add a new person to your CRM.
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name">First Name</Label>
                                <Input id="first_name" placeholder="John" {...form.register("first_name")} />
                                {form.formState.errors.first_name && (
                                    <p className="text-sm text-red-500">{form.formState.errors.first_name.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" placeholder="Doe" {...form.register("last_name")} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="john@example.com" {...form.register("email")} />
                            {form.formState.errors.email && (
                                <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="account_id">Account</Label>
                            <Select
                                onValueChange={(value) => form.setValue("account_id", value)}
                                defaultValue={form.getValues("account_id")}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Account</SelectItem>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Job Title</Label>
                                <Input id="title" placeholder="CEO" {...form.register("title")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" placeholder="+1 555 0100" {...form.register("phone")} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                            <Input id="linkedin_url" placeholder="https://linkedin.com/in/johndoe" {...form.register("linkedin_url")} />
                            {form.formState.errors.linkedin_url && (
                                <p className="text-sm text-red-500">{form.formState.errors.linkedin_url.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input id="location" placeholder="San Francisco, CA" {...form.register("location")} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Contact
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
