import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export interface LineItemBase {
  id: string;
  description: string;
  qty: number | string;
  unitCost: number | string;
  total: number;
  section?: string | null;
}

export interface MobileLineItemCardProps<T extends LineItemBase> {
  item: T;
  index: number;
  sections?: string[];
  showSection?: boolean;
  onUpdateDescription: (value: string) => void;
  onUpdateQty: (value: number | string) => void;
  onUpdateUnitCost: (value: number | string) => void;
  onUpdateSection?: (value: string | null) => void;
  onBlurQty: () => void;
  onBlurUnitCost: () => void;
  onRemove: () => void;
}

export function MobileLineItemCard<T extends LineItemBase>({
  item,
  index,
  sections = [],
  showSection = true,
  onUpdateDescription,
  onUpdateQty,
  onUpdateUnitCost,
  onUpdateSection,
  onBlurQty,
  onBlurUnitCost,
  onRemove,
}: MobileLineItemCardProps<T>) {
  return (
    <div className="relative border rounded-lg shadow-sm p-4 bg-card" data-testid={`mobile-line-item-${index}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="absolute top-2 right-2 h-10 w-10 min-h-[44px] min-w-[44px]"
        data-testid={`button-remove-item-mobile-${index}`}
      >
        <Trash2 className="h-5 w-5 text-red-500" />
      </Button>

      <div className="space-y-4 pr-10">
        <div>
          <Label className="text-sm text-muted-foreground mb-1.5 block">Description</Label>
          <Textarea
            value={item.description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            placeholder="Item description"
            rows={3}
            className="w-full min-h-[88px] resize-none"
            data-testid={`input-item-desc-mobile-${index}`}
          />
        </div>

        {showSection && sections.length > 0 && onUpdateSection && (
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Section</Label>
            <Select
              value={item.section || "none"}
              onValueChange={(value) => onUpdateSection(value === "none" ? null : value)}
            >
              <SelectTrigger className="w-full min-h-[44px]" data-testid={`select-item-section-mobile-${index}`}>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">General</span>
                </SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Qty</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={item.qty}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || val === '-' || val === '-.') {
                  onUpdateQty(val);
                  return;
                }
                if (/^-?\d*\.?\d*$/.test(val)) {
                  const num = parseFloat(val);
                  onUpdateQty(isNaN(num) ? val : num);
                }
              }}
              onBlur={onBlurQty}
              className="w-full min-h-[44px]"
              data-testid={`input-item-qty-mobile-${index}`}
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Unit Cost</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={item.unitCost}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || val === '-' || val === '-.') {
                  onUpdateUnitCost(val);
                  return;
                }
                if (/^-?\d*\.?\d*$/.test(val)) {
                  const num = parseFloat(val);
                  onUpdateUnitCost(isNaN(num) ? val : num);
                }
              }}
              onBlur={onBlurUnitCost}
              className="w-full min-h-[44px]"
              data-testid={`input-item-cost-mobile-${index}`}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <div className="bg-muted/50 rounded-full px-4 py-2">
            <span className="text-sm text-muted-foreground mr-2">Total:</span>
            <span className="font-semibold text-lg">${item.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
