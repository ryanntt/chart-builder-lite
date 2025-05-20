
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
    
    const processedDocs = documents.map(doc => processDocument(doc as Document)); 
    
    const headersSet = new Set<string>();
    const extractObjectPaths = (obj: any, prefix: string = ''): void => {
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) { 
        if(prefix) headersSet.add(prefix);
        return;
      }
      
      const keys = Object.keys(obj);
      if (keys.length === 0 && prefix) { 
         headersSet.add(prefix);
         return;
      }

      keys.forEach(key => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          extractObjectPaths(value, newKey);
        } else {
          headersSet.add(newKey);
        }
      });
    };
    processedDocs.forEach(doc => extractObjectPaths(doc));
    const tableHeaders = Array.from(headersSet).sort();
    
    return { 
        success: true, 
        data: { 
            jsonData: processedDocs,
            tableHeaders,
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

// --- Sample Mflix Data ---
const SAMPLE_MFLIX_MOVIES_DATA = [
  {
    _id: new ObjectId("573a1390f29313caabcd4135"),
    plot: "Three men hammer on an anvil and pass a bottle of beer around.",
    genres: ["Short"],
    runtime: 1,
    cast: ["Charles Kayser", "John Ott"],
    num_mflix_comments: 0,
    title: "Blacksmith Scene",
    fullplot: "A stationary camera looks at a large anvil with a blacksmith behind it and one on either side. The smith in the middle draws a heated metal rod from the fire, places it on the anvil, and all three begin a rhythmic hammering. After several blows, the metal goes back in the fire. One smith pulls out a bottle of beer, and they each take a swig. Then, out comes the heated metal and the hammering resumes.",
    countries: ["USA"],
    released: new Date(-2418758400000),
    directors: ["William K.L. Dickson"],
    rated: "UNRATED",
    awards: {
      wins: 1,
      nominations: 0,
      text: "1 win."
    },
    lastupdated: "2015-08-26 00:03:50.133000000",
    year: 1893,
    imdb: {
      rating: 6.2,
      votes: 1189,
      id: 5
    },
    type: "movie",
    tomatoes: {
      viewer: {
        rating: 3.0,
        numReviews: 184,
        meter: 32
      },
      fresh: 0,
      critic: {
        rating: 6.0, // Corrected from '6. crítico,'
        numReviews: 1,
        meter: 100
      },
      rotten: 0,
      lastUpdated: new Date(1435516449000)
    }
  },
  {
    _id: new ObjectId("573a1390f29313caabcd42e8"),
    plot: "A group of bandits resort to extremes to hijack a mail train.",
    genres: ["Short", "Western"],
    runtime: 11,
    cast: [
      "A.C. Abadie",
      "Gilbert M. 'Broncho Billy' Anderson",
      "George Barnes",
      "Justus D. Barnes"
    ],
    num_mflix_comments: 0,
    title: "The Great Train Robbery",
    fullplot: "Among the earliest existing films in American cinema - notable as the first film that presented a narrative story to viewers.",
    countries: ["USA"],
    released: new Date(-2082883200000),
    directors: ["Edwin S. Porter"],
    rated: "TV-G",
    awards: {
      wins: 1,
      nominations: 0,
      text: "1 win."
    },
    lastupdated: "2015-08-09 00:27:09.100000000",
    year: 1903,
    imdb: {
      rating: 7.4,
      votes: 9847,
      id: 439
    },
    type: "movie",
    tomatoes: {
      viewer: {
        rating: 3.7,
        numReviews: 2559,
        meter: 75
      },
      dvd: new Date(1120492800000),
      fresh: 6,
      critic: {
        rating: 7.6,
        numReviews: 6,
        meter: 100
      },
      rotten: 0,
      lastUpdated: new Date(1431021504000)
    }
  },
  {
    _id: new ObjectId("573a1390f29313caabcd4323"),
    plot: "A young boy, opressed by his mother, goes on a journey to find happiness.",
    genres: ["Short", "Drama", "Fantasy"],
    runtime: 7,
    cast: ["Georges Mèliès", "Jeanne d'Alcy"],
    num_mflix_comments: 0,
    title: "The Impossible Voyage",
    fullplot: "A group of scientists begin a journey to the sun.",
    countries: ["France"],
    released: new Date(-2064384000000),
    directors: ["Georges Mèliès"],
    writers: ["Georges Mèliès (scenario)"],
    awards: {
      wins: 0,
      nominations: 0,
      text: ""
    },
    lastupdated: "2015-08-13 00:27:00.800000000",
    year: 1904,
    imdb: {
      rating: 7.0,
      votes: 964,
      id: 453
    },
    type: "movie",
    tomatoes: {
      viewer: {
        rating: 3.6,
        numReviews: 119,
        meter: 71
      },
      fresh: 1,
      rotten: 0,
      lastUpdated: new Date(1413227121000)
    }
  }
];


// Helper function to extract all unique paths from a dataset
const extractPathsFromData = (data: any[]): string[] => {
  const paths = new Set<string>();
  const extract = (obj: any, prefix = '') => {
    if (typeof obj !== 'object' || obj === null) {
      if (prefix) paths.add(prefix);
      return;
    }
    if (Array.isArray(obj)) {
      if (prefix) paths.add(prefix); 
    } else {
      if (Object.keys(obj).length === 0 && prefix) {
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
    await new Promise(resolve => setTimeout(resolve, 500));

    const processedData = SAMPLE_MFLIX_MOVIES_DATA.map(doc => processDocument(doc as Document));
    const tableHeaders = extractPathsFromData(processedData);
    
    return {
      success: true,
      data: {
        jsonData: processedData,
        tableHeaders,
        sampledRowCount: processedData.length,
        totalRowCount: processedData.length, // Since this is a fixed sample
      }
    };
  } catch (error) {
    console.error("Error fetching sample mflix movies data:", error);
    return { success: false, error: sanitizeError(error) };
  }
}
