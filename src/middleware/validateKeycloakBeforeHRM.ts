// src/middleware/validateKeycloakBeforeHRM.ts
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { Request, Response, NextFunction } from "express";
import axios from "axios";

/**
 * Ensures employee's Keycloak token is valid before sending data to HRM.
 * Refreshes if expired, otherwise continues with the current token.
 */
export const ensureFreshKeycloakToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.cookies?.keycloak_token;
    const refreshToken = req.cookies?.keycloak_refresh_token;

    if (!accessToken && !refreshToken) {
      return res.status(401).json({ error: "Session expired, login again." });
    }

    // Try verifying access token
    try {
      const decodedHeader = jwt.decode(accessToken, { complete: true });
      const kid = decodedHeader?.header?.kid;

      const client = jwksClient({
        jwksUri: `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
      });

      const key = await client.getSigningKey(kid);
      const publicKey = key.getPublicKey();
      jwt.verify(accessToken, publicKey);

      // Valid → attach and continue
      req.validAccessToken = accessToken;
      return next();
    } catch {
      console.log("Access token expired, refreshing...");
    }

    // If expired, refresh
    if (!refreshToken)
      return res.status(401).json({ error: "Session expired, please log in" });

    const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KEYCLOAK_CLIENT_ID!,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
      refresh_token: refreshToken,
    });

    const { data: refreshed } = await axios.post(tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Update cookies with new tokens
    res.cookie("keycloak_token", refreshed.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshed.expires_in * 1000,
    });
    res.cookie("keycloak_refresh_token", refreshed.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshed.refresh_expires_in * 1000,
    });

    req.validAccessToken = refreshed.access_token;
    next();
  } catch (error) {
    console.error("Keycloak check failed:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
