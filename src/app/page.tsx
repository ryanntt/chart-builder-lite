
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AgChartsReact } from 'ag-charts-react';
// The AG Charts CSS imports below consistently cause "Module not found" errors.
// This indicates that the build process cannot locate these CSS files within the ag-charts-community package.
// AG Charts styling might be affected until this is resolved.
// import 'ag-charts-community/styles/ag-charts-community.css'; 
// import 'ag-charts-community/styles/ag-theme-alpine.css'; 
// import 'ag-charts-community/styles/ag-theme-alpine-dark.css'; 
import type { AgChartOptions, AgCartesianAxisOptions, AgChart } from 'ag-charts-community';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XIcon, Hash, CalendarDays, ToggleLeft, BarChart, Download, Loader2, ChevronDown, DatabaseZap, FileText } from "lucide-react";
import { Logo } from "@/components/icons/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger as AccordionPrimitiveTrigger } from "@/components/ui/accordion";
import { useTheme } from "next-themes";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { DataSourceModal } from '@/components/data-source-modal';
import { cn } from "@/lib/utils";


const getFieldTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'string':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
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
            if (!chartDimensions || Math.abs(chartDimensions.width - width) > 1 || Math.abs(chartDimensions.height - height) > 1) {
              setChartDimensions({ width, height });
            }
          }
        }
      });
      resizeObserver.observe(container);

      // Initial size
      const { width, height } = container.getBoundingClientRect();
       if (width > 0 && height > 0) {
         if (!chartDimensions || Math.abs(chartDimensions.width - width) > 1 || Math.abs(chartDimensions.height - height) > 1) {
           setChartDimensions({ width, height });
         }
       }
      return () => resizeObserver.unobserve(container);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartContainerRef.current]); // Dependency on chartContainerRef.current might not re-trigger if only the ref object changes.


  const handleDataSourceConnected = (data: any[], headers: string[], fileName: string, numRows: number) => {
    setDataSourceName(fileName);
    setRowCount(numRows);
    setIsChartLoading(true); 
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
          // More robust date check, ensuring it's not just a number string
          if (sampleValue instanceof Date || (typeof sampleValue === 'string' && (/\d{4}-\d{2}-\d{2}/.test(sampleValue) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(sampleValue)))) {
            if (!isNaN(new Date(sampleValue).getTime())) { // Final check after regex
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
    
    // Transform data based on detected types, especially for dates
    const transformedData = data.map(row => {
      const newRow: any = {};
      for (const header of headers) {
        let value = row[header];
        if (types[header] === 'date' && typeof value === 'string' && value !== null && value !== "") {
          const dateValue = new Date(value);
          newRow[header] = isNaN(dateValue.getTime()) ? value : dateValue; // Keep original if not a valid date
        } else if (types[header] === 'number' && (value === "" || value === null) ) {
          newRow[header] = null; // Treat empty strings/nulls as null for numbers
        }
        else {
          newRow[header] = value;
        }
      }
      return newRow;
    });

    setJsonData(transformedData);
    setSelectedFields([]); // Reset selected fields
    setXAxisField(null);
    setYAxisField(null);
    setInternalChartOptions(null); // Clear previous chart configuration
    
    toast({
      title: "Data Source Connected!",
      description: `${numRows} data rows from "${fileName}" are ready.`,
    });
    setIsChartLoading(false);
    setIsModalOpen(false); // Close the modal on successful connection
  };


  const handleFieldSelect = (field: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field];

      // If a field is deselected, remove it from X/Y axis if it was there
      if (!newSelection.includes(field)) { 
        if (xAxisField === field) setXAxisField(null);
        if (yAxisField === field) setYAxisField(null);
      }
      return newSelection;
    });
  };
  
  // Auto-assign X/Y axes when selectedFields change
 useEffect(() => {
    if (jsonData.length > 0 && selectedFields.length > 0) {
        let currentX = xAxisField;
        let currentY = yAxisField;

        // If X and Y are the same, try to clear Y (or X if Y was the new one)
        if (currentX && currentY && currentX === currentY) {
             // This logic will be hit if a single field is selected, or if user explicitly makes them same.
             // Let's prioritize keeping X if only one field is available.
             setYAxisField(null); // Clear Y, try to find a new Y later if possible
             currentY = null;
        }

        // If current X or Y is no longer in selectedFields, clear it
        if (currentX && !selectedFields.includes(currentX)) {
            currentX = null;
            setXAxisField(null);
        }
        if (currentY && !selectedFields.includes(currentY)) {
            currentY = null;
            setYAxisField(null);
        }
        
        // Attempt to fill X-axis if empty or if current X is invalid
        if (!currentX && (currentY || (!currentX && !currentY))) { // Fill X if X is empty, regardless of Y
            // Prefer string/date for X-axis, then number, then anything else not already Y
            const potentialX = 
                selectedFields.find(f => (headerTypes[f] === 'string' || headerTypes[f] === 'date') && f !== currentY) ||
                selectedFields.find(f => headerTypes[f] === 'number' && f !== currentY) || // then number
                selectedFields.find(f => f !== currentY); // then any other field not Y
            if (potentialX) {
                if (potentialX !== currentY) { // Ensure it's not the same as Y
                    setXAxisField(potentialX);
                    currentX = potentialX; // Update currentX for Y-axis logic
                } else if (selectedFields.length === 1) { // If only one field selected, assign it to X
                    setXAxisField(potentialX);
                    currentX = potentialX;
                }
            }
        }
        
        // Attempt to fill Y-axis if empty or if current Y is invalid, and X is set
        if (!currentY && (currentX || (!currentX && !currentY && xAxisField))) { // Fill Y if Y is empty AND X is (now) set
            // Prefer number for Y-axis, then anything else not already X or object
            const potentialY = 
                selectedFields.find(f => headerTypes[f] === 'number' && f !== (currentX || xAxisField)) || // Prefer number not X
                selectedFields.find(f => f !== (currentX || xAxisField) && headerTypes[f] !== 'object'); // then any other non-object field not X
             if (potentialY) {
                if (potentialY !== (currentX || xAxisField)) { // Ensure it's not the same as X
                    setYAxisField(potentialY);
                } else if (selectedFields.length === 1) { // If only one field selected (already on X), assign it to Y too (common for counts/histograms)
                    setYAxisField(potentialY);
                }
            }
        }
    } else if (selectedFields.length === 0) {
        setXAxisField(null);
        setYAxisField(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFields, jsonData, headerTypes]); // Rerun when selectedFields, data, or types change.


  const handleDragStart = (field: string, origin: 'x' | 'y') => {
    if (!selectedFields.includes(field)) return; // Only draggable if selected
    setDraggedItem({ field, origin });
  };

  const handleDrop = (target: 'x' | 'y') => {
    if (draggedItem) {
        const sourceField = draggedItem.field;
        
        // Ensure the dragged field is still selected (it should be if drag started)
        if (!selectedFields.includes(sourceField)) {
            setDraggedItem(null);
            return;
        }

        const currentX = xAxisField;
        const currentY = yAxisField;

        if (target === 'x') { // Dropped onto X-axis
            if (sourceField === currentY) { // If dragging Y's field to X (swap)
                setXAxisField(sourceField);
                setYAxisField(currentX); // Old X becomes new Y
            } else if (sourceField !== currentX) { // If dragging a different field to X
                setXAxisField(sourceField);
            }
        } else { // Dropped onto Y-axis
            if (sourceField === currentX) { // If dragging X's field to Y (swap)
                setYAxisField(sourceField);
                setXAxisField(currentY); // Old Y becomes new X
            } else if (sourceField !== currentY) { // If dragging a different field to Y
                setYAxisField(sourceField);
            }
        }
        
        // Post-drop check: if X and Y became the same due to a non-swap drop
        // (e.g., X was A, Y was B, user dragged A from field list to Y)
        // In this case, we generally want to clear the original slot of the duplicate.
        // This check should be more specific. If X and Y are now identical, and it wasn't a direct swap.
        if (xAxisField === yAxisField && xAxisField !== null) { // This check is after potential setX/Y
            if (target === 'x' && draggedItem.origin === 'y') { 
                // This was a swap: Y (source) to X (target), X (currentX) to Y (new YAxisField)
                // Already handled by the swap logic above.
            } else if (target === 'y' && draggedItem.origin === 'x') {
                // This was a swap: X (source) to Y (target), Y (currentY) to X (new XAxisField)
                // Already handled.
            } else if (target === 'x') { // Dragged a field (that was also Y) to X, or a new field to X making it same as Y
                 setYAxisField(null); // If X becomes same as Y, clear Y
            } else { // Dragged a field to Y, making it same as X
                 setXAxisField(null); // If Y becomes same as X, clear X
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
    
    // Data filtering for bar/horizontal-bar charts with string/date categories
    if ( (chartType === 'bar' && (xFieldType === 'string' || xFieldType === 'date') ) ) {
        // Aggregate Y values for each unique X category
        const valueCounts = chartData.reduce((acc, row) => {
            const value = String(row[xAxisField]); // Ensure category is string for grouping
            acc[value] = (acc[value] || 0) + (yFieldType === 'number' && typeof row[yAxisField] === 'number' ? Number(row[yAxisField]) : 1);
            return acc;
        }, {} as Record<string, number>);

        // Sort categories by aggregated Y values (descending) and take top 20
        const sortedUniqueValues = Object.entries(valueCounts)
            .sort(([, valA], [, valB]) => valB - valA) // Sort by aggregated value
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
        // For horizontal bar, Y-axis is categorical, X-axis is numerical
        const valueCounts = chartData.reduce((acc, row) => {
            const value = String(row[yAxisField]); // Ensure category (Y-axis) is string for grouping
            acc[value] = (acc[value] || 0) + (xFieldType === 'number' && typeof row[xAxisField] === 'number' ? Number(row[xAxisField]) : 1);
            return acc;
        }, {} as Record<string, number>);

        const sortedUniqueValues = Object.entries(valueCounts)
            .sort(([, valA], [, valB]) => valB - valA)
            .map(([value]) => value);
        
        if (sortedUniqueValues.length > 20) {
            const top20Values = new Set(sortedUniqueValues.slice(0, 20));
            chartData = chartData.filter(row => top20Values.has(String(row[yAxisField]))); // Filter based on Y-axis categories
             toast({
                title: "Data Filtered",
                description: `Y-axis field "${yAxisField}" displaying top 20 unique values by their aggregated X-axis values or frequency.`,
            });
        }
    }
    
    if (chartData.length === 0) { // Check if filtering left no data
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
        // For horizontal bar, xKey is numeric, yKey is categorical
        series = [{ type: 'bar', direction:'horizontal',  xKey: xAxisField, yKey: yAxisField, xName: xAxisField, yName: yAxisField }];
        axes = [
            { type: 'number', position: 'bottom', title: { text: xAxisField } }, 
            { type: (yFieldType === 'string' || yFieldType === 'date') ? 'category' : 'number', position: 'left', title: { text: yAxisField } }, 
        ];
        titleText = `${xAxisField} by ${yAxisField}`; // Title might need to reflect this swap if axes are swapped in AG sense
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
        if (yFieldType !== 'number') { // Angle key (values) must be numeric
            toast({ title: "Type Error", description: "Donut charts require a numeric field for values (Angle Key).", variant: "destructive"});
            setInternalChartOptions(null); setIsChartLoading(false); return;
        }
         if (xFieldType !== 'string' && xFieldType !== 'date') { // Callout label key (categories) should be string/date
            toast({ title: "Type Error", description: "Donut charts require a categorical or date field for labels (Callout Label Key).", variant: "destructive"});
            setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'donut', angleKey: yAxisField, calloutLabelKey: xAxisField, legendItemKey: xAxisField }];
        axes = []; // Pie/Donut charts don't have axes in the same way
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
      autoSize: false, // Important: disable autoSize for manual dimension control via chartDimensions
    };
    
    setInternalChartOptions(newBaseChartOptions);
    setChartRenderKey(prevKey => prevKey + 1); // Force re-render of AgChartsReact
    setIsChartLoading(false);

    // Toast only if chart is actually being generated/updated
    if(xAxisField && yAxisField && jsonData.length > 0 && selectedFields.length > 0) { 
      toast({
        title: "Visualization Updated!",
        description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.`,
      });
    }
  }, [chartType, xAxisField, yAxisField, jsonData, selectedFields, headerTypes]); // Dependencies for useCallback

  // Effect to regenerate chart when relevant state changes
  useEffect(() => {
    if (xAxisField && yAxisField && jsonData.length > 0 && selectedFields.length > 0 && selectedFields.includes(xAxisField) && selectedFields.includes(yAxisField) && chartDimensions) {
      setIsChartLoading(true);
      setIsChartApiReady(false); // Chart will be re-rendered
      const timer = setTimeout(() => {
        regenerateChartLogic();
      }, 300); // Debounce to avoid rapid re-renders during quick changes
      return () => clearTimeout(timer);
    } else {
      setInternalChartOptions(null); // Clear chart if conditions not met
      setIsChartLoading(false); // Ensure loading state is false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, xAxisField, yAxisField, jsonData, selectedFields, headerTypes, chartDimensions, regenerateChartLogic, resolvedTheme]); // Add regenerateChartLogic to deps

  // When chart options are cleared, ensure API ready is false
  useEffect(() => {
    if (!chartOptionsToRender) {
      setIsChartApiReady(false);
    }
  }, [chartOptionsToRender]);


  const sanitizeFilename = (name: string | undefined): string => {
    if (!name) return 'chart.png';
    // Replace non-alphanumeric characters (except underscore, dot, hyphen) with underscore
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
                document.body.appendChild(link); // Required for Firefox
                link.click();
                document.body.removeChild(link); // Clean up
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
    if (fieldToDeselect && yAxisField !== fieldToDeselect) { // Only deselect if it's not also on Y
        setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    }
  };

  const handleYAxisClear = () => {
    const fieldToDeselect = yAxisField;
    setYAxisField(null);
    if (fieldToDeselect && xAxisField !== fieldToDeselect) { // Only deselect if it's not also on X
         setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    }
  };


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
                    className="py-1 px-2 text-xs h-auto"
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
                    className={cn(
                        "w-full",
                        "bg-[var(--btn-primary-lg-bg)] text-[var(--btn-primary-lg-fg)] border border-[var(--btn-primary-lg-border)]",
                        "hover:bg-[var(--btn-primary-lg-hover-bg)] hover:border-[var(--btn-primary-lg-hover-border)]",
                      )}
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
              {tableHeaders.length > 0 ? tableHeaders.map((header) => (
                <div 
                  key={header} 
                  className="flex items-center space-x-2 py-1.5 px-1 rounded-md hover:bg-accent transition-colors"
                  draggable={selectedFields.includes(header)} // Make draggable if selected
                  onDragStart={() => handleDragStart(header, selectedFields.includes(xAxisField || "") && xAxisField === header ? 'x' : (selectedFields.includes(yAxisField || "") && yAxisField === header ? 'y' : 'x'))} // Simplified origin, can refine if needed
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
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate cursor-pointer flex-grow text-foreground"
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

        {/* Main Content Area: Data Preview and Visualization */}
        <div className="flex-grow flex flex-col overflow-hidden bg-secondary">
          {/* Data Preview Section (Collapsible) */}
          <div className="bg-card"> {/* Removed border-b */}
            <Accordion type="single" collapsible defaultValue="preview-accordion-item" className="w-full">
              <AccordionItem value="preview-accordion-item" className="border-b-0"> {/* Remove bottom border from item */}
                 <AccordionPrimitiveTrigger className="flex w-full items-center justify-between p-4 hover:no-underline text-sm font-semibold group data-[state=closed]:border-b data-[state=closed]:border-border text-foreground">
                     Data Preview
                     {/* <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 text-muted-foreground" /> */}
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
                        <p className="text-sm text-muted-foreground">Select fields or connect data to see a preview.</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Visualization Section (Collapsible) */}
          <div className="flex-grow flex flex-col border-b-0 bg-card mt-0 border-t border-border"> {/* Visualization section container with card bg */}
             <Accordion type="single" collapsible defaultValue="viz-accordion-item" className="w-full flex flex-col flex-grow">
              <AccordionItem value="viz-accordion-item" className="border-b-0 flex flex-col flex-grow">
                 <div className="flex w-full items-center justify-between p-4 text-sm font-semibold group border-b data-[state=closed]:border-b-0 border-border text-foreground"> {/* Header for Vis section */}
                  <AccordionPrimitiveTrigger className="flex flex-1 items-center py-0 font-semibold text-sm transition-all hover:no-underline group text-foreground">
                     Visualization
                  </AccordionPrimitiveTrigger>
                   <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 ml-2 rounded-md hover:bg-accent p-1 text-primary"
                      onClick={handleDownloadChart}
                      disabled={!chartOptionsToRender || !isChartApiReady}
                      aria-label="Download chart"
                      title="Download chart as PNG"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                </div>
                <AccordionContent className="p-4 pt-2 space-y-4 flex flex-col flex-grow bg-card">
                  {/* Chart Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <Label htmlFor="chartType" className="text-xs text-muted-foreground">Chart Type</Label>
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
                      <Label htmlFor="xAxis" className="text-xs text-muted-foreground">X-Axis</Label>
                      <div
                        id="xAxisContainer" 
                        draggable={!!xAxisField && selectedFields.length > 0 && selectedFields.includes(xAxisField)}
                        onDragStart={() => xAxisField && handleDragStart(xAxisField, 'x')}
                        onDrop={() => handleDrop('x')}
                        onDragOver={handleDragOver}
                        className={`flex items-center justify-between p-2 border border-input rounded-md min-h-[36px] bg-background text-xs text-foreground ${!!xAxisField && selectedFields.length > 0 && selectedFields.includes(xAxisField) ? 'cursor-grab' : 'cursor-default opacity-70'}`}
                      >
                        <span className="truncate" title={xAxisField || "Select field for X-Axis"}>{xAxisField || 'Select Field'}</span>
                        {xAxisField && <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" onClick={handleXAxisClear}><XIcon className="w-3 h-3" /></Button>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="yAxis" className="text-xs text-muted-foreground">Y-Axis</Label>
                      <div
                        id="yAxisContainer"
                        draggable={!!yAxisField && selectedFields.length > 0 && selectedFields.includes(yAxisField)}
                        onDragStart={() => yAxisField && handleDragStart(yAxisField, 'y')}
                        onDrop={() => handleDrop('y')}
                        onDragOver={handleDragOver}
                        className={`flex items-center justify-between p-2 border border-input rounded-md min-h-[36px] bg-background text-xs text-foreground ${!!yAxisField && selectedFields.length > 0 && selectedFields.includes(yAxisField) ? 'cursor-grab' : 'cursor-default opacity-70'}`}
                      >
                        <span className="truncate" title={yAxisField || "Select field for Y-Axis"}>{yAxisField || 'Select Field'}</span>
                        {yAxisField && <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" onClick={handleYAxisClear}><XIcon className="w-3 h-3" /></Button>}
                      </div>
                    </div>
                  </div>
                                      
                  {/* Chart Rendering Area */}
                  <div ref={chartContainerRef} className="w-full relative ag-chart-wrapper flex-grow min-h-0 h-[400px] max-h-[400px] bg-card border border-border rounded-md">
                    {isChartLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-card/50 z-10 rounded-md">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                    <div className={`${isChartLoading && chartOptionsToRender ? 'opacity-50' : ''} h-full w-full`}>
                      {(chartOptionsToRender && chartDimensions && chartDimensions.width > 0 && chartDimensions.height > 0) ? (
                        <AgChartsReact 
                          options={chartOptionsToRender} 
                          key={chartRenderKey} 
                          onChartReady={(chart) => { // Callback when chart instance is ready
                            chartApiRef.current = chart; // Store the chart instance
                            setIsChartApiReady(true);
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                          {(selectedFields.length === 0 || jsonData.length === 0) ? (
                            <>
                              <BarChart className="h-12 w-12 text-muted-foreground mb-2" data-ai-hint="document data" />
                              <p className="text-sm text-muted-foreground">Connect data and select fields to visualize.</p>
                            </>
                          ) : (!xAxisField || !yAxisField) ? (
                            <>
                              <BarChart className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="chart axes" />
                              <p className="text-sm text-muted-foreground">Assign fields to X and Y axes.</p>
                            </>
                          ) : ( // Fallback if options are null but fields are selected (e.g. waiting for dimensions)
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
      {/* Data Source Modal */}
      <DataSourceModal 
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onDataSourceConnected={handleDataSourceConnected}
      />
    </div>
  );
}

