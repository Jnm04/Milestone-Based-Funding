import pg from "pg";
import { readFileSync } from "fs";

// Read DATABASE_URL from .env.local
const env = readFileSync(".env.local", "utf-8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = match?.[1];

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const res = await client.query(
  `UPDATE "User" SET "walletAddress" = $1 WHERE email = 'janniklasmoeller04@gmail.com' RETURNING email, "walletAddress"`,
  ["0xaBdDbB5BfF6958Db1478bE83585814dC8DB8a3f6"]
);

console.log("Updated:", res.rowCount, "users");
res.rows.forEach(r => console.log(" -", r.email, "→", r.walletAddress));

await client.end();
