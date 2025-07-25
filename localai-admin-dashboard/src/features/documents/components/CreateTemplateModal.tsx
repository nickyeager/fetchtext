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
import { DocumentTemplateService } from "../services/template-service";
import { NewTemplate } from "../types";

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [templateContent, setTemplateContent] = useState("");

  const mutation = useMutation({
    mutationFn: (newTemplate: NewTemplate) =>
      DocumentTemplateService.createTemplate(newTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      // The modal closing is now handled by the useEffect below
    },
    onError: (error) => {
      console.error("Failed to create template:", error);
      // Here you could show a toast notification to the user
    },
  });

  // Effect to handle successful submission
  useEffect(() => {
    if (mutation.isSuccess) {
      onOpenChange(false);
      // Reset form
      setName("");
      setDescription("");
      setCategory("");
      setTemplateContent("");
      // Reset the mutation state to avoid re-triggering the effect
      mutation.reset();
    }
  }, [mutation.isSuccess, onOpenChange, mutation]);

  const handleSubmit = () => {
    const templateData: NewTemplate = {
      name,
      description,
      category,
      template_content: templateContent,
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
