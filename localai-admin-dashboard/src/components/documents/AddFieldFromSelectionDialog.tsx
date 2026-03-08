import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const VARIABLE_TYPES = [
  'text',
  'number',
  'date',
  'currency',
  'email',
  'phone',
  'address',
  'percentage',
] as const;

type VariableType = (typeof VARIABLE_TYPES)[number];

export interface NewFieldData {
  name: string;
  type: VariableType;
  description: string;
  extraction_hints: string[];
}

interface AddFieldFromSelectionDialogProps {
  selectedText: string;
  position: { x: number; y: number } | null;
  templateId: number;
  onAddField: (templateId: number, field: NewFieldData) => Promise<void>;
  onClose: () => void;
}

/** Suggest a variable name from selected text */
function suggestVariableName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
}

/** Guess variable type from text content */
function guessVariableType(text: string): VariableType {
  if (/^\$[\d,.]+$|^\d+[\d,.]*\s*(dollars?|usd)/i.test(text)) return 'currency';
  if (/^\d+(\.\d+)?%$/.test(text)) return 'percentage';
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text)) return 'date';
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return 'email';
  if (/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) return 'phone';
  if (/^\d+[\d,.]*$/.test(text.trim())) return 'number';
  return 'text';
}

export function AddFieldFromSelectionDialog({
  selectedText,
  position,
  templateId,
  onAddField,
  onClose,
}: AddFieldFromSelectionDialogProps) {
  const [name, setName] = useState(suggestVariableName(selectedText));
  const [type, setType] = useState<VariableType>(guessVariableType(selectedText));
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!position || !selectedText) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Variable name is required');
      return;
    }

    setIsSaving(true);
    try {
      await onAddField(templateId, {
        name: trimmedName,
        type,
        description: description.trim() || `Extracted from: "${selectedText.slice(0, 80)}"`,
        extraction_hints: [selectedText],
      });
      toast.success(`Field "${trimmedName}" added to template`);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to add field',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="absolute z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 8}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <Popover open onOpenChange={(open) => !open && onClose()}>
        <PopoverTrigger asChild>
          <span className="sr-only">Add field</span>
        </PopoverTrigger>
        <PopoverContent className="w-80" side="top" align="center">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Template Field
              </h4>
              <p className="text-xs text-muted-foreground truncate" title={selectedText}>
                Selected: &ldquo;{selectedText.slice(0, 60)}
                {selectedText.length > 60 ? '…' : ''}&rdquo;
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-name" className="text-xs">
                Variable Name
              </Label>
              <Input
                id="field-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. vendor_name"
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-type" className="text-xs">
                Type
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as VariableType)}>
                <SelectTrigger id="field-type" className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-desc" className="text-xs">
                Description (optional)
              </Label>
              <Textarea
                id="field-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this field represents..."
                className="h-16 text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Add Field
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
