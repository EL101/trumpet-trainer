import { afterAll, beforeEach, vi } from "vitest";
import { prisma } from "../src/db.js";
import { resetFirebase } from "./firebaseMock.js";

vi.mock("firebase-admin", async () => ({ default: (await import("./firebaseMock.js")).admin }));

beforeEach(async () => {
  resetFirebase();
  await prisma.$executeRawUnsafe("TRUNCATE users, history, library, user_avatars CASCADE");
});

afterAll(async () => {
  await prisma.$disconnect();
});
