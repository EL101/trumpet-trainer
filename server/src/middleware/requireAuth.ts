import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";

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

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // make user info available to route handlers
    next(); // pass control to the next middleware/handler
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
