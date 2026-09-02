import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
  // Neon requires SSL in production; local Docker doesn't.
  ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});

export const prisma = new PrismaClient({ adapter });
