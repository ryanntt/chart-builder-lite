
"use client";

import type React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
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
import { XIcon, BarChart, Download, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { getNestedValue } from "@/lib/utils"; 

interface ChartVisualizationProps {
  jsonData: any[]; 
  headerTypes: Record<string, string>; 
  selectedFields: string[]; 
  setSelectedFields: React.Dispatch<React.SetStateAction<string[]>>;
  currentXAxisField: string | null; 
  setXAxisField: (field: string | null) => void;
  currentYAxisField: string | null; 
  setYAxisField: (field: string | null) => void;
  chartType: string;
  setChartType: (type: string) => void;
}

export function ChartVisualization({
  jsonData,
  headerTypes,
  selectedFields,
  setSelectedFields,
  currentXAxisField,
  setXAxisField,
  currentYAxisField,
  setYAxisField,
  chartType,
  setChartType,
}: ChartVisualizationProps) {
  const chartApiRef = useRef<AgChart | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { theme: resolvedTheme } = useTheme();

  const [draggedItem, setDraggedItem] = useState<{ field: string; origin: 'x' | 'y' } | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isChartApiReady, setIsChartApiReady] = useState(false);
  const [chartDimensions, setChartDimensions] = useState<{ width: number; height: number } | null>(null);
  const [internalChartOptions, setInternalChartOptions] = useState<Omit<AgChartOptions, 'width' | 'height' | 'theme'> | null>(null);
  const [chartRenderKey, setChartRenderKey] = useState(0);

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
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        if (!chartDimensions || Math.abs(chartDimensions.width - width) > 1 || Math.abs(chartDimensions.height - height) > 1) {
          setChartDimensions({ width, height });
        }
      }
      return () => resizeObserver.unobserve(container);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartContainerRef.current]); // Only re-run if chartContainerRef.current itself changes

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
      const currentX = currentXAxisField;
      const currentY = currentYAxisField;

      if (target === 'x') {
        if (sourceField === currentY) {
          setXAxisField(sourceField);
          setYAxisField(currentX);
        } else if (sourceField !== currentX) {
          setXAxisField(sourceField);
        }
      } else { // target === 'y'
        if (sourceField === currentX) {
          setYAxisField(sourceField);
          setXAxisField(currentY);
        } else if (sourceField !== currentY) {
          setYAxisField(sourceField);
        }
      }
      
      const newX = target === 'x' ? sourceField : currentXAxisField;
      const newY = target === 'y' ? sourceField : currentYAxisField;

      if (newX && newY && newX === newY) {
          if (draggedItem.origin === 'x' && target === 'y') { // Dragged X to Y, X was original Y
             setXAxisField(currentY); // old Y becomes new X
          } else if (draggedItem.origin === 'y' && target === 'x') { // Dragged Y to X, Y was original X
             setYAxisField(currentX); // old X becomes new Y
          } else if (target === 'x') { // Dropped on X, and it's now same as Y
            setYAxisField(null); // Clear Y if it wasn't a direct swap that resulted in sameness
          } else { // Dropped on Y, and it's now same as X
            setXAxisField(null); // Clear X
          }
      }
      setDraggedItem(null);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const regenerateChartLogic = useCallback(() => {
    if (!currentXAxisField || jsonData.length === 0 || !selectedFields.includes(currentXAxisField) ) {
      setIsChartLoading(false);
      setInternalChartOptions(null);
      return;
    }
    
    // For non-donut charts, Y-axis field is also crucial
    if (chartType !== 'donut' && (!currentYAxisField || !selectedFields.includes(currentYAxisField))) {
        setIsChartLoading(false);
        setInternalChartOptions(null);
        return;
    }


    let chartData = [...jsonData]; // Make a mutable copy
    
    const xFieldType = headerTypes[currentXAxisField];
    const yFieldType = currentYAxisField ? headerTypes[currentYAxisField] : null;

    let series: AgChartOptions['series'] = [];
    let axes: AgCartesianAxisOptions[] = [];
    let titleText = currentYAxisField ? `${currentYAxisField} by ${currentXAxisField}` : `Distribution by ${currentXAxisField}`;

    // Data aggregation for bar, horizontal-bar (single Y series)
    if ((chartType === 'bar' && (xFieldType === 'string' || xFieldType === 'date'))) {
      const valueCounts = chartData.reduce((acc, row) => {
        const xValCategory = String(getNestedValue(row, currentXAxisField!));
        const yValNumericRaw = getNestedValue(row, currentYAxisField!);
        const yValNumeric = yFieldType === 'number' && typeof yValNumericRaw === 'number' ? Number(yValNumericRaw) : 1; // Count occurrences if Y isn't numeric
        acc[xValCategory] = (acc[xValCategory] || 0) + yValNumeric;
        return acc;
      }, {} as Record<string, number>);
      
      const aggregatedDataForChart = Object.entries(valueCounts).map(([category, value]) => ({
        [currentXAxisField!]: category,
        [currentYAxisField!]: value,
      }));

      const sortedAggregatedValues = [...aggregatedDataForChart].sort((a,b) => 
        Number(getNestedValue(b, currentYAxisField!)) - Number(getNestedValue(a, currentYAxisField!))
      );

      if (sortedAggregatedValues.length > 20) {
        chartData = sortedAggregatedValues.slice(0, 20);
        toast({ title: "Data Filtered", description: `X-axis field "${currentXAxisField}" displaying top 20 unique values by their aggregated Y-axis values.` });
      } else {
         chartData = aggregatedDataForChart;
      }
    } else if ((chartType === 'horizontal-bar' && currentYAxisField && (yFieldType === 'string' || yFieldType === 'date'))) {
      const valueCounts = chartData.reduce((acc, row) => {
        const yValCategory = String(getNestedValue(row, currentYAxisField!));
        const xValNumericRaw = getNestedValue(row, currentXAxisField!);
        const xValNumeric = xFieldType === 'number' && typeof xValNumericRaw === 'number' ? Number(xValNumericRaw) : 1;
        acc[yValCategory] = (acc[yValCategory] || 0) + xValNumeric;
        return acc;
      }, {} as Record<string, number>);

      const aggregatedDataForChart = Object.entries(valueCounts).map(([categoryValue, numericValue]) => ({
        [currentYAxisField!]: categoryValue, 
        [currentXAxisField!]: numericValue,  
      }));
      
      const sortedAggregatedValues = [...aggregatedDataForChart].sort((a, b) => {
          const valA = Number(getNestedValue(a, currentXAxisField!));
          const valB = Number(getNestedValue(b, currentXAxisField!));
          return valB - valA; 
      });
      
      if (sortedAggregatedValues.length > 20) {
        chartData = sortedAggregatedValues.slice(0, 20); 
        toast({ title: "Data Filtered", description: `Y-axis field "${currentYAxisField}" displaying top 20 unique values by their aggregated X-axis values.` });
      } else {
        chartData = aggregatedDataForChart; 
      }
    }

    // Logic for stacked and grouped bar
    if (chartType === 'stacked-bar' || chartType === 'grouped-bar') {
        const validNumericYKeys = selectedFields.filter(
            field => field !== currentXAxisField && headerTypes[field] === 'number'
        );

        if (validNumericYKeys.length === 0) {
            toast({ title: "Configuration Error", description: "Stacked/Grouped Bar charts require at least one numeric Y-axis field.", variant: "destructive" });
            setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        titleText = `${validNumericYKeys.join(', ')} by ${currentXAxisField}`;

        if (xFieldType === 'string' || xFieldType === 'date') {
            const aggregatedDataMap = new Map<string, { [key: string]: any }>();
            jsonData.forEach(row => {
                const xValCategory = String(getNestedValue(row, currentXAxisField!));
                let entry = aggregatedDataMap.get(xValCategory);
                if (!entry) {
                    entry = { [currentXAxisField!]: xValCategory };
                    validNumericYKeys.forEach(yKey => { entry![yKey] = 0; });
                }
                validNumericYKeys.forEach(yKey => {
                    const yValRaw = getNestedValue(row, yKey);
                    const yValNumeric = (headerTypes[yKey] === 'number' && typeof yValRaw === 'number') ? Number(yValRaw) : 0;
                    entry![yKey] = (entry![yKey] || 0) + yValNumeric;
                });
                aggregatedDataMap.set(xValCategory, entry);
            });
            chartData = Array.from(aggregatedDataMap.values());

            if (chartData.length > 20 && validNumericYKeys.length > 0) {
                chartData.sort((a, b) => Number(getNestedValue(b, validNumericYKeys[0])) - Number(getNestedValue(a, validNumericYKeys[0])));
                chartData = chartData.slice(0, 20);
                toast({ title: "Data Filtered", description: `X-axis displaying top 20 categories.` });
            }
        } else {
             toast({ title: "Axis Type Suggestion", description: "Stacked/Grouped Bar charts typically use a categorical X-axis.", variant: "default" });
             chartData = jsonData.map(row => {
                const item: { [key: string]: any } = { [currentXAxisField!]: getNestedValue(row, currentXAxisField!) };
                validNumericYKeys.forEach(yKey => {
                    const val = getNestedValue(row, yKey);
                    item[yKey] = (typeof val === 'number') ? val : null;
                });
                return item;
            }).filter(item => validNumericYKeys.some(yKey => item[yKey] !== null && item[yKey] !== undefined));
        }
         series = [{ 
            type: 'bar', 
            xKey: currentXAxisField!, 
            yKeys: validNumericYKeys, 
            yNames: validNumericYKeys.map(name => name), // Display actual field names in legend/tooltip
            stacked: chartType === 'stacked-bar',
            // grouped: chartType === 'grouped-bar' // AG Charts groups by default with multiple yKeys
        }];
        axes = [
            { type: (xFieldType === 'string' || xFieldType === 'date') ? 'category' : 'number', position: 'bottom', title: { text: currentXAxisField } },
            { type: 'number', position: 'left', title: { text: 'Values' } }, // Generic Y-axis title
        ];
    }


    if (chartData.length === 0 && (chartType === 'bar' || chartType === 'horizontal-bar' || chartType === 'stacked-bar' || chartType === 'grouped-bar')) {
      toast({ title: "No Data After Filtering", description: "No data remains for the selected fields after filtering. Please check your selections or data.", variant: "destructive" });
      setInternalChartOptions(null);
      setIsChartLoading(false);
      return;
    }

    switch (chartType) {
      case 'bar':
        if (!currentYAxisField) {setInternalChartOptions(null); setIsChartLoading(false); return;}
        series = [{ type: 'bar', xKey: currentXAxisField, yKey: currentYAxisField, yName: currentYAxisField }];
        axes = [
          { type: (xFieldType === 'string' || xFieldType === 'date') ? 'category' : 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        break;
      case 'horizontal-bar':
        if (!currentYAxisField) {setInternalChartOptions(null); setIsChartLoading(false); return;}
        series = [{ 
            type: 'bar', 
            direction: 'horizontal', 
            xKey: currentXAxisField, 
            yKey: currentYAxisField,
        }];
        axes = [
          { type: 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: (yFieldType === 'string' || yFieldType === 'date') ? 'category' : 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        titleText = `${currentXAxisField} by ${currentYAxisField}`;
        break;
      case 'scatter':
        if (!currentYAxisField || (xFieldType !== 'number' && xFieldType !== 'date') || (yFieldType !== 'number' && yFieldType !== 'date')) {
          toast({ title: "Type Error", description: "Scatter plots require numeric or date X and Y axes.", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'scatter', xKey: currentXAxisField, yKey: currentYAxisField }];
        axes = [
          { type: xFieldType === 'date' ? 'time' : 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: yFieldType === 'date' ? 'time' : 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        break;
      case 'donut':
        if (!currentYAxisField || yFieldType !== 'number') {
          toast({ title: "Type Error", description: "Donut charts require a numeric field for values (Angle Key).", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        if (xFieldType !== 'string' && xFieldType !== 'date') {
          toast({ title: "Type Error", description: "Donut charts require a categorical or date field for labels (Callout Label Key).", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'donut', angleKey: currentYAxisField!, calloutLabelKey: currentXAxisField, legendItemKey: currentXAxisField }];
        axes = undefined; 
        titleText = `Distribution of ${currentYAxisField} by ${currentXAxisField}`;
        break;
      case 'stacked-bar':
      case 'grouped-bar':
        // Series and axes already defined above for these types
        break;
      default:
        toast({ title: "Unknown Chart Type", description: "Selected chart type is not supported.", variant: "destructive" });
        setInternalChartOptions(null); setIsChartLoading(false); return;
    }
    
    const baseOptionsConfig: Omit<AgChartOptions, 'width' | 'height' | 'theme' | 'axes'> & { axes?: AgCartesianAxisOptions[] } = {
      data: chartData,
      title: { text: titleText },
      series: series,
      autoSize: false, 
    };

    if (axes !== undefined) { // Only add axes if they are defined (not for donut)
      baseOptionsConfig.axes = axes;
    }
    
    setInternalChartOptions(baseOptionsConfig);
    setChartRenderKey(prevKey => prevKey + 1); 
    setIsChartLoading(false);
    if (currentXAxisField && (currentYAxisField || chartType === 'donut' || chartType === 'stacked-bar' || chartType === 'grouped-bar') && jsonData.length > 0 && selectedFields.length > 0) {
      toast({ title: "Visualization Updated!", description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.` });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, currentXAxisField, currentYAxisField, jsonData, selectedFields, headerTypes, resolvedTheme]); 

  useEffect(() => {
    const xReady = currentXAxisField && selectedFields.includes(currentXAxisField);
    const yReady = chartType === 'donut' || chartType === 'stacked-bar' || chartType === 'grouped-bar' || (currentYAxisField && selectedFields.includes(currentYAxisField));

    if (xReady && yReady && jsonData.length > 0 && chartDimensions) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, currentXAxisField, currentYAxisField, jsonData.length, selectedFields, headerTypes, chartDimensions, resolvedTheme, regenerateChartLogic]); 

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
        const filename = sanitizeFilename(internalChartOptions?.title?.text);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast({ title: "Chart Downloading", description: `Downloading ${filename}...` });
        } catch (error) {
          console.error("Error generating chart image:", error);
          toast({ title: "Download Failed", description: "Could not generate chart image.", variant: "destructive" });
        }
      } else {
        toast({ title: "Download Failed", description: "Chart is not ready or canvas element not found.", variant: "destructive" });
      }
    } else {
      toast({ title: "Download Failed", description: "Chart container not found.", variant: "destructive" });
    }
  };

  const handleXAxisClear = () => {
    const fieldToDeselect = currentXAxisField;
    setXAxisField(null);
    if (fieldToDeselect && currentYAxisField !== fieldToDeselect) { 
      setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    } else if (fieldToDeselect && !currentYAxisField) { 
      setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    }
  };

  const handleYAxisClear = () => {
    const fieldToDeselect = currentYAxisField;
    setYAxisField(null);
    if (fieldToDeselect && currentXAxisField !== fieldToDeselect) { 
       setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    } else if (fieldToDeselect && !currentXAxisField) { 
       setSelectedFields(prev => prev.filter(f => f !== fieldToDeselect));
    }
  };
  
  const getAxisLabel = (axisType: 'x' | 'y'): string => {
    const baseLabel = axisType === 'x' ? 'X-Axis' : 'Y-Axis';
    let types = '';
    switch (chartType) {
      case 'bar':
        types = axisType === 'x' ? '(Category/Date/Number)' : '(Number)';
        break;
      case 'horizontal-bar':
        types = axisType === 'x' ? '(Number)' : '(Category/Date)';
        break;
      case 'scatter':
        types = '(Number/Date)';
        break;
      case 'donut':
        return axisType === 'x' ? 'Labels (Category/Date)' : 'Values (Number)';
      case 'stacked-bar':
      case 'grouped-bar':
        types = axisType === 'x' ? '(Category/Date)' : '(Numeric Values)';
        break;
      default:
        return baseLabel;
    }
    return `${baseLabel} ${types}`;
  };

  const getAxisPlaceholder = (axisType: 'x' | 'y'): string => {
    switch (chartType) {
      case 'bar':
        return axisType === 'x' ? 'Drop field for X-Axis (Categories)' : 'Drop field for Y-Axis (Values)';
      case 'horizontal-bar':
        return axisType === 'x' ? 'Drop field for X-Axis (Values)' : 'Drop field for Y-Axis (Categories)';
      case 'scatter':
        return axisType === 'x' ? 'Drop field for X-Axis (Numeric/Date)' : 'Drop field for Y-Axis (Numeric/Date)';
      case 'donut':
        return axisType === 'x' ? 'Drop field for Labels (Category/Date)' : 'Drop field for Values (Numeric)';
      case 'stacked-bar':
      case 'grouped-bar':
        return axisType === 'x' ? 'Drop field for X-Axis (Categories)' : 'Drop fields for Y-Axis (Values)';
      default:
        return `Select field for ${axisType.toUpperCase()}-Axis`;
    }
  };


  return (
    <div className="space-y-4 flex flex-col flex-grow bg-card">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <div className="space-y-1">
          <Label htmlFor="chartType" className="text-xs text-muted-foreground">Chart Type</Label>
          <Select value={chartType} onValueChange={(value) => { setChartType(value); }} name="chartType">
            <SelectTrigger id="chartType" className="h-9 text-xs"><SelectValue placeholder="Select chart type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bar" className="text-xs">Simple Bar</SelectItem>
              <SelectItem value="horizontal-bar" className="text-xs">Horizontal Bar</SelectItem>
              <SelectItem value="scatter" className="text-xs">Scatter Plot</SelectItem>
              <SelectItem value="donut" className="text-xs">Donut Chart</SelectItem>
              <SelectItem value="stacked-bar" className="text-xs">Stacked Bar</SelectItem>
              <SelectItem value="grouped-bar" className="text-xs">Grouped Bar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="xAxisContainer" className="text-xs text-muted-foreground">{getAxisLabel('x')}</Label>
          <div
            id="xAxisContainer"
            draggable={!!currentXAxisField && selectedFields.length > 0 && selectedFields.includes(currentXAxisField)}
            onDragStart={() => currentXAxisField && handleDragStart(currentXAxisField, 'x')}
            onDrop={() => handleDrop('x')}
            onDragOver={handleDragOver}
            className={`flex items-center justify-between p-2 border border-input rounded-md min-h-[36px] bg-background text-xs text-foreground ${!!currentXAxisField && selectedFields.length > 0 && selectedFields.includes(currentXAxisField) ? 'cursor-grab' : 'cursor-default opacity-70'}`}
            title={currentXAxisField || getAxisPlaceholder('x')}
          >
            <span className="truncate">{currentXAxisField || getAxisPlaceholder('x')}</span>
            {currentXAxisField && <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" onClick={handleXAxisClear}><XIcon className="w-3 h-3" /></Button>}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="yAxisContainer" className="text-xs text-muted-foreground">{getAxisLabel('y')}</Label>
          <div
            id="yAxisContainer"
            draggable={!!currentYAxisField && selectedFields.length > 0 && selectedFields.includes(currentYAxisField)}
            onDragStart={() => currentYAxisField && handleDragStart(currentYAxisField, 'y')}
            onDrop={() => handleDrop('y')}
            onDragOver={handleDragOver}
            className={`flex items-center justify-between p-2 border border-input rounded-md min-h-[36px] bg-background text-xs text-foreground ${!!currentYAxisField && selectedFields.length > 0 && selectedFields.includes(currentYAxisField) ? 'cursor-grab' : 'cursor-default opacity-70'}`}
            title={currentYAxisField || getAxisPlaceholder('y')}
          >
            <span className="truncate">{currentYAxisField || getAxisPlaceholder('y')}</span>
            {currentYAxisField && <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" onClick={handleYAxisClear}><XIcon className="w-3 h-3" /></Button>}
          </div>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full relative ag-chart-wrapper flex-grow min-h-0 h-[400px] max-h-[400px] bg-card border border-border-secondary rounded-md">
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
              onChartReady={(chart) => {
                chartApiRef.current = chart;
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
              ) : (!currentXAxisField || (chartType !== 'donut' && chartType !== 'stacked-bar' && chartType !== 'grouped-bar' && !currentYAxisField) ) ? (
                 <>
                  <BarChart className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="chart axes" />
                  <p className="text-sm text-muted-foreground">Assign fields to X and Y axes (or Labels/Values for Donut).</p>
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
       <div className="pt-2 flex justify-end">
         <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-md px-3 text-xs border-border-secondary"
            onClick={handleDownloadChart}
            disabled={!chartOptionsToRender || !isChartApiReady} 
            aria-label="Download chart"
            title="Download chart as PNG"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download Chart
          </Button>
       </div>
    </div>
  );
}

