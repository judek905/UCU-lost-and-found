const express = require('express');
const pool = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, verifyAdmin);

// VIEW PENDING ITEM REPORTS
router.get('/items', async (req, res) => {
    try {
        const [items] = await pool.execute(
            `SELECT items.*, users.full_name, users.email
             FROM items
             JOIN users ON items.user_id = users.id
             WHERE items.review_status = 'PENDING'
             ORDER BY items.created_at DESC`
        );

        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Unable to retrieve reports.' });
    }
});


// APPROVE OR REJECT AN ITEM REPORT
router.patch('/items/:id/review', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { decision, reason } = req.body;

        if (!Number.isInteger(id) || id <= 0 ||
            !['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ message: 'Invalid review details.' });
        }

        if (decision === 'REJECTED' && (!reason || !reason.trim())) {
            return res.status(400).json({
                message: 'A rejection reason is required.'
            });
        }

        const [result] = await pool.execute(
            `UPDATE items
             SET review_status = ?, admin_response = ?
             WHERE id = ? AND review_status = 'PENDING'`,
            [decision, reason ? reason.trim() : null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Pending report not found.'
            });
        }

        res.json({ message: `Item report ${decision.toLowerCase()} successfully.` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Unable to review report.' });
    }
});


// VIEW OWNERSHIP CLAIMS
router.get('/claims', async (req, res) => {
    try {
        const [claims] = await pool.execute(
            `SELECT claims.*, items.title, items.category,
                    users.full_name, users.email
             FROM claims
             JOIN items ON claims.item_id = items.id
             JOIN users ON claims.claimant_id = users.id
             ORDER BY claims.created_at DESC`
        );

        res.json(claims);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Unable to retrieve claims.' });
    }
});


// APPROVE OR REJECT AN OWNERSHIP CLAIM
router.patch('/claims/:id/review', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const claimId = Number(req.params.id);
        const { decision, reason } = req.body;

        if (!Number.isInteger(claimId) || claimId <= 0 ||
            !['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ message: 'Invalid review details.' });
        }

        if (decision === 'REJECTED' && (!reason || !reason.trim())) {
            return res.status(400).json({
                message: 'A rejection reason is required.'
            });
        }

        await connection.beginTransaction();

        const [claims] = await connection.execute(
            'SELECT * FROM claims WHERE id = ? FOR UPDATE',
            [claimId]
        );

        if (claims.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Claim not found.' });
        }

        const claim = claims[0];

        if (claim.status !== 'PENDING') {
            await connection.rollback();
            return res.status(409).json({
                message: 'This claim has already been reviewed.'
            });
        }

        if (decision === 'APPROVED') {
            const [items] = await connection.execute(
                'SELECT * FROM items WHERE id = ? FOR UPDATE',
                [claim.item_id]
            );

            if (items.length === 0 ||
                items[0].status !== 'OPEN' ||
                items[0].review_status !== 'APPROVED') {
                await connection.rollback();
                return res.status(409).json({
                    message: 'This item is not available for an approved claim.'
                });
            }

            const [approved] = await connection.execute(
                `SELECT id FROM claims
                 WHERE item_id = ? AND status = 'APPROVED'`,
                [claim.item_id]
            );

            if (approved.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    message: 'Another claim has already been approved for this item.'
                });
            }
        }

        await connection.execute(
            `UPDATE claims
             SET status = ?, admin_response = ?, reviewed_by = ?
             WHERE id = ?`,
            [
                decision,
                reason ? reason.trim() : null,
                req.user.id,
                claimId
            ]
        );

        await connection.commit();

        res.json({ message: `Claim ${decision.toLowerCase()} successfully.` });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Unable to review claim.' });
    } finally {
        connection.release();
    }
});


// CONFIRM ITEM RETURNED AFTER COLLECTION
router.patch('/items/:id/returned', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { collection_confirmed } = req.body;

        if (!Number.isInteger(id) || id <= 0 || collection_confirmed !== true) {
            return res.status(400).json({
                message: 'Collection confirmation is required.'
            });
        }

        const [result] = await pool.execute(
            `UPDATE items
             SET status = 'RETURNED'
             WHERE id = ?
             AND status = 'OPEN'
             AND review_status = 'APPROVED'
             AND EXISTS (
                 SELECT 1 FROM claims
                 WHERE claims.item_id = items.id
                 AND claims.status = 'APPROVED'
             )`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                message: 'Item cannot be marked returned. Check its approval and collection status.'
            });
        }

        res.json({ message: 'Item successfully marked as returned.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Unable to update item status.' });
    }
});

module.exports = router;