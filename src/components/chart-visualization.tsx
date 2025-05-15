
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
  }, [chartContainerRef.current]);

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
      } else {
        if (sourceField === currentX) {
          setYAxisField(sourceField);
          setXAxisField(currentY);
        } else if (sourceField !== currentY) {
          setYAxisField(sourceField);
        }
      }
      if (currentXAxisField === currentYAxisField && currentXAxisField !== null) {
        if (target === 'x' && draggedItem.origin === 'y') {
        } else if (target === 'y' && draggedItem.origin === 'x') {
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
    if (!currentXAxisField || !currentYAxisField || jsonData.length === 0 || !selectedFields.includes(currentXAxisField) || !selectedFields.includes(currentYAxisField)) {
      setIsChartLoading(false);
      setInternalChartOptions(null);
      return;
    }

    let chartData = jsonData.map(row => ({
      [currentXAxisField]: row[currentXAxisField],
      [currentYAxisField]: row[currentYAxisField],
    }));

    const xFieldType = headerTypes[currentXAxisField];
    const yFieldType = headerTypes[currentYAxisField];

    let series: AgChartOptions['series'] = [];
    let axes: AgCartesianAxisOptions[] = [];
    let titleText = `${currentYAxisField} by ${currentXAxisField}`;

    if ((chartType === 'bar' && (xFieldType === 'string' || xFieldType === 'date'))) {
      const valueCounts = chartData.reduce((acc, row) => {
        const value = String(row[currentXAxisField]);
        acc[value] = (acc[value] || 0) + (yFieldType === 'number' && typeof row[currentYAxisField] === 'number' ? Number(row[currentYAxisField]) : 1);
        return acc;
      }, {} as Record<string, number>);
      const sortedUniqueValues = Object.entries(valueCounts).sort(([, valA], [, valB]) => valB - valA).map(([value]) => value);
      if (sortedUniqueValues.length > 20) {
        const top20Values = new Set(sortedUniqueValues.slice(0, 20));
        chartData = chartData.filter(row => top20Values.has(String(row[currentXAxisField])));
        toast({ title: "Data Filtered", description: `X-axis field "${currentXAxisField}" displaying top 20 unique values by their aggregated Y-axis values or frequency.` });
      }
    } else if ((chartType === 'horizontal-bar' && (yFieldType === 'string' || yFieldType === 'date'))) {
      const valueCounts = chartData.reduce((acc, row) => {
        const value = String(row[currentYAxisField]);
        acc[value] = (acc[value] || 0) + (xFieldType === 'number' && typeof row[currentXAxisField] === 'number' ? Number(row[currentXAxisField]) : 1);
        return acc;
      }, {} as Record<string, number>);
      const sortedUniqueValues = Object.entries(valueCounts).sort(([, valA], [, valB]) => valB - valA).map(([value]) => value);
      if (sortedUniqueValues.length > 20) {
        const top20Values = new Set(sortedUniqueValues.slice(0, 20));
        chartData = chartData.filter(row => top20Values.has(String(row[currentYAxisField])));
        toast({ title: "Data Filtered", description: `Y-axis field "${currentYAxisField}" displaying top 20 unique values by their aggregated X-axis values or frequency.` });
      }
    }

    if (chartData.length === 0) {
      toast({ title: "No Data After Filtering", description: "No data remains for the selected fields after filtering. Please check your selections or data.", variant: "destructive" });
      setInternalChartOptions(null);
      setIsChartLoading(false);
      return;
    }

    switch (chartType) {
      case 'bar':
        series = [{ type: 'bar', xKey: currentXAxisField, yKey: currentYAxisField, yName: currentYAxisField }];
        axes = [
          { type: (xFieldType === 'string' || xFieldType === 'date') ? 'category' : 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        break;
      case 'horizontal-bar':
        series = [{ type: 'bar', direction: 'horizontal', xKey: currentXAxisField, yKey: currentYAxisField, xName: currentXAxisField, yName: currentYAxisField }];
        axes = [
          { type: 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: (yFieldType === 'string' || yFieldType === 'date') ? 'category' : 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        titleText = `${currentXAxisField} by ${currentYAxisField}`;
        break;
      case 'scatter':
        if ((xFieldType !== 'number' && xFieldType !== 'date') || (yFieldType !== 'number' && yFieldType !== 'date')) {
          toast({ title: "Type Error", description: "Scatter plots require numeric or date X and Y axes.", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'scatter', xKey: currentXAxisField, yKey: currentYAxisField, xName: currentXAxisField, yName: currentYAxisField }];
        axes = [
          { type: xFieldType === 'date' ? 'time' : 'number', position: 'bottom', title: { text: currentXAxisField } },
          { type: yFieldType === 'date' ? 'time' : 'number', position: 'left', title: { text: currentYAxisField } },
        ];
        break;
      case 'donut':
        if (yFieldType !== 'number') {
          toast({ title: "Type Error", description: "Donut charts require a numeric field for values (Angle Key).", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        if (xFieldType !== 'string' && xFieldType !== 'date') {
          toast({ title: "Type Error", description: "Donut charts require a categorical or date field for labels (Callout Label Key).", variant: "destructive" });
          setInternalChartOptions(null); setIsChartLoading(false); return;
        }
        series = [{ type: 'donut', angleKey: currentYAxisField, calloutLabelKey: currentXAxisField, legendItemKey: currentXAxisField }];
        axes = [];
        titleText = `Distribution of ${currentYAxisField} by ${currentXAxisField}`;
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
      autoSize: false,
    };
    setInternalChartOptions(newBaseChartOptions);
    setChartRenderKey(prevKey => prevKey + 1);
    setIsChartLoading(false);
    if (currentXAxisField && currentYAxisField && jsonData.length > 0 && selectedFields.length > 0) {
      toast({ title: "Visualization Updated!", description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.` });
    }
  }, [chartType, currentXAxisField, currentYAxisField, jsonData, selectedFields, headerTypes]);

  useEffect(() => {
    if (currentXAxisField && currentYAxisField && jsonData.length > 0 && selectedFields.length > 0 && selectedFields.includes(currentXAxisField) && selectedFields.includes(currentYAxisField) && chartDimensions) {
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
  }, [chartType, currentXAxisField, currentYAxisField, jsonData, selectedFields, headerTypes, chartDimensions, regenerateChartLogic, resolvedTheme]);

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
    }
  };

  const handleYAxisClear = () => {
    const fieldToDeselect = currentYAxisField;
    setYAxisField(null);
    if (fieldToDeselect && currentXAxisField !== fieldToDeselect) {
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
      default:
        return `Select field for ${axisType.toUpperCase()}-Axis`;
    }
  };


  return (
    <div className="space-y-4 flex flex-col flex-grow bg-card">
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
              ) : (!currentXAxisField || !currentYAxisField) ? (
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
       <div className="pt-2 flex justify-end">
         <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-md px-3 text-xs"
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

    