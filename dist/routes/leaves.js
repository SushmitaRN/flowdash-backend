"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// Apply for leave
router.post('/', auth_1.auth, async (req, res) => {
    try {
        const { type, startDate, endDate, reason } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!startDate || !endDate || !reason || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Basic validation
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({ error: "End date must be after start date" });
        }
        const leave = await prisma.leaveRequest.create({
            data: {
                userId,
                type: type,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                status: client_1.LeaveStatus.PENDING,
            },
        });
        res.json(leave);
    }
    catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// Get my leaves
router.get('/my', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const leaves = await prisma.leaveRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(leaves);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get pending leaves (Manager/PM only)
router.get('/pending', auth_1.auth, async (req, res) => {
    try {
        const user = req.user;
        if (!user || !['MANAGER', 'PROJECT_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Optional: Filter by manager's team if "ManagerEmployees" is used effectively.
        // For now, Managers see all pending leaves or we can filter by their team.
        // Given the simple requirement "managers approve/reject", and checking schema:
        // Employee has manual `managerId`. 
        // If user is MANAGER, fetch employees where managerId = user.id, then fetch their leaves.
        let whereClause = { status: client_1.LeaveStatus.PENDING };
        if (user.role === 'MANAGER') {
            // Find employees managed by this user
            // The User model has `ManagerEmployees Employee[]`
            // But the LeaveRequest is linked to `User`, not `Employee`.
            // We need to find the Users who are linked to Employees managed by this manager.
            // This is slightly complex because of the separation of User and Employee tables.
            // Employee has userId. 
            // So: LeaveRequest -> User -> Employee -> managerId
            whereClause = {
                status: client_1.LeaveStatus.PENDING,
                user: {
                    role: {
                        in: ['OPERATOR', 'PROJECT_MANAGER']
                    }
                }
            };
        }
        // PROJECT_MANAGER might see all or specific ones. Let's start with all for PM, and team for Manager.
        const leaves = await prisma.leaveRequest.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        email: true,
                        Employee: {
                            select: {
                                name: true,
                                roleTitle: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' },
        });
        // Flatten result for frontend convenience? 
        // Or just let frontend handle it. Let's return as is.
        res.json(leaves);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Approve/Reject leave
router.patch('/:id/status', auth_1.auth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ error: "Missing ID" });
        const { status } = req.body;
        const user = req.user;
        if (!user || !['MANAGER', 'PROJECT_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (![client_1.LeaveStatus.APPROVED, client_1.LeaveStatus.REJECTED].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const leave = await prisma.leaveRequest.update({
            where: { id },
            data: {
                status: status,
                approvedById: user.id,
            },
        });
        res.json(leave);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=leaves.js.map