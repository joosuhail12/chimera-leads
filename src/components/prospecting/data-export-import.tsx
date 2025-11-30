'use client';

import { useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  Cloud,
  Check,
  X,
  AlertCircle,
  Loader2,
  Database,
  Users,
  Building2,
  Filter,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { logProspectingEvent } from '@/lib/utils/prospecting-analytics';

interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  dataType: 'leads' | 'companies' | 'all';
  dateRange: 'all' | '7d' | '30d' | '90d' | 'custom';
  filters: {
    scoreMin?: number;
    scoreMax?: number;
    status?: string[];
    tags?: string[];
    sources?: string[];
  };
  fields: string[];
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

const defaultFields = {
  leads: [
    'name', 'email', 'title', 'company', 'phone', 'linkedin',
    'score', 'status', 'source', 'tags', 'created_at', 'updated_at'
  ],
  companies: [
    'name', 'domain', 'industry', 'size', 'revenue', 'location',
    'technologies', 'funding', 'description', 'created_at'
  ]
};

export function DataExportImport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    dataType: 'leads',
    dateRange: '30d',
    filters: {},
    fields: defaultFields.leads
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();
  const fireAnalyticsEvent = (event: string, payload?: Record<string, any>) => {
    logProspectingEvent(event, payload).catch(() => {});
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);

    try {
      const response = await fetch('/api/apollo/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportOptions)
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apollo-export-${exportOptions.dataType}-${new Date().toISOString().split('T')[0]}.${exportOptions.format}`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Data exported as ${exportOptions.format.toUpperCase()}`,
      });
      fireAnalyticsEvent('prospecting_export', {
        format: exportOptions.format,
        dataType: exportOptions.dataType,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Unable to export data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      previewFile(file);
    }
  };

  // Preview import file
  const previewFile = async (file: File) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const content = e.target?.result as string;
      let data: any[] = [];

      try {
        if (file.name.endsWith('.json')) {
          data = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          data = parseCSV(content);
        }

        setPreviewData(data.slice(0, 5)); // Preview first 5 rows

        // Auto-detect field mapping
        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          const mapping: Record<string, string> = {};

          headers.forEach(header => {
            const normalized = header.toLowerCase().replace(/\s+/g, '_');
            if (defaultFields.leads.includes(normalized) || defaultFields.companies.includes(normalized)) {
              mapping[header] = normalized;
            } else {
              mapping[header] = '';
            }
          });

          setFieldMapping(mapping);
          setShowMappingDialog(true);
        }
      } catch (error) {
        toast({
          title: 'Invalid File',
          description: 'Unable to parse file. Please check the format.',
          variant: 'destructive',
        });
      }
    };

    reader.readAsText(file);
  };

  // Parse CSV content
  const parseCSV = (content: string): any[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      data.push(row);
    }

    return data;
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportProgress(0);

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('mapping', JSON.stringify(fieldMapping));
    formData.append('dataType', exportOptions.dataType);

    try {
      const response = await fetch('/api/apollo/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Import failed');

      // Stream progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let finalResult: ImportResult | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.progress) {
                setImportProgress(data.progress);
              }
              if (data.result) {
                setImportResult(data.result);
                finalResult = data.result;
              }
            } catch {
              // Ignore non-JSON lines
            }
          }
        }
      }

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${importResult?.success || 0} records`,
      });
      fireAnalyticsEvent('prospecting_file_import', {
        dataType: exportOptions.dataType,
        success: finalResult?.success ?? 0,
        failed: finalResult?.failed ?? 0,
        duplicates: finalResult?.duplicates ?? 0,
      });
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: 'Unable to import data. Please check the file format.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setShowMappingDialog(false);
    }
  };

  // Export templates
  const exportTemplates = {
    leads: {
      name: 'Leads Template',
      description: 'Template for importing lead/contact data',
      fields: ['Name', 'Email', 'Title', 'Company', 'Phone', 'LinkedIn URL', 'Tags']
    },
    companies: {
      name: 'Companies Template',
      description: 'Template for importing company data',
      fields: ['Company Name', 'Domain', 'Industry', 'Employee Count', 'Revenue', 'Location']
    }
  };

  // Download template
  const downloadTemplate = (type: 'leads' | 'companies') => {
    const template = exportTemplates[type];
    const csv = template.fields.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Export & Import
          </CardTitle>
          <CardDescription>
            Export your prospecting data or import leads from external sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="export" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </TabsTrigger>
              <TabsTrigger value="import">
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </TabsTrigger>
            </TabsList>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Data Type */}
                <div>
                  <Label>Data Type</Label>
                  <Select
                    value={exportOptions.dataType}
                    onValueChange={(value: any) =>
                      setExportOptions({ ...exportOptions, dataType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Leads/Contacts
                        </div>
                      </SelectItem>
                      <SelectItem value="companies">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Companies
                        </div>
                      </SelectItem>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          All Data
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Format */}
                <div>
                  <Label>Export Format</Label>
                  <Select
                    value={exportOptions.format}
                    onValueChange={(value: any) =>
                      setExportOptions({ ...exportOptions, format: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CSV
                        </div>
                      </SelectItem>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          JSON
                        </div>
                      </SelectItem>
                      <SelectItem value="excel">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div>
                  <Label>Date Range</Label>
                  <Select
                    value={exportOptions.dateRange}
                    onValueChange={(value: any) =>
                      setExportOptions({ ...exportOptions, dateRange: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filters */}
                <div>
                  <Label>Score Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={exportOptions.filters.scoreMin || ''}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          filters: {
                            ...exportOptions.filters,
                            scoreMin: parseInt(e.target.value)
                          }
                        })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={exportOptions.filters.scoreMax || ''}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          filters: {
                            ...exportOptions.filters,
                            scoreMax: parseInt(e.target.value)
                          }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Field Selection */}
              <div>
                <Label>Fields to Export</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {(exportOptions.dataType === 'leads' ? defaultFields.leads : defaultFields.companies).map(field => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={exportOptions.fields.includes(field)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setExportOptions({
                              ...exportOptions,
                              fields: [...exportOptions.fields, field]
                            });
                          } else {
                            setExportOptions({
                              ...exportOptions,
                              fields: exportOptions.fields.filter(f => f !== field)
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Export Button */}
              <Button
                onClick={handleExport}
                disabled={isExporting || exportOptions.fields.length === 0}
                className="w-full"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-4">
              {/* Templates */}
              <div>
                <Label>Download Templates</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {Object.entries(exportTemplates).map(([key, template]) => (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => downloadTemplate(key as 'leads' | 'companies')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* File Upload */}
              <div>
                <Label>Upload File</Label>
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">CSV, JSON or Excel files</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.json,.xlsx,.xls"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>

              {/* File Info */}
              {importFile && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-medium">{importFile.name}</p>
                        <p className="text-sm text-gray-600">
                          {(importFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImportFile(null);
                        setPreviewData([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Import Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-xl font-bold">{importResult.total}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Success</p>
                      <p className="text-xl font-bold text-green-600">{importResult.success}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-xl font-bold text-red-600">{importResult.failed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Duplicates</p>
                      <p className="text-xl font-bold text-yellow-600">{importResult.duplicates}</p>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="text-xs text-gray-600">
                            Row {error.row}: {error.field} - {error.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Field Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Map Import Fields</DialogTitle>
            <DialogDescription>
              Map your file columns to the correct database fields
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(fieldMapping).map(([source, target]) => (
              <div key={source} className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm">{source}</Label>
                  {previewData.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Sample: {previewData[0][source]}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <Select
                    value={target}
                    onValueChange={(value) =>
                      setFieldMapping({ ...fieldMapping, [source]: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Skip this field</SelectItem>
                      {(exportOptions.dataType === 'leads' ? defaultFields.leads : defaultFields.companies).map(field => (
                        <SelectItem key={field} value={field}>
                          {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Start Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
