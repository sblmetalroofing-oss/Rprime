import type { Express, Request } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

interface AuthenticatedUser {
  claims?: { sub?: string };
  id?: string;
}

interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      // Guard against undefined user or claims
      if (!req.user || !req.user.claims || !req.user.claims.sub) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
