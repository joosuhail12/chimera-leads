'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Mail,
  TrendingUp,
  MessageSquare,
  Calendar,
  Activity,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { SequenceMetrics as MetricsType } from '@/lib/types/sequences';

export function SequenceMetrics() {
  const [metrics, setMetrics] = useState<MetricsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/sequences/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const metricCards = [
    {
      label: 'Active Sequences',
      value: metrics.total_sequences,
      icon: Activity,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Active Enrollments',
      value: metrics.active_enrollments,
      icon: Users,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Avg Reply Rate',
      value: `${metrics.average_reply_rate.toFixed(1)}%`,
      icon: MessageSquare,
      color: 'text-purple-600 bg-purple-100',
    },
    {
      label: 'Meetings Booked',
      value: metrics.total_meetings_booked,
      icon: Calendar,
      color: 'text-orange-600 bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricCards.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

function MetricCard({ label, value, icon: Icon, color }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}