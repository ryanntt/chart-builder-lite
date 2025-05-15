
'use server';

import { MongoClient, ServerApiVersion, Collection, ObjectId } from 'mongodb';
import type { Document } from 'mongodb';

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
    rowCount: number;
}

// Helper to flatten a document - still used for direct Atlas connections
function flattenDocument(doc: Document, prefix: string = ''): Document {
  const flattened: Document = {};
  for (const key in doc) {
    if (Object.prototype.hasOwnProperty.call(doc, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      const value = doc[key];

      if (value instanceof ObjectId) {
        flattened[newKey] = value.toString();
      } else if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          flattened[newKey] = null; 
        } else {
          flattened[newKey] = value.toISOString();
        }
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value); // Simple stringify for arrays in flattened view
      } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value) && Object.keys(value).length > 0) {
        Object.assign(flattened, flattenDocument(value, newKey));
      } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value) && Object.keys(value).length === 0) {
        flattened[newKey] = '{}'; 
      }
      else {
        flattened[newKey] = Buffer.isBuffer(value) ? `[Buffer]` : value;
      }
    }
  }
  return flattened;
}


export async function fetchCollectionData(
    connectionString: string, 
    dbName: string, 
    collectionName: string,
    limit: number = 100 
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
    
    const documents = await collection.find().limit(limit).toArray();
    console.log(`Successfully fetched ${documents.length} documents from ${dbName}.${collectionName}`);

    if (documents.length === 0) {
      return { success: true, data: { jsonData: [], tableHeaders: [], rowCount: 0 } };
    }

    const flattenedDocs = documents.map(doc => flattenDocument(doc as Document)); // Cast to Document
    
    const headersSet = new Set<string>();
    flattenedDocs.forEach(doc => {
      Object.keys(doc).forEach(key => headersSet.add(key));
    });
    const tableHeaders = Array.from(headersSet);

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
            rowCount: documents.length 
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
