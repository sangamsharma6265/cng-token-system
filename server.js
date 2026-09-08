const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Token = require('./models/Token');
const AdminConfig = require('./models/AdminConfig');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cng-token-system';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch((err) => console.error('❌ Database Connection Error:', err));

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Generate Token API (Checks Limit & Start Number)
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

        const maxLimit = (config && config.maxLimit) ? config.maxLimit : 100;
        const tokenCount = await Token.countDocuments({ bookingDate });

        if (tokenCount >= maxLimit) {
            return res.status(400).json({ success: false, message: 'Daily limit reached! Please Book for Tomorrow.' });
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

app.get('/api/tokens', async (req, res) => {
    try {
        const { date } = req.query;
        let query = {};
        if (date) query.bookingDate = date;

        const tokens = await Token.find(query).sort({ createdAt: -1 });
        const config = await AdminConfig.findOne({ date: date || new Date().toISOString().split('T')[0] });
        
        res.status(200).json({
            success: true,
            tokens: tokens,
            data: tokens,
            config: config || { startNumber: 1, maxLimit: 100 }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

app.delete('/api/tokens/:id', async (req, res) => {
    try {
        await Token.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Token deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// Update Start Number and Max Limit (Ending Token No)
app.post('/api/tokens/start-number', async (req, res) => {
    try {
        const { startNumber, maxLimit } = req.body;
        const today = new Date().toISOString().split('T')[0];

        let config = await AdminConfig.findOne({ date: today });
        if (config) {
            if (startNumber) config.startNumber = parseInt(startNumber);
            if (maxLimit) config.maxLimit = parseInt(maxLimit);
            await config.save();
        } else {
            config = new AdminConfig({
                date: today,
                startNumber: startNumber ? parseInt(startNumber) : 1,
                maxLimit: maxLimit ? parseInt(maxLimit) : 100
            });
            await config.save();
        }

        res.status(200).json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});