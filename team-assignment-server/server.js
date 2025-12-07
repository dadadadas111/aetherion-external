const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createRedisClient, closeRedisClient } = require('./config/redis');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    console.log(`[${new Date().toISOString()}] -> ${method} ${originalUrl} from ${ip} body=${JSON.stringify(req.body || {})} query=${JSON.stringify(req.query || {})}`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] <- ${method} ${originalUrl} ${res.statusCode} ${duration}ms`);
    });

    next();
});

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'Team Assignment Server Running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Initialize Redis and start server
async function startServer() {
    try {
        // Initialize Redis client
        createRedisClient();
        
        // Initialize MatchManager with Redis
        const MatchManager = require('./models/MatchManager');
        MatchManager.initialize();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`Team Assignment Server running on port ${PORT}`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully...');
            await closeRedisClient();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            console.log('SIGINT received, shutting down gracefully...');
            await closeRedisClient();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
