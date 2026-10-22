import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en el entorno");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
