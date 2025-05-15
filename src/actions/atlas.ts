
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
      const value = doc[key];

      if (value instanceof ObjectId) {
        flattened[newKey] = value.toString();
      } else if (value instanceof Date) {
        flattened[newKey] = value.toISOString();
      } else if (Array.isArray(value)) {
        // For arrays, stringify them. Could also iterate and flatten if needed.
        flattened[newKey] = JSON.stringify(value);
      } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value) && Object.keys(value).length > 0) {
        // If it's a non-empty nested object (and not null, not Buffer), recurse
        Object.assign(flattened, flattenDocument(value, newKey));
      } else if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value) && Object.keys(value).length === 0) {
        // Handle empty objects e.g. by stringifying or specific representation
        flattened[newKey] = '{}'; 
      }
      else {
        // For primitives, Buffers, or null
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

// --- Sample Data Actions ---

export async function fetchSampleDatabases(): Promise<AtlasActionResult<string[]>> {
  // Simulate fetching sample databases
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return { success: true, data: ['sample_mflix'] };
}

export async function fetchSampleCollections(dbName: string): Promise<AtlasActionResult<string[]>> {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  if (dbName === 'sample_mflix') {
    return { success: true, data: ['movies'] }; // Only return 'movies' for now
  }
  return { success: false, error: `Sample database "${dbName}" not found.` };
}

const sampleMflixMoviesData = [
  { _id: "573a1390f29313caabcd4135", title: "Blacksmith Scene", year: 1893, runtime: 1, released: new Date("-2418528000000"), type: "movie", genres: ["Short"]},
  { _id: "573a1390f29313caabcd42e8", title: "The Great Train Robbery", year: 1903, runtime: 11, released: new Date("-2082940800000"), type: "movie", genres: ["Short", "Western"]},
  { _id: "573a1390f29313caabcd446f", title: "The Land Beyond the Sunset", year: 1912, runtime: 14, released: new Date("-1820908800000"), type: "movie", genres: ["Short", "Drama"]},
  { _id: "573a1390f29313caabcd4803", title: "The Wonderful Wizard of Oz", year: 1910, runtime: 15, released: new Date("-1883952000000"), type: "movie", genres: ["Short", "Adventure", "Fantasy"]},
  { _id: "573a1390f29313caabcd498c", title: "A Corner in Wheat", year: 1909, runtime: 14, released: new Date("-1902096000000"), type: "movie", genres: ["Short", "Drama"]},
];
const sampleMflixMoviesHeaders = ["_id", "title", "year", "runtime", "released", "type", "genres"];


const sampleMflixCommentsData = [
  { _id: "5a9427648b0beebeb69579e7", name: "Mercedes Tyler", email: "mercedes_tyler@fakegmail.com", movie_id: "573a1390f29313caabcd4135", text: "Eius veritatis vero facilis quaerat fuga temporibus. Praesentium natus illum nisi.", date: new Date("2012-03-26T04:33:30.000Z")},
  { _id: "5a9427648b0beebeb69579e8", name: "John Doe", email: "john_doe@fakegmail.com", movie_id: "573a1390f29313caabcd42e8", text: "Accusantium quod error ut enim sequi consectetur. Minus ex ipsam commodi quas.", date: new Date("1999-08-15T15:02:00.000Z")},
  { _id: "5a9427648b0beebeb69579e9", name: "Sophie Turner", email: "sophie_turner@fakegmail.com", movie_id: "573a1390f29313caabcd446f", text: "Maiores quasi itaque animi maxime excepturi. Necessitatibus labore ad ut ab. Quisquam quos commodi.", date: new Date("2001-05-10T03:17:13.000Z")},
];
const sampleMflixCommentsHeaders = ["_id", "name", "email", "movie_id", "text", "date"];


export async function fetchSampleCollectionData(
  dbName: string,
  collectionName: string
): Promise<AtlasActionResult<FetchCollectionDataResult>> {
  await new Promise(resolve => setTimeout(resolve, 700)); // Simulate network delay

  if (dbName === 'sample_mflix') {
    if (collectionName === 'movies') {
      const jsonData = sampleMflixMoviesData.map(doc => flattenDocument(doc));
      return {
        success: true,
        data: {
          jsonData,
          tableHeaders: sampleMflixMoviesHeaders,
          rowCount: sampleMflixMoviesData.length,
        },
      };
    } else if (collectionName === 'comments') {
       const jsonData = sampleMflixCommentsData.map(doc => flattenDocument(doc));
      return {
        success: true,
        data: {
          jsonData,
          tableHeaders: sampleMflixCommentsHeaders,
          rowCount: sampleMflixCommentsData.length,
        },
      };
    } else if (collectionName === 'theaters' || collectionName === 'users') {
        // Simulate empty collections for these for now
        return { success: true, data: { jsonData: [], tableHeaders: [], rowCount: 0 } };
    }
    return { success: false, error: `Sample collection "${collectionName}" in "${dbName}" not found or data not available.` };
  }
  return { success: false, error: `Sample database "${dbName}" not found.` };
}
