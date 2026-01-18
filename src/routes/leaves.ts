import { Router, Request, Response } from "express";
import { LeaveStatus, LeaveType } from "@prisma/client";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// Extend Request type locally
type AuthRequest = Request & {
  user?: {
    id: string;
    role: string;
    email: string;
  };
};

// ============================
// Apply for leave
// ============================
router.post("/", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId,
        type: type as LeaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: LeaveStatus.PENDING,
      },
    });

    res.status(201).json(leave);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to apply for leave" });
  }
});

// ============================
// Get my leaves
// ============================
router.get("/my", auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(leaves);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
});

// ============================
// Get pending leaves (Manager / Project Manager)
// ============================
router.get("/pending", auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user || !["MANAGER", "PROJECT_MANAGER"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.PENDING,
      },
      include: {
        user: {
          select: {
            email: true,
            Employee: {
              select: {
                name: true,
                roleTitle: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(leaves);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pending leaves" });
  }
});

// ============================
// Approve / Reject leave
// ============================
router.patch("/:id/status", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!id) {
      return res.status(400).json({ error: "Leave ID is required" });
    }

    if (!user || !["MANAGER", "PROJECT_MANAGER"].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (![LeaveStatus.APPROVED, LeaveStatus.REJECTED].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: status as LeaveStatus,
        approverId: user.id, 
      },
    });

    res.json(leave);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to update leave status" });
  }
});

export default router;
