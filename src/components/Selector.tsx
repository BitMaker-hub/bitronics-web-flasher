import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SelectorProps = {
  onValueChange: (value: string) => void;
  disabled?: boolean;
  values?: string[];
  placeholder?: string;
  value?: string;
  /** Versions are data: the brand sets those in M PLUS 1 Code. */
  mono?: boolean;
  /** The list arrives newest first, so the first entry is the one to pick. */
  markFirstAsLatest?: boolean;
};

export default function BoardVersionSelector({
  onValueChange,
  disabled,
  placeholder = '',
  values = [],
  value,
  mono = false,
  markFirstAsLatest = false,
}: SelectorProps) {
  return (
    <Select 
      onValueChange={onValueChange} 
      disabled={disabled} 
      value={value || undefined}
      key={value || 'empty'}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {values.map((val, index) => (
          <SelectItem key={val} value={val}>
            <span className={mono ? 'font-data' : undefined}>{val}</span>
            {markFirstAsLatest && index === 0 && (
              <span className="ml-2 rounded bg-bitronics px-1.5 py-0.5 text-[10px] font-semibold text-[#4A4200] align-middle">
                Latest
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
