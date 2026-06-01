import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({
    uid: req.user!.uid,
    name: req.user!.name,
    email: req.user!.email
  })
});

export default router;