
"use client";

import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { fetchDatabases, fetchCollections, fetchCollectionData, fetchSampleMflixMoviesData } from '@/actions/atlas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, UploadCloud, CircleAlert, PlugZap, Database, Folder, X, ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';


interface DataSourceModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDataSourceConnected: (data: any[], headers: string[], fileName: string, sampledRowCount: number, totalRowCount: number, sourceType: 'csv' | 'atlas' | 'sample') => void;
}

const SkeletonListItem = () => (
  <div className="flex items-center space-x-2 p-2 mb-1 rounded-md bg-muted/30">
    <Skeleton className="h-5 w-5 rounded-full" />
    <Skeleton className="h-4 w-4/5 rounded" />
  </div>
);

export function DataSourceModal({ isOpen, onOpenChange, onDataSourceConnected }: DataSourceModalProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Atlas connection states
  const [connectionString, setConnectionString] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [hasStoredConnectionString, setHasStoredConnectionString] = useState(false);
  
  // Shared loading/error states
  const [isLoading, setIsLoading] = useState(false); 
  const [isFetchingDatabases, setIsFetchingDatabases] = useState(false);
  const [isFetchingCollections, setIsFetchingCollections] = useState(false);
  const [isFetchingSampleData, setIsFetchingSampleData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'atlas') {
      const storedConnectionString = localStorage.getItem('atlasConnectionString');
      if (storedConnectionString) {
        setConnectionString(storedConnectionString);
        setHasStoredConnectionString(true);
      } else {
        setHasStoredConnectionString(false);
      }
    }
  }, [activeTab, isOpen]);


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
        onDataSourceConnected(parsedData, headers, file.name, parsedData.length, parsedData.length, 'csv');
        toast({ title: "CSV Uploaded", description: `${file.name} processed successfully.` });
        setIsLoading(false);
        onOpenChange(false); 
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Atlas specific handlers
  const handleFetchDatabases = async () => {
    if (!connectionString) {
      setError("Please enter a MongoDB connection string.");
      return;
    }
    setIsFetchingDatabases(true);
    setError(null);
    setDatabases([]);
    setSelectedDatabase(null);
    setCollections([]);
    setSelectedCollection(null);

    const result = await fetchDatabases(connectionString);
    if (result.success && result.data) {
      setDatabases(result.data);
      localStorage.setItem('atlasConnectionString', connectionString);
      setHasStoredConnectionString(true);
      toast({ title: "Success", description: "Databases fetched. Connection string saved locally." });
    } else {
      setError(result.error || "Failed to fetch databases.");
      toast({ title: "Error", description: result.error || "Failed to fetch databases.", variant: "destructive" });
    }
    setIsFetchingDatabases(false);
  };

  const handleClearStoredConnectionString = () => {
    localStorage.removeItem('atlasConnectionString');
    setConnectionString('');
    setHasStoredConnectionString(false);
    toast({ title: "Stored connection cleared", description: "The locally stored Atlas connection string has been removed." });
  };

  const handleDatabaseSelect = async (dbName: string) => {
    setSelectedDatabase(dbName);
    setIsFetchingCollections(true);
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
    setIsFetchingCollections(false);
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
        const { jsonData, tableHeaders, sampledRowCount, totalRowCount } = result.data;
        onDataSourceConnected(jsonData, tableHeaders, `${selectedDatabase}.${collectionName}`, sampledRowCount, totalRowCount, 'atlas');
        toast({ title: "Data Loaded", description: `Data from ${selectedDatabase}.${collectionName} loaded.`});
        onOpenChange(false); 
    } else {
        setError(result.error || `Failed to load data from ${collectionName}.`);
        toast({ title: "Error", description: result.error || `Failed to load data from ${collectionName}.`, variant: "destructive" });
    }
    setIsLoading(false);
    setSelectedCollection(null); 
  };

  const handleLoadSampleData = async () => {
    setIsFetchingSampleData(true);
    setError(null);
    const result = await fetchSampleMflixMoviesData();
    if (result.success && result.data) {
      const { jsonData, tableHeaders, sampledRowCount, totalRowCount } = result.data;
      onDataSourceConnected(jsonData, tableHeaders, "sample_mflix.movies", sampledRowCount, totalRowCount, 'sample');
      toast({ title: "Sample Data Loaded", description: "sample_mflix.movies loaded." });
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to load sample mflix movies data.");
      toast({ title: "Error", description: result.error || "Failed to load sample data.", variant: "destructive" });
    }
    setIsFetchingSampleData(false);
  };


  const handleBackToDatabases = () => {
    setSelectedDatabase(null);
    setCollections([]);
    setSelectedCollection(null);
    setError(null);
  };

  const isFetchAtlasButtonDisabled = isFetchingDatabases || isFetchingCollections || isLoading || !connectionString;


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 bg-card border-[var(--border-color-secondary)]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-foreground">Connect data source</DialogTitle>
          <DialogDescription className="text-muted-foreground">Upload a CSV file, connect to MongoDB Atlas, or use sample data.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full rounded-none px-6">
            <TabsTrigger value="upload" className="rounded-none">Upload file</TabsTrigger>
            <TabsTrigger value="atlas" className="rounded-none">Connect to Atlas</TabsTrigger>
            <TabsTrigger value="sample" className="rounded-none">Sample data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="p-6">
            <div
              className={cn(`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-md cursor-pointer transition-colors 
                border-[var(--border-color-secondary)] hover:bg-accent/50 bg-background`, 
                isDragging && 'border-primary bg-accent/10'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                <UploadCloud className={cn("w-10 h-10 mb-3 text-muted-foreground", isDragging && "text-primary")} />
                <p className={cn("mb-2 text-sm text-muted-foreground", isDragging && "text-primary")}>
                  <span className="font-semibold">Click to browse</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV files only</p>
                <Button type="button" onClick={handleBrowseClick} variant="lgDefault" size="default" className="mt-4" disabled={isLoading}>
                  {isLoading && activeTab === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Browse file
                </Button>
              </div>
              <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelected} className="hidden" disabled={isLoading} />
            </div>
            {isLoading && activeTab === 'upload' && <p className="text-sm text-muted-foreground mt-2 text-center">Processing file...</p>}
          </TabsContent>

          <TabsContent value="atlas" className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connectionString" className="text-muted-foreground">MongoDB connection string</Label>
              <div className="flex space-x-2 items-center">
                <div className="relative flex-grow">
                  <Input 
                    id="connectionString" 
                    placeholder="mongodb+srv://<username>:<password>@<cluster-url>/..." 
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    disabled={isFetchingDatabases || isFetchingCollections || isLoading}
                    className="pr-8" 
                  />
                  {hasStoredConnectionString && connectionString && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleClearStoredConnectionString}
                      aria-label="Clear stored connection string"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button 
                  onClick={handleFetchDatabases} 
                  variant={isFetchAtlasButtonDisabled ? "lgDisabled" : "default"}
                  size="default"
                  disabled={isFetchAtlasButtonDisabled}
                  className="flex-shrink-0"
                >
                  {isFetchingDatabases ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Fetch
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Connection strings are stored in your browser's local storage for convenience. 
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-xs ml-1 text-[var(--lg-blue-base)] underline decoration-[var(--secondary-foreground)]" 
                  onClick={() => toast({title: "Local Storage", description: "Storing connection strings locally is convenient for development but not recommended for production due to security risks."})}
                >
                  Learn more
                </Button>
              </p>
            </div>
            
            {error && <p className="text-sm text-destructive flex items-center"><CircleAlert className="w-4 h-4 mr-1" /> {error}</p>}
            
            <div className="min-h-[240px] max-h-[300px] overflow-y-auto"> 
              {isFetchingDatabases && (
                <ScrollArea className="h-[240px] w-full rounded-md border border-[var(--border-color-secondary)]">
                  <div className="p-2">
                    {[...Array(5)].map((_, i) => <SkeletonListItem key={i} />)}
                  </div>
                </ScrollArea>
              )}

              {!isFetchingDatabases && databases.length > 0 && !selectedDatabase && (
                <div className="space-y-2">
                  <Label className="text-foreground font-medium">Select a database:</Label>
                  <ScrollArea className="h-[240px] w-full rounded-md border border-[var(--border-color-secondary)]">
                    <div className="p-2">
                      {databases.map(dbName => (
                        <Button 
                          key={dbName} 
                          variant="ghost" 
                          className="w-full justify-start mb-1 hover:bg-accent text-foreground"
                          onClick={() => handleDatabaseSelect(dbName)}
                          disabled={isFetchingCollections || isLoading}
                        >
                          <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                          {dbName}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {selectedDatabase && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-foreground font-medium">Select a collection from {selectedDatabase}:</Label>
                    <Button variant="lgDefault" size="sm" onClick={handleBackToDatabases} disabled={isFetchingCollections || isLoading}>
                       <ChevronLeft className="h-4 w-4" /> Change database
                    </Button>
                  </div>
                  {isFetchingCollections && (
                     <ScrollArea className="h-[200px] w-full rounded-md border border-[var(--border-color-secondary)]"> 
                        <div className="p-2">
                        {[...Array(5)].map((_, i) => <SkeletonListItem key={i} />)}
                        </div>
                    </ScrollArea>
                  )}
                  {!isFetchingCollections && collections.length > 0 && (
                    <div className="space-y-2">
                      <ScrollArea className="h-[200px] w-full rounded-md border border-[var(--border-color-secondary)]"> 
                        <div className="p-2">
                          {collections.map(colName => (
                            <Button 
                              key={colName} 
                              variant="ghost" 
                              className="w-full justify-start mb-1 hover:bg-accent text-foreground"
                              onClick={() => handleLoadCollectionData(colName)}
                              disabled={isLoading && selectedCollection === colName}
                            >
                              <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                              {colName}
                              {isLoading && selectedCollection === colName && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                  {!isFetchingCollections && collections.length === 0 && !error && (
                     <p className="text-sm text-muted-foreground text-center py-4">No collections found in {selectedDatabase}.</p>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sample" className="p-6 space-y-4">
            <Label className="text-foreground font-medium">Select a sample dataset:</Label>
             <Button 
                variant="lgDefault" 
                size="default"
                className="w-full justify-start"
                onClick={handleLoadSampleData}
                disabled={isFetchingSampleData}
              >
                <Database className="mr-2 h-4 w-4" />
                sample_mflix.movies
                {isFetchingSampleData && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
              </Button>
             {error && activeTab === 'sample' && <p className="text-sm text-destructive flex items-center"><CircleAlert className="w-4 h-4 mr-1" /> {error}</p>}
          </TabsContent>

        </Tabs>
        <DialogFooter className="p-6 pt-0 border-t border-t-[var(--border-color-secondary)]">
          <Button variant="lgDefault" size="default" onClick={() => onOpenChange(false)} disabled={isLoading || isFetchingDatabases || isFetchingCollections || isFetchingSampleData}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    