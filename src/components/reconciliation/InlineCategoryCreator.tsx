import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Check, Loader2, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InlineCategoryCreatorProps {
  onCategoryCreated: (category: { id: string; name: string }) => void;
  onCancel: () => void;
}

export function InlineCategoryCreator({ onCategoryCreated, onCancel }: InlineCategoryCreatorProps) {
  const { tenantId } = useTenant();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }

    if (!tenantId) {
      toast.error("Erro de contexto");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          active: true,
        })
        .select("id, name")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Esta categoria já existe");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Categoria "${data.name}" criada`);
      onCategoryCreated(data);
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Erro ao criar categoria");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-2">
        <Label>Nova Categoria</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da categoria"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
        />
      </div>
      <Button
        size="sm"
        onClick={handleCreate}
        disabled={isCreating || !name.trim()}
      >
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface CategorySelectorWithCreateProps {
  categories: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  onCategoryCreated: (category: { id: string; name: string }) => void;
}

export function CategorySelectorWithCreate({
  categories,
  value,
  onChange,
  onCategoryCreated,
}: CategorySelectorWithCreateProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCategoryCreated = (category: { id: string; name: string }) => {
    onCategoryCreated(category);
    onChange(category.id);
    setIsCreating(false);
  };

  const selectedCategory = categories.find((cat) => cat.id === value);

  if (isCreating) {
    return (
      <InlineCategoryCreator
        onCategoryCreated={handleCategoryCreated}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Categoria *</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Nova
        </Button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selectedCategory?.name || "Selecione uma categoria"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar categoria..." />
            <CommandList>
              <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
              <CommandGroup>
                {categories.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    value={cat.name}
                    onSelect={() => {
                      onChange(cat.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === cat.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {cat.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
