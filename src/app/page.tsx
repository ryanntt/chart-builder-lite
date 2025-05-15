
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, Type, Hash, CalendarDays, ToggleLeft, Loader2, ChevronDown, ChevronRight, DatabaseZap, Brackets } from "lucide-react";
import { Logo } from "@/components/icons/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger as AccordionPrimitiveTrigger } from "@/components/ui/accordion";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { DataSourceModal } from '@/components/data-source-modal';
import { ChartVisualization } from '@/components/chart-visualization';
import { cn, getNestedValue } from "@/lib/utils";

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
  onDragStartAxis: (field: string, origin: 'x' | 'y') => void;
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

  return (
    <div 
      key={field.key} 
      className="flex items-center space-x-2 py-1.5 px-1 rounded-md hover:bg-accent transition-colors"
      style={{ paddingLeft: `${depth * 1.5}rem` }}
      draggable={selectedFields.includes(field.path)}
      onDragStart={() => {
          if (selectedFields.includes(field.path)) {
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

  const [rowCountText, setRowCountText] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [processedFieldStructure, setProcessedFieldStructure] = useState<FieldDefinition[]>([]);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const handleDragStartForAxis = (field: string, origin: 'x' | 'y') => {
    if (!selectedFields.includes(field)) return; 
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
  
    flatHeaders.sort().forEach(fullPath => { 
      const parts = fullPath.split('.');
      let currentPathProcessed = '';
  
      parts.forEach((part, index) => {
        const isLastNamePart = index === parts.length - 1;
        const parentPath = currentPathProcessed;
        currentPathProcessed = currentPathProcessed ? `${currentPathProcessed}.${part}` : part;
  
        let node = map[currentPathProcessed];
  
        if (!node) {
          const fieldType = isLastNamePart ? (types[fullPath] || 'unknown') : 
                            ( (index < parts.length -1 && /^\d+$/.test(parts[index+1])) ? 'array' : 'object');
          
          node = {
            key: currentPathProcessed,
            name: part,
            path: currentPathProcessed,
            type: fieldType as FieldDefinition['type'],
            isParent: !isLastNamePart,
            children: isLastNamePart ? undefined : [],
          };
          map[currentPathProcessed] = node;
  
          if (index === 0) {
            tree.push(node);
          } else {
            if (map[parentPath] && map[parentPath].children) {
              if (!map[parentPath].children!.find(child => child.path === currentPathProcessed)) {
                 map[parentPath].children!.push(node);
              }
            }
          }
        } else if (!isLastNamePart && !node.isParent) { 
            node.isParent = true;
            node.children = node.children || [];
            node.type = (index < parts.length -1 && /^\d+$/.test(parts[index+1])) ? 'array' : 'object';
        }
      });
    });
    return tree;
  };


  const handleDataSourceConnected = (data: any[], headers: string[], fileName: string, sampledRows: number, totalRows: number) => {
    setDataSourceName(fileName);
    
    let countTextVal = "";
    if (totalRows > sampledRows) {
      countTextVal = `(sampled ${sampledRows} of ${totalRows} rows)`;
    } else {
      countTextVal = `(${totalRows} rows)`;
    }
    setRowCountText(countTextVal);
    
    setTableHeaders(headers); 

    const types: Record<string, string> = {};
    if (data.length > 0) {
      const sampleRow = data[0];
      headers.forEach(headerPath => {
        const sampleValue = getNestedValue(sampleRow, headerPath);
        if (typeof sampleValue === 'number') {
          types[headerPath] = 'number';
        } else if (typeof sampleValue === 'boolean') {
          types[headerPath] = 'boolean';
        } else if (sampleValue instanceof Date || (typeof sampleValue === 'string' && !isNaN(new Date(sampleValue).getTime()) && /\d{4}-\d{2}-\d{2}/.test(sampleValue))) {
          types[headerPath] = 'date';
        } else if (Array.isArray(sampleValue)){
          types[headerPath] = 'array';
        } else if (typeof sampleValue === 'object' && sampleValue !== null && !(sampleValue instanceof Date)){
          types[headerPath] = 'object';
        }
        else {
          types[headerPath] = 'string';
        }
      });
    }
    setHeaderTypes(types);
    setProcessedFieldStructure(buildFieldTree(headers, types));
    setJsonData(data); 
    setSelectedFields([]); 
    setXAxisFieldInternal(null);
    setYAxisFieldInternal(null);
    setExpandedFields(new Set()); 
    
    let toastDescription = `${fileName}" are ready.`;
    if (totalRows > sampledRows) {
      toastDescription = `Sampled ${sampledRows} of ${totalRows} data rows from "${fileName}" are ready.`;
    } else {
      toastDescription = `${totalRows} data rows from "${fileName}" are ready.`;
    }
    toast({
      title: "Data Source Connected!",
      description: toastDescription,
    });
    setIsModalOpen(false); 
  };


  const handleFieldSelect = (fieldPath: string) => {
    const fieldDefinition = findFieldInTree(processedFieldStructure, fieldPath);
    if (fieldDefinition && fieldDefinition.isParent) {
      toast({ title: "Selection Info", description: "Parent fields cannot be directly selected for charting. Please select their child fields.", variant: "default"});
      return;
    }

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

  const findFieldInTree = (nodes: FieldDefinition[], path: string): FieldDefinition | undefined => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findFieldInTree(node.children, path);
        if (found) return found;
      }
    }
    return undefined;
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
                } else if (selectedFields.length === 1) { 
                    setXAxisFieldInternal(potentialX);
                }
            }
        }
        
        if (!currentY && (currentX || (!currentX && !currentY && currentXAxisField))) { 
            const potentialY = 
                selectedFields.find(f => headerTypes[f] === 'number' && f !== (currentX || currentXAxisField)) || 
                selectedFields.find(f => f !== (currentX || currentXAxisField) && headerTypes[f] !== 'object' && headerTypes[f] !== 'array');
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
  }, [selectedFields, jsonData.length, headerTypes]); 

  return (
    <div className="flex flex-col min-h-screen bg-secondary text-foreground">
      <AppHeader />
      <main className="flex-grow flex h-[calc(100vh-4rem)] border-t border-border-secondary">
        <div className="w-[300px] flex-shrink-0 border-r border-border-secondary bg-card flex flex-col">
          <div className="p-4 border-b border-border-secondary">
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
                <div>
                  <p className="text-sm text-foreground truncate font-medium" title={dataSourceName}>
                    {dataSourceName}
                  </p>
                  {rowCountText && <p className="text-xs text-muted-foreground mt-0.5">{rowCountText}</p>}
                </div>
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
                  onDragStartAxis={handleDragStartForAxis}
                />
              )) : (
                <p className="text-sm text-muted-foreground p-2">Connect a data source to see fields.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-grow flex flex-col overflow-hidden bg-secondary">
          <div className="bg-card"> 
            <Accordion type="single" collapsible defaultValue="preview-accordion-item" className="w-full">
              <AccordionItem value="preview-accordion-item" className="border-b-0"> 
                 <AccordionPrimitiveTrigger className="flex w-full items-center p-4 hover:no-underline text-sm font-semibold group text-foreground">
                     <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 mr-2" />
                     Data Preview
                 </AccordionPrimitiveTrigger>
                <AccordionContent className="p-4 pt-0">
                  <div className="max-h-[250px] overflow-y-auto border border-border-secondary rounded-md bg-card">
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
                                <TableCell key={header} className="text-xs py-1 px-2 text-foreground">
                                  {String(getNestedValue(row, header))}
                                </TableCell>
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

          <div className="flex-grow flex flex-col border-b-0 bg-card mt-0 border-t border-border-secondary"> 
             <Accordion type="single" collapsible defaultValue="viz-accordion-item" className="w-full flex flex-col flex-grow">
              <AccordionItem value="viz-accordion-item" className="border-b-0 flex flex-col flex-grow">
                 <AccordionPrimitiveTrigger className="flex w-full items-center p-4 hover:no-underline text-sm font-semibold group text-foreground">
                     <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 mr-2" />
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
      <DataSourceModal 
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onDataSourceConnected={handleDataSourceConnected}
      />
    </div>
  );
}

