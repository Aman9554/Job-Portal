const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },         // Job ka naam (e.g., UPPSC RO/ARO)
    department: { type: String, required: true },    // Department (e.g., UPPSC)
    location: { type: String, required: true },      // State ya City (e.g., Uttar Pradesh)
    qualification: { type: String, required: true }, // Eligibility (e.g., Bachelor's Degree)
    salary: { type: String, default: 'Not Disclosed' },
    lastDate: { type: Date, required: true },
    applyLink: { type: String, required: true }
}, { timestamps: true }); // Ye automatic create hone ka time record karega

module.exports = mongoose.model('Job', jobSchema);