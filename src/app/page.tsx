"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AtlasCredentials, AtlasConfiguration, loginToAtlas, uploadDataToAtlas } from "@/services/atlas";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Upload } from 'lucide-react';

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [atlasCredentials, setAtlasCredentials] = useState<AtlasCredentials>({ publicKey: "", privateKey: "" });
  const [atlasConfiguration, setAtlasConfiguration] = useState<AtlasConfiguration>({ projectId: "", databaseName: "", collectionName: "" });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    try {
      const text = await file.text();
      const lines = text.split("\n");
      const headers = lines[0].split(",").map((header: string) => header.trim());

      const parsedData = [];
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

      setJsonData(parsedData);
      toast({
        title: "CSV file parsed!",
        description: "Data is ready for transfer.",
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

  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAtlasCredentials({ ...atlasCredentials, [e.target.name]: e.target.value });
  };

  const handleConfigurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAtlasConfiguration({ ...atlasConfiguration, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    try {
      const result = await loginToAtlas(atlasCredentials);
      if (result.success) {
        setIsLoggedIn(true);
        toast({
          title: "Login Successful!",
          description: "You are now connected to MongoDB Atlas.",
        });
      } else {
        toast({
          title: "Login Failed",
          description: result.error || "Invalid credentials.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Error",
        description: error.message || "Failed to connect to MongoDB Atlas.",
        variant: "destructive",
      });
    }
  };

  const handleTransferData = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Not Logged In",
        description: "Please log in to MongoDB Atlas before transferring data.",
        variant: "destructive",
      });
      return;
    }

    if (jsonData.length === 0) {
      toast({
        title: "No Data to Transfer",
        description: "Please upload a CSV file to parse the data.",
        variant: "destructive",
      });
      return;
    }

    try {
      await uploadDataToAtlas(atlasConfiguration, jsonData);
      toast({
        title: "Data Transfer Successful!",
        description: "Data has been successfully transferred to MongoDB Atlas.",
      });
    } catch (error: any) {
      console.error("Data transfer error:", error);
      toast({
        title: "Data Transfer Error",
        description: error.message || "Failed to transfer data to MongoDB Atlas.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-secondary">
      <Toaster />
      <Card className="w-full max-w-md space-y-4 p-4 rounded-lg shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-center">CSV Atlas Uploader</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="csv-upload" className="text-sm font-medium">Upload CSV File:</label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
          </div>

          <Card className="p-4 rounded-md bg-muted">
            <CardHeader>
              <CardTitle className="text-md font-semibold">MongoDB Atlas Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col space-y-1">
                <label htmlFor="public-key" className="text-sm font-medium">Public Key:</label>
                <Input id="public-key" type="text" name="publicKey" value={atlasCredentials.publicKey} onChange={handleCredentialChange} />
              </div>
              <div className="flex flex-col space-y-1">
                <label htmlFor="private-key" className="text-sm font-medium">Private Key:</label>
                <Input id="private-key" type="password" name="privateKey" value={atlasCredentials.privateKey} onChange={handleCredentialChange} />
              </div>
            </CardContent>
          </Card>

          <Card className="p-4 rounded-md bg-muted">
            <CardHeader>
              <CardTitle className="text-md font-semibold">Atlas Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col space-y-1">
                <label htmlFor="project-id" className="text-sm font-medium">Project ID:</label>
                <Input id="project-id" type="text" name="projectId" value={atlasConfiguration.projectId} onChange={handleConfigurationChange} />
              </div>
              <div className="flex flex-col space-y-1">
                <label htmlFor="database-name" className="text-sm font-medium">Database Name:</label>
                <Input id="database-name" type="text" name="databaseName" value={atlasConfiguration.databaseName} onChange={handleConfigurationChange} />
              </div>
              <div className="flex flex-col space-y-1">
                <label htmlFor="collection-name" className="text-sm font-medium">Collection Name:</label>
                <Input id="collection-name" type="text" name="collectionName" value={atlasConfiguration.collectionName} onChange={handleConfigurationChange} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button onClick={handleLogin} disabled={isLoggedIn} className="bg-primary text-primary-foreground hover:bg-primary/80">
              {isLoggedIn ? "Logged In" : "Login to Atlas"}
            </Button>
            <Button onClick={handleTransferData} disabled={!isLoggedIn || jsonData.length === 0} className="bg-accent text-accent-foreground hover:bg-accent/80">
              Transfer Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
