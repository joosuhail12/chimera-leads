'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SequenceSettings } from '@/lib/types/sequences';

interface TemplateSettingsProps {
  settings: SequenceSettings;
  onChange: (settings: SequenceSettings) => void;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

export function TemplateSettings({ settings, onChange }: TemplateSettingsProps) {
  const updateSetting = (key: keyof SequenceSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-sm mb-3">Sequence Settings</h3>

      {/* Pause Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="pauseOnReply" className="text-sm">
              Pause on Reply
            </Label>
            <p className="text-xs text-gray-500">
              Stop sequence when lead replies to any email
            </p>
          </div>
          <Switch
            id="pauseOnReply"
            checked={settings.pauseOnReply}
            onCheckedChange={(checked) => updateSetting('pauseOnReply', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="pauseOnMeeting" className="text-sm">
              Pause on Meeting
            </Label>
            <p className="text-xs text-gray-500">
              Stop sequence when a meeting is booked
            </p>
          </div>
          <Switch
            id="pauseOnMeeting"
            checked={settings.pauseOnMeeting}
            onCheckedChange={(checked) => updateSetting('pauseOnMeeting', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="skipWeekends" className="text-sm">
              Skip Weekends
            </Label>
            <p className="text-xs text-gray-500">
              Don't send emails on Saturdays and Sundays
            </p>
          </div>
          <Switch
            id="skipWeekends"
            checked={settings.skipWeekends}
            onCheckedChange={(checked) => updateSetting('skipWeekends', checked)}
          />
        </div>
      </div>

      {/* Daily Limit */}
      <div>
        <Label htmlFor="dailyLimit" className="text-sm">
          Daily Email Limit
        </Label>
        <Input
          id="dailyLimit"
          type="number"
          min="1"
          max="500"
          value={settings.dailyLimit}
          onChange={(e) => updateSetting('dailyLimit', parseInt(e.target.value) || 50)}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum emails to send per day from this sequence
        </p>
      </div>

      {/* Timezone */}
      <div>
        <Label htmlFor="timezone" className="text-sm">
          Timezone
        </Label>
        <Select
          value={settings.timezone}
          onValueChange={(value) => updateSetting('timezone', value)}
        >
          <SelectTrigger id="timezone" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Timezone for scheduling and time windows
        </p>
      </div>
    </div>
  );
}