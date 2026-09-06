const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // Format: "YYYY-MM-DD"
    maxLimit: { type: Number, default: 100 }, // Daily max token limit
    isBookingClosed: { type: Boolean, default: false } // Manual "Full for today" toggle
});

module.exports = mongoose.model('AdminConfig', adminConfigSchema);