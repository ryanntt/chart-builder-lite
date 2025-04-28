"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Upload } from 'lucide-react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { VegaLiteSpec } from 'vega-lite';
import { genVegaSpec } from "@/services/vega";
import vegaEmbed from 'vega-embed';
import { Checkbox } from "@/components/ui/checkbox";

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [vegaSpec, setVegaSpec] = useState<VegaLiteSpec | null>(null);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [validData, setValidData] = useState<any[]>([]); // Store valid data
  const [selectedFields, setSelectedFields] = useState<string[]>([]); // Track selected fields for visualization

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    try {
      const text = await file.text();
      const lines = text.split("\n");
      const headers = lines[0].split(",").map((header: string) => header.trim());
      setTableHeaders(headers);

      const parsedData: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const data: any = {};
        const currentLine = lines[i].split(",");

        if (currentLine.length !== headers.length) {
          console.warn(`Skipping line ${i + 1} due to inconsistent number of columns.`);
          continue;
        }

        for (let j = 0; j < headers.length; j++) {
          data[headers[j]] = currentLine[j].trim();
        }

        parsedData.push(data);
      }

      // Data Cleaning and Transformation
      const cleanedData = parsedData.map(row => {
        const transformedRow: { [key: string]: any } = {};
        Object.keys(row).forEach(key => {
          let value = row[key];
          if (typeof value === 'string') {
            const num = Number(value);
            value = isNaN(num) ? value : num;
          }
          transformedRow[key] = value;
        });
        return transformedRow;
      });


      // Identify and remove invalid data
      const validatedData = cleanedData.filter(item => {
        const isValid = Object.values(item).every(value => value !== undefined && value !== null && value !== '');
        if (!isValid) {
          console.warn('Invalid data removed:', item);
        }
        return isValid;
      });

      setJsonData(validatedData);
      setValidData(validatedData);  // Store valid data

      toast({
        title: "CSV file parsed!",
        description: "Data is ready for preview.",
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
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      } else {
        return [...prev, field];
      }
    });
  };


  const visualizeData = async () => {
    if (selectedFields.length < 2) {
      toast({
        title: "Visualization Error",
        description: "Please select at least two fields for visualization.",
        variant: "destructive",
      });
      return;
    }
  
    const selectedData = validData.map(item => {
      const selectedItem: { [key: string]: any } = {};
      selectedFields.forEach(field => {
        selectedItem[field] = item[field];
      });
      return selectedItem;
    });
  
    if (selectedData.length === 0) {
      toast({
        title: "No Data to Visualize",
        description: "Please upload a CSV file to parse the data.",
        variant: "destructive",
      });
      return;
    }
  
    try {
      // Generate Vega-Lite specification based on the schema and data
      const spec = await genVegaSpec(selectedFields, selectedData);
      setVegaSpec(spec);
  
      // Serialize data to JSON string before passing to vegaEmbed
      const serializedData = JSON.stringify(selectedData);
  
      // Embed the visualization using vega-embed
      const vegaEmbedModule = await import('vega-embed');
      vegaEmbedModule.default("#vis", spec, { actions: false }).then(() => {
        toast({
          title: "Visualization Rendered!",
          description: "Data visualization has been successfully rendered.",
        });
      }).catch(error => {
        console.error("Error embedding VegaLite:", error);
        toast({
          title: "Visualization Error",
          description: "Failed to render the visualization.",
          variant: "destructive",
        });
      });
  
  
    } catch (error: any) {
      console.error("Visualization error:", error);
      toast({
        title: "Visualization Error",
        description: error.message || "Failed to render the visualization.",
        variant: "destructive",
      });
    }
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
            <div className="grid grid-cols-3 gap-4">
              <Card style={{ width: '300px' }} className="p-4 rounded-md bg-muted overflow-x-auto">
                <CardHeader>
                  <CardTitle className="text-md font-semibold">Data Preview</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                <ul>
                    {tableHeaders.map((header) => (
                      <li key={header} className="flex items-center space-x-2">
                        <Checkbox
                          id={header}
                          checked={selectedFields.includes(header)}
                          onCheckedChange={() => handleFieldSelect(header)}
                        />
                        <label
                          htmlFor={header}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {header}
                        </label>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="flex flex-col space-y-4 col-span-2">
                <Card className="p-4 rounded-md bg-muted overflow-x-auto">
                  <CardHeader>
                    <CardTitle className="text-md font-semibold">Selected Fields</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedFields.map((header) => (
                            <TableHead key={header}>{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody style={{ maxHeight: '200px', overflowY: 'scroll' }}>
                        {jsonData.slice(0, 10).map((row, index) => (
                          <TableRow key={index}>
                            {selectedFields.map((header) => (
                              <TableCell key={header}>{row[header]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="p-4 rounded-md bg-muted">
                  <CardHeader>
                    <CardTitle className="text-md font-semibold">Visualization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={visualizeData}>Visualize</Button>
                    <div id="vis" />
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
