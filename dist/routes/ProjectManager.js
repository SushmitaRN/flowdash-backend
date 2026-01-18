"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
router.get("/ManagerTasks", auth_1.auth, async (req, res) => {
    try {
        const employeeId = req.user.id;
        // 1. Fetch tasks assigned to the logged-in employee
        const tasks = await db_1.default.task.findMany({
            where: { assigneeId: employeeId, isDeleted: false },
            include: {
                createdBy: true,
            },
            orderBy: { dueDate: "asc" },
        });
        // 2. Map manager files from Supabase
        const tasksWithFiles = await Promise.all(tasks.map(async (task) => {
            // Manager files (from bucket: ManagerFiles, folder: task.id)
            const { data: managerFiles } = await supabase.storage
                .from("projectManagerFiles")
                .list(task.id, { limit: 10 });
            const managerFileUrls = managerFiles?.map((file) => supabase.storage
                .from("projectManagerFiles")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl) || [];
            // Employee uploaded files (from bucket: OperationsDocuments)
            const { data: employeeFiles } = await supabase.storage
                .from("ManagerAddedDocuments")
                .list(task.id, { limit: 10 });
            const employeeFileUrls = employeeFiles?.map((file) => supabase.storage
                .from("ManagerAddedDocuments")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl) || [];
            return {
                ...task,
                managerFiles: managerFileUrls,
                employeeFiles: employeeFileUrls,
            };
        }));
        res.json({ tasks: tasksWithFiles });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});
// Employment Assignment
//* Get the user and Manager list
router.get("/Manager_employee_list", auth_1.auth, async (req, res) => {
    const userId = req.user.id;
    try {
        const managers = await db_1.default.employee.findMany({
            where: {
                managerId: userId,
            },
            select: {
                name: true,
                roleTitle: true,
                department: true,
                user: {
                    select: {
                        id: true,
                        ManagerEmployees: {
                            select: {
                                id: true,
                                name: true,
                                roleTitle: true,
                                department: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        });
        res.status(200).json({ managers });
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
// Get all operators who are not assigned to any manager
router.get("/employee-assign/new-joiners", auth_1.auth, (0, role_1.requireRole)("PROJECT_MANAGER"), // only PM can see this
async (req, res) => {
    try {
        const newJoiners = await db_1.default.employee.findMany({
            where: {
                managerId: null,
                user: {
                    role: "OPERATOR",
                },
            },
            select: {
                id: true,
                name: true,
                roleTitle: true,
                department: true,
                status: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        // You can send exactly what your UI needs
        res.status(200).json({ newJoiners });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch new joiners" });
    }
});
// Assign an employee (operator) to a manager
router.post("/employee-assign/assign", auth_1.auth, (0, role_1.requireRole)("PROJECT_MANAGER"), async (req, res) => {
    try {
        // 1. Receive new name/dept from body
        const { employeeId, managerUserId, name, department } = req.body;
        if (!employeeId || !managerUserId) {
            return res
                .status(400)
                .json({ error: "employeeId and managerUserId are required" });
        }
        // 2. Validate Manager
        const managerUser = await db_1.default.user.findFirst({
            where: {
                id: managerUserId,
                role: { in: ["MANAGER", "PROJECT_MANAGER"] },
            },
        });
        if (!managerUser) {
            return res.status(404).json({ error: "Target Manager not found" });
        }
        // 3. Validate Employee
        const employee = await db_1.default.employee.findFirst({
            where: {
                id: employeeId,
                user: { role: "OPERATOR" },
            },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee (operator) not found" });
        }
        // 4. Update & Assign
        // We update the name/department AND set the managerId
        const updatedEmployee = await db_1.default.employee.update({
            where: { id: employeeId },
            data: {
                managerId: managerUserId,
                name: name || employee.name, // Use new name if provided, else keep old
                department: department || employee.department, // Use new dept if provided
            },
        });
        res.status(200).json({
            message: "Employee details updated and assigned successfully",
            employee: updatedEmployee,
        });
    }
    catch (error) {
        console.error("Assignment Error:", error);
        res.status(500).json({ error: "Failed to assign employee" });
    }
});
exports.default = router;
//# sourceMappingURL=ProjectManager.js.map