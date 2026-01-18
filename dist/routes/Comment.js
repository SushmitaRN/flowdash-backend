"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/:taskId", auth_1.auth, async (req, res) => {
    const { taskId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    console.log("Adding comment", { taskId, content, userId });
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!taskId)
        return res.status(400).json({ message: "Task ID required" });
    try {
        // Fetch the task and its creator/assignee
        const task = await db_1.default.task.findUnique({
            where: { id: taskId },
            include: { createdBy: true, assignee: true },
        });
        if (!task)
            return res.status(404).json({ message: "Task not found" });
        // Only the manager (createdBy) or assigned operator can comment
        if (userId !== task.createdById && userId !== task.assigneeId) {
            return res.status(403).json({ message: "Not authorized" });
        }
        const comment = await db_1.default.taskComment.create({
            data: {
                taskId,
                authorId: userId,
                content,
                seenByAssignee: userId === task.createdById ? false : true,
                seenByManager: userId === task.assigneeId ? false : true,
            },
            include: { author: { select: { id: true, email: true, role: true } } },
        });
        res.json(comment);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// --- Get all comments for a task ---
router.get("/:taskId", auth_1.auth, async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user.id;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!taskId)
        return res.status(400).json({ message: "Task ID required" });
    try {
        const task = await db_1.default.task.findUnique({
            where: { id: taskId },
            include: { createdBy: true, assignee: true },
        });
        if (!task)
            return res.status(404).json({ message: "Task not found" });
        // Only manager or assigned operator can see comments
        if (userId !== task.createdById && userId !== task.assigneeId) {
            return res.status(403).json({ message: "Not authorized" });
        }
        const comments = await db_1.default.taskComment.findMany({
            where: { taskId },
            include: { author: { select: { id: true, email: true, role: true } } },
            orderBy: { createdAt: "asc" },
        });
        res.json(comments);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// --- Mark comments as seen ---
router.patch("/:taskId/seen", auth_1.auth, async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user.id;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!taskId)
        return res.status(400).json({ message: "Task ID required" });
    try {
        const task = await db_1.default.task.findUnique({ where: { id: taskId } });
        if (!task)
            return res.status(404).json({ message: "Task not found" });
        let updateData = {};
        if (userId === task.assigneeId)
            updateData = { seenByAssignee: true };
        else if (userId === task.createdById)
            updateData = { seenByManager: true };
        else
            return res.status(403).json({ message: "Not authorized" });
        await db_1.default.taskComment.updateMany({
            where: { taskId },
            data: updateData,
        });
        res.json({ message: "Comments marked as seen" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
exports.default = router;
//# sourceMappingURL=Comment.js.map