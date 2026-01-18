import { Request, Response, NextFunction } from "express";
/**
 * Ensures employee's Keycloak token is valid before sending data to HRM.
 * Refreshes if expired, otherwise continues with the current token.
 */
export declare const ensureFreshKeycloakToken: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=validateKeycloakBeforeHRM.d.ts.map