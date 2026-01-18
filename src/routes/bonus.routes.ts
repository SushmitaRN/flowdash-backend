import { Router, Request, Response } from "express";
import prisma from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// Get All Candidates (All Operators) - For Bonus Assignment
router.get("/candidates", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can view candidates" });
        }

        // Fetch ALL users (for testing/flexibility)
        const candidates = await prisma.user.findMany({
            // where: { role: "OPERATOR" }, // Relaxed filter for user testing
            select: {
                id: true,
                email: true,
                Employee: {
                    select: { name: true }
                }
            }
        });

        // Map to expected format
        const formatted = candidates.map(u => ({
            id: u.id,          // This is the User ID needed for the bonus
            userId: u.id,      // Redundant but safe
            name: u.Employee[0]?.name || u.email, // Fallback to email if no Employee profile
            role: "Employee"
        }));

        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch candidates" });
    }
});

// Assign Bonus (Manager Only)
router.post("/", auth, async (req: Request, res: Response) => {
    try {
        const { userId, amount, type, reason, period } = req.body;
        const user = req.user;

        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can assign bonuses" });
        }

        if (!userId || !amount || !type || !reason || !period) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const bonus = await prisma.bonus.create({
            data: {
                userId,
                amount: parseFloat(amount),
                type,
                reason,
                period: new Date(period),
                status: "PENDING"
            }
        });

        res.status(201).json(bonus);
    } catch (error) {
        console.error("Assign bonus error:", error);
        res.status(500).json({ error: "Failed to assign bonus" + (error instanceof Error ? ": " + error.message : "") });
    }
});

// Get My Bonuses
router.get("/my", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const bonuses = await prisma.bonus.findMany({
            where: { userId: user.id },
            orderBy: { period: "desc" }
        });

        res.json(bonuses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch bonuses" });
    }
});

// Get All Bonuses (Manager Only)
router.get("/all", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can view all bonuses" });
        }

        const bonuses = await prisma.bonus.findMany({
            include: {
                user: {
                    select: {
                        email: true,
                        role: true,
                        Employee: {
                            select: { name: true }
                        }
                    }
                },
                approver: {
                    select: { email: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        res.json(bonuses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch all bonuses" });
    }
});

// Approve Bonus (Manager Only)
router.patch("/:id/approve", auth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can approve bonuses" });
        }

        const bonus = await prisma.bonus.update({
            where: { id: id as string },
            data: {
                status: "APPROVED",
                approverId: user.id,
                approvedAt: new Date()
            }
        });

        res.json(bonus);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to approve bonus" });
    }
});

// Get Statistics (Manager Only)
router.get("/stats", auth, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role?.toUpperCase() !== "MANAGER") {
            return res.status(403).json({ error: "Only managers can view stats" });
        }

        const totalApproved = await prisma.bonus.aggregate({
            where: { status: "APPROVED" },
            _sum: { amount: true }
        });

        const totalPending = await prisma.bonus.aggregate({
            where: { status: "PENDING" },
            _sum: { amount: true }
        });

        const pendingCount = await prisma.bonus.count({
            where: { status: "PENDING" }
        });

        res.json({
            totalApproved: totalApproved._sum.amount || 0,
            totalPending: totalPending._sum.amount || 0,
            totalAllocated: (totalApproved._sum.amount || 0) + (totalPending._sum.amount || 0),
            pendingCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

export default router;
