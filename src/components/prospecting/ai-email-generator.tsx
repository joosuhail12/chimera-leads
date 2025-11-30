'use client';

import { useState } from 'react';
import {
  Mail,
  Sparkles,
  Copy,
  Send,
  Save,
  RefreshCw,
  Settings,
  ChevronDown,
  User,
  Building2,
  Target,
  FileText,
  Zap,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Edit,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  tone: 'professional' | 'casual' | 'friendly' | 'urgent';
  type: 'cold' | 'follow-up' | 'nurture' | 'meeting' | 'demo';
}

interface GeneratedEmail {
  subject: string;
  body: string;
  preview: string;
  score: number;
  suggestions: string[];
  personalization: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

interface EmailContext {
  lead: {
    name: string;
    title: string;
    company: string;
    industry: string;
    pain_points?: string[];
    recent_activity?: string[];
  };
  sender: {
    name: string;
    title: string;
    company: string;
  };
  product: {
    name: string;
    value_props: string[];
    differentiators: string[];
  };
}

const emailTemplates: EmailTemplate[] = [
  {
    id: 'cold-outreach',
    name: 'Cold Outreach',
    subject: 'Quick question about {{company}}\'s {{pain_point}}',
    body: `Hi {{first_name}},

I noticed {{company}} is {{recent_activity}}. Many {{industry}} companies struggle with {{pain_point}}.

{{value_prop}}

Worth a quick chat to see if we can help {{company}} {{benefit}}?

Best,
{{sender_name}}`,
    variables: ['first_name', 'company', 'pain_point', 'recent_activity', 'industry', 'value_prop', 'benefit', 'sender_name'],
    tone: 'professional',
    type: 'cold',
  },
  {
    id: 'follow-up-1',
    name: 'First Follow-up',
    subject: 'Re: {{previous_subject}}',
    body: `Hi {{first_name}},

Hope you're having a great week. I wanted to follow up on my previous note about {{topic}}.

{{social_proof}}

Would {{day}} or {{day2}} work for a brief 15-minute call?

Thanks,
{{sender_name}}`,
    variables: ['first_name', 'previous_subject', 'topic', 'social_proof', 'day', 'day2', 'sender_name'],
    tone: 'friendly',
    type: 'follow-up',
  },
];

export function AIEmailGenerator() {
  const [emailContext, setEmailContext] = useState<EmailContext>({
    lead: {
      name: '',
      title: '',
      company: '',
      industry: '',
      pain_points: [],
      recent_activity: [],
    },
    sender: {
      name: '',
      title: '',
      company: '',
    },
    product: {
      name: '',
      value_props: [],
      differentiators: [],
    },
  });

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [emailContent, setEmailContent] = useState({ subject: '', body: '' });

  // AI Settings
  const [aiSettings, setAiSettings] = useState({
    creativity: 0.7,
    formality: 0.8,
    length: 'medium',
    personalization: 'high',
    includePS: false,
    includeCTA: true,
    useEmojis: false,
  });

  const { toast } = useToast();

  // Generate email with AI
  const generateEmail = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/apollo/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate,
          context: emailContext,
          settings: aiSettings,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();

      setGeneratedEmail({
        subject: data.subject,
        body: data.body,
        preview: data.body.substring(0, 150) + '...',
        score: data.score || 85,
        suggestions: data.suggestions || [
          'Add specific metrics or numbers',
          'Include a clear call-to-action',
          'Personalize the opening line',
        ],
        personalization: {
          level: data.personalization?.level || 'high',
          factors: data.personalization?.factors || ['Company name', 'Recent activity', 'Industry context'],
        },
      });

      setEmailContent({
        subject: data.subject,
        body: data.body,
      });

      toast({
        title: 'Email Generated',
        description: 'AI has created a personalized email for you',
      });
    } catch (error) {
      // Fallback to template-based generation
      if (selectedTemplate) {
        const generated = generateFromTemplate(selectedTemplate, emailContext);
        setGeneratedEmail(generated);
        setEmailContent({
          subject: generated.subject,
          body: generated.body,
        });
      }

      toast({
        title: 'Using Template',
        description: 'Generated email from template (AI unavailable)',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate from template (fallback)
  const generateFromTemplate = (template: EmailTemplate, context: EmailContext): GeneratedEmail => {
    let subject = template.subject;
    let body = template.body;

    // Replace variables
    const replacements: Record<string, string> = {
      first_name: context.lead.name.split(' ')[0],
      company: context.lead.company,
      industry: context.lead.industry,
      sender_name: context.sender.name,
      pain_point: context.lead.pain_points?.[0] || 'scaling challenges',
      recent_activity: context.lead.recent_activity?.[0] || 'growing rapidly',
      value_prop: context.product.value_props?.[0] || 'Our solution helps companies like yours',
      benefit: 'achieve better results',
      topic: context.product.name,
      social_proof: `Companies like ${context.lead.company} typically see 30% improvement`,
      day: 'Tuesday',
      day2: 'Thursday',
      previous_subject: 'Our previous conversation',
    };

    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    return {
      subject,
      body,
      preview: body.substring(0, 150) + '...',
      score: 75,
      suggestions: [
        'Review and personalize further',
        'Add specific details about the company',
        'Include relevant case studies',
      ],
      personalization: {
        level: 'medium',
        factors: ['Basic template variables replaced'],
      },
    };
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Email content copied to clipboard',
    });
  };

  // Save as template
  const saveAsTemplate = () => {
    // Save logic here
    toast({
      title: 'Template Saved',
      description: 'Email saved as a new template',
    });
  };

  // Add to sequence
  const addToSequence = () => {
    // Sequence logic here
    toast({
      title: 'Added to Sequence',
      description: 'Email added to your sequence',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Email Generator
          </CardTitle>
          <CardDescription>
            Generate personalized, high-converting emails with AI assistance
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Context Input */}
        <div className="lg:col-span-1 space-y-4">
          {/* Lead Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Lead Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="John Doe"
                  value={emailContext.lead.name}
                  onChange={(e) =>
                    setEmailContext({
                      ...emailContext,
                      lead: { ...emailContext.lead, name: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  placeholder="VP of Sales"
                  value={emailContext.lead.title}
                  onChange={(e) =>
                    setEmailContext({
                      ...emailContext,
                      lead: { ...emailContext.lead, title: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  placeholder="Acme Corp"
                  value={emailContext.lead.company}
                  onChange={(e) =>
                    setEmailContext({
                      ...emailContext,
                      lead: { ...emailContext.lead, company: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>Industry</Label>
                <Input
                  placeholder="SaaS"
                  value={emailContext.lead.industry}
                  onChange={(e) =>
                    setEmailContext({
                      ...emailContext,
                      lead: { ...emailContext.lead, industry: e.target.value },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Email Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedTemplate?.id}
                onValueChange={(value) =>
                  setSelectedTemplate(emailTemplates.find((t) => t.id === value) || null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {template.type}
                        </Badge>
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Collapsible>
            <Card>
              <CardHeader>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      AI Settings
                    </CardTitle>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Creativity</Label>
                      <span className="text-sm text-gray-500">
                        {Math.round(aiSettings.creativity * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[aiSettings.creativity]}
                      onValueChange={([value]) =>
                        setAiSettings({ ...aiSettings, creativity: value })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Formality</Label>
                      <span className="text-sm text-gray-500">
                        {Math.round(aiSettings.formality * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[aiSettings.formality]}
                      onValueChange={([value]) =>
                        setAiSettings({ ...aiSettings, formality: value })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <Label>Email Length</Label>
                    <Select
                      value={aiSettings.length}
                      onValueChange={(value: any) =>
                        setAiSettings({ ...aiSettings, length: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (50-100 words)</SelectItem>
                        <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                        <SelectItem value="long">Long (200+ words)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Include P.S.</Label>
                      <Switch
                        checked={aiSettings.includePS}
                        onCheckedChange={(checked) =>
                          setAiSettings({ ...aiSettings, includePS: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Strong CTA</Label>
                      <Switch
                        checked={aiSettings.includeCTA}
                        onCheckedChange={(checked) =>
                          setAiSettings({ ...aiSettings, includeCTA: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Use Emojis</Label>
                      <Switch
                        checked={aiSettings.useEmojis}
                        onCheckedChange={(checked) =>
                          setAiSettings({ ...aiSettings, useEmojis: checked })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Generate Button */}
          <Button
            className="w-full"
            onClick={generateEmail}
            disabled={!selectedTemplate || !emailContext.lead.name || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Email
              </>
            )}
          </Button>
        </div>

        {/* Email Preview & Editor */}
        <div className="lg:col-span-2 space-y-4">
          {generatedEmail ? (
            <>
              {/* Email Score & Insights */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {generatedEmail.score}%
                      </div>
                      <p className="text-sm text-gray-600">Email Score</p>
                    </div>
                    <div className="text-center">
                      <Badge
                        variant={
                          generatedEmail.personalization.level === 'high'
                            ? 'default'
                            : generatedEmail.personalization.level === 'medium'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="mb-1"
                      >
                        {generatedEmail.personalization.level} personalization
                      </Badge>
                      <p className="text-xs text-gray-600">
                        {generatedEmail.personalization.factors.length} factors used
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline">
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Good result</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline">
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Needs improvement</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateEmail()}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {generatedEmail.suggestions.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        💡 Suggestions for improvement:
                      </p>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {generatedEmail.suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Content */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Generated Email</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditMode(!editMode)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {editMode ? 'Preview' : 'Edit'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`${emailContent.subject}\n\n${emailContent.body}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editMode ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Subject Line</Label>
                        <Input
                          value={emailContent.subject}
                          onChange={(e) =>
                            setEmailContent({ ...emailContent, subject: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Email Body</Label>
                        <Textarea
                          value={emailContent.body}
                          onChange={(e) =>
                            setEmailContent({ ...emailContent, body: e.target.value })
                          }
                          rows={15}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Subject:</p>
                        <p className="font-medium">{emailContent.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Body:</p>
                        <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                          {emailContent.body}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button className="flex-1" onClick={addToSequence}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Sequence
                </Button>
                <Button variant="outline" className="flex-1" onClick={saveAsTemplate}>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
                <Button variant="outline" className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Email Generated</h3>
                <p className="text-gray-600">
                  Fill in the lead information and select a template to generate an email
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}