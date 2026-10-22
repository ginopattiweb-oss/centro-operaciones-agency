import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("migraciones aplicadas ok");
  process.exit(0);
}
main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
