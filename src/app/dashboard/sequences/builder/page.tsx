/**
 * Sequence Builder Page
 * Create or edit email sequences with drag-and-drop
 */

import { Suspense } from 'react';
import { SequenceBuilderWrapper } from './builder-wrapper';

export const metadata = {
  title: 'Sequence Builder | Chimera',
  description: 'Build automated email sequences',
};

interface PageProps {
  searchParams: Promise<{
    id?: string;
  }>;
}

export default async function SequenceBuilderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const templateId = params.id;

  return (
    <div className="h-full flex flex-col">
      <Suspense fallback={<BuilderSkeleton />}>
        <SequenceBuilderWrapper templateId={templateId} />
      </Suspense>
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div className="flex-1 p-6">
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}