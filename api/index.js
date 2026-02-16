import { createServer } from 'http';
import app from '../dist/index.cjs';

// Vercel serverless function wrapper
export default async (req, res) => {
    // Forward request to Express app
    const server = createServer(app);
    return server.emit('request', req, res);
};
