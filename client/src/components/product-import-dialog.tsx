import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertCircle, Check } from "lucide-react";
import { importItemsCSV, type ColumnMapping } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MappableField = "itemCode" | "description" | "sellPrice" | "costPrice" | "category" | "unit" | "supplierName";

const FIELD_OPTIONS: { value: MappableField; label: string; required: boolean }[] = [
  { value: "itemCode", label: "Item Code", required: true },
  { value: "description", label: "Description", required: true },
  { value: "sellPrice", label: "Sell Price", required: false },
  { value: "costPrice", label: "Cost Price", required: false },
  { value: "category", label: "Category", required: false },
  { value: "unit", label: "Unit", required: false },
  { value: "supplierName", label: "Supplier Name", required: false },
];

export function ProductImportDialog({ open, onOpenChange }: ProductImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<MappableField, number | undefined>>({
    itemCode: undefined,
    description: undefined,
    sellPrice: undefined,
    costPrice: undefined,
    category: undefined,
    unit: undefined,
    supplierName: undefined,
  });
  const [fileName, setFileName] = useState<string>("");
  const [defaultMarkup, setDefaultMarkup] = useState<string>("30"); // Default 30% markup

  const parseCSVLine = useCallback((line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "File must have at least a header and one data row", variant: "destructive" });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const data = lines.slice(1).map(line => parseCSVLine(line));
      
      setCsvHeaders(headers);
      setCsvData(data);
      
      const autoMapping: Record<MappableField, number | undefined> = {
        itemCode: undefined,
        description: undefined,
        sellPrice: undefined,
        costPrice: undefined,
        category: undefined,
        unit: undefined,
        supplierName: undefined,
      };
      
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes("item") && lowerHeader.includes("code")) autoMapping.itemCode = index;
        else if (lowerHeader === "description" || lowerHeader === "desc") autoMapping.description = index;
        else if (lowerHeader.includes("sell") || lowerHeader.includes("price")) {
          if (autoMapping.sellPrice === undefined) autoMapping.sellPrice = index;
        }
        else if (lowerHeader.includes("cost") || lowerHeader.includes("buy")) autoMapping.costPrice = index;
        else if (lowerHeader === "category") autoMapping.category = index;
        else if (lowerHeader.includes("unit")) autoMapping.unit = index;
        else if (lowerHeader.includes("supplier")) autoMapping.supplierName = index;
      });
      
      setColumnMapping(autoMapping);
    };
    reader.readAsText(file);
    event.target.value = "";
  }, [parseCSVLine, toast]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const mapping: ColumnMapping = {};
      if (columnMapping.itemCode !== undefined) mapping.itemCode = columnMapping.itemCode;
      if (columnMapping.description !== undefined) mapping.description = columnMapping.description;
      if (columnMapping.sellPrice !== undefined) mapping.sellPrice = columnMapping.sellPrice;
      if (columnMapping.costPrice !== undefined) mapping.costPrice = columnMapping.costPrice;
      if (columnMapping.category !== undefined) mapping.category = columnMapping.category;
      if (columnMapping.unit !== undefined) mapping.unit = columnMapping.unit;
      if (columnMapping.supplierName !== undefined) mapping.supplierName = columnMapping.supplierName;
      
      const markup = parseFloat(defaultMarkup) || 0;
      return importItemsCSV(csvData, mapping, markup);
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.invalidateQueries({ queryKey: ["items"] });
        toast({ 
          title: "Import Complete", 
          description: `Successfully imported ${result.created} of ${result.total} products${result.errors?.length ? ` (${result.errors.length} errors)` : ''}` 
        });
        handleReset();
        onOpenChange(false);
      } else {
        toast({ title: "Import Failed", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Import Failed", variant: "destructive" });
    }
  });

  const handleReset = () => {
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({
      itemCode: undefined,
      description: undefined,
      sellPrice: undefined,
      costPrice: undefined,
      category: undefined,
      unit: undefined,
      supplierName: undefined,
    });
    setFileName("");
    setDefaultMarkup("30");
  };

  const handleMappingChange = (field: MappableField, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === "none" ? undefined : parseInt(value, 10)
    }));
  };

  const isValid = columnMapping.itemCode !== undefined && columnMapping.description !== undefined;
  const previewRows = csvData.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleReset();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {csvHeaders.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-lg font-medium block mb-2">Upload CSV File</span>
                <span className="text-sm text-muted-foreground">Click to select your Apex price list or drag and drop</span>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-csv-upload"
              />
              <Button variant="outline" className="mt-4" onClick={() => document.getElementById("csv-upload")?.click()} data-testid="button-select-file">
                <FileText className="h-4 w-4 mr-2" />
                Select File
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="secondary">{csvData.length} rows</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-change-file">
                  Change File
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="defaultMarkup" className="font-medium">Default Markup %</Label>
                    <p className="text-xs text-muted-foreground">Applied to products with cost but no sell price</p>
                  </div>
                  <Input
                    id="defaultMarkup"
                    type="number"
                    value={defaultMarkup}
                    onChange={(e) => setDefaultMarkup(e.target.value)}
                    className="w-24"
                    min="0"
                    max="500"
                    data-testid="input-default-markup"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Column Mapping</h3>
                <p className="text-sm text-muted-foreground">
                  Map your CSV columns to product fields. Required fields are marked with *.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {FIELD_OPTIONS.map(({ value, label, required }) => (
                    <div key={value} className="space-y-2">
                      <Label className="flex items-center gap-1">
                        {label}
                        {required && <span className="text-destructive">*</span>}
                        {columnMapping[value] !== undefined && (
                          <Check className="h-3 w-3 text-green-600 ml-1" />
                        )}
                      </Label>
                      <Select
                        value={columnMapping[value]?.toString() ?? "none"}
                        onValueChange={(val) => handleMappingChange(value, val)}
                        data-testid={`select-mapping-${value}`}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Not mapped --</SelectItem>
                          {csvHeaders.map((header, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Preview (First 5 rows)</h3>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map((header, index) => (
                          <TableHead key={index} className="whitespace-nowrap">
                            {header}
                            {Object.entries(columnMapping).some(([_, v]) => v === index) && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {FIELD_OPTIONS.find(f => columnMapping[f.value as MappableField] === index)?.label}
                              </Badge>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} className="whitespace-nowrap max-w-[200px] truncate">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {!isValid && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">Please map both Item Code and Description columns to continue</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-import">
            Cancel
          </Button>
          <Button 
            onClick={() => importMutation.mutate()} 
            disabled={!isValid || importMutation.isPending}
            data-testid="button-import-products"
          >
            {importMutation.isPending ? "Importing..." : `Import ${csvData.length} Products`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
