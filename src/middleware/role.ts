import { Request, Response, NextFunction } from "express";

export function requireRole(...allowed: Array<"MANAGER" | "OPERATOR" | "PROJECT_MANAGER">) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check case-insensitive
    const role = req.user?.role?.toUpperCase();
    // Allow if role matches any allowed role (assuming allowed are passed as uppercase)
    const allowedUpper = allowed.map(r => r.toUpperCase());

    // cast role to any to avoid typescript strict errors with the Enum string literal
    if (!role || !allowedUpper.includes(role as any)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
