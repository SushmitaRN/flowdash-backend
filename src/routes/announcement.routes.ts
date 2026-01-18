import { Router, Request, Response } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// Get all announcements
// Get all announcements (filtered by target audience)
router.get("/", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const whereClause: any = {};

        // If not a manager, filter by target audience
        if (user.role?.toUpperCase() !== "MANAGER") {
            whereClause.OR = [
                { targetAudience: "ALL" },
                { targetAudience: "EMPLOYEES" }
            ];
        }
        // Managers see everything (ALL, EMPLOYEES, MANAGERS)

        const announcements = await prisma.announcement.findMany({
            where: whereClause,
            orderBy: [
                { isPinned: "desc" },
                { createdAt: "desc" }
            ],
            include: {
                author: {
                    select: { email: true, role: true } // Don't expose sensitive user data
                }
            }
        });
        res.json(announcements);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch announcements" });
    }
});

// Create announcement (Manager only)
router.post("/", auth, async (req: Request, res: Response) => {
    try {
        const { title, message, isPinned, targetAudience } = req.body;
        const user = req.user;

        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can create announcements" });
        }

        if (!title || !message) {
            return res.status(400).json({ error: "Title and message are required" });
        }

        const announcement = await prisma.announcement.create({
            data: {
                title,
                message,
                isPinned: isPinned || false,
                targetAudience: targetAudience || "ALL",
                authorId: user.id
            }
        });

        res.status(201).json(announcement);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create announcement" });
    }
});

// Pin/Unpin announcement (Manager only)
router.patch("/:id/pin", auth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isPinned } = req.body;
        const user = req.user;

        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can pin announcements" });
        }

        const announcement = await prisma.announcement.update({
            where: { id: id as string },
            data: { isPinned }
        });

        res.json(announcement);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update announcement" });
    }
});

// Delete announcement (Manager only)
router.delete("/:id", auth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can delete announcements" });
        }

        await prisma.announcement.delete({
            where: { id: id as string }
        });

        res.json({ message: "Announcement deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete announcement" });
    }
});

export default router;
