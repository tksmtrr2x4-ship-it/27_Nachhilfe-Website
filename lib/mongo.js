import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "nachhilfe";

// Cache the connection promise across requests (and, in dev, across HMR
// reloads via a global) so we don't open a new pool on every call.
let clientPromise;

function getClientPromise() {
  if (!uri) {
    throw new Error(
      "MONGODB_URI fehlt in den Umgebungsvariablen (siehe .env.local.example)."
    );
  }
  if (clientPromise) return clientPromise;

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}
