
'use server';

import { MongoClient, ServerApiVersion, Collection } from 'mongodb';
import type { Document } from 'mongodb';

interface AtlasActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Avoid exposing detailed internal error messages
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
    const dbNames = databases.databases.map(db => db.name).filter(name => !['admin', 'local', 'config'].includes(name)); // Filter out system DBs
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
    rowCount: number;
}

// Helper to flatten a document
function flattenDocument(doc: Document, prefix: string = ''): Document {
  const flattened: Document = {};
  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof doc[key] === 'object' && doc[key] !== null && !Array.isArray(doc[key]) && !(doc[key] instanceof Date) && Object.keys(doc[key]).length > 0 ) {
         // Check if it's a simple object (not ObjectId, Date, etc.)
        if (doc[key]._bsontype && doc[key]._bsontype === 'ObjectID') {
           flattened[newKey] = doc[key].toString(); // Convert ObjectId to string
        } else {
           Object.assign(flattened, flattenDocument(doc[key], newKey));
        }
      } else if (Array.isArray(doc[key])) {
        flattened[newKey] = JSON.stringify(doc[key]); // Convert arrays to JSON strings
      } else if (doc[key] instanceof Date) {
        flattened[newKey] = doc[key].toISOString(); // Convert dates to ISO strings
      }
       else if (doc[key] !== null && typeof doc[key] === 'object' && doc[key]._bsontype === 'ObjectID') {
        flattened[newKey] = doc[key].toString();
      }
      else {
        flattened[newKey] = doc[key];
      }
    }
  }
  return flattened;
}


export async function fetchCollectionData(
    connectionString: string, 
    dbName: string, 
    collectionName: string,
    limit: number = 100 // Default limit to 100 documents
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
    
    // Fetch a sample of documents (e.g., the first 'limit' documents)
    const documents = await collection.find().limit(limit).toArray();
    console.log(`Successfully fetched ${documents.length} documents from ${dbName}.${collectionName}`);

    if (documents.length === 0) {
      return { success: true, data: { jsonData: [], tableHeaders: [], rowCount: 0 } };
    }

    // Flatten documents and extract headers
    const flattenedDocs = documents.map(doc => flattenDocument(doc));
    
    // Determine headers from all keys in flattened documents
    const headersSet = new Set<string>();
    flattenedDocs.forEach(doc => {
      Object.keys(doc).forEach(key => headersSet.add(key));
    });
    const tableHeaders = Array.from(headersSet);

    // Ensure all jsonData rows have all headers, filling with null if a key is missing
    const jsonData = flattenedDocs.map(doc => {
        const row: any = {};
        tableHeaders.forEach(header => {
            row[header] = doc[header] !== undefined ? doc[header] : null;
        });
        return row;
    });
    
    return { 
        success: true, 
        data: { 
            jsonData, 
            tableHeaders,
            rowCount: documents.length // Or use collection.countDocuments() for total, but that's another call
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
