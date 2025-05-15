
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
// The AG Charts CSS imports below consistently cause "Module not found" errors.
// This indicates that the build process cannot locate these CSS files within the ag-charts-community package.
// AG Charts styling might be affected until this is resolved.
// import 'ag-charts-community/styles/ag-charts-community.css'; 
// import 'ag-charts-community/styles/ag-theme-alpine.css'; 
// import 'ag-charts-community/styles/ag-theme-alpine-dark.css'; 
import { Label } from "@/components/ui/label";
import { FileText, Type, Hash, CalendarDays, ToggleLeft, Loader2, ChevronDown, ChevronRight, DatabaseZap, Brackets } from "lucide-react";
import { Logo } from "@/components/icons/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger as AccordionPrimitiveTrigger } from "@/components/ui/accordion";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { DataSourceModal } from '@/components/data-source-modal';
import { ChartVisualization } from '@/components/chart-visualization'; // Import the new component
import { cn } from "@/lib/utils";

interface FieldDefinition {
  key: string; 
  name: string; 
  path: string; 
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'unknown';
  isParent: boolean;
  children?: FieldDefinition[];
}

const getFieldTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'string':
      return <Type className="h-4 w-4 text-muted-foreground" />;
    case 'number':
      return <Hash className="h-4 w-4 text-muted-foreground" />;
    case 'date':
      return <CalendarDays className="h-4 w-4 text-muted-foreground" />;
    case 'boolean':
      return <ToggleLeft className="h-4 w-4 text-muted-foreground" />;
    case 'object':
      return <Brackets className="h-4 w-4 text-muted-foreground" />;
    case 'array':
      return <Brackets className="h-4 w-4 text-muted-foreground" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />; 
  }
};

const AppHeader = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="mx-auto flex h-16 items-center px-4 sm:justify-between sm:space-x-0">
      <div className="flex gap-2 items-center">
        <Logo className="h-6 w-6 text-primary" data-ai-hint="database logo" />
        <h1 className="text-xl font-semibold text-foreground">CSV Atlas Uploader</h1>
      </div>
      <ThemeToggleButton />
    </div>
  </header>
);

const RenderFieldItem: React.FC<{
  field: FieldDefinition;
  selectedFields: string[];
  onFieldSelect: (path: string) => void;
  expandedFields: Set<string>;
  onToggleExpand: (path: string) => void;
  depth: number;
  currentXAxisField: string | null;
  currentYAxisField: string | null;
  onDragStartAxis: (field: string, origin: 'x' | 'y') => void; // For dragging to axis
}> = ({ field, selectedFields, onFieldSelect, expandedFields, onToggleExpand, depth, currentXAxisField, currentYAxisField, onDragStartAxis }) => {
  const isExpanded = expandedFields.has(field.path);

  if (field.isParent) {
    return (
      <div style={{ paddingLeft: `${depth * 1.5}rem` }}>
        <div 
          className="flex items-center space-x-2 py-1.5 px-1 rounded-md hover:bg-accent transition-colors cursor-pointer"
          onClick={() => onToggleExpand(field.path)}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {getFieldTypeIcon(field.type)}
          <Label
            className="text-sm font-medium leading-none truncate cursor-pointer flex-grow text-foreground"
            title={field.name}
          >
            {field.name}
          </Label>
        </div>
        {isExpanded && field.children && field.children.length > 0 && (
          <div className="mt-1">
            {field.children.map(child => (
              <RenderFieldItem
                key={child.key}
                field={child}
                selectedFields={selectedFields}
                onFieldSelect={onFieldSelect}
                expandedFields={expandedFields}
                onToggleExpand={onToggleExpand}
                depth={depth + 1}
                currentXAxisField={currentXAxisField}
                currentYAxisField={currentYAxisField}
                onDragStartAxis={onDragStartAxis}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node
  return (
    <div 
      key={field.key} 
      className="flex items-center space-x-2 py-1.5 px-1 rounded-md hover:bg-accent transition-colors"
      style={{ paddingLeft: `${depth * 1.5}rem` }}
      draggable={selectedFields.includes(field.path)}
      onDragStart={() => {
          if (selectedFields.includes(field.path)) {
            // Determine if this field is currently an axis field to set origin correctly
            const origin = currentXAxisField === field.path ? 'x' : (currentYAxisField === field.path ? 'y' : 'x');
            onDragStartAxis(field.path, origin);
          }
        }
      }
    >
      <Checkbox
        id={`checkbox-${field.path}`}
        checked={selectedFields.includes(field.path)}
        onCheckedChange={() => onFieldSelect(field.path)}
        aria-label={`Select field ${field.name}`}
      />
      {getFieldTypeIcon(field.type)}
      <Label
        htmlFor={`checkbox-${field.path}`}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate cursor-pointer flex-grow text-foreground"
        title={field.name}
      >
        {field.name}
      </Label>
    </div>
  );
};


export default function Home() {
  const [dataSourceName, setDataSourceName] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [headerTypes, setHeaderTypes] = useState<Record<string, string>>({});
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  
  const [chartType, setChartType] = useState<string>('bar');
  const [currentXAxisField, setXAxisFieldInternal] = useState<string | null>(null);
  const [currentYAxisField, setYAxisFieldInternal] = useState<string | null>(null);

  const [rowCount, setRowCount] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [processedFieldStructure, setProcessedFieldStructure] = useState<FieldDefinition[]>([]);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // This state will be passed to ChartVisualization for its internal drag start
  const [draggedAxisItem, setDraggedAxisItem] = useState<{ field: string; origin: 'x' | 'y' } | null>(null);

  const handleDragStartForAxis = (field: string, origin: 'x' | 'y') => {
    if (!selectedFields.includes(field)) return; 
    setDraggedAxisItem({ field, origin });
  };


  const handleToggleExpand = (path: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };
  
  const buildFieldTree = (flatHeaders: string[], types: Record<string, string>): FieldDefinition[] => {
    const tree: FieldDefinition[] = [];
    const map: Record<string, FieldDefinition> = {};
  
    flatHeaders.forEach(fullPath => {
      const parts = fullPath.split('.');
      let currentPath = '';
  
      parts.forEach((part, index) => {
        const isLastNamePart = index === parts.length - 1;
        const oldPath = currentPath;
        currentPath = currentPath ? `${currentPath}.${part}` : part;
  
        let node = map[currentPath];
  
        if (!node) {
          const fieldType = isLastNamePart ? (types[fullPath] || 'unknown') : 
                            ( /^\d+$/.test(parts[index+1]) ? 'array' : 'object'); // Basic inference
          
          node = {
            key: currentPath, // Use full path as key for uniqueness
            name: part,
            path: currentPath, // Store full path
            type: fieldType as FieldDefinition['type'],
            isParent: !isLastNamePart,
            children: isLastNamePart ? undefined : [],
          };
          map[currentPath] = node;
  
          if (index === 0) { // Root level
            tree.push(node);
          } else { // Nested level
            const parentPath = oldPath;
            if (map[parentPath] && map[parentPath].children) {
              map[parentPath].children!.push(node);
            }
          }
        } else if (!isLastNamePart && !node.children) { 
            node.children = [];
            node.isParent = true;
            node.type = /^\d+$/.test(parts[index+1]) ? 'array' : 'object';
        }
      });
    });
    return tree;
  };


  const handleDataSourceConnected = (data: any[], headers: string[], fileName: string, numRows: number) => {
    setDataSourceName(fileName);
    setRowCount(numRows);

    setTableHeaders(headers); 

    const types: Record<string, string> = {};
    if (data.length > 0) {
      headers.forEach(header => {
        const sampleValue = data[0][header];
        if (typeof sampleValue === 'number') {
          types[header] = 'number';
        } else if (typeof sampleValue === 'boolean') {
          types[header] = 'boolean';
        } else if (sampleValue instanceof Date || (typeof sampleValue === 'string' && !isNaN(new Date(sampleValue).getTime()))) {
          if (sampleValue instanceof Date || (typeof sampleValue === 'string' && (/\d{4}-\d{2}-\d{2}/.test(sampleValue) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(sampleValue)))) {
            if (!isNaN(new Date(sampleValue).getTime())) { 
              types[header] = 'date';
            } else {
              types[header] = 'string';
            }
          } else {
            types[header] = 'string';
          }
        } else {
          types[header] = 'string';
        }
      });
    }
    setHeaderTypes(types);
    setProcessedFieldStructure(buildFieldTree(headers, types));
    
    const transformedData = data.map(row => {
      const newRow: any = {};
      for (const header of headers) {
        let value = row[header];
        if (types[header] === 'date' && typeof value === 'string' && value !== null && value !== "") {
          const dateValue = new Date(value);
          newRow[header] = isNaN(dateValue.getTime()) ? value : dateValue; 
        } else if (types[header] === 'number' && (value === "" || value === null) ) {
          newRow[header] = null; 
        }
        else {
          newRow[header] = value;
        }
      }
      return newRow;
    });

    setJsonData(transformedData);
    setSelectedFields([]); 
    setXAxisFieldInternal(null);
    setYAxisFieldInternal(null);
    
    toast({
      title: "Data Source Connected!",
      description: `${numRows} data rows from "${fileName}" are ready.`,
    });
    setIsModalOpen(false); 
  };


  const handleFieldSelect = (fieldPath: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(fieldPath)
        ? prev.filter(f => f !== fieldPath)
        : [...prev, fieldPath];

      if (!newSelection.includes(fieldPath)) { 
        if (currentXAxisField === fieldPath) setXAxisFieldInternal(null);
        if (currentYAxisField === fieldPath) setYAxisFieldInternal(null);
      }
      return newSelection;
    });
  };
  
 useEffect(() => {
    if (jsonData.length > 0 && selectedFields.length > 0) {
        let currentX = currentXAxisField;
        let currentY = currentYAxisField;

        if (currentX && currentY && currentX === currentY) {
             setYAxisFieldInternal(null); 
             currentY = null;
        }

        if (currentX && !selectedFields.includes(currentX)) {
            currentX = null;
            setXAxisFieldInternal(null);
        }
        if (currentY && !selectedFields.includes(currentY)) {
            currentY = null;
            setYAxisFieldInternal(null);
        }
        
        if (!currentX && (currentY || (!currentX && !currentY))) { 
            const potentialX = 
                selectedFields.find(f => (headerTypes[f] === 'string' || headerTypes[f] === 'date') && f !== currentY) ||
                selectedFields.find(f => headerTypes[f] === 'number' && f !== currentY) || 
                selectedFields.find(f => f !== currentY); 
            if (potentialX) {
                if (potentialX !== currentY) { 
                    setXAxisFieldInternal(potentialX);
                    currentX = potentialX; 
                } else if (selectedFields.length === 1) { 
                    setXAxisFieldInternal(potentialX);
                    currentX = potentialX;
                }
            }
        }
        
        if (!currentY && (currentX || (!currentX && !currentY && currentXAxisField))) { 
            const potentialY = 
                selectedFields.find(f => headerTypes[f] === 'number' && f !== (currentX || currentXAxisField)) || 
                selectedFields.find(f => f !== (currentX || currentXAxisField) && headerTypes[f] !== 'object');
             if (potentialY) {
                if (potentialY !== (currentX || currentXAxisField)) { 
                    setYAxisFieldInternal(potentialY);
                } else if (selectedFields.length === 1) { 
                    setYAxisFieldInternal(potentialY);
                }
            }
        }
    } else if (selectedFields.length === 0) {
        setXAxisFieldInternal(null);
        setYAxisFieldInternal(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFields, jsonData, headerTypes]); 

  return (
    <div className="flex flex-col min-h-screen bg-secondary text-foreground">
      <AppHeader />
      <main className="flex-grow flex h-[calc(100vh-4rem)] border-t border-border">
        {/* Left Sidebar: Data Source and Fields */}
        <div className="w-[300px] flex-shrink-0 border-r border-border bg-card flex flex-col">
          {/* Data Source Section */}
          <div className="p-4 border-b border-border">
            {dataSourceName ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-foreground">Data Source</h2>
                  <Button 
                    onClick={() => setIsModalOpen(true)} 
                    size="sm" 
                    variant="outline" 
                    className="py-1 px-2 text-xs h-auto border-[var(--btn-primary-lg-border)] hover:border-[var(--btn-primary-lg-hover-border)]"
                  >
                    <DatabaseZap className="mr-1.5 h-3 w-3" /> Change
                  </Button>
                </div>
                <p className="text-sm text-foreground truncate font-medium" title={dataSourceName}>
                  {dataSourceName}
                  {rowCount !== null && <span className="text-xs text-muted-foreground ml-1.5">({rowCount} rows)</span>}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold mb-2 text-foreground">Data Source</h2>
                 <Button 
                    onClick={() => setIsModalOpen(true)} 
                    variant="lgPrimary"
                    className="w-full"
                  >
                    <DatabaseZap className="mr-2 h-4 w-4" /> Connect Data Source
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Upload a CSV or connect to Atlas.</p>
              </>
            )}
          </div>
          {/* Fields Section */}
          <div className="p-4 flex-grow flex flex-col overflow-y-auto">
            <h2 className="text-sm font-semibold mb-2 text-foreground">Fields</h2>
            <div className="space-y-1">
              {processedFieldStructure.length > 0 ? processedFieldStructure.map((field) => (
                <RenderFieldItem
                  key={field.key}
                  field={field}
                  selectedFields={selectedFields}
                  onFieldSelect={handleFieldSelect}
                  expandedFields={expandedFields}
                  onToggleExpand={handleToggleExpand}
                  depth={0}
                  currentXAxisField={currentXAxisField}
                  currentYAxisField={currentYAxisField}
                  onDragStartAxis={handleDragStartForAxis} // Pass the drag start handler
                />
              )) : (
                <p className="text-sm text-muted-foreground p-2">Connect a data source to see fields.</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area: Data Preview and Visualization */}
        <div className="flex-grow flex flex-col overflow-hidden bg-secondary">
          {/* Data Preview Section (Collapsible) */}
          <div className="bg-card"> 
            <Accordion type="single" collapsible defaultValue="preview-accordion-item" className="w-full">
              <AccordionItem value="preview-accordion-item" className="border-b-0"> 
                 <AccordionPrimitiveTrigger className="flex w-full items-center justify-between p-4 hover:no-underline text-sm font-semibold group data-[state=closed]:border-b data-[state=closed]:border-border text-foreground">
                     Data Preview
                 </AccordionPrimitiveTrigger>
                <AccordionContent className="p-4 pt-0">
                  <div className="max-h-[250px] overflow-y-auto border border-border rounded-md bg-card">
                    {selectedFields.length > 0 && jsonData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {selectedFields.map((header) => (
                              <TableHead key={header} className="text-xs h-8 px-2 sticky top-0 bg-card z-10 text-muted-foreground">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jsonData.slice(0, 10).map((row, index) => (
                            <TableRow key={index}>
                              {selectedFields.map((header) => (
                                <TableCell key={header} className="text-xs py-1 px-2 text-foreground">{String(row[header])}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[150px] text-center">
                         <FileText className="h-8 w-8 text-muted-foreground mb-2" data-ai-hint="document icon" />
                        <p className="text-sm text-muted-foreground">Connect data and select fields to see a preview.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Visualization Section (Collapsible) */}
          <div className="flex-grow flex flex-col border-b-0 bg-card mt-0 border-t border-border"> 
             <Accordion type="single" collapsible defaultValue="viz-accordion-item" className="w-full flex flex-col flex-grow">
              <AccordionItem value="viz-accordion-item" className="border-b-0 flex flex-col flex-grow">
                 <AccordionPrimitiveTrigger className="flex w-full items-center justify-between p-4 hover:no-underline text-sm font-semibold group data-[state=closed]:border-b-0 border-b border-border text-foreground">
                     Visualization
                  </AccordionPrimitiveTrigger>
                <AccordionContent className="p-4 pt-2 flex flex-col flex-grow bg-card">
                  <ChartVisualization
                    jsonData={jsonData}
                    headerTypes={headerTypes}
                    selectedFields={selectedFields}
                    setSelectedFields={setSelectedFields}
                    currentXAxisField={currentXAxisField}
                    setXAxisField={setXAxisFieldInternal}
                    currentYAxisField={currentYAxisField}
                    setYAxisField={setYAxisFieldInternal}
                    chartType={chartType}
                    setChartType={setChartType}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>
      {/* Data Source Modal */}
      <DataSourceModal 
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onDataSourceConnected={handleDataSourceConnected}
      />
    </div>
  );
}

    