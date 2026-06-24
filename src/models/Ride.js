const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    passengerId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true  },
    driverId : { type: mongoose.Schema.Types.ObjectId, ref: 'User',  default: null },
    pickupLocation : {
        type: String,
        required: true,
        trim: true,},
    dropoffLocation : {
        type: String,
        required: true,
        trim: true
    },
    status : {
        type: String,
        enum: ['requested', 'accepted', 'started', 'completed', 'cancelled'],
        default: 'requested'
    },
    fare :{
        type: Number,
        default: null
    },
    StartedAt :{
        type: Date,
        default: null
    },
    CompletedAt :{
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
