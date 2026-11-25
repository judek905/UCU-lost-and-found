const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// CREATE UPLOADS FOLDER IF IT DOES NOT EXIST
const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// MULTER STORAGE SETTINGS
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {
        const uniqueName =
            Date.now() +
            '-' +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname).toLowerCase();

        cb(null, uniqueName);
    }
});

// CHECK ALLOWED IMAGE TYPES
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, PNG and WEBP images are allowed.'));
    }
};

// MULTER UPLOAD CONFIGURATION
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// HELPER TO DELETE UPLOADED FILES
function deleteUploadedFile(file) {
    if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
    }
}

// ========================================
// CREATE A LOST OR FOUND ITEM REPORT
// ========================================

router.post('/', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const {
            report_type,
            title,
            category,
            description,
            private_details,
            item_date,
            campus_location
        } = req.body;

        // VALIDATE REQUIRED FIELDS
        if (
            !report_type ||
            !title ||
            !category ||
            !description ||
            !item_date ||
            !campus_location
        ) {
            deleteUploadedFile(req.file);

            return res.status(400).json({
                message: 'Please fill in all required report fields.'
            });
        }

        // VALIDATE REPORT TYPE
        if (!['LOST', 'FOUND'].includes(report_type.toUpperCase())) {
            deleteUploadedFile(req.file);

            return res.status(400).json({
                message: 'Report type must be LOST or FOUND.'
            });
        }

        // GET PHOTO URL
        const photo_url = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        // INSERT REPORT INTO DATABASE
        const [result] = await pool.query(
            `INSERT INTO items (
                user_id,
                report_type,
                title,
                category,
                description,
                private_details,
                item_date,
                campus_location,
                photo_url,
                status,
                review_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'PENDING')`,
            [
                req.user.id,
                report_type.toUpperCase(),
                title,
                category,
                description,
                private_details || null,
                item_date,
                campus_location,
                photo_url
            ]
        );

        return res.status(201).json({
            message: 'Item report submitted successfully. Waiting for administrator approval.',
            itemId: result.insertId
        });

    } catch (error) {
        deleteUploadedFile(req.file);

        console.error('Item creation error:', error.message);

        return res.status(500).json({
            message: 'Unable to submit item report.',
            error: error.message
        });
    }
});

// ========================================
// GET APPROVED LOST AND FOUND ITEMS
// ========================================

router.get('/', async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT
                id,
                user_id,
                report_type,
                title,
                category,
                description,
                item_date,
                campus_location,
                photo_url,
                status,
                review_status,
                created_at
             FROM items
             WHERE status = 'OPEN'
             AND review_status = 'APPROVED'
             ORDER BY created_at DESC`
        );

        return res.json(items);

    } catch (error) {
        console.error('Fetch items error:', error.message);

        return res.status(500).json({
            message: 'Unable to retrieve items.'
        });
    }
});

// ========================================
// GET REPORTS BELONGING TO LOGGED-IN USER
// ========================================

router.get('/my-reports', verifyToken, async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT *
             FROM items
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        return res.json(items);

    } catch (error) {
        console.error('My reports error:', error.message);

        return res.status(500).json({
            message: 'Unable to retrieve your reports.'
        });
    }
});

// ========================================
// UPDATE AN EXISTING ITEM REPORT
// ========================================

router.patch('/:id', verifyToken, async (req, res) => {
    try {
        const {
            title,
            category,
            description,
            private_details,
            item_date,
            campus_location
        } = req.body;

        if (
            !title ||
            !category ||
            !description ||
            !item_date ||
            !campus_location
        ) {
            return res.status(400).json({
                message: 'Please fill in all required fields.'
            });
        }

        const [result] = await pool.query(
            `UPDATE items
             SET
                title = ?,
                category = ?,
                description = ?,
                private_details = ?,
                item_date = ?,
                campus_location = ?,
                review_status = 'PENDING'
             WHERE id = ?
             AND user_id = ?
             AND status = 'OPEN'`,
            [
                title,
                category,
                description,
                private_details || null,
                item_date,
                campus_location,
                req.params.id,
                req.user.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Report not found or you are not allowed to edit it.'
            });
        }

        return res.json({
            message: 'Report updated successfully. It is awaiting administrator approval.'
        });

    } catch (error) {
        console.error('Update item error:', error.message);

        return res.status(500).json({
            message: 'Unable to update item report.'
        });
    }
});

// ========================================
// MULTER ERROR HANDLING
// ========================================

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: 'Image is too large. Maximum allowed size is 5MB.'
            });
        }

        return res.status(400).json({
            message: error.message
        });
    }

    if (error) {
        return res.status(400).json({
            message: error.message
        });
    }

    next();
});

module.exports = router;