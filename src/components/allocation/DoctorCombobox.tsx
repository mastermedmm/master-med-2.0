import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Doctor {
  id: string;
  name: string;
  aliquota: number;
}

interface DoctorComboboxProps {
  doctors: Doctor[];
  value: string;
  onSelect: (doctorId: string) => void;
  placeholder?: string;
}

export function DoctorCombobox({
  doctors,
  value,
  onSelect,
  placeholder = 'Selecione...',
}: DoctorComboboxProps) {
  const [open, setOpen] = React.useState(false);
  
  const selectedDoctor = doctors.find((d) => d.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="truncate">
            {selectedDoctor
              ? `${selectedDoctor.name} (${selectedDoctor.aliquota}%)`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar médico..." className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
            <CommandGroup>
              {doctors.map((doctor) => (
                <CommandItem
                  key={doctor.id}
                  value={`${doctor.name} ${doctor.id}`}
                  onSelect={() => {
                    onSelect(doctor.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      'mr-2 h-3 w-3',
                      value === doctor.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{doctor.name}</span>
                  <span className="ml-auto text-muted-foreground">
                    ({doctor.aliquota}%)
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
