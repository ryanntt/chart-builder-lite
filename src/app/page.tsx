
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AgChartsReact } from 'ag-charts-react';
// import 'ag-charts-community/styles/ag-charts-community.css'; // Core AG Charts CSS - Consistently causes "Module not found"
// import 'ag-charts-community/styles/ag-theme-alpine.css'; // Alpine theme - Consistently causes "Module not found"
// import 'ag-charts-community/styles/ag-theme-alpine-dark.css'; // Alpine dark theme - Consistently causes "Module not found"
import type { AgChartOptions, AgCartesianAxisOptions, AgChart } from 'ag-charts-community';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XIcon, FileText, Type, Hash, CalendarDays, ToggleLeft, BarChart, Download, Moon, Sun, Loader2, ChevronDown, DatabaseZap } from "lucide-react";
import { Logo } from "@/components/icons/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger as AccordionPrimitiveTrigger } from "@/components/ui/accordion";
import { useTheme } from "next-themes";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import Papa from 'papaparse';
import { DataSourceModal } from '@/components/data-source-modal';


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
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const AppHeader = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border bg-bg-color-primary/95 backdrop-blur supports-[backdrop-filter]:bg-bg-color-primary/60">
    <div className="container mx-auto flex h-16 items-center px-4 sm:justify-between sm:space-x-0">
      <div className="flex gap-2 items-center">
        <Logo className="h-6 w-6 text-primary" data-ai-hint="database logo" />
        <h1 className="text-xl font-semibold text-foreground">CSV Atlas Uploader</h1>
      </div>
      <ThemeToggleButton />
    </div>
  </header>
);

export default function Home() {
  const [dataSourceName, setDataSourceName] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [headerTypes, setHeaderTypes] = useState<Record<string, string>>({});
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  
  const chartApiRef = useRef<AgChart | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { theme: resolvedTheme } = useTheme();
  
  const [chartType, setChartType] = useState<string>('bar');
  const [xAxisField, setXAxisField] = useState<string | null>(null);
  const [yAxisField, setYAxisField] = useState<string | null>(null);
  
  const [draggedItem, setDraggedItem] = useState<{ field: string; origin: 'x' | 'y' } | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isChartApiReady, setIsChartApiReady] = useState(false);
  const [chartDimensions, setChartDimensions] = useState<{ width: number; height: number } | null>(null);

  const [internalChartOptions, setInternalChartOptions] = useState<Omit<AgChartOptions, 'width' | 'height' | 'theme'> | null>(null);
  const [chartRenderKey, setChartRenderKey] = useState(0);
  const [rowCount, setRowCount] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);


  const chartOptionsToRender = useMemo(() => {
    if (!internalChartOptions || !chartDimensions) return null;
    return {
      ...internalChartOptions,
      width: chartDimensions.width,
      height: chartDimensions.height,
      theme: resolvedTheme === 'dark' ? 'ag-default-dark' : 'ag-theme-alpine',
    };
  }, [internalChartOptions, chartDimensions, resolvedTheme]);


  useEffect(() => {
    const container = chartContainerRef.current;
    if (container) {
      const resizeObserver = new ResizeObserver(entries => {
        if (entries[0]) {
          const { width, height } = entries[0].contentRect;
          if (width > 0 && height > 0) {
            if (!chartDimensions || Math.abs(chartDimensions.width - width) > 0.5 || Math.abs(chartDimensions.height - height) > 0.5) {
              setChartDimensions({ width, height });
            }
          }
        }
      });
      resizeObserver.observe(container);

      const { width, height } = container.getBoundingClientRect();
       if (width > 0 && height > 0) {
         if (!chartDimensions || Math.abs(chartDimensions.width - width) > 0.5 || Math.abs(chartDimensions.height - height) > 0.5) {
           setChartDimensions({ width, height });
         }
       }
      return () => resizeObserver.unobserve(container);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartContainerRef.current]); 


  const handleDataSourceConnected = (data: any[], headers: string[], fileName: string, numRows: number) => {
    setDataSourceName(fileName);
    setRowCount(numRows);
    setIsChartLoading(true); // To reflect loading state while processing this new data
    setIsChartApiReady(false);

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
    setSelectedFields([]); // Reset selections
    setXAxisField(null);
    setYAxisField(null);
    setInternalChartOptions(null); // Clear previous chart
    
    toast({
      title: "Data Source Connected!",
      description: `${numRows} data rows from "${fileName}" are ready.`,
    });
    setIsChartLoading(false);
    setIsModalOpen(false); // Ensure modal closes
  };


  const handleFieldSelect = (field: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field];

      if (!newSelection.includes(field)) { 
        if (xAxisField === field) setXAxisField(null);
        if (yAxisField === field) setYAxisField(null);
      }
      return newSelection;
    });
  };
  
 useEffect(() => {
    if (jsonData.length > 0 && selectedFields.length > 0) {
        let currentX = xAxisField;
        let currentY = yAxisField;

        // Rule: One field can only be mapped to one chart configuration input.
        if (currentX && currentY && currentX === currentY) {
            // If by some chance they became same, prioritize X and clear Y
             setYAxisField(null);
             currentY = null;
        }


        if (currentX && !selectedFields.includes(currentX)) {
            currentX = null;
            setXAxisField(null);
        }
        if (currentY && !selectedFields.includes(currentY)) {
            currentY = null;
            setYAxisField(null);
        }
        
        if (!currentX && (currentY || (!currentX && !currentY))) {
            const potentialX = 
                selectedFields.find(f => (headerTypes[f] === 'string' || headerTypes[f] === 'date') && f !== currentY) ||
                selectedFields.find(f => headerTypes[f] === 'number' && f !== currentY) ||
                selectedFields.find(f => f !== currentY);
            if (potentialX) {
                if (potentialX !== currentY) { 
                    setXAxisField(potentialX);
                    currentX = potentialX; 
                } else if (selectedFields.length === 1) { 
                    setXAxisField(potentialX);
                    currentX = potentialX;
                }
            }
        }
        
        if (!currentY && (currentX || (!currentX && !currentY && xAxisField))) { 
            const potentialY = 
                selectedFields.find(f => headerTypes[f] === 'number' && f !== (currentX || xAxisField)) || 
                selectedFields.find(f => f !== (currentX || xAxisField) && headerTypes[f] !== 'object'); 
             if (potentialY) {
                if (potentialY !== (currentX || xAxisField)) { 
                    setYAxisField(potentialY);
                } else if (selectedFields.length === 1) { 
                    setYAxisField(potentialY);
                }
            }
        }
    } else if (selectedFields.length === 0) {
        setXAxisField(null);
        setYAxisField(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFields, jsonData, headerTypes]);


  const handleDragStart = (field: string, origin: 'x' | 'y') => {
    if (!selectedFields.includes(field)) return; 
    setDraggedItem({ field, origin });
  };

  const handleDrop = (target: 'x' | 'y') => {
    if (draggedItem) {
        const sourceField = draggedItem.field;
        
        if (!selectedFields.includes(sourceField)) {
            setDraggedItem(null);
            return;
        }

        const currentX = xAxisField;
        const currentY = yAxisField;

        if (target === 'x') { 
            if (sourceField === currentY) { // Swapping X and Y
                setXAxisField(sourceField);
                setYAxisField(currentX); 
            } else if (sourceField !== currentX) { // New field to X
                setXAxisField(sourceField);
            }
        } else { // Target is 'y'
            if (sourceField === currentX) { // Swapping Y and X
                setYAxisField(sourceField);
                setXAxisField(currentY); 
            } else if (sourceField !== currentY) { // New field to Y
                setYAxisField(sourceField);
            }
        }
        
        if (xAxisField === yAxisField && xAxisField !== null) {
            if (target === 'x' && draggedItem.origin === 'y') { 
                 setYAxisField(currentX); 
            } else if (target === 'y' && draggedItem.origin === 'x') { 
                 setXAxisField(currentY); 
            } else if (target === 'x') {
                 setYAxisField(null); 
            } else {
                 setXAxisField(null); 
            }
        }
        setDraggedItem(null);
    }
};
  
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const regenerateChartLogic = useCallback(() => {
    if (!xAxisField || !yAxisField || jsonData.length === 0 || !selectedFields.includes(xAxisField) || !selectedFields.includes(yAxisField)) {
      setIsChartLoading(false);
      setInternalChartOptions(null);
      return;
    }

    let chartData = jsonData.map(row => ({
      [xAxisField]: row[xAxisField],
      [yAxisField]: row[yAxisField],
    }));

    const xFieldType = headerTypes[xAxisField];
    const yFieldType = headerTypes[yAxisField];

    let series: AgChartOptions['series'] = [];
    let axes: AgCartesianAxisOptions[] = [];
    let titleText = `${yAxisField} by ${xAxisField}`;
    
    if ( (chartType === 'bar' && (xFieldType === 'string' || xFieldType === 'date') ) ) {
        const valueCounts = chartData.reduce((acc, row) => {
            const value = String(row[xAxisField]);
            acc[value] = (acc[value] || 0) + (yFieldType === 'number' && typeof row[yAxisField] === 'number' ? Number(row[yAxisField]) : 1);
            return acc;
        }, {} as Record<string, number>);

        const sortedUniqueValues = Object.entries(valueCounts)
            .sort(([, valA], [, valB]) => valB - valA) 
            .map(([value]) => value);

        if (sortedUniqueValues.length > 20) {
            const top20Values = new Set(sortedUniqueValues.slice(0, 20));
            chartData = chartData.filter(row => top20Values.has(String(row[xAxisField])));
            toast({
                title: "Data Filtered",
                description: `X-axis field "${xAxisField}" displaying top 20 unique values by their aggregated Y-axis values or frequency.`,
            });
        }
    }  else if ( (chartType === 'horizontal-bar' && (yFieldType === 'string' || yFieldType === 'date') ) ) { 
        const valueCounts = chartData.reduce((acc, row) => {
            const value = String(row[yAxisField]); 
            acc[value] = (acc[value] || 0) + (xFieldType === 'number' && typeof row[xAxisField] === 'number' ? Number(row[xAxisField]) : 1);
            return acc;
        }, {} as Record<string, number>);

        const sortedUniqueValues = Object.entries(valueCounts)
            .sort(([, valA], [, valB]) => valB - valA)
            .map(([value]) => value);
        
        if (sortedUniqueValues.length > 20) {
            const top20Values = new Set(sortedUniqueValues.slice(0, 20));
            chartData = chartData.filter(row => top20Values.has(String(row[yAxisField])));
             toast({
                title: "Data Filtered",
                description: `Y-axis field "${yAxisField}" displaying top 20 unique values by their aggregated X-axis values or frequency.`,
            });
        }
    }
    
    if (chartData.length === 0) {
        toast({
          title: "No Data After Filtering",
          description: "No data remains for the selected fields after filtering. Please check your selections or data.",
          variant: "destructive",
        });
        setInternalChartOptions(null); 
        setIsChartLoading(false);
        return;
    }

    switch (chartType) {
      case 'bar':
        series = [{ type: 'bar', xKey: xAxisField, yKey: yAxisField, yName: yAxisField }];
        axes = [
          { type: (xFieldType === 'string' || xFieldType === 'date') ? 'category' : 'number', position: 'bottom', title: { text: xAxisField } },
          { type: 'number', position: 'left', title: { text: yAxisField } },
        ];
        break;
      case 'horizontal-bar':
        series = [{ type: 'bar', direction:'horizontal',  xKey: xAxisField, yKey: yAxisField, xName: xAxisField, yName: yAxisField }];
        axes = [
            { type: 'number', position: 'bottom', title: { text: xAxisField } }, 
            { type: (yFieldType === 'string' || yFieldType === 'date') ? 'category' : 'number', position: 'left', title: { text: yAxisField } }, 
        ];
        titleText = `${xAxisField} by ${yAxisField}`; 
        break;
      case 'scatter':
        if ((xFieldType !== 'number' && xFieldType !== 'date') || (yFieldType !== 'number' && yFieldType !== 'date')) {
            toast({ title: "Type Error", description: "Scatter plots require numeric or date X and Y axes.", variant: "destructive"});
            setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'scatter', xKey: xAxisField, yKey: yAxisField, xName: xAxisField, yName: yAxisField }];
        axes = [
          { type: xFieldType === 'date' ? 'time' : 'number', position: 'bottom', title: { text: xAxisField } },
          { type: yFieldType === 'date' ? 'time' : 'number', position: 'left', title: { text: yAxisField } },
        ];
        break;
      case 'donut':
        if (yFieldType !== 'number') {
            toast({ title: "Type Error", description: "Donut charts require a numeric field for values (Angle Key).", variant: "destructive"});
            setInternalChartOptions(null); setIsChartLoading(false); return;
        }
         if (xFieldType !== 'string' && xFieldType !== 'date') { 
            toast({ title: "Type Error", description: "Donut charts require a categorical or date field for labels (Callout Label Key).", variant: "destructive"});
            setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'donut', angleKey: yAxisField, calloutLabelKey: xAxisField, legendItemKey: xAxisField }];
        axes = []; 
        titleText = `Distribution of ${yAxisField} by ${xAxisField}`;
        break;
      default:
        toast({ title: "Unknown Chart Type", description: "Selected chart type is not supported.", variant: "destructive" });
        setInternalChartOptions(null); setIsChartLoading(false); return;
    }

    const newBaseChartOptions: Omit<AgChartOptions, 'width' | 'height' | 'theme'> = {
      data: chartData,
      title: { text: titleText },
      series: series,
      axes: axes.length > 0 ? axes : undefined,
      autoSize: false, // Important for manual sizing control
    };
    
    setInternalChartOptions(newBaseChartOptions);
    setChartRenderKey(prevKey => prevKey + 1); 
    setIsChartLoading(false);

    if(xAxisField && yAxisField && jsonData.length > 0 && selectedFields.length > 0) { 
      toast({
        title: "Visualization Updated!",
        description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.`,
      });
    }
  }, [chartType, xAxisField, yAxisField, jsonData, selectedFields, headerTypes]); 

  useEffect(() => {
    if (xAxisField && yAxisField && jsonData.length > 0 && selectedFields.length > 0 && selectedFields.includes(xAxisField) && selectedFields.includes(yAxisField) && chartDimensions) {
      setIsChartLoading(true);
      setIsChartApiReady(false); 
      const timer = setTimeout(() => {
        regenerateChartLogic();
      }, 300); 
      return () => clearTimeout(timer);
    } else {
      setInternalChartOptions(null);
      setIsChartLoading(false); 
    }
  }, [chartType, xAxisField, yAxisField, jsonData, selectedFields, headerTypes, chartDimensions, regenerateChartLogic, resolvedTheme]); 

  useEffect(() => {
    if (!chartOptionsToRender) {
      setIsChartApiReady(false);
    }
  }, [chartOptionsToRender]);


  const sanitizeFilename = (name: string | undefined): string => {
    if (!name) return 'chart.png';
    return name.replace(/[^a-z0-9_.-]+/gi, '_').replace(/_+/g, '_').toLowerCase() + '.png';
  };

  const handleDownloadChart = () => {
    const chartWrapper = chartContainerRef.current;
    if (chartWrapper) {
        const canvas = chartWrapper.querySelector('canvas');
        if (canvas && chartOptionsToRender && isChartApiReady) {
            const filename = sanitizeFilename(chartOptionsToRender.title?.text);
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename;
                document.body.appendChild(link); 
                link.click();
                document.body.removeChild(link); 
                toast({
                    title: "Chart Downloading",
                    description: `Downloading ${filename}...`,
                });
            } catch (error) {
                console.error("Error generating chart image:", error);
                toast({
                    title: "Download Failed",
                    description: "Could not generate chart image.",
                    variant: "destructive",
                });
            }
        } else {
            toast({
                title: "Download Failed",
                description: "Chart is not ready or canvas element not found.",
                variant: "destructive",
            });
        }
    } else {
         toast({
            title: "Download Failed",
            description: "Chart container not found.",
             variant: "destructive",
        });
    }
};
  
  const handleXAxisClear = () => {
    const fieldToDeselect = xAxisField;
    setXAxisField(null);
    if (fieldToDeselect && yAxisField !== fieldToDeselect) { 
        setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    }
  };

  const handleYAxisClear = () => {
    const fieldToDeselect = yAxisField;
    setYAxisField(null);
    if (fieldToDeselect && xAxisField !== fieldToDeselect) { 
         setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-bg-color-secondary text-foreground">
      <AppHeader />
      <main className="flex-grow flex h-[calc(100vh-4rem)] border-t border-border">
        <div className="w-[300px] flex-shrink-0 border-r border-border bg-bg-color-primary flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold mb-2 text-foreground">Data Source</h2>
             <Button onClick={() => setIsModalOpen(true)} className="w-full" variant="outline">
                <DatabaseZap className="mr-2 h-4 w-4" /> Connect Data Source
            </Button>
            {dataSourceName && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={dataSourceName}>
                Selected: {dataSourceName}
                {rowCount !== null && ` (${rowCount} rows)`}
              </p>
            )}
            {!dataSourceName && <p className="text-xs text-muted-foreground mt-1">Upload a CSV or connect to Atlas.</p>}
          </div>
          <div className="p-4 flex-grow flex flex-col overflow-y-auto">
            <h2 className="text-sm font-semibold mb-2 text-foreground">Fields</h2>
            <div className="space-y-1">
              {tableHeaders.length > 0 ? tableHeaders.map((header) => (
                <div 
                  key={header} 
                  className="flex items-center space-x-2 py-1.5 px-1 rounded-md hover:bg-bg-color-primary-hover transition-colors"
                  draggable={selectedFields.includes(header)}
                  onDragStart={() => handleDragStart(header, selectedFields.includes(xAxisField || "") && xAxisField === header ? 'x' : (selectedFields.includes(yAxisField || "") && yAxisField === header ? 'y' : 'x'))}
                >
                  <Checkbox
                    id={`checkbox-${header}`}
                    checked={selectedFields.includes(header)}
                    onCheckedChange={() => handleFieldSelect(header)}
                    aria-label={`Select field ${header}`}
                  />
                  {getFieldTypeIcon(headerTypes[header])}
                  <Label
                    htmlFor={`checkbox-${header}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate cursor-pointer flex-grow"
                    title={header}
                  >
                    {header}
                  </Label>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground p-2">Connect a data source to see fields.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-grow flex flex-col overflow-hidden bg-bg-color-primary">
          <div className="border-b border-border">
            <Accordion type="single" collapsible defaultValue="preview-accordion-item" className="w-full">
              <AccordionItem value="preview-accordion-item" className="border-b-0"> 
                 <AccordionPrimitiveTrigger className="flex w-full items-center justify-between p-4 hover:no-underline text-sm font-semibold group data-[state=closed]:border-b data-[state=closed]:border-border">
                     Data Preview
                     <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-2 group-data-[state=open]:rotate-180" />
                </AccordionPrimitiveTrigger>
                <AccordionContent className="p-4 pt-0">
                  <div className="max-h-[250px] overflow-y-auto border rounded-md bg-bg-color-primary">
                    {selectedFields.length > 0 && jsonData.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {selectedFields.map((header) => (
                              <TableHead key={header} className="text-xs h-8 px-2 sticky top-0 bg-bg-color-primary z-10">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jsonData.slice(0, 10).map((row, index) => (
                            <TableRow key={index}>
                              {selectedFields.map((header) => (
                                <TableCell key={header} className="text-xs py-1 px-2">{String(row[header])}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[150px] text-center">
                         <FileText className="w-10 h-10 text-muted-foreground mb-2" data-ai-hint="document icon" />
                        <p className="text-sm text-muted-foreground">Select fields or connect data to see a preview.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="flex-grow flex flex-col border-b-0">
             <Accordion type="single" collapsible defaultValue="viz-accordion-item" className="w-full flex flex-col flex-grow">
              <AccordionItem value="viz-accordion-item" className="border-b-0 flex flex-col flex-grow">
                 <div className="flex w-full items-center justify-between p-4 text-sm font-semibold group border-b data-[state=closed]:border-b-0 border-border">
                  <AccordionPrimitiveTrigger className="flex flex-1 items-center py-0 font-semibold text-sm transition-all hover:no-underline group [&[data-state=open]>svg]:rotate-180">
                     Visualization
                     <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-2 group-data-[state=open]:rotate-180" />
                  </AccordionPrimitiveTrigger>
                   <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 ml-2 rounded-md hover:bg-bg-color-primary-hover p-1"
                      onClick={handleDownloadChart}
                      disabled={!chartOptionsToRender || !isChartApiReady}
                      aria-label="Download chart"
                      title="Download chart as PNG"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                </div>
                <AccordionContent className="p-4 pt-2 space-y-4 flex flex-col flex-grow bg-bg-color-primary">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <Label htmlFor="chartType" className="text-xs">Chart Type</Label>
                      <Select value={chartType} onValueChange={(value) => { setChartType(value); }} name="chartType" disabled={selectedFields.length === 0}>
                        <SelectTrigger id="chartType" className="h-9 text-xs"><SelectValue placeholder="Select chart type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bar" className="text-xs">Simple Bar</SelectItem>
                          <SelectItem value="horizontal-bar" className="text-xs">Horizontal Bar</SelectItem>
                          <SelectItem value="scatter" className="text-xs">Scatter Plot</SelectItem>
                          <SelectItem value="donut" className="text-xs">Donut Chart</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="xAxis" className="text-xs">X-Axis</Label>
                      <div
                        id="xAxisContainer" 
                        draggable={!!xAxisField && selectedFields.length > 0 && selectedFields.includes(xAxisField)}
                        onDragStart={() => xAxisField && handleDragStart(xAxisField, 'x')}
                        onDrop={() => handleDrop('x')}
                        onDragOver={handleDragOver}
                        className={`flex items-center justify-between p-2 border rounded-md min-h-[36px] bg-bg-color-secondary text-xs ${!!xAxisField && selectedFields.length > 0 && selectedFields.includes(xAxisField) ? 'cursor-grab' : 'cursor-default opacity-70'}`}
                      >
                        <span className="truncate" title={xAxisField || "Select field for X-Axis"}>{xAxisField || 'Select Field'}</span>
                        {xAxisField && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleXAxisClear}><XIcon className="w-3 h-3" /></Button>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="yAxis" className="text-xs">Y-Axis</Label>
                      <div
                        id="yAxisContainer"
                        draggable={!!yAxisField && selectedFields.length > 0 && selectedFields.includes(yAxisField)}
                        onDragStart={() => yAxisField && handleDragStart(yAxisField, 'y')}
                        onDrop={() => handleDrop('y')}
                        onDragOver={handleDragOver}
                        className={`flex items-center justify-between p-2 border rounded-md min-h-[36px] bg-bg-color-secondary text-xs ${!!yAxisField && selectedFields.length > 0 && selectedFields.includes(yAxisField) ? 'cursor-grab' : 'cursor-default opacity-70'}`}
                      >
                        <span className="truncate" title={yAxisField || "Select field for Y-Axis"}>{yAxisField || 'Select Field'}</span>
                        {yAxisField && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleYAxisClear}><XIcon className="w-3 h-3" /></Button>}
                      </div>
                    </div>
                  </div>
                                      
                  <div ref={chartContainerRef} className="w-full relative ag-chart-wrapper flex-grow min-h-0 h-[400px] max-h-[400px] bg-bg-color-primary border rounded-md">
                    {isChartLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-bg-color-primary/50 z-10 rounded-md">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                    <div className={`${isChartLoading && chartOptionsToRender ? 'opacity-50' : ''} h-full w-full`}>
                      {(chartOptionsToRender && chartDimensions && chartDimensions.width > 0 && chartDimensions.height > 0) ? (
                        <AgChartsReact 
                          options={chartOptionsToRender} 
                          key={chartRenderKey} 
                          onChartReady={(chart) => { 
                            chartApiRef.current = chart;
                            setIsChartApiReady(true);
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                          {(selectedFields.length === 0 || jsonData.length === 0) ? (
                            <>
                              <FileText className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="document data" />
                              <p className="text-sm text-muted-foreground">Connect data and select fields to visualize.</p>
                            </>
                          ) : (!xAxisField || !yAxisField) ? (
                            <>
                              <BarChart className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="chart axes" />
                              <p className="text-sm text-muted-foreground">Assign fields to X and Y axes.</p>
                            </>
                          ) : ( 
                             <>
                              <BarChart className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="analytics chart" />
                              <p className="text-sm text-muted-foreground">Chart will render here. Ensure container has dimensions and valid configuration.</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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
