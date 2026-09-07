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
app.use(express.static(path.join(__dirname, 'public')));

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

// 1. Generate Token API Route (Supports custom starting token number)
app.post('/api/tokens/generate', async (req, res) => {
    try {
        const { customerName, vehicleNumber, mobileNumber, bookingDate, paymentType } = req.body;

        if (!customerName || !vehicleNumber || !mobileNumber || !bookingDate || !paymentType) {
            return res.status(400).json({ success: false, message: 'All fields are required!' });
        }

        let config = await AdminConfig.findOne({ date: bookingDate });
        if (config && config.isBookingClosed) {
            return res.status(400).json({ success: false, message: 'Bookings for this date are closed by admin!' });
        }

        const maxLimit = config && config.maxLimit ? config.maxLimit : 100;
        const tokenCount = await Token.countDocuments({ bookingDate });

        if (tokenCount >= maxLimit) {
            return res.status(400).json({ success: false, message: 'Daily token limit reached for this date!' });
        }

        let startNum = (config && config.startNumber) ? config.startNumber : 1;
        const lastToken = await Token.findOne({ bookingDate }).sort({ tokenNumber: -1 });
        
        let nextTokenNumber = startNum;
        if (lastToken && lastToken.tokenNumber >= startNum) {
            nextTokenNumber = lastToken.tokenNumber + 1;
        }

        const paymentStatus = (paymentType === 'Pay Now') ? 'Completed' : 'Skipped/Manual';

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

// 2. Get all tokens for Admin Panel
app.get('/api/tokens', async (req, res) => {
    try {
        const { date } = req.query;
        let query = {};
        
        if (date) {
            query.bookingDate = date;
        }

        const tokens = await Token.find(query).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            tokens: tokens,
            data: tokens
        });
    } catch (error) {
        console.error('Error fetching tokens:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// 3. Delete Token API (Admin Power)
app.delete('/api/tokens/:id', async (req, res) => {
    try {
        const deletedToken = await Token.findByIdAndDelete(req.params.id);
        if (!deletedToken) {
            return res.status(404).json({ success: false, message: 'Token not found' });
        }
        res.status(200).json({ success: true, message: 'Token deleted successfully' });
    } catch (error) {
        console.error('Error deleting token:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// 4. Set Starting Token Number API (Admin Power)
app.post('/api/tokens/start-number', async (req, res) => {
    try {
        const { startNumber } = req.body;
        if (!startNumber || isNaN(startNumber)) {
            return res.status(400).json({ success: false, message: 'Valid start number is required' });
        }

        const today = new Date().toISOString().split('T')[0];

        let config = await AdminConfig.findOne({ date: today });
        if (config) {
            config.startNumber = parseInt(startNumber);
            await config.save();
        } else {
            config = new AdminConfig({
                date: today,
                startNumber: parseInt(startNumber)
            });
            await config.save();
        }

        res.status(200).json({ success: true, message: 'Starting token number updated successfully' });
    } catch (error) {
        console.error('Error updating start number:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});