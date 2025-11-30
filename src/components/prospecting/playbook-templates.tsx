'use client';

import { useState } from 'react';
import {
  PlayCircle,
  Clock,
  Filter,
  Search,
  Settings,
  ChevronRight,
  Award,
  Target,
  Zap,
  Calendar,
  Users,
  TrendingUp,
  Copy,
  Edit,
  Eye,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { playbookTemplates, getTemplatesByCategory } from '@/lib/playbook-templates';
import { PlaybookTemplate } from '@/lib/types/playbook';

interface PlaybookTemplatesProps {
  onCreatePlaybook?: (template: PlaybookTemplate, variables: Record<string, any>) => void;
}

export function PlaybookTemplates({ onCreatePlaybook }: PlaybookTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<PlaybookTemplate | null>(null);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({});
  const { toast } = useToast();

  // Filter templates based on selection
  const filteredTemplates = playbookTemplates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesDifficulty && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'prospecting': return <Target className="h-4 w-4" />;
      case 'nurturing': return <Users className="h-4 w-4" />;
      case 'enrichment': return <Zap className="h-4 w-4" />;
      case 'scoring': return <Award className="h-4 w-4" />;
      default: return <PlayCircle className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'advanced': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleTemplateSelect = (template: PlaybookTemplate) => {
    setSelectedTemplate(template);

    // Initialize variables with defaults
    const initialVariables: Record<string, any> = {};
    template.variables?.forEach(variable => {
      initialVariables[variable.name] = variable.default;
    });
    setTemplateVariables(initialVariables);

    setShowCustomizeDialog(true);
  };

  const handleCreatePlaybook = () => {
    if (!selectedTemplate) return;

    // Validate required variables
    const missingRequired = selectedTemplate.variables?.filter(
      v => v.required && !templateVariables[v.name]
    );

    if (missingRequired && missingRequired.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill in: ${missingRequired.map(v => v.name).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    // Create playbook with customized variables
    if (onCreatePlaybook) {
      onCreatePlaybook(selectedTemplate, templateVariables);
    }

    toast({
      title: 'Playbook Created',
      description: `${selectedTemplate.name} has been created and is ready to use.`,
    });

    setShowCustomizeDialog(false);
    setSelectedTemplate(null);
  };

  const renderVariableInput = (variable: any) => {
    const value = templateVariables[variable.name];

    switch (variable.type) {
      case 'string':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setTemplateVariables({
              ...templateVariables,
              [variable.name]: e.target.value,
            })}
            placeholder={variable.description}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => setTemplateVariables({
              ...templateVariables,
              [variable.name]: parseInt(e.target.value),
            })}
            placeholder={variable.description}
          />
        );

      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => setTemplateVariables({
              ...templateVariables,
              [variable.name]: checked,
            })}
          />
        );

      case 'array':
        return (
          <Textarea
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => setTemplateVariables({
              ...templateVariables,
              [variable.name]: e.target.value.split(',').map(s => s.trim()),
            })}
            placeholder={`Enter comma-separated values: ${variable.description}`}
            rows={3}
          />
        );

      case 'object':
        return (
          <Textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setTemplateVariables({
                  ...templateVariables,
                  [variable.name]: parsed,
                });
              } catch {
                // Invalid JSON, don't update
              }
            }}
            placeholder={`JSON object: ${variable.description}`}
            rows={4}
            className="font-mono text-sm"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Playbook Templates
              </CardTitle>
              <CardDescription>
                Pre-built automation workflows for common prospecting scenarios
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="prospecting">Prospecting</SelectItem>
                <SelectItem value="nurturing">Nurturing</SelectItem>
                <SelectItem value="enrichment">Enrichment</SelectItem>
                <SelectItem value="scoring">Scoring</SelectItem>
              </SelectContent>
            </Select>

            {/* Difficulty Filter */}
            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => handleTemplateSelect(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryIcon(template.category)}
                        <span className="ml-1">{template.category}</span>
                      </Badge>
                      {template.difficulty && (
                        <Badge className={`text-xs ${getDifficultyColor(template.difficulty)}`}>
                          {template.difficulty}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {template.description}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {template.estimatedTime}
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {template.playbook.steps?.length ?? 0} steps
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <PlayCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-gray-600">
              Try adjusting your filters or search query
            </p>
          </CardContent>
        </Card>
      )}

      {/* Customize Dialog */}
      <Dialog open={showCustomizeDialog} onOpenChange={setShowCustomizeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  Customize {selectedTemplate.name}
                </DialogTitle>
                <DialogDescription>
                  Configure the playbook variables to match your needs
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Requirements */}
                {selectedTemplate.requirements && selectedTemplate.requirements.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2">Requirements</Label>
                    <div className="space-y-2">
                      {selectedTemplate.requirements.map((req, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variables */}
                {selectedTemplate.variables && selectedTemplate.variables.map((variable) => (
                  <div key={variable.name} className="space-y-2">
                    <Label>
                      {variable.name}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {variable.description && (
                      <p className="text-sm text-gray-600">{variable.description}</p>
                    )}
                    {renderVariableInput(variable)}
                  </div>
                ))}

                {/* Playbook Details */}
                <div>
                  <Label className="text-sm font-medium mb-2">Playbook Steps</Label>
                  <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                    {selectedTemplate.playbook.steps?.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">
                          {index + 1}
                        </div>
                        <span className="text-sm">{step.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCustomizeDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePlaybook}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Create Playbook
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}