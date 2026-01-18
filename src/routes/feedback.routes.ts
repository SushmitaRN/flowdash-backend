import { Router, Request, Response } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// Submit feedback (Employees and Managers)
router.post("/", auth, async (req: Request, res: Response) => {
    try {
        const { message, isAnonymous } = req.body;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const feedback = await prisma.feedback.create({
            data: {
                message,
                isAnonymous: isAnonymous || false,
                userId: isAnonymous ? null : user.id // If anonymous, don't link user
            }
        });

        res.status(201).json(feedback);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to submit feedback" });
    }
});

// Get all feedback (Manager only)
router.get("/", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;

        if (!user || user.role !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can view feedback" });
        }

        const feedback = await prisma.feedback.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { email: true, role: true }
                }
            }
        });

        res.json(feedback);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch feedback" });
    }
});

export default router;
