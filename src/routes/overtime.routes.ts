import { Router, Request, Response } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// Submit Overtime Request (Employee)
router.post("/", auth, async (req: Request, res: Response) => {
    try {
        const { date, hours, reason } = req.body;
        const user = req.user;

        if (!user) return res.status(401).json({ error: "Unauthorized" });
        if (!date || !hours || !reason) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Check for duplicate on the same date for this user
        const existing = await prisma.overtimeRequest.findUnique({
            where: {
                userId_date: {
                    userId: user.id,
                    date: new Date(date)
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: "Overtime request already exists for this date" });
        }

        const request = await prisma.overtimeRequest.create({
            data: {
                userId: user.id,
                date: new Date(date),
                hours: parseFloat(hours),
                reason,
                status: "PENDING"
            }
        });

        res.status(201).json(request);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to submit overtime request" });
    }
});

// Get My Overtime History
router.get("/my", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const requests = await prisma.overtimeRequest.findMany({
            where: { userId: user.id },
            orderBy: { date: "desc" }
        });

        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch overtime history" });
    }
});

// Get Pending Requests (Manager Only)
router.get("/pending", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can view pending requests" });
        }

        const requests = await prisma.overtimeRequest.findMany({
            where: { status: "PENDING" },
            include: {
                user: {
                    select: { email: true, id: true, role: true }
                }
            },
            orderBy: { date: "asc" }
        });

        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch pending requests" });
    }
});

// Approve/Reject Request (Manager Only)
router.patch("/:id/status", auth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const user = req.user;

        if (!user || user.role !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can approve/reject requests" });
        }

        if (!["APPROVED", "REJECTED"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const request = await prisma.overtimeRequest.update({
            where: { id },
            data: {
                status,
                remarks,
                approverId: user.id,
                approvalDate: new Date()
            }
        });

        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update request status" });
    }
});

// Delete Pending Request (Employee)
router.delete("/:id", auth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        // Ensure user owns the request and it is PENDING
        const request = await prisma.overtimeRequest.findUnique({ where: { id } });

        if (!request) return res.status(404).json({ error: "Request not found" });
        if (request.userId !== user.id) return res.status(403).json({ error: "Unauthorized" });
        if (request.status !== "PENDING") return res.status(400).json({ error: "Cannot delete processed request" });

        await prisma.overtimeRequest.delete({ where: { id } });
        res.json({ message: "Request cancelled" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to cancel request" });
    }
});

export default router;
