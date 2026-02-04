import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { templateService } from '@/services/template-service';
import { useOrganization } from '@/context/organization-context';
import { NewTemplate } from "../types";
import { toast } from 'sonner';
//

interface CreateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Add other props like onTemplateCreated if needed
}

export function CreateTemplateModal({
  open,
  onOpenChange,
}: CreateTemplateModalProps) {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [templateContent, setTemplateContent] = useState("");

  const mutation = useMutation({
    mutationFn: (newTemplate: NewTemplate & { organization_id: string }) => {
      // Adapt to SmartTemplate requirements
      return templateService.createTemplate({
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        template_content: newTemplate.template_content || '',
        template_type: 'markdown',
        tags: [],
        is_public: false,
        smart_variables: [],
        extraction_rules: [],
        generation_settings: {},
        organization_id: newTemplate.organization_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      // The modal closing is now handled by the useEffect below
    },
    onError: (_error) => {
      // Here you could show a toast notification to the user
    },
  });

  // Effect to handle successful submission
  const { isSuccess, reset } = mutation;
  useEffect(() => {
    if (isSuccess) {
      onOpenChange(false);
      // Reset form
      setName("");
      setDescription("");
      setCategory("");
      setTemplateContent("");
      // Reset the mutation state to avoid re-triggering the effect
      reset();
    }
  }, [isSuccess, onOpenChange, reset]);

  const handleSubmit = () => {
    if (!activeOrganization) {
      toast.error('Please select an organization first');
      return;
    }

    const templateData: NewTemplate & { organization_id: string } = {
      name,
      description,
      category,
      template_content: templateContent,
      organization_id: activeOrganization.id,
    };
    mutation.mutate(templateData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new document template.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              className="col-span-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              className="col-span-3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              Category
            </Label>
            <Input
              id="category"
              className="col-span-3"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="template_content" className="text-right pt-2">
              Template Content
            </Label>
            <Textarea
              id="template_content"
              className="col-span-3 min-h-[200px]"
              placeholder="Enter your template content here. Use Markdown for formatting and {{variable_name}} for smart variables."
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
