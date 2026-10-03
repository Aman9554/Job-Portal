const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Job = require('./models/Job');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const MAX_PAGE_SIZE = 100;
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || '';
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

function sendError(res, status, message) {
    return res.status(status).json({ success: false, message });
}

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));

    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signToken(payload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
    const [encodedPayload, providedSignature, extraPart] = token.split('.');
    if (!encodedPayload || !providedSignature || extraPart) {
        return null;
    }

    const expectedSignature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(encodedPayload)
        .digest('base64url');

    if (!safeEqual(providedSignature, expectedSignature)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function requireAdmin(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const payload = match ? verifyToken(match[1]) : null;

    if (!payload || payload.role !== 'admin') {
        return sendError(res, 401, 'Admin authentication required.');
    }

    req.admin = payload;
    return next();
}

function getJobInput(body, isUpdate = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'Request body must be a JSON object.' };
    }

    const fields = ['title', 'department', 'location', 'qualification', 'salary', 'lastDate', 'applyLink'];
    const input = {};
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            input[field] = body[field];
        }
    }

    if (Object.keys(input).length === 0) {
        return { error: 'Provide at least one supported job field.' };
    }

    if (isUpdate && Object.keys(input).length !== Object.keys(body).length) {
        return { error: 'Request contains unsupported job fields.' };
    }

    for (const field of ['title', 'department', 'location', 'qualification', 'applyLink']) {
        if (Object.prototype.hasOwnProperty.call(input, field)
            && (typeof input[field] !== 'string' || input[field].trim().length === 0)) {
            return { error: `${field} must be a non-empty string.` };
        }
        if (typeof input[field] === 'string') {
            input[field] = input[field].trim();
        }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'salary')) {
        if (typeof input.salary !== 'string') {
            return { error: 'salary must be a string.' };
        }
        input.salary = input.salary.trim();
    }

    if (Object.prototype.hasOwnProperty.call(input, 'lastDate')) {
        const lastDate = new Date(input.lastDate);
        if (typeof input.lastDate !== 'string' || !input.lastDate || Number.isNaN(lastDate.getTime())) {
            return { error: 'lastDate must be a valid date.' };
        }
        input.lastDate = lastDate;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'applyLink')) {
        try {
            const url = new URL(input.applyLink);
            if (!['http:', 'https:'].includes(url.protocol)) {
                return { error: 'applyLink must use http or https.' };
            }
        } catch {
            return { error: 'applyLink must be a valid URL.' };
        }
    }

    return { input };
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTodayStart() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Gov Job Portal API is running smoothly!',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const configuredUsername = process.env.ADMIN_USERNAME;
    const configuredPassword = process.env.ADMIN_PASSWORD;

    if (!configuredUsername || !configuredPassword) {
        return sendError(res, 503, 'Admin login is not configured on the server.');
    }

    if (typeof username !== 'string' || typeof password !== 'string'
        || !safeEqual(username, configuredUsername) || !safeEqual(password, configuredPassword)) {
        return sendError(res, 401, 'Invalid username or password.');
    }

    const now = Math.floor(Date.now() / 1000);
    const token = signToken({ role: 'admin', iat: now, exp: now + TOKEN_TTL_SECONDS });
    return res.status(200).json({
        success: true,
        message: 'Welcome Admin!',
        token,
        expiresIn: TOKEN_TTL_SECONDS
    });
});

app.get('/api/jobs', async (req, res, next) => {
    try {
        const { search, department, location, status } = req.query;
        const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
        const page = hasPagination ? Number(req.query.page || 1) : 1;
        const limit = hasPagination ? Number(req.query.limit || 20) : 0;

        if (!Number.isInteger(page) || page < 1 || (hasPagination && (
            !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE
        ))) {
            return sendError(res, 400, `page must be positive and limit must be between 1 and ${MAX_PAGE_SIZE}.`);
        }
        if (status !== undefined && !['all', 'active', 'expired'].includes(status)) {
            return sendError(res, 400, 'status must be all, active, or expired.');
        }

        const filter = {};
        if (typeof search === 'string' && search.trim()) {
            const pattern = new RegExp(escapeRegex(search.trim()), 'i');
            filter.$or = ['title', 'department', 'location', 'qualification'].map((field) => ({
                [field]: pattern
            }));
        }
        for (const field of ['department', 'location']) {
            if (typeof req.query[field] === 'string' && req.query[field].trim()) {
                filter[field] = new RegExp(escapeRegex(req.query[field].trim()), 'i');
            }
        }
        if (status === 'active') {
            filter.lastDate = { $gte: getTodayStart() };
        } else if (status === 'expired') {
            filter.lastDate = { $lt: getTodayStart() };
        }

        const query = Job.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
        if (hasPagination) {
            query.skip((page - 1) * limit).limit(limit);
        }

        const [jobs, total] = await Promise.all([
            query.exec(),
            hasPagination ? Job.countDocuments(filter) : Promise.resolve(null)
        ]);

        const response = { success: true, data: jobs };
        if (hasPagination) {
            response.pagination = {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            };
        }
        return res.status(200).json(response);
    } catch (error) {
        return next(error);
    }
});

app.get('/api/jobs/:id', async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return sendError(res, 400, 'Invalid job ID.');
    }

    try {
        const job = await Job.findById(req.params.id).lean();
        if (!job) {
            return sendError(res, 404, 'Job not found.');
        }
        return res.status(200).json({ success: true, data: job });
    } catch (error) {
        return next(error);
    }
});

app.get('/api/stats', async (req, res, next) => {
    try {
        const today = getTodayStart();
        const [totalJobs, activeJobs, departments] = await Promise.all([
            Job.countDocuments(),
            Job.countDocuments({ lastDate: { $gte: today } }),
            Job.distinct('department')
        ]);

        return res.status(200).json({
            success: true,
            data: { totalJobs, activeJobs, expiredJobs: totalJobs - activeJobs, departments: departments.length }
        });
    } catch (error) {
        return next(error);
    }
});

app.post('/api/jobs', requireAdmin, async (req, res, next) => {
    const { input, error } = getJobInput(req.body);
    if (error) {
        return sendError(res, 400, error);
    }

    try {
        const savedJob = await new Job(input).save();
        return res.status(201).json({ success: true, message: 'Job successfully added!', data: savedJob });
    } catch (err) {
        return next(err);
    }
});

app.put('/api/jobs/:id', requireAdmin, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return sendError(res, 400, 'Invalid job ID.');
    }

    const { input, error } = getJobInput(req.body, true);
    if (error) {
        return sendError(res, 400, error);
    }

    try {
        const updatedJob = await Job.findByIdAndUpdate(req.params.id, input, {
            new: true,
            runValidators: true
        });
        if (!updatedJob) {
            return sendError(res, 404, 'Job not found.');
        }
        return res.status(200).json({ success: true, message: 'Job updated successfully.', data: updatedJob });
    } catch (err) {
        return next(err);
    }
});

app.delete('/api/jobs/:id', requireAdmin, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return sendError(res, 400, 'Invalid job ID.');
    }

    try {
        const deletedJob = await Job.findByIdAndDelete(req.params.id);
        if (!deletedJob) {
            return sendError(res, 404, 'Job not found.');
        }
        return res.status(200).json({ success: true, message: 'Job deleted successfully.' });
    } catch (error) {
        return next(error);
    }
});

app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1d' }));

app.get('/{*path}', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/') || !req.accepts('html')) {
        return next();
    }
    return res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (error) => {
        if (error) next(error);
    });
});

app.use((req, res) => sendError(res, 404, 'Route not found.'));

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.type === 'entity.parse.failed') {
        return sendError(res, 400, 'Request body contains invalid JSON.');
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return sendError(res, 400, error.message);
    }

    console.error('API request failed:', error);
    const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected server error occurred.'
        : error.message;
    return sendError(res, 500, message);
});

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not configured.');
    }
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured.');
    }
    if (TOKEN_SECRET.length < 32) {
        throw new Error('ADMIN_TOKEN_SECRET must be at least 32 characters long.');
    }
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error('PORT must be a valid port number.');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.');

    const server = await new Promise((resolve, reject) => {
        const listener = app.listen(PORT, () => resolve(listener));
        listener.once('error', reject);
    });
    console.log(`Backend server running on port ${PORT}.`);

    const shutdown = async (signal) => {
        console.log(`${signal} received; shutting down gracefully.`);
        server.close(async (error) => {
            if (error) {
                console.error('HTTP server shutdown failed:', error);
                process.exitCode = 1;
            }
            try {
                await mongoose.disconnect();
            } catch (disconnectError) {
                console.error('MongoDB shutdown failed:', disconnectError);
                process.exitCode = 1;
            }
        });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Backend startup failed:', error);
        process.exitCode = 1;
    });
}

module.exports = { app, startServer };
