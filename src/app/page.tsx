
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AgChartsReact } from 'ag-charts-react';
import type { AgChartOptions } from 'ag-charts-community';


export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartOptions, setChartOptions] = useState<AgChartOptions | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setJsonData([]);
    setTableHeaders([]);
    setSelectedFields([]);
    setChartOptions(null);

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
      const invalidDataRows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const currentLineValues = lines[i].split(",").map(value => value.trim());
        
        if (currentLineValues.length !== headers.length) {
          console.warn(`Skipping line ${i + 1} due to inconsistent number of columns. Expected ${headers.length}, got ${currentLineValues.length}. Line: ${lines[i]}`);
          invalidDataRows.push({lineNumber: i + 1, data: lines[i]});
          continue;
        }

        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
          let value: string | number | boolean = currentLineValues[j];
          if (value !== "" && !isNaN(Number(value))) {
            value = Number(value);
          } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
            value = value.toLowerCase() === 'true';
          } else if (value === "") {
            value = ""; 
          }
          rowData[headers[j]] = value;
        }
        parsedData.push(rowData);
      }
      
      if (invalidDataRows.length > 0) {
        console.warn("The following rows were considered invalid or incomplete and skipped:", invalidDataRows);
      }

      setJsonData(parsedData);

      if (parsedData.length === 0 && lines.length > 1) {
         toast({
          title: "No Valid Data",
          description: "No valid data rows could be parsed from the CSV.",
          variant: "destructive",
        });
      } else if (parsedData.length > 0) {
        toast({
          title: "CSV file parsed!",
          description: `${parsedData.length} data rows ready for preview. ${invalidDataRows.length > 0 ? `${invalidDataRows.length} rows skipped.` : ''}`,
        });
      }

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
     // Do not reset chart options here to allow users to adjust selections and re-visualize
  };

  const visualizeData = () => {
    if (selectedFields.length < 1) {
      toast({
        title: "Visualization Error",
        description: "Please select at least one field for visualization.",
        variant: "destructive",
      });
      return;
    }

    if (jsonData.length === 0) {
      toast({
        title: "No Data to Visualize",
        description: "No valid data to visualize. Please check the CSV file or parsed data.",
        variant: "destructive",
      });
      return;
    }
    
    let chartDataForProcessing = jsonData.map(row => {
        const dataPoint: any = {};
        selectedFields.forEach(field => {
            dataPoint[field] = row[field];
        });
        return dataPoint;
    });


    if (chartDataForProcessing.length === 0) {
      toast({
        title: "No Data for Selected Fields",
        description: "The selected fields do not have corresponding data to visualize.",
        variant: "destructive",
      });
      return;
    }

    const series: any[] = [];
    let xKey = '';
    let finalChartData = chartDataForProcessing;

    if (selectedFields.length > 0) {
        xKey = selectedFields[0];
        // Check if the xKey field is string and needs filtering
        if (jsonData.length > 0 && typeof jsonData[0]?.[xKey] === 'string') {
            const valueCounts = jsonData.reduce((acc, row) => {
                const value = String(row[xKey]);
                acc[value] = (acc[value] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const sortedUniqueValues = Object.entries(valueCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .map(([value]) => value);

            if (sortedUniqueValues.length > 20) {
                const top20Values = new Set(sortedUniqueValues.slice(0, 20));
                finalChartData = chartDataForProcessing.filter(row => top20Values.has(String(row[xKey])));
                toast({
                    title: "Data Filtered for X-axis",
                    description: `Field "${xKey}" has ${sortedUniqueValues.length} unique values. Displaying top 20 by frequency.`,
                });
            }
        }
    }


    // Handle single categorical field case (distribution chart)
    if (selectedFields.length === 1 && typeof jsonData[0]?.[xKey] === 'string') {
        const counts = finalChartData.reduce((acc, curr) => {
            const val = String(curr[xKey]);
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const countData = Object.entries(counts).map(([key, value]) => ({ [xKey]: key, 'Count': value }));
        
        setChartOptions({
            data: countData,
            title: { text: `Distribution of ${xKey}` },
            series: [{ type: 'bar', xKey: xKey, yKey: 'Count', yName: 'Count' }],
            axes: [
              { type: 'category', position: 'bottom', title: { text: xKey } },
              { type: 'number', position: 'left', title: { text: 'Count' } }
            ]
        });
        toast({
            title: "Visualization Rendered!",
            description: `Distribution chart for ${xKey} has been successfully rendered.`,
        });
        return;
    }
    
    // Handle multiple fields or single numeric field
    selectedFields.forEach((field, index) => {
        if (index === 0 && typeof jsonData[0]?.[field] === 'string') return; // xKey already handled

        const isNumeric = finalChartData.some(d => typeof d[field] === 'number');
        if (isNumeric) {
            series.push({ type: 'bar', xKey: xKey, yKey: field, yName: field });
        } else if (index > 0) { // Only warn for potential y-axis fields
            console.warn(`Field "${field}" is not numeric and will be skipped for y-axis.`);
            toast({
                title: "Field Skipped",
                description: `Field "${field}" is not numeric and was skipped for the y-axis.`,
                variant: "default"
            });
        }
    });
    
    if (series.length === 0) {
        toast({
            title: "Visualization Error",
            description: "No suitable numeric fields found for the y-axis, or the selected X-axis is not categorical.",
            variant: "destructive",
        });
        setChartOptions(null); // Clear previous chart
        return;
    }

    setChartOptions({
      data: finalChartData,
      title: { text: `Data Visualization` },
      series: series,
      axes: [
        { type: 'category', position: 'bottom', title: { text: xKey } },
        { type: 'number', position: 'left', title: { text: 'Values' } }
      ]
    });

    toast({
      title: "Visualization Rendered!",
      description: "Data visualization has been successfully rendered.",
    });
  };
  
  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-2 bg-secondary">
      <Toaster />
      <Card className="w-full max-w-full space-y-4 p-4 rounded-lg shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-center">CSV Data Visualizer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="csv-upload" className="text-sm font-medium">Upload CSV File:</label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
          </div>
          
          {jsonData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
              <Card className="p-4 rounded-md bg-muted overflow-x-auto" style={{ width: '300px' }}>
                <CardHeader>
                  <CardTitle className="text-md font-semibold">Data Preview</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                  <ul>
                    {tableHeaders.map((header) => (
                      <li key={header} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`checkbox-${header}`}
                          checked={selectedFields.includes(header)}
                          onCheckedChange={() => handleFieldSelect(header)}
                          aria-label={`Select field ${header}`}
                        />
                        <label
                          htmlFor={`checkbox-${header}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {header}
                        </label>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="flex flex-col space-y-4">
                <Card className="p-4 rounded-md bg-muted overflow-x-auto">
                  <CardHeader>
                    <CardTitle className="text-md font-semibold">Selected Fields Preview (Top 10 rows)</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[250px] overflow-y-auto">
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
                      <p className="text-sm text-muted-foreground">Select fields from the Data Preview to see them here.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="p-4 rounded-md bg-muted flex-grow">
                  <CardHeader>
                    <CardTitle className="text-md font-semibold">Visualization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={visualizeData} disabled={selectedFields.length === 0}>Visualize</Button>
                    {chartOptions && (
                       <div ref={chartContainerRef} style={{ height: '400px', marginTop: '1rem' }} className="ag-theme-quartz">
                         <AgChartsReact options={chartOptions} />
                       </div>
                    )}
                    {!chartOptions && selectedFields.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">Click "Visualize" to render the chart with selected fields.</p>
                    )}
                     {!chartOptions && selectedFields.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">Select fields and click "Visualize" to render a chart.</p>
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
