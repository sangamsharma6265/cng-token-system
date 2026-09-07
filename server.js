const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Token = require('./models/Token');
const AdminConfig = require('./models/AdminConfig');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Serves static files from public folder

// Environment Variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cng-token-system';

// Connect to MongoDB Database
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch((err) => console.error('❌ Database Connection Error:', err));

// Route to serve Admin Panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 1. Generate Token API Route
app.post('/api/tokens/generate', async (req, res) => {
    try {
        const { customerName, vehicleNumber, mobileNumber, bookingDate, paymentType } = req.body;

        // Validation check
        if (!customerName || !vehicleNumber || !mobileNumber || !bookingDate || !paymentType) {
            return res.status(400).json({ success: false, message: 'All fields are required!' });
        }

        // Check if booking is closed for this specific date by Admin
        let config = await AdminConfig.findOne({ date: bookingDate });
        if (config && config.isBookingClosed) {
            return res.status(400).json({ success: false, message: 'Bookings for this date are closed by admin!' });
        }

        const maxLimit = config ? config.maxLimit : 100; // Default limit 100 tokens per day

        // Count existing tokens for the given date to find the next token number
        const tokenCount = await Token.countDocuments({ bookingDate });

        if (tokenCount >= maxLimit) {
            return res.status(400).json({ success: false, message: 'Daily token limit reached for this date!' });
        }

        const nextTokenNumber = tokenCount + 1;

        // Set initial payment status based on user choice
        const paymentStatus = (paymentType === 'Pay Now') ? 'Completed' : 'Skipped/Manual';

        // Create and save new token
        const newToken = new Token({
            tokenNumber: nextTokenNumber,
            bookingDate,
            customerName,
            vehicleNumber,
            mobileNumber,
            paymentType,
            paymentStatus
        });

        await newToken.save();

        res.status(201).json({
            success: true,
            message: 'Token generated successfully!',
            data: {
                tokenNumber: nextTokenNumber,
                bookingDate,
                customerName,
                vehicleNumber,
                paymentType,
                paymentStatus
            }
        });

    } catch (error) {
        console.error('Detailed Error while generating token:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});