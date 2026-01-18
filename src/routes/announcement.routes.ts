import { Router, Request, Response } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// Get all announcements
router.get("/", auth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const whereClause =
      req.user.role === "MANAGER"
        ? {}
        : {
            OR: [
              { targetAudience: "ALL" },
              { targetAudience: "EMPLOYEES" },
            ],
          };

    const announcements = await prisma.announcement.findMany({
      where: whereClause,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: {
          select: {
            email: true,
            role: true,
          },
        },
      },
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
    if (!req.user || req.user.role !== "MANAGER") {
      return res.status(403).json({ error: "Only managers can create announcements" });
    }

    const { title, message, isPinned = false, targetAudience = "ALL" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message,
        isPinned,
        targetAudience,
        authorId: req.user.id,
      },
    });

    res.status(201).json(announcement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// Pin / Unpin announcement (Manager only)
router.patch("/:id/pin", auth, async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "MANAGER") {
      return res.status(403).json({ error: "Only managers can pin announcements" });
    }

    const { id } = req.params;
    const { isPinned } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Announcement ID is required" });
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: { isPinned: Boolean(isPinned) },
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
    if (!req.user || req.user.role !== "MANAGER") {
      return res.status(403).json({ error: "Only managers can delete announcements" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Announcement ID is required" });
    }

    await prisma.announcement.delete({
      where: { id },
    });

    res.json({ message: "Announcement deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
