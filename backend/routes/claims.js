const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// SUBMIT AN OWNERSHIP CLAIM
router.post('/:itemId', verifyToken, async (req, res) => {
    try {
        const itemId = Number(req.params.itemId);
        const { evidence } = req.body;

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({
                message: 'Invalid item ID.'
            });
        }

        if (!evidence || evidence.trim().length < 10) {
            return res.status(400).json({
                message: 'Please provide sufficient ownership evidence.'
            });
        }

        const [items] = await pool.execute(
            'SELECT id, user_id, report_type, status FROM items WHERE id = ?',
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({
                message: 'Item not found.'
            });
        }

        const item = items[0];

        if (item.report_type !== 'FOUND') {
            return res.status(400).json({
                message: 'You can only claim found items.'
            });
        }

        if (item.status !== 'OPEN') {
            return res.status(400).json({
                message: 'This item is no longer available for claims.'
            });
        }

        if (item.user_id === req.user.id) {
            return res.status(403).json({
                message: 'You cannot claim an item you reported finding.'
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO claims (item_id, claimant_id, evidence)
             VALUES (?, ?, ?)`,
            [itemId, req.user.id, evidence.trim()]
        );

        res.status(201).json({
            message: 'Your ownership claim has been submitted successfully.',
            claimId: result.insertId
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'You have already submitted a claim for this item.'
            });
        }

        console.error('Claim submission error:', error.message);

        res.status(500).json({
            message: 'Unable to submit your claim.'
        });
    }
});


// VIEW MY CLAIMS
router.get('/my-claims', verifyToken, async (req, res) => {
    try {
        const [claims] = await pool.execute(
            `SELECT
                claims.id,
                claims.item_id,
                claims.evidence,
                claims.status,
                claims.admin_response,
                claims.created_at,
                items.title,
                items.category,
                items.campus_location
             FROM claims
             JOIN items ON claims.item_id = items.id
             WHERE claims.claimant_id = ?
             ORDER BY claims.created_at DESC`,
            [req.user.id]
        );

        res.json(claims);

    } catch (error) {
        console.error('Fetch claims error:', error.message);

        res.status(500).json({
            message: 'Unable to retrieve your claims.'
        });
    }
});

module.exports = router;