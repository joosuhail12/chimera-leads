/**
 * Sequences Management Page
 * List, manage, and analyze email sequences
 */

import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SequenceList } from '@/components/sequences/sequence-list';
import { SequenceMetrics } from '@/components/sequences/sequence-metrics';
import { SequenceTemplateService } from '@/lib/services/sequences';
import type { SequenceTemplate } from '@/lib/types/sequences';

export const metadata = {
  title: 'Sequences | Chimera',
  description: 'Manage email sequences and automation',
};

export default async function SequencesPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="p-6">
        <p>Please sign in to view sequences.</p>
      </div>
    );
  }

  let initialTemplates: SequenceTemplate[] = [];
  try {
    initialTemplates = await SequenceTemplateService.list(userId);
  } catch (error) {
    console.error('Failed to preload sequences:', error);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Sequences</h1>
              <p className="text-sm text-gray-600 mt-1">
                Automate your outreach with email sequences
              </p>
            </div>
            <Link href="/dashboard/sequences/builder">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Sequence
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-6 py-4 bg-gray-50 border-b">
        <Suspense fallback={<MetricsSkeleton />}>
          <SequenceMetrics />
        </Suspense>
      </div>

      {/* Sequence List */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<ListSkeleton />}>
          <SequenceList initialTemplates={initialTemplates} />
        </Suspense>
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-4 rounded-lg">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="p-6">
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
