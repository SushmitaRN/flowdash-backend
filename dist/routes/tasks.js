"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const role_js_1 = require("../middleware/role.js");
const db_1 = __importDefault(require("../db"));
const multer_1 = __importDefault(require("multer"));
const supabase_js_1 = require("@supabase/supabase-js");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not set");
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
//! FOR TIME CALCULATION
// const workLogs = await prisma.taskWorkLog.findMany({
//   where: { taskId }
// });
// const totalMillis = workLogs.reduce((acc, log) => {
//   const end = log.endTime ? new Date(log.endTime) : new Date();
//   return acc + (end.getTime() - new Date(log.startTime).getTime());
// }, 0);
// const totalHours = (totalMillis / 1000 / 60 / 60).toFixed(2);
// Create task (manager)
router.post("/create", auth_js_1.auth, (0, role_js_1.requireRole)("MANAGER", "PROJECT_MANAGER"), upload.single("file"), async (req, res) => {
    const { title, notes, dueDate, priority, assignedHours, assigneeUserId, assigneeEmployeeId, } = req.body;
    if (!title)
        return res.status(400).json({ error: "title is required" });
    let assigneeId = assigneeUserId;
    if (!assigneeId && assigneeEmployeeId) {
        const emp = await db_1.default.employee.findUnique({
            where: { id: assigneeEmployeeId },
        });
        if (!emp)
            return res.status(400).json({ error: "invalid assignee employee id" });
        assigneeId = emp.userId;
    }
    let fileUrl = null;
    if (req.file) {
        const fileName = `${Date.now()}_${req.file.originalname}`;
        console.log(req.file.mimetype);
        const { error } = await supabase.storage
            .from("ManagerFiles")
            .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
        });
        if (error)
            return res.status(500).json({ error: "file upload failed" });
        const { data } = supabase.storage
            .from("ManagerFiles")
            .getPublicUrl(fileName);
        fileUrl = data.publicUrl;
    }
    const task = await db_1.default.task.create({
        data: {
            title,
            notes,
            dueDate: dueDate ? new Date(dueDate) : null,
            priority,
            assignedHours: parseInt(assignedHours) || null,
            createdById: req.user.id,
            assigneeId: assigneeId || null,
            // optionally store fileUrl in your model if you add a column
            fileUrl_manager: fileUrl || null,
        },
    });
    res.status(201).json(task);
});
router.patch("/:id", auth_js_1.auth, (0, role_js_1.requireRole)("MANAGER", "PROJECT_MANAGER"), upload.single("file"), async (req, res) => {
    // 1. Fix the "Where" error: Ensure taskId is a string
    const taskId = req.params.id;
    if (!taskId)
        return res.status(400).json({ error: "Task ID is required" });
    const { title, notes, dueDate, priority, assignedHours, assigneeUserId, assigneeEmployeeId, } = req.body;
    try {
        // --- Handle Assignee Logic ---
        let newAssigneeId = undefined; // Start undefined
        // Only check DB if the user specifically requested a change
        if (assigneeUserId) {
            newAssigneeId = assigneeUserId;
        }
        else if (assigneeEmployeeId) {
            const emp = await db_1.default.employee.findUnique({
                where: { id: assigneeEmployeeId },
            });
            if (!emp)
                return res.status(400).json({ error: "invalid assignee employee id" });
            newAssigneeId = emp.userId;
        }
        // --- Handle File Logic ---
        let newFileUrl = undefined; // Start undefined
        if (req.file) {
            const fileName = `${Date.now()}_${req.file.originalname}`;
            const { error } = await supabase.storage
                .from("ManagerFiles")
                .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
            });
            if (error)
                return res.status(500).json({ error: "file upload failed" });
            const { data } = supabase.storage.from("ManagerFiles").getPublicUrl(fileName);
            newFileUrl = data.publicUrl;
        }
        // --- THE FIX: Build updateData dynamically ---
        // We explicitly type this as Prisma.TaskUncheckedUpdateInput to allow scalar 'assigneeId'
        const updateData = {};
        // Only add properties to the object if they exist. 
        // This solves the 'exactOptionalPropertyTypes' error.
        if (title)
            updateData.title = title;
        if (priority)
            updateData.priority = priority;
        // For Nullable fields (notes, dueDate, assignedHours):
        // We check !== undefined so we can accept empty strings or explicit updates
        if (notes !== undefined)
            updateData.notes = notes;
        if (dueDate) {
            updateData.dueDate = new Date(dueDate);
        }
        if (assignedHours) {
            updateData.assignedHours = parseInt(assignedHours);
        }
        // Only add these if we calculated new values
        if (newAssigneeId)
            updateData.assigneeId = newAssigneeId;
        if (newFileUrl)
            updateData.fileUrl_manager = newFileUrl;
        // 2. Perform Update
        const task = await db_1.default.task.update({
            where: { id: taskId }, // taskId is now guaranteed string
            data: updateData, // updateData no longer contains explicit 'undefined' values
        });
        res.json(task);
    }
    catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: "Task not found" });
        }
        res.status(500).json({ error: "Failed to update task" });
    }
});
// List tasks (manager: all; operator: mine)
router.get("/", auth_js_1.auth, async (req, res) => {
    const isManager = req.user.role === "MANAGER";
    const where = isManager ? { isDeleted: false } : { assigneeId: req.user.id, isDeleted: false };
    const { assigneeId, status } = req.query;
    if (assigneeId)
        where.assigneeId = String(assigneeId);
    if (status)
        where.status = String(status).toUpperCase();
    const tasks = await db_1.default.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
});
// Update status (operator updates own; manager can update any)
router.patch("/:taskId/status", auth_js_1.auth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        if (!status)
            return res.status(400).json({ error: "Status required" });
        if (!taskId) {
            return res.status(400).json({ error: "task id required" });
        }
        const task = await db_1.default.task.findUnique({ where: { id: taskId } });
        if (!task)
            return res.status(404).json({ error: "Task not found" });
        const userId = req.user.id;
        const isOwner = task.assigneeId === userId;
        const isManager = req.user.role === "MANAGER" || req.user.role === "PROJECT_MANAGER";
        if (!isManager && !isOwner)
            return res.status(403).json({ error: "Not allowed" });
        const newStatus = status.toUpperCase();
        console.log("Status Change =>", newStatus);
        // ----------------------------------------
        // 🚫 Restrict multiple WORKING tasks
        // ----------------------------------------
        if (newStatus === "WORKING") {
            const activeTask = await db_1.default.task.findFirst({
                where: {
                    assigneeId: userId,
                    status: "WORKING",
                    id: { not: taskId },
                },
            });
            if (activeTask) {
                return res.status(409).json({
                    error: "Another task is already in progress",
                    runningTask: {
                        id: activeTask.id,
                        title: activeTask.title,
                    },
                });
            }
            // ⏱ Start new work session
            await db_1.default.taskWorkLog.create({
                data: {
                    taskId,
                    userId,
                    startTime: new Date(),
                },
            });
        }
        // ----------------------------------------
        // ⏹ Stop running timer (STUCK or DONE)
        // ----------------------------------------
        if (newStatus === "STUCK" || newStatus === "DONE") {
            await db_1.default.taskWorkLog.updateMany({
                where: {
                    taskId,
                    userId,
                    endTime: null,
                },
                data: {
                    endTime: new Date(),
                },
            });
        }
        // ----------------------------------------
        // Update task status in DB
        // ----------------------------------------
        const updated = await db_1.default.task.update({
            where: { id: taskId },
            data: {
                status: newStatus,
                updatedAt: new Date(),
            },
        });
        res.json({
            message: "Status updated successfully",
            task: updated,
        });
    }
    catch (err) {
        console.error("Status Update Error:", err);
        res.status(500).json({ error: "Failed to update status" });
    }
});
// update the priority
router.patch("/:id/priority", auth_js_1.auth, async (req, res) => {
    const { id } = req.params;
    const { priority } = req.body;
    if (!priority)
        return res.status(400).json({ error: "priority required" });
    if (!id)
        return res.status(400).json({ error: "task id required" });
    const task = await db_1.default.task.findUnique({ where: { id } });
    if (!task)
        return res.status(404).json({ error: "task not found" });
    const role = req.user.role;
    const isManager = role === "MANAGER" || role === "PROJECT_MANAGER";
    const isOwner = task.assigneeId === req.user.id;
    if (!isManager && !isOwner)
        return res.status(403).json({ error: "forbidden" });
    const updated = await db_1.default.task.update({
        where: { id },
        data: { priority: String(priority).toUpperCase() },
    });
    res.json(updated);
});
// Transfer task (manager only)
router.post("/:id/transfer", auth_js_1.auth, (0, role_js_1.requireRole)("MANAGER", "PROJECT_MANAGER"), async (req, res) => {
    const { id } = req.params;
    console.log(id);
    const { newAssigneeUserId, newEmployeeId } = req.body;
    let assigneeId = newAssigneeUserId;
    if (!id)
        return res.status(400).json({ error: "task id required" });
    if (!assigneeId && newEmployeeId) {
        const emp = await db_1.default.employee.findUnique({
            where: { id: newEmployeeId },
        });
        if (!emp)
            return res.status(400).json({ error: "invalid employee id" });
        assigneeId = emp.userId;
    }
    if (!assigneeId)
        return res.status(400).json({ error: "assignee required" });
    const updated = await db_1.default.task.update({
        where: { id },
        data: { assigneeId, status: "TODO" }, // reset to TODO on transfer (matches your UI)
    });
    res.json(updated);
});
router.delete("/:id", auth_js_1.auth, (0, role_js_1.requireRole)("MANAGER", "PROJECT_MANAGER"), async (req, res) => {
    const { id } = req.params;
    if (!id)
        return res.status(400).json({ error: "task id required" });
    try {
        const task = await db_1.default.task.findUnique({ where: { id } });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        // Optional: If you want to restrict deletion to certain users (e.g., managers)
        const userId = req.user?.id; // from verifyToken middleware
        if (task.createdById !== userId) {
            return res
                .status(403)
                .json({ message: "Not authorized to delete this task" });
        }
        // await prisma.taskWorkLog.deleteMany({
        //   where:{
        //     taskId: id
        //   }
        // })
        // await prisma.task.delete({ where: { id } });
        await db_1.default.task.update({
            where: {
                id
            },
            data: {
                isDeleted: true
            }
        });
        res.status(200).json({ message: "Task deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ message: "Failed to delete task" });
    }
});
router.get("/Dashboard", auth_js_1.auth, (0, role_js_1.requireRole)("OPERATOR"), async (req, res) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(400).json({ message: "User ID not found" });
        }
        const tasks = await db_1.default.task.findMany({
            where: { assigneeId: userId },
            orderBy: { dueDate: "asc" },
        });
        // Stats
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === "DONE").length;
        const pendingTasks = tasks.filter((t) => t.status === "TODO").length;
        const inProgressTasks = tasks.filter((t) => t.status === "WORKING").length;
        const stuckTasks = tasks.filter((t) => t.status === "STUCK").length;
        // Completion rate
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        // Optionally: build completion trend (last 4 weeks)
        const completionTrend = [];
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - i * 7);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            const weekTasks = tasks.filter((t) => t.updatedAt >= startOfWeek && t.updatedAt <= endOfWeek);
            const completedThisWeek = weekTasks.filter((t) => t.status === "DONE").length;
            const rate = weekTasks.length > 0
                ? Math.round((completedThisWeek / weekTasks.length) * 100)
                : 0;
            completionTrend.push({
                week: `Wk ${startOfWeek.getWeekNumber()}`,
                rate,
            });
        }
        res.json({
            tasks,
            stats: {
                totalTasks,
                completedTasks,
                inProgressTasks,
                pendingTasks,
                stuckTasks,
                completionRate,
                completionTrend,
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
Date.prototype.getWeekNumber = function () {
    const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};
// operations
// ----------------------------
// GET: Fetch tasks for employee
// ----------------------------
router.get("/EmployeeTasks", auth_js_1.auth, async (req, res) => {
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
                .from("ManagerFiles")
                .list(task.id, { limit: 10 });
            const managerFileUrls = managerFiles?.map((file) => supabase.storage
                .from("ManagerFiles")
                .getPublicUrl(`${task.id}/${file.name}`).data.publicUrl) || [];
            // Employee uploaded files (from bucket: OperationsDocuments)
            const { data: employeeFiles } = await supabase.storage
                .from("OperationsDocuments")
                .list(task.id, { limit: 10 });
            const employeeFileUrls = employeeFiles?.map((file) => supabase.storage
                .from("OperationsDocuments")
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
// GET THE COMPLTED TASK OF THE PARTICULAR EMPLOYEES
router.get("/:employeeId/completed", auth_js_1.auth, async (req, res) => {
    try {
        const { employeeId } = req.params;
        if (!employeeId) {
            return res.status(400).json({ message: "Employee ID required" });
        }
        // 1️⃣ Fetch employee profile to get associated userId
        const employee = await db_1.default.employee.findUnique({
            where: { id: employeeId },
            select: { userId: true },
        });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }
        // 2️⃣ Fetch tasks only completed by this user
        const tasks = await db_1.default.task.findMany({
            where: {
                assigneeId: employee.userId,
                status: "DONE",
            },
            include: {
                createdBy: {
                    select: { email: true, role: true },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        res.json({ tasks });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});
// ----------------------------
// PATCH: Update task status
// ----------------------------
// router.patch("/:taskId/status", auth, async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { status } = req.body;
//     if (!status) {
//       return res.status(400).json({ error: "Status is required" });
//     }
//     if (!taskId) {
//       return res.status(400).json({ error: "Task ID is required" });
//     }
//     const updatedTask = await prisma.task.update({
//       where: { id: taskId },
//       data: { status, updatedAt: new Date() },
//     });
//     res.json({ message: "Status updated", task: updatedTask });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to update task status" });
//   }
// });
// ----------------------------
// POST: Upload Employee File
// ----------------------------
router.post("/:taskId/upload", auth_js_1.auth, upload.single("file"), async (req, res) => {
    try {
        const { taskId } = req.params;
        const file = req.file;
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Supabase environment variables are not set");
        }
        if (!taskId)
            return res.status(400).json({ error: "Task ID is required" });
        if (!file)
            return res.status(400).json({ error: "No file provided" });
        const fileName = `${Date.now()}_${file.originalname}`;
        console.log(fileName);
        // Upload to Supabase bucket: OperationsDocuments
        const { error: uploadError } = await supabase.storage
            .from("OperationsDocuments")
            .upload(fileName, file.buffer, {
            contentType: file.mimetype,
        });
        console.log("Upload successful:", uploadError);
        if (uploadError)
            throw uploadError;
        console.log("hi");
        const { data } = supabase.storage
            .from("OperationsDocuments")
            .getPublicUrl(fileName);
        const publicUrl = data.publicUrl;
        console.log("hi");
        // Optionally, save the file URL to the task in DB (if single file)
        await db_1.default.task.update({
            where: { id: taskId },
            data: { fileUrl_operator: publicUrl },
        });
        console.log("hi");
        res.json({ message: "File uploaded successfully", fileUrl: publicUrl });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to upload file" });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map