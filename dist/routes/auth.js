"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db"));
const validateKeycloakBeforeHRM_1 = require("../middleware/validateKeycloakBeforeHRM");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Development-only login route with hardcoded credentials
const HARDCODED_DEV_USERS = {
    "pm@dotspeaks.com": { password: "pm123456", role: client_1.Role.MANAGER, name: "Project Manager" },
    "manager@dotspeaks.com": { password: "manager123", role: client_1.Role.MANAGER, name: "Manager" },
    "employee@dotspeaks.com": { password: "employee123", role: client_1.Role.OPERATOR, name: "Employee" }
};
router.post("/dev-login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: "email & password required" });
        // Check if user exists in hardcoded credentials
        // Cast to any to access the users object dynamically or define a type, but for quick fix:
        const devUser = HARDCODED_DEV_USERS[email];
        if (!devUser || devUser.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        // Find or create user in database
        let user = await db_1.default.user.findUnique({ where: { email } });
        if (!user) {
            user = await db_1.default.user.create({
                data: {
                    email,
                    password: "", // No password needed for dev users
                    role: devUser.role,
                },
            });
            // Create employee profile if needed
            if (devUser.role === "MANAGER" || devUser.role === "OPERATOR") {
                await db_1.default.employee.create({
                    data: {
                        userId: user.id,
                        name: devUser.name,
                        roleTitle: devUser.role,
                        department: null,
                        managerId: null,
                    },
                });
            }
        }
        // Generate JWT token
        const appToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || "dev-secret-key-change-in-production", { expiresIn: "7d" });
        res.json({
            token: appToken,
            role: user.role,
            userId: user.id,
            email: user.email,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e?.message || "login failed" });
    }
});
router.post("/register", async (req, res) => {
    try {
        const { email, password, role, name, roleTitle, department } = req.body;
        if (!email || !password || !role)
            return res.status(400).json({ error: "email, password, role required" });
        const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10);
        const user = await db_1.default.user.create({
            data: { email, password: hash, role },
        });
        // if operator, optionally create Employee profile
        if (role === "OPERATOR") {
            await db_1.default.employee.create({
                data: {
                    userId: user.id,
                    name: name ?? email.split("@")[0],
                    roleTitle: roleTitle ?? "Operator",
                    department: department ?? "Operations",
                },
            });
        }
        res.json({ id: user.id, email: user.email, role: user.role });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || "register failed" });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: "email & password required" });
        // 1️⃣ Authenticate with Keycloak
        const tokenUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
        const body = new URLSearchParams({
            grant_type: "password",
            client_id: process.env.KEYCLOAK_PROVISIONER_CLIENT_ID, // e.g. hrm-backend
            client_secret: process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET, // from Credentials tab
            username: email,
            password,
        });
        console.log("token url: ", tokenUrl);
        let kc;
        try {
            const { data } = await axios_1.default.post(tokenUrl, body, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            kc = data;
            console.log(data);
        }
        catch (err) {
            return res
                .status(401)
                .json({ error: "Invalid credentials (Keycloak)", err });
        }
        // 2️⃣ Decode Keycloak access token to extract info
        const decoded = JSON.parse(Buffer.from(kc.access_token.split(".")[1], "base64").toString("utf8"));
        const keycloakSub = decoded.sub;
        const roles = decoded.realm_access?.roles || [];
        const role = roles.includes("MANAGER") ? "MANAGER" : "OPERATOR";
        // 3️⃣ Find or create user in Prisma
        let user = await db_1.default.user.findUnique({ where: { email } });
        if (!user) {
            user = await db_1.default.user.create({
                data: {
                    email,
                    password: "", // handled by Keycloak
                    role,
                },
            });
            if (role === "MANAGER" || role === "OPERATOR") {
                await db_1.default.employee.create({
                    data: {
                        userId: user.id,
                        name: email.split("@")[0], // placeholder name
                        roleTitle: role,
                        department: null,
                        managerId: null, // Managers have no manager initially
                    },
                });
            }
        }
        // 4️⃣ Link with ExternalIdentity table
        await db_1.default.externalIdentity.upsert({
            where: { email },
            update: { subject: keycloakSub },
            create: {
                provider: "keycloak",
                subject: keycloakSub,
                email,
                userId: user.id,
            },
        });
        // 5️⃣ Return your app’s own JWT for frontend
        const appToken = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.cookie("keycloak_token", kc.access_token, {
            httpOnly: true,
            secure: true, // ✅ must be false in localhost (no HTTPS)
            sameSite: "none", // ✅ allows cookies for cross-site GETs
            maxAge: kc.expires_in * 1000, // 5 mins
        });
        res.cookie("keycloak_refresh_token", kc.refresh_token, {
            httpOnly: true,
            secure: true, // ✅ must be false in localhost (no HTTPS)
            sameSite: "none", // ✅ allows cookies for cross-site GETs
            maxAge: kc.refresh_expires_in * 1000, // ~30 mins
        });
        res.json({
            token: appToken, // your app token (frontend uses this)
            keycloakToken: kc.access_token,
            role: user.role,
            userId: user.id,
            email,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: e?.message || "login failed" });
    }
});
router.post("/logout", async (req, res) => {
    try {
        const refreshToken = req.cookies["keycloak_refresh_token"];
        if (!refreshToken) {
            return res.status(400).json({ error: "No refresh token found" });
        }
        const logoutUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout`;
        const body = new URLSearchParams({
            client_id: process.env.KEYCLOAK_PROVISIONER_CLIENT_ID,
            client_secret: process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET,
            refresh_token: refreshToken,
        });
        await axios_1.default.post(logoutUrl, body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        //  Remove cookies
        res.clearCookie("keycloak_token", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        res.clearCookie("keycloak_refresh_token", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        res.clearCookie("token", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        return res.json({ message: "Logged out successfully" });
    }
    catch (err) {
        console.error("Logout Error:", err.response?.data || err.message);
        return res.status(500).json({
            error: err?.message || "Failed to log out",
        });
    }
});
router.post("/token", async (req, res) => {
    try {
        const url = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
        const body = new URLSearchParams({
            client_id: process.env.KEYCLOAK_AUDIENCE,
            client_secret: process.env.KEYCLOAK_AUDIENCE_SECRET,
            grant_type: "client_credentials",
        });
        const { data } = await axios_1.default.post(url, body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: "Failed to get token" });
    }
});
router.get("/me", auth_1.auth, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        return res.json({
            id: user.id,
            email: user.email,
            role: user.role,
        });
    }
    catch (error) { }
});
router.get("/go-to-hrm", validateKeycloakBeforeHRM_1.ensureFreshKeycloakToken, async (req, res) => {
    try {
        const { tenantCode } = req.query;
        const backend_url = process.env.HRM_BACKEND_ROUTE;
        if (!tenantCode)
            return res.status(400).json({ error: "tenantCode is required" });
        const accessToken = req.validAccessToken;
        // Redirect to HRM frontend
        const hrmRedirectUrl = `${backend_url}/api/tenant/sso-login/${tenantCode}?token=${accessToken}&sso=1`;
        res.json({ redirectUrl: hrmRedirectUrl });
    }
    catch (err) {
        console.error("Redirect failed:", err.message);
        res.status(500).json({ error: "Failed to redirect to HRM" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map