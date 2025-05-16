
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
  tableHeaders: string[]; 
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
  tableHeaders,
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
  const { resolvedTheme } = useTheme();

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
      // Initial dimension set
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


  const regenerateChartLogic = useCallback(() => {
    if (!currentXAxisField || jsonData.length === 0 ) { 
      setIsChartLoading(false);
      setInternalChartOptions(null);
      return;
    }
    
    let yKeysForChart: string[] = [];
    if (chartType === 'stacked-bar' || chartType === 'grouped-bar') {
        yKeysForChart = selectedFields.filter(
            field => field !== currentXAxisField && headerTypes[field] === 'number'
        );
        if (yKeysForChart.length === 0) {
             toast({ title: "Configuration error", description: "Stacked/Grouped Bar charts require at least one numeric Y-axis field selected (from the main Fields panel).", variant: "destructive" });
             setInternalChartOptions(null); setIsChartLoading(false); return;
        }
    } else if (chartType !== 'donut' && !currentYAxisField) {
        setIsChartLoading(false);
        setInternalChartOptions(null);
        return;
    }


    let chartData = [...jsonData]; 
    
    const xFieldType = headerTypes[currentXAxisField];
    const yFieldType = currentYAxisField ? headerTypes[currentYAxisField] : null;

    let series: AgChartOptions['series'] = [];
    let axesOptions: AgCartesianAxisOptions[] | undefined = []; 
    let titleText = currentYAxisField ? `${currentYAxisField} by ${currentXAxisField}` : `Distribution by ${currentXAxisField}`;

    if ((chartType === 'bar' && currentYAxisField && (xFieldType === 'string' || xFieldType === 'date'))) {
      const valueCounts = chartData.reduce((acc, row) => {
        const xValCategory = String(getNestedValue(row, currentXAxisField!));
        const yValNumericRaw = getNestedValue(row, currentYAxisField!);
        const yValNumeric = headerTypes[currentYAxisField!] === 'number' && typeof yValNumericRaw === 'number' ? Number(yValNumericRaw) : 1; 
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
        toast({ title: "Data filtered", description: `X-axis field "${currentXAxisField}" displaying top 20 unique values by their aggregated Y-axis values.` });
      } else {
         chartData = aggregatedDataForChart;
      }
    } else if ((chartType === 'horizontal-bar' && currentYAxisField && (yFieldType === 'string' || yFieldType === 'date'))) {
      const valueCounts = chartData.reduce((acc, row) => {
        const yValCategory = String(getNestedValue(row, currentYAxisField!));
        const xValNumericRaw = getNestedValue(row, currentXAxisField!);
        const xValNumeric = headerTypes[currentXAxisField!] === 'number' && typeof xValNumericRaw === 'number' ? Number(xValNumericRaw) : 1;
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
        toast({ title: "Data filtered", description: `Y-axis field "${currentYAxisField}" displaying top 20 unique values by their aggregated X-axis values.` });
      } else {
        chartData = aggregatedDataForChart; 
      }
    } else if (chartType === 'stacked-bar' || chartType === 'grouped-bar') {
        const validNumericYKeys = yKeysForChart; // Already determined
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
                toast({ title: "Data filtered", description: `X-axis displaying top 20 categories based on '${validNumericYKeys[0]}'.` });
            }
        } else { 
             toast({ title: "Axis type suggestion", description: "Stacked/Grouped Bar charts typically use a categorical X-axis.", variant: "default" });
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
            yNames: validNumericYKeys.map(name => name), 
            stacked: chartType === 'stacked-bar',
        }];
        axesOptions = [
            { type: (xFieldType === 'string' || xFieldType === 'date') ? 'category' : 'number', position: 'bottom', title: { text: currentXAxisField } },
            { type: 'number', position: 'left', title: { text: 'Values' } }, 
        ];
    }


    if (chartData.length === 0 && (chartType === 'bar' || chartType === 'horizontal-bar' || chartType === 'stacked-bar' || chartType === 'grouped-bar')) {
      toast({ title: "No data after filtering", description: "No data remains for the selected fields after filtering. Please check your selections or data.", variant: "destructive" });
      setInternalChartOptions(null);
      setIsChartLoading(false);
      return;
    }

    switch (chartType) {
      case 'bar':
        if (!currentYAxisField) {setInternalChartOptions(null); setIsChartLoading(false); return;}
        series = [{ type: 'bar', xKey: currentXAxisField, yKey: currentYAxisField }];
        axesOptions = [
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
        axesOptions = [
          { type: 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: (yFieldType === 'string' || yFieldType === 'date') ? 'category' : 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        titleText = `${currentXAxisField} by ${currentYAxisField}`;
        break;
      case 'scatter':
        if (!currentYAxisField || (xFieldType !== 'number' && xFieldType !== 'date') || (yFieldType !== 'number' && yFieldType !== 'date')) {
          toast({ title: "Type error", description: "Scatter plots require numeric or date X and Y axes.", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'scatter', xKey: currentXAxisField, yKey: currentYAxisField }];
        axesOptions = [
          { type: xFieldType === 'date' ? 'time' : 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: yFieldType === 'date' ? 'time' : 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        break;
      case 'donut':
        if (!currentYAxisField || headerTypes[currentYAxisField!] !== 'number') {
          toast({ title: "Type error", description: "Donut charts require a numeric field for values (Angle Key).", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        if (xFieldType !== 'string' && xFieldType !== 'date') {
          toast({ title: "Type error", description: "Donut charts require a categorical or date field for labels (Callout Label Key).", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'donut', angleKey: currentYAxisField!, calloutLabelKey: currentXAxisField, legendItemKey: currentXAxisField }];
        axesOptions = undefined; // Donut charts do not use axes
        titleText = `Distribution of ${currentYAxisField} by ${currentXAxisField}`;
        break;
      case 'stacked-bar':
      case 'grouped-bar':
        // Series and axesOptions already defined above
        break;
      default:
        toast({ title: "Unknown chart type", description: "Selected chart type is not supported.", variant: "destructive" });
        setInternalChartOptions(null); setIsChartLoading(false); return;
    }
    
    const baseOptionsConfig: Omit<AgChartOptions, 'width' | 'height' | 'theme' | 'axes'> & { axes?: AgCartesianAxisOptions[] } = {
      data: chartData,
      title: { text: titleText },
      series: series,
      autoSize: false, 
    };

    if (axesOptions !== undefined && chartType !== 'donut') { 
      baseOptionsConfig.axes = axesOptions;
    }
    
    setInternalChartOptions(baseOptionsConfig);
    setChartRenderKey(prevKey => prevKey + 1); 
    setIsChartLoading(false);
    if (currentXAxisField && (currentYAxisField || chartType === 'donut' || chartType === 'stacked-bar' || chartType === 'grouped-bar') && jsonData.length > 0 && (selectedFields.length > 0 || ( (chartType === 'stacked-bar' || chartType === 'grouped-bar') && yKeysForChart.length > 0 )  ) ) {
      toast({ title: "Visualization updated!", description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.` });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, currentXAxisField, currentYAxisField, jsonData, selectedFields, headerTypes, resolvedTheme]); 

  useEffect(() => {
    const xReady = currentXAxisField; 
    const yReadyForNonSpecialTypes = currentYAxisField; 
    const yReadyForSpecialTypes = chartType === 'donut' || chartType === 'stacked-bar' || chartType === 'grouped-bar';

    if (xReady && (yReadyForNonSpecialTypes || yReadyForSpecialTypes) && jsonData.length > 0 && chartDimensions) {
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
  }, [chartType, currentXAxisField, currentYAxisField, jsonData.length, selectedFields, headerTypes, chartDimensions, resolvedTheme, regenerateChartLogic]); // selectedFields added to deps for stacked/grouped

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
          toast({ title: "Chart downloading", description: `Downloading ${filename}...` });
        } catch (error) {
          console.error("Error generating chart image:", error);
          toast({ title: "Download failed", description: "Could not generate chart image.", variant: "destructive" });
        }
      } else {
        toast({ title: "Download failed", description: "Chart is not ready or canvas element not found.", variant: "destructive" });
      }
    } else {
      toast({ title: "Download failed", description: "Chart container not found.", variant: "destructive" });
    }
  };

  const handleXAxisClear = () => {
    setXAxisField(null);
  };

  const handleYAxisClear = () => {
    setYAxisField(null);
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
        types = axisType === 'x' ? '(Category/Date)' : (axisType === 'y' ? '(Numeric Values)' : '');
        break;
      default:
        return baseLabel;
    }
    return `${baseLabel} ${types}`;
  };

  const getAxisPlaceholder = (axisType: 'x' | 'y'): string => {
    switch (chartType) {
      case 'bar':
        return axisType === 'x' ? 'Select X-Axis (Categories)' : 'Select Y-Axis (Values)';
      case 'horizontal-bar':
        return axisType === 'x' ? 'Select X-Axis (Values)' : 'Select Y-Axis (Categories)';
      case 'scatter':
        return axisType === 'x' ? 'Select X-Axis (Numeric/Date)' : 'Select Y-Axis (Numeric/Date)';
      case 'donut':
        return axisType === 'x' ? 'Select Labels (Category/Date)' : 'Select Values (Numeric)';
      case 'stacked-bar':
      case 'grouped-bar':
        return axisType === 'x' ? 'Select X-Axis (Categories)' : (axisType === 'y' ? 'Y-Axis (Multiple Numeric)' : 'Y-Axis (Multiple Numeric)');
      default:
        return `Select field for ${axisType.toUpperCase()}-Axis`;
    }
  };

  const getValidFieldsForAxis = (axis: 'x' | 'y'): string[] => {
    if (tableHeaders.length === 0) return [];

    const isNumeric = (field: string) => headerTypes[field] === 'number';
    const isCategorical = (field: string) => headerTypes[field] === 'string' || headerTypes[field] === 'date';
    const isGeo = (field: string) => headerTypes[field] === 'geojson-coordinates';


    switch (chartType) {
      case 'bar':
        if (axis === 'x') return tableHeaders.filter(f => isCategorical(f) || isNumeric(f));
        if (axis === 'y') return tableHeaders.filter(f => isNumeric(f) && f !== currentXAxisField);
        break;
      case 'horizontal-bar':
        if (axis === 'x') return tableHeaders.filter(f => isNumeric(f));
        if (axis === 'y') return tableHeaders.filter(f => isCategorical(f) && f !== currentXAxisField);
        break;
      case 'scatter':
        if (axis === 'x') return tableHeaders.filter(f => isNumeric(f) || headerTypes[f] === 'date');
        if (axis === 'y') return tableHeaders.filter(f => (isNumeric(f) || headerTypes[f] === 'date') && f !== currentXAxisField);
        break;
      case 'donut':
        if (axis === 'x') return tableHeaders.filter(f => isCategorical(f)); // Labels
        if (axis === 'y') return tableHeaders.filter(f => isNumeric(f) && f !== currentXAxisField); // Values
        break;
      case 'stacked-bar':
      case 'grouped-bar':
        if (axis === 'x') return tableHeaders.filter(f => isCategorical(f));
        // For Y-axis of stacked/grouped, it's based on multiple selected numeric fields.
        // The Select input might represent one (e.g., the first, or none if implicit).
        // For simplicity, let's allow selecting any numeric field not used in X.
        // The actual series generation will use all selected numeric fields.
        if (axis === 'y') return tableHeaders.filter(f => isNumeric(f) && f !== currentXAxisField); 
        break;
    }
    return tableHeaders.filter(f => !isGeo(f)); 
  };

  const handleSetAxisField = (field: string | null, axis: 'x' | 'y') => {
    if (axis === 'x') {
      setXAxisField(field);
    } else {
      setYAxisField(field);
    }
    if (field && !selectedFields.includes(field)) {
      setSelectedFields(prev => [...new Set([...prev, field])]);
    }
  };


  return (
    <div className="flex flex-grow bg-card space-x-4">
      {/* Left Panel: Controls */}
      <div className="w-[200px] flex-shrink-0 space-y-3">
        <div>
          <Label htmlFor="chartType" className="text-xs text-muted-foreground">Chart type</Label>
          <Select 
            value={chartType} 
            onValueChange={(value) => { setChartType(value); }} 
            name="chartType"
          >
            <SelectTrigger id="chartType" className="h-9 text-xs"><SelectValue placeholder="Select chart type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bar" className="text-xs">Simple Bar</SelectItem>
              <SelectItem value="horizontal-bar" className="text-xs">Horizontal Bar</SelectItem>
              <SelectItem value="stacked-bar" className="text-xs">Stacked Bar</SelectItem>
              <SelectItem value="grouped-bar" className="text-xs">Grouped Bar</SelectItem>
              <SelectItem value="scatter" className="text-xs">Scatter Plot</SelectItem>
              <SelectItem value="donut" className="text-xs">Donut Chart</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="xAxisSelect" className="text-xs text-muted-foreground">{getAxisLabel('x')}</Label>
          <div className="flex items-center space-x-1">
            <Select
              value={currentXAxisField || ""}
              onValueChange={(value) => handleSetAxisField(value === "" ? null : value, 'x')}
              name="xAxisSelect"
              disabled={getValidFieldsForAxis('x').length === 0 && !currentXAxisField}
            >
              <SelectTrigger id="xAxisSelect" className="h-9 text-xs flex-grow min-w-0">
                <SelectValue placeholder={getAxisPlaceholder('x')} />
              </SelectTrigger>
              <SelectContent>
                {getValidFieldsForAxis('x').map(field => (
                  <SelectItem key={`x-${field}`} value={field} className="text-xs">
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentXAxisField && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary flex-shrink-0" onClick={handleXAxisClear}><XIcon className="w-3.5 h-3.5" /></Button>}
          </div>
        </div>
        
        <div>
          <Label htmlFor="yAxisSelect" className="text-xs text-muted-foreground">{getAxisLabel('y')}</Label>
            <div className="flex items-center space-x-1">
            <Select
              value={currentYAxisField || ""}
              onValueChange={(value) => handleSetAxisField(value === "" ? null : value, 'y')}
              name="yAxisSelect"
              disabled={
                (chartType === 'stacked-bar' || chartType === 'grouped-bar') || 
                (getValidFieldsForAxis('y').length === 0 && !currentYAxisField)
              }
            >
              <SelectTrigger id="yAxisSelect" className="h-9 text-xs flex-grow min-w-0">
                <SelectValue placeholder={getAxisPlaceholder('y')} />
              </SelectTrigger>
              <SelectContent>
                  {getValidFieldsForAxis('y').map(field => (
                  <SelectItem key={`y-${field}`} value={field} className="text-xs">
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentYAxisField && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary flex-shrink-0" onClick={handleYAxisClear}><XIcon className="w-3.5 h-3.5" /></Button>}
          </div>
          {(chartType === 'stacked-bar' || chartType === 'grouped-bar') && (
              <p className="text-xs text-muted-foreground mt-1">Y-values derived from all selected numeric fields.</p>
          )}
        </div>
      </div>

      {/* Right Panel: Chart Rendering Area */}
      <div className="flex-grow flex flex-col min-w-0">
        <div ref={chartContainerRef} className="w-full relative ag-chart-wrapper flex-grow min-h-0 h-[400px] max-h-[400px] bg-card border border-[var(--border-color-secondary)] rounded-md">
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
                {(tableHeaders.length === 0 || jsonData.length === 0) ? (
                  <>
                    <BarChart className="h-12 w-12 text-muted-foreground mb-2" data-ai-hint="document data" />
                    <p className="text-sm text-muted-foreground">Connect data to visualize.</p>
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
              variant={!chartOptionsToRender || !isChartApiReady ? "lgDisabled" : "lgDefault"}
              size="sm"
              className="h-8 rounded-md px-3 text-xs"
              onClick={handleDownloadChart}
              disabled={!chartOptionsToRender || !isChartApiReady} 
              aria-label="Download chart"
              title="Download chart as PNG"
            >
              <Download className="h-3.5 w-3.5" />
              Download chart
          </Button>
        </div>
      </div>
    </div>
  );
}
