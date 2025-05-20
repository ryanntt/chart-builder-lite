
'use server';

import { MongoClient, ServerApiVersion, Collection, ObjectId } from 'mongodb';
import type { Document } from 'mongodb';
import sampleMflixMoviesData from '../lib/sample-data/mflix-movies.json';

interface AtlasActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('authentication') || error.message.includes('credentials')) {
      return 'Authentication failed. Please check your connection string and credentials.';
    }
    if (error.message.includes('timed out') || error.message.includes('network error')) {
      return 'Connection timed out. Please check your network or Atlas IP access list.';
    }
    return 'An unexpected error occurred while connecting to MongoDB Atlas.';
  }
  return 'An unknown error occurred.';
}

export async function fetchDatabases(connectionString: string): Promise<AtlasActionResult<string[]>> {
  if (!connectionString) {
    return { success: false, error: 'Connection string is required.' };
  }

  let client: MongoClient | undefined;
  try {
    client = new MongoClient(connectionString, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    await client.connect();
    const databases = await client.db().admin().listDatabases();
    const dbNames = databases.databases.map(db => db.name).filter(name => !['admin', 'local', 'config'].includes(name));
    console.log("Successfully fetched databases:", dbNames);
    return { success: true, data: dbNames };
  } catch (error) {
    console.error("Error fetching databases:", error);
    return { success: false, error: sanitizeError(error) };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

export async function fetchCollections(connectionString: string, dbName: string): Promise<AtlasActionResult<string[]>> {
  if (!connectionString || !dbName) {
    return { success: false, error: 'Connection string and database name are required.' };
  }
  
  let client: MongoClient | undefined;
  try {
    client = new MongoClient(connectionString, {
       serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    await client.connect();
    const collections = await client.db(dbName).listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    console.log(`Successfully fetched collections for database ${dbName}:`, collectionNames);
    return { success: true, data: collectionNames };
  } catch (error) {
    console.error(`Error fetching collections for database ${dbName}:`, error);
    return { success: false, error: sanitizeError(error) };
  } finally {
    if (client) {
      await client.close();
    }
  }
}


interface FetchCollectionDataResult {
    jsonData: any[];
    tableHeaders: string[];
    sampledRowCount: number;
    totalRowCount: number;
}

// Helper to process a document (handles BSON types like ObjectId and Date)
// Keeps nested structure for direct JSON representation.
function processDocument(doc: Document): Document {
  const processed: Document = {};
  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key)) {
      const value = doc[key];
      if (value instanceof ObjectId) {
        processed[key] = value.toString(); // Convert ObjectId to string
      } else if (value instanceof Date) {
        if (isNaN(value.getTime())) { // Check for invalid Date
          processed[key] = null; 
        } else {
          processed[key] = value.toISOString();
        }
      } else if (Array.isArray(value)) {
        // Recursively process elements in an array if they are objects or arrays
        processed[key] = value.map(item => {
          if (typeof item === 'object' && item !== null && !(item instanceof Date) && !(item instanceof ObjectId)) {
            return processDocument(item as Document);
          } else if (item instanceof ObjectId) {
            return item.toString();
          } else if (item instanceof Date) {
            return isNaN(item.getTime()) ? null : item.toISOString();
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
        processed[key] = processDocument(value as Document); // Recursively process nested objects
      }
       else {
        processed[key] = Buffer.isBuffer(value) ? `[Buffer]` : value;
      }
    }
  }
  return processed;
}


export async function fetchCollectionData(
    connectionString: string, 
    dbName: string, 
    collectionName: string,
    limit: number = 1000 
): Promise<AtlasActionResult<FetchCollectionDataResult>> {
  if (!connectionString || !dbName || !collectionName) {
    return { success: false, error: 'Connection string, database name, and collection name are required.' };
  }

  let client: MongoClient | undefined;
  try {
    client = new MongoClient(connectionString, {
       serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    await client.connect();
    const collection: Collection<Document> = client.db(dbName).collection(collectionName);
    
    const totalRowCount = await collection.countDocuments();
    const documents = await collection.find().limit(limit).toArray();
    const sampledRowCount = documents.length;

    console.log(`Successfully fetched ${sampledRowCount} of ${totalRowCount} documents from ${dbName}.${collectionName}`);

    if (documents.length === 0) {
      return { success: true, data: { jsonData: [], tableHeaders: [], sampledRowCount: 0, totalRowCount } };
    }
    
    // Process documents to handle BSON types (like ObjectId or Date) into JSON-friendly formats
    // while keeping the nested structure.
    const processedDocs = documents.map(doc => processDocument(doc as Document)); 
    
    // Extract all unique paths from the processed documents to serve as table headers
    const headersSet = new Set<string>();
    const extractObjectPaths = (obj: any, prefix: string = ''): void => {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) { 
        // If it's a primitive or an array (we treat array itself as a path if prefix exists, 
        // or its elements if they are objects/arrays recursively)
        if(prefix) headersSet.add(prefix);
        return;
      }
      
      const keys = Object.keys(obj);
      if (keys.length === 0 && prefix) { // Handle empty objects
         headersSet.add(prefix);
         return;
      }

      keys.forEach(key => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        // If the value is an object (and not null or an array), recurse
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractObjectPaths(value, newKey);
        } else {
          // Otherwise, it's a leaf node or an array (which we add as a path)
          headersSet.add(newKey);
        }
      });
    };
    processedDocs.forEach(doc => extractObjectPaths(doc));
    const tableHeaders = Array.from(headersSet).sort();
    
    return { 
        success: true, 
        data: { 
            jsonData: processedDocs, // Return the processed, nested JSON data
            tableHeaders, // Return the flat list of dot-notation headers
            sampledRowCount,
            totalRowCount
        } 
    };
  } catch (error) {
    console.error(`Error fetching data from collection ${dbName}.${collectionName}:`, error);
    return { success: false, error: sanitizeError(error) };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Helper function to extract all unique paths from a dataset
const extractPathsFromData = (data: any[]): string[] => {
  const paths = new Set<string>();
  const extract = (obj: any, prefix = '') => {
    if (typeof obj !== 'object' || obj === null) { // Primitives
      if (prefix) paths.add(prefix);
      return;
    }
    if (Array.isArray(obj)) {
       // For arrays, we add the path to the array itself.
       // If elements need to be individually addressable as headers (e.g., array[0].field),
       // this logic would need to be more complex, potentially adding paths like 'array.0', 'array.1', etc.
       // For now, treating the array path as a single header.
      if (prefix) paths.add(prefix); 
    } else { // Objects
      if (Object.keys(obj).length === 0 && prefix) { // Empty objects
         paths.add(prefix); 
         return;
      }
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          extract(obj[key], prefix ? `${prefix}.${key}` : key);
        }
      }
    }
  };
  data.forEach(item => extract(item));
  return Array.from(paths).sort();
};


export async function fetchSampleMflixMoviesData(): Promise<AtlasActionResult<FetchCollectionDataResult>> {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // The imported data is already in JSON format (strings for ObjectId and Date)
    // processDocument will mostly pass these through but ensure consistent structure.
    const processedData = sampleMflixMoviesData.map(doc => processDocument(doc as Document));
    const tableHeaders = extractPathsFromData(processedData);
    const totalRowCount = processedData.length;
    
    return {
      success: true,
      data: {
        jsonData: processedData,
        tableHeaders,
        sampledRowCount: totalRowCount, // For sample data, sampled and total are the same
        totalRowCount: totalRowCount, 
      }
    };
  } catch (error) {
    console.error("Error fetching sample mflix movies data:", error);
    return { success: false, error: sanitizeError(error) };
  }
}

    
