import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Briefcase } from "lucide-react";
import * as api from "@/lib/api";

export function JobTemplatesSection() {
  const { toast } = useToast();
  const [jobTemplates, setJobTemplates] = useState<api.JobTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<api.JobTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    defaultTitle: "",
    defaultDescription: "",
    estimatedDuration: "",
    priority: "medium",
    category: "",
    isActive: "true"
  });

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    const data = await api.fetchJobTemplates();
    setJobTemplates(data);
    setTemplatesLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      defaultTitle: "",
      defaultDescription: "",
      estimatedDuration: "",
      priority: "medium",
      category: "",
      isActive: "true"
    });
    setEditingTemplate(null);
  };

  const handleEditTemplate = (template: api.JobTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      defaultTitle: template.defaultTitle,
      defaultDescription: template.defaultDescription || "",
      estimatedDuration: template.estimatedDuration?.toString() || "",
      priority: template.priority,
      category: template.category || "",
      isActive: template.isActive
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.defaultTitle) {
      toast({
        variant: "destructive",
        title: "Required Fields",
        description: "Name and Default Title are required"
      });
      return;
    }

    const templateData = {
      name: templateForm.name,
      description: templateForm.description || null,
      defaultTitle: templateForm.defaultTitle,
      defaultDescription: templateForm.defaultDescription || null,
      estimatedDuration: templateForm.estimatedDuration ? parseInt(templateForm.estimatedDuration) : null,
      priority: templateForm.priority,
      category: templateForm.category || null,
      isActive: templateForm.isActive
    };

    try {
      if (editingTemplate) {
        await api.updateJobTemplate(editingTemplate.id, templateData);
        toast({ title: "Template Updated", description: "Job template has been updated" });
      } else {
        await api.createJobTemplate(templateData);
        toast({ title: "Template Created", description: "New job template has been created" });
      }
      setTemplateDialogOpen(false);
      resetTemplateForm();
      loadTemplates();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${editingTemplate ? 'update' : 'create'} template`
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await api.deleteJobTemplate(id);
      toast({ title: "Template Deleted", description: "Job template has been deleted" });
      loadTemplates();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete template"
      });
    }
  };

  return (
    <Card id="templates" className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Job Templates
            </CardTitle>
            <CardDescription>Create templates for common job types</CardDescription>
          </div>
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetTemplateForm} data-testid="button-add-template">
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Job Template'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name *</Label>
                  <Input
                    id="template-name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Standard Roof Inspection"
                    data-testid="input-template-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-title">Default Job Title *</Label>
                  <Input
                    id="template-title"
                    value={templateForm.defaultTitle}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, defaultTitle: e.target.value }))}
                    placeholder="e.g., Roof Inspection"
                    data-testid="input-template-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-desc">Default Description</Label>
                  <Textarea
                    id="template-desc"
                    value={templateForm.defaultDescription}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, defaultDescription: e.target.value }))}
                    placeholder="Description that appears on new jobs"
                    data-testid="input-template-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-duration">Est. Duration (hrs)</Label>
                    <Input
                      id="template-duration"
                      type="number"
                      value={templateForm.estimatedDuration}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                      placeholder="e.g., 2"
                      data-testid="input-template-duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-priority">Priority</Label>
                    <select
                      id="template-priority"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={templateForm.priority}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, priority: e.target.value }))}
                      data-testid="select-template-priority"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Input
                    id="template-category"
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Inspection, Repair, Installation"
                    data-testid="input-template-category"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="template-active"
                    checked={templateForm.isActive === 'true'}
                    onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, isActive: checked ? 'true' : 'false' }))}
                    data-testid="checkbox-template-active"
                  />
                  <Label htmlFor="template-active">Active</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} data-testid="button-save-template">
                  {editingTemplate ? 'Update' : 'Create'} Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {templatesLoading ? (
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        ) : jobTemplates.length === 0 ? (
          <div className="text-center py-6">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No job templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create templates to quickly start common job types</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Default Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.defaultTitle}</TableCell>
                  <TableCell>{template.category || '-'}</TableCell>
                  <TableCell className="capitalize">{template.priority}</TableCell>
                  <TableCell>
                    <span className={template.isActive === 'true' ? 'text-green-600' : 'text-muted-foreground'}>
                      {template.isActive === 'true' ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditTemplate(template)} data-testid={`button-edit-template-${template.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template.id)} data-testid={`button-delete-template-${template.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
