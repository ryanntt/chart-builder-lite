
"use client";

import { useState, useEffect } from "react";
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
      const lines = text.split("\n").filter(line => line.trim() !== ''); // Remove empty lines
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
        let isValidRow = true;
        for (let j = 0; j < headers.length; j++) {
          let value: string | number = currentLineValues[j];
          // Attempt to convert to number if it looks like one, otherwise keep as string
          if (value !== "" && !isNaN(Number(value))) {
            value = Number(value);
          } else if (value === "") { // Handle empty strings as null or a specific placeholder if needed
            value = ""; // Or handle as per visualization needs e.g., null
          }
          rowData[headers[j]] = value;

          // Basic validation: check for undefined, null, or truly empty strings if they are not allowed
           if (value === undefined || value === null ) { // Removed value === '' for flexibility
             // isValidRow = false; // Decide if empty strings make a row invalid
           }
        }
        
        if (isValidRow) {
          parsedData.push(rowData);
        } else {
          console.warn('Invalid data in row, skipping:', rowData);
          invalidDataRows.push({lineNumber: i + 1, data: rowData, reason: "Contains invalid/empty critical fields"});
        }
      }
      
      if (invalidDataRows.length > 0) {
        console.log("The following rows were considered invalid or incomplete and skipped:", invalidDataRows);
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
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      } else {
        return [...prev, field];
      }
    });
    setChartOptions(null); // Reset chart when selection changes
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
    
    const chartData = jsonData.map(row => {
        const dataPoint: any = {};
        selectedFields.forEach(field => {
            dataPoint[field] = row[field];
        });
        return dataPoint;
    });

    if (chartData.length === 0) {
      toast({
        title: "No Data for Selected Fields",
        description: "The selected fields do not have corresponding data to visualize.",
        variant: "destructive",
      });
      return;
    }

    const series: any[] = [];
    let xKey = '';

    // Determine xKey (categorical) and yKeys (numerical)
    // For simplicity, let's assume the first selected field is categorical (xKey)
    // and subsequent fields are numerical (yKeys).
    // More sophisticated type detection would be needed for robust behavior.
    if (selectedFields.length > 0) {
        xKey = selectedFields[0];
    }

    selectedFields.slice(1).forEach(field => {
        // Crude check if data in this field is numeric for at least one row
        const isNumeric = chartData.some(d => typeof d[field] === 'number');
        if (isNumeric) {
            series.push({ type: 'bar', xKey: xKey, yKey: field, yName: field });
        } else if (selectedFields.length === 1 && typeof chartData[0][field] === 'string') {
            // Special case for single categorical field: count occurrences
            const counts = chartData.reduce((acc, curr) => {
                acc[curr[field]] = (acc[curr[field]] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            const countData = Object.entries(counts).map(([key, value]) => ({ [field]: key, 'Count': value }));
            
            setChartOptions({
                data: countData,
                title: { text: `Distribution of ${field}` },
                series: [{ type: 'bar', xKey: field, yKey: 'Count', yName: 'Count' }],
            });
            toast({
                title: "Visualization Rendered!",
                description: `Distribution chart for ${field} has been successfully rendered.`,
            });
            return; // Exit early for this special case
        } else {
            console.warn(`Field "${field}" is not numeric and will be skipped for y-axis or not suitable for current chart type.`);
        }
    });
    
    if (selectedFields.length > 1 && series.length === 0) {
        toast({
            title: "Visualization Error",
            description: "No numeric fields selected for the y-axis or suitable data for a bar/column chart.",
            variant: "destructive",
        });
        return;
    }
    if (selectedFields.length === 1 && series.length === 0 && typeof chartData[0]?.[xKey] !== 'string' ) {
         toast({
            title: "Visualization Error",
            description: "Please select a categorical field to see its distribution or multiple fields for a comparison chart.",
            variant: "destructive",
        });
        return;
    }


    setChartOptions({
      data: chartData,
      title: { text: `Data Visualization` },
      series: series,
      axes: [
        {
          type: 'category',
          position: 'bottom',
          title: { text: xKey }
        },
        {
          type: 'number',
          position: 'left',
          title: { text: 'Values' }
        }
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
      <Card className="w-full space-y-4 p-4 rounded-lg shadow-md">
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
                  <CardContent className="max-h-[250px] overflow-y-auto"> {/* Adjusted height */}
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

                <Card className="p-4 rounded-md bg-muted">
                  <CardHeader>
                    <CardTitle className="text-md font-semibold">Visualization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={visualizeData} disabled={selectedFields.length === 0}>Visualize</Button>
                    {chartOptions && (
                       <div style={{ height: '400px', marginTop: '1rem' }} className="ag-theme-quartz">
                         <AgChartsReact options={chartOptions} />
                       </div>
                    )}
                    {!chartOptions && selectedFields.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">Click "Visualize" to render the chart with selected fields.</p>
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
