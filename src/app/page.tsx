
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AgChartsReact } from 'ag-charts-react';
import type { AgChartOptions, AgCartesianAxisOptions, AgPieSeriesOptions, AgBarSeriesOptions, AgScatterSeriesOptions } from 'ag-charts-community';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XIcon, Upload } from "lucide-react";

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartOptions, setChartOptions] = useState<AgChartOptions | null>(null);
  
  const [chartType, setChartType] = useState<string>('bar');
  const [xAxisField, setXAxisField] = useState<string | null>(null);
  const [yAxisField, setYAxisField] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ field: string; origin: 'x' | 'y' } | null>(null);


  const chartContainerRef = useRef<HTMLDivElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setJsonData([]);
    setTableHeaders([]);
    setSelectedFields([]);
    setChartOptions(null);
    setXAxisField(null);
    setYAxisField(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim() !== '');
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV file must contain a header row and at least one data row.",
          variant: "destructive",
        });
        return;
      }
      
      const headers = lines[0].split(",").map((header: string) => header.trim());
      setTableHeaders(headers);

      const parsedData: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const currentLineValues = lines[i].split(",").map(value => value.trim());
        if (currentLineValues.length !== headers.length) {
          console.warn(`Skipping line ${i + 1} due to inconsistent number of columns.`);
          continue;
        }
        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
          let value: string | number | boolean = currentLineValues[j];
          if (value !== "" && !isNaN(Number(value))) {
            value = Number(value);
          } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
            value = value.toLowerCase() === 'true';
          }
          rowData[headers[j]] = value;
        }
        parsedData.push(rowData);
      }
      setJsonData(parsedData);
      toast({
        title: "CSV file parsed!",
        description: `${parsedData.length} data rows ready for preview.`,
      });

    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast({
        title: "Error parsing CSV",
        description: "Failed to read or parse the CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleFieldSelect = (field: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field];
      return newSelection;
    });
  };
  
  useEffect(() => {
    if (jsonData.length > 0 && selectedFields.length > 0) {
      const firstJsonRow = jsonData[0];
      
      let currentX = xAxisField;
      let currentY = yAxisField;

      if (currentX && !selectedFields.includes(currentX)) {
        currentX = null;
        setXAxisField(null);
        setChartOptions(null);
      }
      if (currentY && !selectedFields.includes(currentY)) {
        currentY = null;
        setYAxisField(null);
        setChartOptions(null);
      }
      
      if (!currentX) {
        const newX = selectedFields.find(f => typeof firstJsonRow[f] === 'string') || selectedFields[0];
        if (newX && newX !== currentY) {
          setXAxisField(newX);
          currentX = newX;
        }
      }
      
      if (!currentY) {
        const newY = selectedFields.find(f => typeof firstJsonRow[f] === 'number' && f !== currentX) || 
                     selectedFields.find(f => f !== currentX && typeof firstJsonRow[f] !== 'object'); // Avoid objects for Y
        if (newY) {
          setYAxisField(newY);
        }
      }
    } else if (selectedFields.length === 0) {
        setXAxisField(null);
        setYAxisField(null);
        setChartOptions(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFields, jsonData]);


  const handleDragStart = (field: string, origin: 'x' | 'y') => {
    setDraggedItem({ field, origin });
  };

  const handleDrop = (target: 'x' | 'y') => {
    if (draggedItem) {
      const sourceField = draggedItem.field;
      const sourceOrigin = draggedItem.origin;

      const currentX = xAxisField;
      const currentY = yAxisField;

      if (target === 'x') {
        setXAxisField(sourceField);
        if (sourceOrigin === 'y') setYAxisField(currentX);
      } else { // target === 'y'
        setYAxisField(sourceField);
        if (sourceOrigin === 'x') setXAxisField(currentY);
      }
      setChartOptions(null); // Reset chart on axis change
      setDraggedItem(null);
    }
  };
  
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };


  const visualizeData = () => {
    if (!xAxisField || !yAxisField) {
      toast({
        title: "Missing Fields",
        description: "Please ensure both X and Y axes have fields selected.",
        variant: "destructive",
      });
      return;
    }

    if (jsonData.length === 0) {
      toast({
        title: "No Data",
        description: "No data to visualize.",
        variant: "destructive",
      });
      return;
    }

    let chartData = jsonData.map(row => ({
      [xAxisField]: row[xAxisField],
      [yAxisField]: row[yAxisField],
    }));

    const xFieldType = typeof jsonData[0]?.[xAxisField];
    const yFieldType = typeof jsonData[0]?.[yAxisField];

    let series: AgChartOptions['series'] = [];
    let axes: AgCartesianAxisOptions[] = [];
    let titleText = `${yAxisField} by ${xAxisField}`;

    // Filter for top 20 unique string values on X-axis for bar charts
    if ((chartType === 'bar' || chartType === 'horizontal-bar') && xFieldType === 'string') {
        const valueCounts = chartData.reduce((acc, row) => {
            const value = String(row[xAxisField]);
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const sortedUniqueValues = Object.entries(valueCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([value]) => value);

        if (sortedUniqueValues.length > 20) {
            const top20Values = new Set(sortedUniqueValues.slice(0, 20));
            chartData = chartData.filter(row => top20Values.has(String(row[xAxisField])));
            toast({
                title: "Data Filtered",
                description: `X-axis field "${xAxisField}" displaying top 20 values by frequency.`,
            });
        }
    }
    
    if (chartData.length === 0) {
        toast({
          title: "No Data After Filtering",
          description: "No data remains for the selected fields after filtering. Please check your selections or data.",
          variant: "destructive",
        });
        setChartOptions(null);
        return;
    }


    switch (chartType) {
      case 'bar':
        series = [{ type: 'bar', xKey: xAxisField, yKey: yAxisField, yName: yAxisField }];
        axes = [
          { type: xFieldType === 'string' ? 'category' : 'number', position: 'bottom', title: { text: xAxisField } },
          { type: 'number', position: 'left', title: { text: yAxisField } },
        ];
        break;
      case 'horizontal-bar':
        series = [{ type: 'bar', xKey: yAxisField, yKey: xAxisField, xName: yAxisField, yName: xAxisField }]; // xKey is numeric, yKey is category
        axes = [
          { type: 'number', position: 'bottom', title: { text: yAxisField } },
          { type: xFieldType === 'string' ? 'category' : 'number', position: 'left', title: { text: xAxisField } },
        ];
        titleText = `${yAxisField} by ${xAxisField}`;
        break;
      case 'scatter':
        if (xFieldType !== 'number' || yFieldType !== 'number') {
            toast({ title: "Type Error", description: "Scatter plots require numeric X and Y axes.", variant: "destructive"});
            return;
        }
        series = [{ type: 'scatter', xKey: xAxisField, yKey: yAxisField, xName: xAxisField, yName: yAxisField }];
        axes = [
          { type: 'number', position: 'bottom', title: { text: xAxisField } },
          { type: 'number', position: 'left', title: { text: yAxisField } },
        ];
        break;
      case 'pie':
        if (yFieldType !== 'number') {
            toast({ title: "Type Error", description: "Pie charts require a numeric field for values (Y-axis).", variant: "destructive"});
            return;
        }
         if (xFieldType !== 'string') {
            toast({ title: "Type Error", description: "Pie charts require a categorical field for labels (X-axis).", variant: "destructive"});
            return;
        }
        series = [{ type: 'pie', angleKey: yAxisField, labelKey: xAxisField, calloutLabelKey: xAxisField, sectorLabelKey: yAxisField, legendItemKey: xAxisField }];
        axes = []; // Pie charts don't use Cartesian axes
        break;
      default:
        toast({ title: "Unknown Chart Type", description: "Selected chart type is not supported.", variant: "destructive" });
        return;
    }

    setChartOptions({
      data: chartData,
      title: { text: titleText },
      series: series,
      axes: axes.length > 0 ? axes : undefined,
    });

    toast({
      title: "Visualization Rendered!",
      description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.`,
    });
  };
  
  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-2 bg-secondary">
      <Toaster />
      <Card className="w-full max-w-full space-y-4 p-4 rounded-lg shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-center">CSV Atlas Uploader & Visualizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2 items-center">
            <Label htmlFor="csv-upload" className="text-sm font-medium">Upload CSV File:</Label>
            <div className="flex gap-2">
              <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="max-w-xs"/>
              <Button onClick={() => { /* Placeholder for future upload to Atlas logic */ toast({title: "Upload to Atlas", description: "This feature is not yet implemented."}) }} >
                <Upload className="mr-2 h-4 w-4" /> Upload to Atlas
              </Button>
            </div>
          </div>
          
          {jsonData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
              {/* Data Preview Column (Field Selection) */}
              <Card className="p-4 rounded-md bg-muted" style={{ width: '300px' }}>
                <CardHeader className="p-2">
                  <CardTitle className="text-md font-semibold">Data Fields</CardTitle>
                  <CardDescription>Select fields for preview and visualization.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
                  <ul className="space-y-1">
                    {tableHeaders.map((header) => (
                      <li key={header} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`checkbox-${header}`}
                          checked={selectedFields.includes(header)}
                          onCheckedChange={() => handleFieldSelect(header)}
                          aria-label={`Select field ${header}`}
                        />
                        <Label
                          htmlFor={`checkbox-${header}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                          title={header}
                        >
                          {header}
                        </Label>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Selected Fields & Visualization Column */}
              <div className="flex flex-col space-y-4">
                <Card className="p-4 rounded-md bg-muted overflow-x-auto">
                  <CardHeader className="p-2">
                    <CardTitle className="text-md font-semibold">Selected Fields Preview</CardTitle>
                    <CardDescription>Top 10 rows of selected data.</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[250px] overflow-y-auto p-2">
                    {selectedFields.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {selectedFields.map((header) => (
                              <TableHead key={header}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jsonData.slice(0, 10).map((row, index) => (
                            <TableRow key={index}>
                              {selectedFields.map((header) => (
                                <TableCell key={header}>{String(row[header])}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select fields from the list to see a preview.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="p-4 rounded-md bg-muted flex-grow">
                  <CardHeader className="p-2">
                    <CardTitle className="text-md font-semibold">Visualization Controls & Output</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1">
                        <Label htmlFor="chartType">Chart Type</Label>
                        <Select value={chartType} onValueChange={(value) => { setChartType(value); setChartOptions(null); }} name="chartType">
                          <SelectTrigger id="chartType"><SelectValue placeholder="Select chart type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bar">Simple Bar</SelectItem>
                            <SelectItem value="horizontal-bar">Horizontal Bar</SelectItem>
                            <SelectItem value="scatter">Scatter Plot</SelectItem>
                            <SelectItem value="pie">Pie Chart</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="xAxis">X-Axis</Label>
                        <div
                          id="xAxis"
                          draggable={!!xAxisField}
                          onDragStart={() => xAxisField && handleDragStart(xAxisField, 'x')}
                          onDrop={() => handleDrop('x')}
                          onDragOver={handleDragOver}
                          className="flex items-center justify-between p-2 border rounded-md min-h-[38px] bg-background cursor-grab text-sm"
                        >
                          <span className="truncate" title={xAxisField || undefined}>{xAxisField || 'Drop/Select'}</span>
                          {xAxisField && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setXAxisField(null); setChartOptions(null); }}><XIcon className="w-3 h-3" /></Button>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="yAxis">Y-Axis</Label>
                        <div
                          id="yAxis"
                          draggable={!!yAxisField}
                          onDragStart={() => yAxisField && handleDragStart(yAxisField, 'y')}
                          onDrop={() => handleDrop('y')}
                          onDragOver={handleDragOver}
                          className="flex items-center justify-between p-2 border rounded-md min-h-[38px] bg-background cursor-grab text-sm"
                        >
                           <span className="truncate" title={yAxisField || undefined}>{yAxisField || 'Drop/Select'}</span>
                          {yAxisField && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setYAxisField(null); setChartOptions(null); }}><XIcon className="w-3 h-3" /></Button>}
                        </div>
                      </div>
                    </div>
                    <Button 
                        onClick={visualizeData} 
                        disabled={!xAxisField || !yAxisField || selectedFields.length === 0}
                        className="w-full sm:w-auto"
                    >
                        Visualize
                    </Button>
                    
                    {chartOptions && (
                       <div ref={chartContainerRef} style={{ height: '400px', marginTop: '1rem' }} className="ag-theme-quartz">
                         <AgChartsReact options={chartOptions} />
                       </div>
                    )}
                    {!chartOptions && selectedFields.length > 0 && (xAxisField || yAxisField) && (
                        <p className="text-sm text-muted-foreground mt-2 text-center">Click "Visualize" to render the chart.</p>
                    )}
                     {!chartOptions && (!xAxisField || !yAxisField) && selectedFields.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-2 text-center">Ensure X and Y axes are assigned fields for visualization.</p>
                    )}
                    {!chartOptions && selectedFields.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2 text-center">Select fields from the list to enable visualization.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

