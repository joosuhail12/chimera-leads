"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Mail, AlertCircle, CheckCircle, XCircle, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddEmailDialog } from "./add-email-dialog";
import { DomainVerificationGuide } from "./domain-verification-guide";

interface EmailSetting {
  id: string;
  organization_id: string;
  from_name: string | null;
  from_email: string;
  reply_to_email: string | null;
  domain: string | null;
  is_verified: boolean;
  verification_token: string | null;
  dkim_tokens: string[] | null;
  spf_record: string | null;
  dkim_verified: boolean;
  spf_verified: boolean;
  verification_status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface EmailSettingsManagerProps {
  organizationId: string;
  initialSettings: EmailSetting[];
  userId: string;
}

export function EmailSettingsManager({
  organizationId,
  initialSettings,
  userId,
}: EmailSettingsManagerProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<EmailSetting[]>(initialSettings);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<EmailSetting | null>(null);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddEmail = async (data: {
    from_name: string;
    from_email: string;
    reply_to_email?: string;
  }) => {
    try {
      const response = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          organization_id: organizationId,
          created_by: userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add email address");
      }

      const newSetting = await response.json();
      setSettings([newSetting, ...settings]);
      setIsAddDialogOpen(false);

      // Trigger verification automatically
      await handleVerify(newSetting.id);
    } catch (error) {
      console.error("Error adding email:", error);
      alert("Failed to add email address. Please try again.");
    }
  };

  const handleVerify = async (settingId: string) => {
    setIsVerifying(settingId);
    try {
      const response = await fetch("/api/settings/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settingId }),
      });

      if (!response.ok) {
        throw new Error("Failed to trigger verification");
      }

      router.refresh();
    } catch (error) {
      console.error("Error triggering verification:", error);
      alert("Failed to trigger verification. Please try again.");
    } finally {
      setIsVerifying(null);
    }
  };

  const handleCheckStatus = async (settingId: string) => {
    setIsVerifying(settingId);
    try {
      const response = await fetch(`/api/settings/email/verify?settingId=${settingId}`);

      if (!response.ok) {
        throw new Error("Failed to check verification status");
      }

      const { verified } = await response.json();

      // Update local state
      setSettings(settings.map(s =>
        s.id === settingId
          ? { ...s, is_verified: verified, verification_status: verified ? 'verified' : s.verification_status }
          : s
      ));

      router.refresh();
    } catch (error) {
      console.error("Error checking status:", error);
      alert("Failed to check verification status. Please try again.");
    } finally {
      setIsVerifying(null);
    }
  };

  const handleDelete = async (settingId: string) => {
    if (!confirm("Are you sure you want to delete this email configuration?")) {
      return;
    }

    setIsDeleting(settingId);
    try {
      const response = await fetch(`/api/settings/email?id=${settingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete email configuration");
      }

      setSettings(settings.filter(s => s.id !== settingId));
    } catch (error) {
      console.error("Error deleting email:", error);
      alert("Failed to delete email configuration. Please try again.");
    } finally {
      setIsDeleting(null);
    }
  };

  const getStatusIcon = (setting: EmailSetting) => {
    if (setting.is_verified) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (setting.verification_status === 'failed') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusLabel = (setting: EmailSetting) => {
    if (setting.is_verified) return "Verified";
    if (setting.verification_status === 'failed') return "Failed";
    return "Pending Verification";
  };

  if (settings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Mail className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No email addresses configured</h3>
        <p className="mt-2 text-sm text-gray-500">
          Add your first email address to start sending emails from your custom domain.
        </p>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="mt-6 gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Email Address
        </Button>
        <AddEmailDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onSubmit={handleAddEmail}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Email Addresses</h2>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Email Address
        </Button>
      </div>

      <div className="space-y-4">
        {settings.map((setting) => (
          <div
            key={setting.id}
            className="rounded-lg border border-gray-200 bg-white p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-medium text-gray-900">
                    {setting.from_name || setting.from_email}
                  </h3>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(setting)}
                    <span className={`text-sm ${
                      setting.is_verified ? 'text-green-600' :
                      setting.verification_status === 'failed' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {getStatusLabel(setting)}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500">{setting.from_email}</p>
                {setting.reply_to_email && (
                  <p className="mt-1 text-sm text-gray-500">
                    Reply-to: {setting.reply_to_email}
                  </p>
                )}
                {setting.domain && (
                  <p className="mt-1 text-sm text-gray-500">
                    Domain: {setting.domain}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!setting.is_verified && (
                  <>
                    {setting.domain && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSetting(setting)}
                      >
                        View DNS Setup
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckStatus(setting.id)}
                      disabled={isVerifying === setting.id}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isVerifying === setting.id ? 'animate-spin' : ''}`} />
                      Check Status
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(setting.id)}
                  disabled={isDeleting === setting.id}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {setting.created_at && (
              <div className="mt-4 text-xs text-gray-500">
                Added on {new Date(setting.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      <AddEmailDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSubmit={handleAddEmail}
      />

      {selectedSetting && (
        <DomainVerificationGuide
          setting={selectedSetting}
          isOpen={!!selectedSetting}
          onClose={() => setSelectedSetting(null)}
        />
      )}
    </div>
  );
}