const mongoose = require('mongoose');

const wasteDataSchema = new mongoose.Schema({
  wasteType: {
    type: String,
    required: true,
    enum: ['Plastic', 'Organic', 'E-Waste', 'Construction', 'Hazardous']
  },
  wasteGenerated: {
    type: Number,
    required: true
  },
  recyclingRate: {
    type: Number,
    required: true
  },
  populationDensity: {
    type: Number,
    required: true
  },
  municipalEfficiencyScore: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  costOfWasteManagement: {
    type: Number,
    required: true
  },
  awarenessCampaignsCount: {
    type: Number,
    required: true
  },
  landfillCapacity: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  landfillLatitude: {
    type: Number,
    required: true
  },
  landfillLongitude: {
    type: Number,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  disposalMethod: {
    type: String,
    required: true,
    enum: ['Incineration', 'Landfill', 'Recycling']
  },
  landfillName: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for aggregation performance
wasteDataSchema.index({ wasteType: 1 });
wasteDataSchema.index({ city: 1 });
wasteDataSchema.index({ year: 1 });
wasteDataSchema.index({ disposalMethod: 1 });

module.exports = mongoose.model('WasteData', wasteDataSchema);
