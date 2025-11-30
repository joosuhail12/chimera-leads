"use client";

import { useState, useEffect } from "react";
import {
    Plus,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Copy,
    Mail,
    Globe,
    Trash2,
    Check,
    ChevronDown,
    ChevronUp,
    Star,
    MoreVertical
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
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Domain {
    id: string;
    domain: string;
    is_verified: boolean;
    dkim_tokens: string[];
    status: string;
}

interface Sender {
    id: string;
    email: string;
    from_name: string;
    domain: { domain: string };
    is_default: boolean;
}

export function DomainSettings() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [senders, setSenders] = useState<Sender[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog States
    const [isDomainDialogOpen, setIsDomainDialogOpen] = useState(false);
    const [isSenderDialogOpen, setIsSenderDialogOpen] = useState(false);
    const [deleteDomainId, setDeleteDomainId] = useState<string | null>(null);
    const [deleteSenderId, setDeleteSenderId] = useState<string | null>(null);

    // Loading States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    // UI States
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [copiedText, setCopiedText] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [domainsRes, sendersRes] = await Promise.all([
                fetch("/api/settings/domains"),
                fetch("/api/settings/senders")
            ]);

            const domainsData = await domainsRes.json();
            const sendersData = await sendersRes.json();

            setDomains(domainsData.domains || []);
            setSenders(sendersData.senders || []);

            // Auto-expand unverified domains
            const unverifiedIds = new Set(
                (domainsData.domains || [])
                    .filter((d: Domain) => !d.is_verified)
                    .map((d: Domain) => d.id)
            );
            setExpandedDomains(unverifiedIds as Set<string>);

        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    }

    const toggleDomainExpand = (id: string) => {
        const newSet = new Set(expandedDomains);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedDomains(newSet);
    };

    async function handleAddDomain(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch("/api/settings/domains", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain: formData.get("domain") }),
            });

            if (!res.ok) throw new Error("Failed");
            setIsDomainDialogOpen(false);
            fetchData();
        } catch (error) {
            alert("Failed to add domain");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteDomain() {
        if (!deleteDomainId) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/settings/domains/${deleteDomainId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            setDeleteDomainId(null);
            fetchData();
        } catch (error) {
            alert("Failed to delete domain");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleAddSender(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch("/api/settings/senders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domainId: formData.get("domainId"),
                    localPart: formData.get("localPart"),
                    fromName: formData.get("fromName"),
                }),
            });

            if (!res.ok) throw new Error("Failed");
            setIsSenderDialogOpen(false);
            fetchData();
        } catch (error) {
            alert("Failed to add sender");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteSender() {
        if (!deleteSenderId) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/settings/senders/${deleteSenderId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            setDeleteSenderId(null);
            fetchData();
        } catch (error) {
            alert("Failed to delete sender");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleSetDefaultSender(id: string) {
        try {
            const res = await fetch(`/api/settings/senders/${id}/default`, { method: "PATCH" });
            if (!res.ok) throw new Error("Failed");
            fetchData();
        } catch (error) {
            alert("Failed to set default sender");
        }
    }

    async function checkVerification(id: string) {
        setVerifyingId(id);
        try {
            const res = await fetch(`/api/settings/domains/${id}/verify`, { method: "POST" });
            if (res.ok) fetchData();
        } finally {
            setVerifyingId(null);
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 2000);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <div className="space-y-6">
            <Tabs defaultValue="domains">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="domains" className="gap-2">
                        <Globe className="h-4 w-4" /> Domains
                    </TabsTrigger>
                    <TabsTrigger value="senders" className="gap-2">
                        <Mail className="h-4 w-4" /> Senders
                    </TabsTrigger>
                </TabsList>

                {/* DOMAINS TAB */}
                <TabsContent value="domains" className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-lg font-medium">Verified Domains</h3>
                            <p className="text-sm text-muted-foreground">
                                Add domains to verify ownership and improve email deliverability (DKIM).
                            </p>
                        </div>
                        <Dialog open={isDomainDialogOpen} onOpenChange={setIsDomainDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" /> Add Domain
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Domain</DialogTitle>
                                    <DialogDescription>
                                        Enter the domain you want to send emails from (e.g., acme.com).
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleAddDomain} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Domain Name</Label>
                                        <Input name="domain" placeholder="acme.com" required />
                                    </div>
                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting ? "Adding..." : "Add Domain"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid gap-4">
                        {domains.length === 0 && (
                            <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 text-center">
                                <Globe className="mb-4 h-8 w-8 text-muted-foreground" />
                                <h3 className="text-lg font-semibold">No domains added</h3>
                                <p className="text-sm text-muted-foreground">
                                    Add your first domain to start sending verified emails.
                                </p>
                            </div>
                        )}
                        {domains.map((domain) => (
                            <Card key={domain.id} className="overflow-hidden">
                                <div
                                    className="flex flex-row items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => toggleDomainExpand(domain.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "p-2 rounded-full",
                                            domain.is_verified ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                                        )}>
                                            <Globe className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-base">{domain.domain}</h4>
                                                <Badge
                                                    variant={domain.is_verified ? "default" : "secondary"}
                                                    className={cn(
                                                        "capitalize text-xs h-5 px-1.5",
                                                        domain.is_verified
                                                            ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                                                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                    )}
                                                >
                                                    {domain.status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {domain.is_verified ? "Verified via DKIM" : "Verification Pending"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!domain.is_verified && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    checkVerification(domain.id);
                                                }}
                                                disabled={verifyingId === domain.id}
                                                className="gap-2 h-8"
                                            >
                                                <RefreshCw
                                                    className={cn("h-3 w-3", verifyingId === domain.id && "animate-spin")}
                                                />
                                                {verifyingId === domain.id ? "Checking..." : "Check Status"}
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            {expandedDomains.has(domain.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {expandedDomains.has(domain.id) && (
                                    <div className="border-t bg-muted/10 p-4 animate-in slide-in-from-top-2 duration-200">
                                        {!domain.is_verified ? (
                                            <div className="space-y-4">
                                                <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
                                                    <div className="flex gap-3">
                                                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                        <div className="space-y-1">
                                                            <h4 className="font-medium text-blue-900 dark:text-blue-300">Verification Required</h4>
                                                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                                                Add these CNAME records to your DNS provider to verify ownership.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border bg-background">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
                                                            <tr>
                                                                <th className="px-4 py-3">Type</th>
                                                                <th className="px-4 py-3">Name</th>
                                                                <th className="px-4 py-3">Value</th>
                                                                <th className="px-4 py-3"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {domain.dkim_tokens?.map((token) => {
                                                                const name = `${token}._domainkey.${domain.domain}`;
                                                                const value = `${token}.dkim.amazonses.com`;
                                                                return (
                                                                    <tr key={token} className="group hover:bg-muted/50">
                                                                        <td className="px-4 py-3 font-mono text-xs">CNAME</td>
                                                                        <td className="px-4 py-3 font-mono text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="truncate max-w-[200px]">{name}</span>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                                                                    onClick={() => copyToClipboard(name)}
                                                                                >
                                                                                    {copiedText === name ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                                                </Button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 font-mono text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="truncate max-w-[200px]">{value}</span>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                                                                    onClick={() => copyToClipboard(value)}
                                                                                >
                                                                                    {copiedText === value ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                                                </Button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => copyToClipboard(`${name} ${value}`)}
                                                                            >
                                                                                Copy
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span>Domain verified and ready for sending.</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => setDeleteDomainId(domain.id)}
                                            >
                                                <Trash2 className="h-4 w-4" /> Delete Domain
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* SENDERS TAB */}
                <TabsContent value="senders" className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-lg font-medium">Sender Profiles</h3>
                            <p className="text-sm text-muted-foreground">
                                Create sender identities (e.g., "Support Team") using your verified domains.
                            </p>
                        </div>
                        <Dialog open={isSenderDialogOpen} onOpenChange={setIsSenderDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" /> Add Sender
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Sender Profile</DialogTitle>
                                    <DialogDescription>
                                        Configure a new "From" address.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleAddSender} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Domain</Label>
                                        <Select name="domainId" required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a verified domain" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {domains.filter(d => d.is_verified).map(d => (
                                                    <SelectItem key={d.id} value={d.id}>{d.domain}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {domains.filter(d => d.is_verified).length === 0 && (
                                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                You need a verified domain to add a sender.
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Username</Label>
                                            <div className="flex items-center rounded-md border px-3 py-2">
                                                <Input
                                                    name="localPart"
                                                    placeholder="support"
                                                    required
                                                    className="h-auto border-0 p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Display Name</Label>
                                            <Input name="fromName" placeholder="Acme Support" required />
                                        </div>
                                    </div>
                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting ? "Adding..." : "Add Sender"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid gap-4">
                        {senders.length === 0 && (
                            <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 text-center">
                                <Mail className="mb-4 h-8 w-8 text-muted-foreground" />
                                <h3 className="text-lg font-semibold">No senders configured</h3>
                                <p className="text-sm text-muted-foreground">
                                    Create your first sender profile to start sending emails.
                                </p>
                            </div>
                        )}
                        {senders.map((sender) => (
                            <Card key={sender.id} className="flex flex-row items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-base">{sender.from_name}</h4>
                                            {sender.is_default && (
                                                <Badge variant="secondary" className="text-xs">Default</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{sender.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!sender.is_default && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSetDefaultSender(sender.id)}
                                            title="Set as Default"
                                        >
                                            <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-500" />
                                        </Button>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setDeleteSenderId(sender.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Delete Domain Confirmation */}
            <Dialog open={!!deleteDomainId} onOpenChange={(open) => !open && setDeleteDomainId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Domain?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete the domain and all associated sender profiles. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDomainId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteDomain} disabled={isSubmitting}>
                            {isSubmitting ? "Deleting..." : "Delete Domain"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Sender Confirmation */}
            <Dialog open={!!deleteSenderId} onOpenChange={(open) => !open && setDeleteSenderId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Sender?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete this sender profile.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteSenderId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteSender} disabled={isSubmitting}>
                            {isSubmitting ? "Deleting..." : "Delete Sender"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
