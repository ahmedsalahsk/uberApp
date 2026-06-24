const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true , unique: true },
    carInfo : {
        type: String,
        trim: true,
        default: ""
    },
    licenseNumber : {
        type: String,
        trim: true,
        default: ""
    },
    isAvailable : {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Driver', DriverSchema);
