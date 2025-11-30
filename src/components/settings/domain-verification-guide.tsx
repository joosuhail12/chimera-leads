"use client";

import { useState } from "react";
import { X, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailSetting {
  id: string;
  from_email: string;
  domain: string | null;
  dkim_tokens: string[] | null;
  spf_record: string | null;
  dkim_verified: boolean;
  spf_verified: boolean;
}

interface DomainVerificationGuideProps {
  setting: EmailSetting;
  isOpen: boolean;
  onClose: () => void;
}

export function DomainVerificationGuide({
  setting,
  isOpen,
  onClose,
}: DomainVerificationGuideProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopy = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemId);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getDkimRecords = () => {
    if (!setting.dkim_tokens || setting.dkim_tokens.length === 0) {
      return [];
    }

    return setting.dkim_tokens.map((token, index) => ({
      name: `${token}._domainkey.${setting.domain}`,
      type: "CNAME",
      value: `${token}.dkim.amazonses.com`,
      id: `dkim-${index}`,
    }));
  };

  const getSpfRecord = () => {
    if (!setting.domain) return null;

    return {
      name: setting.domain,
      type: "TXT",
      value: setting.spf_record || "v=spf1 include:amazonses.com ~all",
      id: "spf",
    };
  };

  const dkimRecords = getDkimRecords();
  const spfRecord = getSpfRecord();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Domain Verification Setup</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Verifying: {setting.from_email}
            </h3>
            {setting.domain && (
              <p className="mt-1 text-sm text-gray-500">Domain: {setting.domain}</p>
            )}
          </div>

          {/* Verification Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Verification Status</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {setting.dkim_verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-sm text-gray-700">
                  DKIM: {setting.dkim_verified ? "Verified" : "Pending"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {setting.spf_verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-sm text-gray-700">
                  SPF: {setting.spf_verified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* DNS Records */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Required DNS Records</h4>

            {/* DKIM Records */}
            {dkimRecords.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  DKIM Records (for email authentication)
                </h5>
                {dkimRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Type: {record.type}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(`${record.name}\n${record.value}`, record.id)}
                        className="h-7 gap-1 text-xs"
                      >
                        {copiedItem === record.id ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <div>
                        <span className="text-xs text-gray-500">Name:</span>
                        <p className="mt-0.5 text-xs font-mono text-gray-900 break-all">
                          {record.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Value:</span>
                        <p className="mt-0.5 text-xs font-mono text-gray-900 break-all">
                          {record.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SPF Record */}
            {spfRecord && (
              <div className="space-y-3">
                <h5 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  SPF Record (for sender verification)
                </h5>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Type: {spfRecord.type}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`${spfRecord.name}\n${spfRecord.value}`, spfRecord.id)}
                      className="h-7 gap-1 text-xs"
                    >
                      {copiedItem === spfRecord.id ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-xs text-gray-500">Name:</span>
                      <p className="mt-0.5 text-xs font-mono text-gray-900 break-all">
                        {spfRecord.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Value:</span>
                      <p className="mt-0.5 text-xs font-mono text-gray-900 break-all">
                        {spfRecord.value}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-blue-50 p-4 space-y-2">
            <h4 className="text-sm font-medium text-blue-900">Setup Instructions</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
              <li>Log in to your domain's DNS management console</li>
              <li>Add the DKIM CNAME records shown above</li>
              <li>Add or update the SPF TXT record for your domain</li>
              <li>DNS changes may take up to 48 hours to propagate</li>
              <li>Click "Check Status" in the email settings to verify</li>
            </ol>
          </div>

          {!setting.dkim_tokens && (
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                DNS records are being generated. Please check back in a few moments.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}