
"use client";

import type React from 'react';
import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { fetchDatabases, fetchCollections, fetchCollectionData } from '@/actions/atlas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, UploadCloud, Database, ListTree, FileText, CircleAlert } from 'lucide-react';

interface DataSourceModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataSourceConnected: (data: any[], headers: string[], fileName: string, rowCount: number) => void;
}

export function DataSourceModal({ isOpen, onOpenChange, onDataSourceConnected }: DataSourceModalProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [connectionString, setConnectionString] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const processAndConnectFile = (file: File) => {
    setIsLoading(true);
    setError(null);
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields;
        if (!headers || headers.length === 0) {
          toast({ title: "Invalid CSV", description: "CSV file must contain a header row.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const parsedData = results.data as any[];
        if (parsedData.length === 0) {
          toast({ title: "Empty CSV", description: "CSV file does not contain any data rows.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        onDataSourceConnected(parsedData, headers, file.name, parsedData.length);
        toast({ title: "CSV Uploaded", description: `${file.name} processed successfully.` });
        setIsLoading(false);
        onOpenChange(false); // Close modal on success
      },
      error: (parseError: any) => {
        toast({ title: "Error parsing CSV", description: parseError.message, variant: "destructive" });
        setIsLoading(false);
      }
    });
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processAndConnectFile(file);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type === "text/csv") {
      processAndConnectFile(file);
    } else {
      toast({ title: "Invalid File Type", description: "Please drop a CSV file.", variant: "destructive" });
    }
  }, [processAndConnectFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFetchDatabases = async () => {
    if (!connectionString) {
      setError("Please enter a MongoDB connection string.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setDatabases([]);
    setSelectedDatabase(null);
    setCollections([]);
    setSelectedCollection(null);

    const result = await fetchDatabases(connectionString);
    if (result.success && result.data) {
      setDatabases(result.data);
      toast({ title: "Success", description: "Databases fetched successfully." });
    } else {
      setError(result.error || "Failed to fetch databases.");
      toast({ title: "Error", description: result.error || "Failed to fetch databases.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleDatabaseSelect = async (dbName: string) => {
    setSelectedDatabase(dbName);
    setIsLoading(true);
    setError(null);
    setCollections([]);
    setSelectedCollection(null);

    const result = await fetchCollections(connectionString, dbName);
    if (result.success && result.data) {
      setCollections(result.data);
      toast({ title: "Success", description: `Collections for ${dbName} fetched.` });
    } else {
      setError(result.error || `Failed to fetch collections for ${dbName}.`);
      toast({ title: "Error", description: result.error || `Failed to fetch collections for ${dbName}.`, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  const handleLoadCollectionData = async (collectionName: string) => {
    if (!selectedDatabase || !connectionString) {
        setError("Database or connection string missing.");
        return;
    }
    setSelectedCollection(collectionName);
    setIsLoading(true);
    setError(null);

    const result = await fetchCollectionData(connectionString, selectedDatabase, collectionName);
    if (result.success && result.data) {
        const { jsonData, tableHeaders, rowCount } = result.data;
        onDataSourceConnected(jsonData, tableHeaders, `${selectedDatabase}.${collectionName}`, rowCount);
        toast({ title: "Data Loaded", description: `Data from ${selectedDatabase}.${collectionName} loaded.`});
        onOpenChange(false); // Close modal
    } else {
        setError(result.error || `Failed to load data from ${collectionName}.`);
        toast({ title: "Error", description: result.error || `Failed to load data from ${collectionName}.`, variant: "destructive" });
    }
    setIsLoading(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Connect Data Source</DialogTitle>
          <DialogDescription>Upload a CSV file or connect to your MongoDB Atlas cluster.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
            <TabsTrigger value="upload" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Upload File</TabsTrigger>
            <TabsTrigger value="atlas" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Connect to Atlas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="p-6">
            <div
              className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/70 transition-colors
                ${isDragging ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                <UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`mb-2 text-sm ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}>
                  <span className="font-semibold">Click to browse</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV files only (Max 10MB)</p>
                <Button type="button" onClick={handleBrowseClick} variant="outline" className="mt-4" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Browse File
                </Button>
              </div>
              <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelected} className="hidden" disabled={isLoading} />
            </div>
            {isLoading && activeTab === 'upload' && <p className="text-sm text-muted-foreground mt-2 text-center">Processing file...</p>}
          </TabsContent>

          <TabsContent value="atlas" className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connectionString">MongoDB Connection String</Label>
              <Input 
                id="connectionString" 
                type="password" 
                placeholder="mongodb+srv://<username>:<password>@<cluster-url>/..." 
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button onClick={handleFetchDatabases} disabled={isLoading || !connectionString} className="w-full">
              {isLoading && !databases.length ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Fetch Databases
            </Button>

            {error && <p className="text-sm text-destructive flex items-center"><CircleAlert className="w-4 h-4 mr-1" /> {error}</p>}

            {databases.length > 0 && !selectedDatabase && (
              <div className="space-y-2">
                <Label>Select a Database:</Label>
                <ScrollArea className="h-40 w-full rounded-md border">
                  <div className="p-2">
                    {databases.map(dbName => (
                      <Button 
                        key={dbName} 
                        variant="ghost" 
                        className="w-full justify-start mb-1"
                        onClick={() => handleDatabaseSelect(dbName)}
                        disabled={isLoading}
                      >
                        <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                        {dbName}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {selectedDatabase && collections.length > 0 && (
              <div className="space-y-2">
                <Label>Select a Collection from {selectedDatabase}:</Label>
                 <ScrollArea className="h-40 w-full rounded-md border">
                   <div className="p-2">
                    {collections.map(colName => (
                      <Button 
                        key={colName} 
                        variant="ghost" 
                        className="w-full justify-start mb-1"
                        onClick={() => handleLoadCollectionData(colName)}
                        disabled={isLoading}
                      >
                        <ListTree className="mr-2 h-4 w-4 text-muted-foreground" />
                        {colName}
                         {isLoading && selectedCollection === colName && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                      </Button>
                    ))}
                   </div>
                 </ScrollArea>
              </div>
            )}
             {isLoading && (databases.length > 0 || collections.length > 0) && <p className="text-sm text-muted-foreground mt-2 text-center">Loading...</p>}
          </TabsContent>
        </Tabs>
        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
