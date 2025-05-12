"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AgChartsReact } from 'ag-charts-react';
import type { AgChartOptions, AgCartesianAxisOptions } from 'ag-charts-community';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XIcon, FileText, Type, Hash, CalendarDays, ToggleLeft, BarChart, PieChartIcon } from "lucide-react"; // Removed BarChartHorizontal, Dot
import { Logo } from "@/components/icons/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


const AppHeader = () => (
  <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container mx-auto flex h-16 items-center space-x-4 px-4 sm:justify-between sm:space-x-0">
      <div className="flex gap-2 items-center">
        <Logo className="h-6 w-6 text-primary" data-ai-hint="database logo" />
        <h1 className="text-xl font-bold text-primary">CSV Atlas Uploader & Visualizer</h1>
      </div>
      {/* Future nav items can go here */}
    </div>
  </header>
);

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [headerTypes, setHeaderTypes] = useState<Record<string, string>>({});
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartOptions, setChartOptions] = useState<AgChartOptions | null>(null);
  
  const [chartType, setChartType] = useState<string>('bar');
  const [xAxisField, setXAxisField] = useState<string | null>(null);
  const [yAxisField, setYAxisField] = useState<string | null>(null);
  const [chartRenderKey, setChartRenderKey] = useState(0); // Key for re-rendering chart
  const [draggedItem, setDraggedItem] = useState<{ field: string; origin: 'x' | 'y' } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'string':
        return <Type className="h-4 w-4 text-blue-500" />;
      case 'number':
        return <Hash className="h-4 w-4 text-green-500" />;
      case 'boolean':
        return <ToggleLeft className="h-4 w-4 text-purple-500" />;
      case 'date': 
        return <CalendarDays className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setJsonData([]);
    setTableHeaders([]);
    setHeaderTypes({});
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
        setCsvFile(null); 
        return;
      }
      
      const headers = lines[0].split(",").map((header: string) => header.trim());
      setTableHeaders(headers);

      const parsedData: any[] = [];
      const sampleRowForTypeDetection = lines[1]?.split(",").map(value => value.trim()) || [];
      const types: Record<string, string> = {};

      headers.forEach((header, index) => {
        const sampleValue = sampleRowForTypeDetection[index];
        if (sampleValue !== "" && !isNaN(Number(sampleValue))) {
          types[header] = 'number';
        } else if (sampleValue?.toLowerCase() === 'true' || sampleValue?.toLowerCase() === 'false') {
          types[header] = 'boolean';
        } else if (sampleValue && (/\d{4}-\d{2}-\d{2}/.test(sampleValue) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(sampleValue))) {
          if (!isNaN(new Date(sampleValue).getTime())) {
            types[header] = 'date';
          } else {
            types[header] = 'string';
          }
        } else {
          types[header] = 'string'; 
        }
      });
      setHeaderTypes(types);

      for (let i = 1; i < lines.length; i++) {
        const currentLineValues = lines[i].split(",").map(value => value.trim());
        if (currentLineValues.length !== headers.length) {
          console.warn(`Skipping line ${i + 1} due to inconsistent number of columns.`);
          continue;
        }
        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
          let value: string | number | boolean | Date | null = currentLineValues[j];
          if (types[headers[j]] === 'number') {
            value = value === "" ? null : Number(value); 
          } else if (types[headers[j]] === 'boolean') {
            value = value.toLowerCase() === 'true';
          } else if (types[headers[j]] === 'date') {
            value = value === "" ? null : new Date(value);
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
      setCsvFile(null); 
      setJsonData([]); 
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
      let currentX = xAxisField;
      let currentY = yAxisField;

      if (currentX && !selectedFields.includes(currentX)) {
        currentX = null;
        setXAxisField(null);
      }
      if (currentY && !selectedFields.includes(currentY)) {
        currentY = null;
        setYAxisField(null);
      }
      
      if (!currentX) {
         const newX = selectedFields.find(f => (headerTypes[f] === 'string' || headerTypes[f] === 'date') && f !== currentY) ||
                       selectedFields.find(f => headerTypes[f] === 'number' && f !== currentY) ||
                       (selectedFields[0] !== currentY ? selectedFields[0] : null);
        if (newX) {
          setXAxisField(newX);
          currentX = newX;
        }
      }
      
      if (!currentY) {
        const newY = selectedFields.find(f => headerTypes[f] === 'number' && f !== currentX) || 
                     selectedFields.find(f => f !== currentX && headerTypes[f] !== 'object');
        if (newY) {
          setYAxisField(newY);
        }
      }
    } else if (selectedFields.length === 0) {
        setXAxisField(null);
        setYAxisField(null);
    }
    // No setChartOptions(null) here to keep chart visible during field reselection
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFields, jsonData, headerTypes]); 


  const handleDragStart = (field: string, origin: 'x' | 'y') => {
    setDraggedItem({ field, origin });
  };

  const handleDrop = (target: 'x' | 'y') => {
    if (draggedItem) {
      const sourceField = draggedItem.field;
      const currentX = xAxisField;
      const currentY = yAxisField;

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
      setChartOptions(null);
      return;
    }

    if (jsonData.length === 0) {
      toast({
        title: "No Data",
        description: "No data to visualize.",
        variant: "destructive",
      });
      setChartOptions(null);
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
        setChartOptions(null);
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
        series = [{ type: 'bar', direction:'horizontal',  xKey: xAxisField, yKey: yAxisField, xName: xAxisField, yName: yAxisField }]; // Corrected: yName is label for values (xKey here), xName for categories (yKey here)
        axes = [
            { type: 'number', position: 'bottom', title: { text: xAxisField } }, // Numeric axis
            { type: (yFieldType === 'string' || yFieldType === 'date') ? 'category' : 'number', position: 'left', title: { text: yAxisField } }, // Category axis
        ];
        titleText = `${xAxisField} by ${yAxisField}`; 
        break;
      case 'scatter':
        if ((xFieldType !== 'number' && xFieldType !== 'date') || (yFieldType !== 'number' && yFieldType !== 'date')) {
            toast({ title: "Type Error", description: "Scatter plots require numeric or date X and Y axes.", variant: "destructive"});
            setChartOptions(null); return;
        }
        series = [{ type: 'scatter', xKey: xAxisField, yKey: yAxisField, xName: xAxisField, yName: yAxisField }];
        axes = [
          { type: xFieldType === 'date' ? 'time' : 'number', position: 'bottom', title: { text: xAxisField } },
          { type: yFieldType === 'date' ? 'time' : 'number', position: 'left', title: { text: yAxisField } },
        ];
        break;
      case 'pie':
        if (yFieldType !== 'number') {
            toast({ title: "Type Error", description: "Pie charts require a numeric field for values (Angle Key).", variant: "destructive"});
            setChartOptions(null); return;
        }
         if (xFieldType !== 'string' && xFieldType !== 'date') { 
            toast({ title: "Type Error", description: "Pie charts require a categorical or date field for labels (Label Key).", variant: "destructive"});
            setChartOptions(null); return;
        }
        series = [{ type: 'pie', angleKey: yAxisField, labelKey: xAxisField, calloutLabelKey: xAxisField, sectorLabelKey: yAxisField, legendItemKey: xAxisField }];
        axes = []; 
        break;
      default:
        toast({ title: "Unknown Chart Type", description: "Selected chart type is not supported.", variant: "destructive" });
        setChartOptions(null); return;
    }

    const newChartOptions: AgChartOptions = {
      data: chartData,
      title: { text: titleText },
      series: series,
      axes: axes.length > 0 ? axes : undefined,
      autoSize: true, 
      // theme: 'ag-default-dark' // Optional: if you want a dark theme
    };
    setChartOptions(newChartOptions);
    setChartRenderKey(prevKey => prevKey + 1); 

    toast({
      title: "Visualization Rendered!",
      description: `${chartType.replace('-', ' ')} chart for ${titleText} is ready.`,
    });
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-6 h-full">
          
          {/* Left Column: Data Source + Fields */}
          <div className="flex flex-col space-y-6">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-md font-semibold">Data Source</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Input 
                  id="csv-upload-main" 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                  className="w-full text-sm"
                  title={csvFile?.name || "Select a CSV file"}
                />
                {csvFile && <p className="text-xs text-muted-foreground mt-1 truncate" title={csvFile.name}>Selected: {csvFile.name}</p>}
                {!csvFile && <p className="text-xs text-muted-foreground mt-1">Upload your CSV file to get started.</p>}
              </CardContent>
            </Card>

            <Card className="flex flex-col flex-grow">
              <CardHeader className="p-4">
                <CardTitle className="text-md font-semibold">Fields</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-grow overflow-y-auto space-y-1">
                {tableHeaders.length > 0 ? tableHeaders.map((header) => (
                  <div key={header} className="flex items-center space-x-2 py-1.5 px-1 rounded-md hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`checkbox-${header}`}
                      checked={selectedFields.includes(header)}
                      onCheckedChange={() => handleFieldSelect(header)}
                      aria-label={`Select field ${header}`}
                    />
                    {getFieldTypeIcon(headerTypes[header])}
                    <Label
                      htmlFor={`checkbox-${header}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate cursor-pointer"
                      title={header}
                    >
                      {header}
                    </Label>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground p-2">Upload a CSV to see data fields.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Selected Fields Preview & Visualization */}
          <div className="flex flex-col space-y-6">
            <Card>
              <Accordion type="single" collapsible defaultValue="preview-accordion-item" className="w-full">
                <AccordionItem value="preview-accordion-item" className="border-none">
                  <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline rounded-t-md font-semibold data-[state=open]:border-b data-[state=open]:bg-muted/30 data-[state=closed]:rounded-b-md">
                    Data Preview
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-2">
                    <div className="max-h-[250px] overflow-y-auto">
                      {selectedFields.length > 0 && jsonData.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {selectedFields.map((header) => (
                                <TableHead key={header} className="text-xs h-8 px-2">{header}</TableHead>
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
                          <p className="text-sm text-muted-foreground">Select fields or upload data to see a preview.</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

            <Card className="flex flex-col flex-grow">
              <Accordion type="single" collapsible defaultValue="viz-accordion-item" className="w-full flex flex-col flex-grow">
                <AccordionItem value="viz-accordion-item" className="border-none flex flex-col flex-grow">
                  <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline rounded-t-md font-semibold data-[state=open]:border-b data-[state=open]:bg-muted/30 data-[state=closed]:rounded-b-md">
                    Visualization
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-2 space-y-4 flex flex-col flex-grow">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1">
                        <Label htmlFor="chartType" className="text-xs">Chart Type</Label>
                        <Select value={chartType} onValueChange={(value) => { setChartType(value); setChartOptions(null); }} name="chartType" disabled={selectedFields.length === 0}>
                          <SelectTrigger id="chartType" className="h-9 text-xs"><SelectValue placeholder="Select chart type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bar" className="text-xs">Simple Bar</SelectItem>
                            <SelectItem value="horizontal-bar" className="text-xs">Horizontal Bar</SelectItem>
                            <SelectItem value="scatter" className="text-xs">Scatter Plot</SelectItem>
                            <SelectItem value="pie" className="text-xs">Pie Chart</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="xAxis" className="text-xs">X-Axis</Label>
                        <div
                          id="xAxisContainer" 
                          draggable={!!xAxisField && selectedFields.length > 0}
                          onDragStart={() => xAxisField && handleDragStart(xAxisField, 'x')}
                          onDrop={() => handleDrop('x')}
                          onDragOver={handleDragOver}
                          className={`flex items-center justify-between p-2 border rounded-md min-h-[36px] bg-background text-xs ${!!xAxisField && selectedFields.length > 0 ? 'cursor-grab' : 'cursor-default opacity-70'}`}
                        >
                          <span className="truncate" title={xAxisField || "Select field for X-Axis"}>{xAxisField || 'Select Field'}</span>
                          {xAxisField && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setXAxisField(null); setChartOptions(null); }}><XIcon className="w-3 h-3" /></Button>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="yAxis" className="text-xs">Y-Axis</Label>
                        <div
                          id="yAxisContainer"
                          draggable={!!yAxisField && selectedFields.length > 0}
                          onDragStart={() => yAxisField && handleDragStart(yAxisField, 'y')}
                          onDrop={() => handleDrop('y')}
                          onDragOver={handleDragOver}
                          className={`flex items-center justify-between p-2 border rounded-md min-h-[36px] bg-background text-xs ${!!yAxisField && selectedFields.length > 0 ? 'cursor-grab' : 'cursor-default opacity-70'}`}
                        >
                          <span className="truncate" title={yAxisField || "Select field for Y-Axis"}>{yAxisField || 'Select Field'}</span>
                          {yAxisField && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setYAxisField(null); setChartOptions(null); }}><XIcon className="w-3 h-3" /></Button>}
                        </div>
                      </div>
                    </div>
                    <Button 
                        onClick={visualizeData} 
                        disabled={!xAxisField || !yAxisField || selectedFields.length === 0 || jsonData.length === 0}
                        className="w-auto h-9 text-xs self-start"
                    >
                        Visualize
                    </Button>
                    
                    <div ref={chartContainerRef} className="ag-theme-quartz w-full flex-grow min-h-[300px]" style={{ height: '400px' }}>
                      {chartOptions && (
                        <AgChartsReact options={chartOptions} key={chartRenderKey} />
                      )}
                      {!chartOptions && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          {(selectedFields.length === 0 || jsonData.length === 0) ? (
                            <>
                              <FileText className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="document data" />
                              <p className="text-sm text-muted-foreground">Upload data and select fields to visualize.</p>
                            </>
                          ) : (!xAxisField || !yAxisField) ? (
                            <>
                              <BarChart className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="chart axes" />
                              <p className="text-sm text-muted-foreground">Assign fields to X and Y axes.</p>
                            </>
                          ) : (
                             <>
                              <BarChart className="w-12 h-12 text-muted-foreground mb-2" data-ai-hint="analytics chart" />
                              <p className="text-sm text-muted-foreground">Click "Visualize" to render the chart.</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
