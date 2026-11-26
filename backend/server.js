// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS for your Vercel frontend domain
app.use(cors({
    origin: [
        'https://ucu-lost-and-found-moses-1aca.vercel.app',
        'http://localhost:5173'
    ],
    credentials: true
}));

app.use(express.json());
