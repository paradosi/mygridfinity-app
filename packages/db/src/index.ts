import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;
let dbInstance: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (dbInstance) return dbInstance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  client = postgres(url, { max: 5 });
  dbInstance = drizzle(client);
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = undefined;
    dbInstance = undefined;
  }
}
