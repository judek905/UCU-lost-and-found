const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

// STUDENT REGISTRATION
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: 'Please fill in all required fields.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long.'
            });
        }

        const cleanName = full_name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                message: 'Please provide a valid name and email address.'
            });
        }

        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [cleanEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: 'This email is already registered.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
            [cleanName, cleanEmail, hashedPassword, 'STUDENT']
        );

        res.status(201).json({
            message: 'Registration successful!',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Registration error:', error.message);

        res.status(500).json({
            message: 'Registration failed. Please try again.'
        });
    }
});


// STUDENT LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required.'
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [cleanEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error.message);

        res.status(500).json({
            message: 'Login failed. Please try again.'
        });
    }
});

module.exports = router;