'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Edit,
  Copy,
  Trash2,
  MoreVertical,
  Play,
  Pause,
  Users,
  Mail,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SequenceTemplate } from '@/lib/types/sequences';
import { cn } from '@/lib/utils/cn';

export function SequenceList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/sequences/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (templateId: string, templateName: string) => {
    const newName = prompt(`Enter name for cloned sequence:`, `Copy of ${templateName}`);
    if (!newName) return;

    try {
      const response = await fetch(`/api/sequences/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('Error cloning template:', error);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this sequence?')) return;

    try {
      const response = await fetch(`/api/sequences/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadTemplates();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete sequence');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleToggleActive = async (template: SequenceTemplate) => {
    try {
      const response = await fetch(`/api/sequences/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !template.is_active }),
      });

      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('Error toggling template status:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading sequences...</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No sequences yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first sequence to start automating outreach
          </p>
          <Link href="/dashboard/sequences/builder">
            <Button>Create Sequence</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <span
                      className={cn(
                        'px-2 py-1 text-xs rounded-full',
                        template.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {template.category && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        {template.category.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {template.description}
                    </p>
                  )}

                  {/* Metrics */}
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{template.total_enrolled || 0} enrolled</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>{template.avg_reply_rate?.toFixed(1) || 0}% reply rate</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <span>{template.avg_open_rate?.toFixed(1) || 0}% open rate</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{template.steps?.length || 0} steps</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(template)}
                  >
                    {template.is_active ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Activate
                      </>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/sequences/builder?id=${template.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleClone(template.id, template.name)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}