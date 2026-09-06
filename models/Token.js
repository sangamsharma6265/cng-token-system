const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    tokenNumber: { type: Number, required: true },
    bookingDate: { type: String, required: true }, // Format: "YYYY-MM-DD"
    customerName: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    paymentType: { type: String, enum: ['Pay Now', 'Pay Later'], required: true },
    paymentStatus: { type: String, enum: ['Pending', 'Completed', 'Skipped/Manual'], default: 'Pending' },
    status: { type: String, enum: ['Waiting', 'In-Progress', 'Completed', 'Cancelled'], default: 'Waiting' },
    whatsappSent: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Yeh ensure karega ki ek hi date par token numbers unique rahein
tokenSchema.index({ bookingDate: 1, tokenNumber: 1 }, { unique: true });

module.exports = mongoose.model('Token', tokenSchema);