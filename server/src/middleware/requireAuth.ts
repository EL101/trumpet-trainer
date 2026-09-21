import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import { ensureUserExists } from "../queries/users.js";

// Extend Express's Request type so TypeScript knows about req.user
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const token = authHeader.replace("Bearer ", "");

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Exercise rows point at `users` by foreign key, so the row has to exist
  // before any route writes one. Cached, so this is one INSERT per uid per boot.
  // Kept out of the block above so a DB outage isn't reported as a bad token.
  try {
    await ensureUserExists(decoded);
  } catch (err) {
    console.error("Failed to ensure user row:", err);
    return res.status(500).json({ error: "Failed to load user" });
  }

  req.user = decoded; // make user info available to route handlers
  next(); // pass control to the next middleware/handler
}
