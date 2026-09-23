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
    // checkRevoked costs a lookup against Firebase per request, but it is what
    // makes a disabled, deleted or signed-out-everywhere account stop working
    // before its token expires -- including guests the sweep has just removed,
    // whose still-valid tokens would otherwise recreate the row we deleted.
    decoded = await admin.auth().verifyIdToken(token, true);
  } catch (err) {
    const code = err instanceof Error && "code" in err ? String(err.code) : "";
    if (code === "auth/user-disabled") {
      return res.status(403).json({ error: "Account disabled" });
    }
    // Revoked and deleted both mean "sign in again", unlike a malformed token.
    if (code === "auth/id-token-revoked" || code === "auth/user-not-found") {
      return res.status(401).json({ error: "Session expired", reauth: true });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Exercise rows point at `users` by foreign key, so the row has to exist
  // before any route writes one. This also keeps lastSeenAt current for the
  // guest sweep. Throttled per process, so most requests skip it entirely.
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
