const express = require('express');
const WasteData = require('../models/WasteData');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// GET /api/data/stats — Aggregate KPIs
router.get('/stats', async (req, res) => {
  try {
    const stats = await WasteData.aggregate([
      {
        $group: {
          _id: null,
          totalWasteGenerated: { $sum: '$wasteGenerated' },
          avgWastePerDay: { $avg: '$wasteGenerated' },
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgCost: { $avg: '$costOfWasteManagement' },
          avgEfficiency: { $avg: '$municipalEfficiencyScore' },
          totalRecords: { $sum: 1 },
          totalCities: { $addToSet: '$city' },
          totalLandfillCapacity: { $avg: '$landfillCapacity' },
          avgAwarenessCampaigns: { $avg: '$awarenessCampaignsCount' }
        }
      },
      {
        $project: {
          _id: 0,
          totalWasteGenerated: { $round: ['$totalWasteGenerated', 0] },
          avgWastePerDay: { $round: ['$avgWastePerDay', 1] },
          avgRecyclingRate: { $round: ['$avgRecyclingRate', 1] },
          avgCost: { $round: ['$avgCost', 0] },
          avgEfficiency: { $round: ['$avgEfficiency', 1] },
          totalRecords: 1,
          cityCount: { $size: '$totalCities' },
          totalLandfillCapacity: { $round: ['$totalLandfillCapacity', 0] },
          avgAwarenessCampaigns: { $round: ['$avgAwarenessCampaigns', 1] }
        }
      }
    ]);

    // Get year-over-year comparison
    const yearlyComparison = await WasteData.aggregate([
      { $group: { _id: '$year', totalWaste: { $sum: '$wasteGenerated' }, avgRecycling: { $avg: '$recyclingRate' } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      summary: stats[0] || {},
      yearlyTrend: yearlyComparison
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// GET /api/data/waste-by-type — Waste breakdown by type
router.get('/waste-by-type', async (req, res) => {
  try {
    const data = await WasteData.aggregate([
      {
        $group: {
          _id: '$wasteType',
          totalGenerated: { $sum: '$wasteGenerated' },
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgCost: { $avg: '$costOfWasteManagement' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalGenerated: -1 } }
    ]);

    // Calculate percentages
    const grandTotal = data.reduce((sum, d) => sum + d.totalGenerated, 0);
    const result = data.map(d => ({
      wasteType: d._id,
      totalGenerated: d.totalGenerated,
      percentage: Math.round((d.totalGenerated / grandTotal) * 100 * 10) / 10,
      avgRecyclingRate: Math.round(d.avgRecyclingRate * 10) / 10,
      avgCost: Math.round(d.avgCost),
      count: d.count
    }));

    res.json({ wasteTypes: result, grandTotal });
  } catch (error) {
    console.error('Waste by type error:', error);
    res.status(500).json({ message: 'Error fetching waste by type' });
  }
});

// GET /api/data/waste-by-city — Per-city statistics
router.get('/waste-by-city', async (req, res) => {
  try {
    const data = await WasteData.aggregate([
      {
        $group: {
          _id: '$city',
          totalGenerated: { $sum: '$wasteGenerated' },
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgEfficiency: { $avg: '$municipalEfficiencyScore' },
          avgCost: { $avg: '$costOfWasteManagement' },
          populationDensity: { $first: '$populationDensity' },
          landfillCapacity: { $first: '$landfillCapacity' },
          latitude: { $first: '$landfillLatitude' },
          longitude: { $first: '$landfillLongitude' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalGenerated: -1 } }
    ]);

    const result = data.map(d => ({
      city: d._id,
      totalGenerated: d.totalGenerated,
      avgRecyclingRate: Math.round(d.avgRecyclingRate * 10) / 10,
      avgEfficiency: Math.round(d.avgEfficiency * 10) / 10,
      avgCost: Math.round(d.avgCost),
      populationDensity: d.populationDensity,
      landfillCapacity: d.landfillCapacity,
      latitude: d.latitude,
      longitude: d.longitude,
      count: d.count
    }));

    res.json({ cities: result });
  } catch (error) {
    console.error('Waste by city error:', error);
    res.status(500).json({ message: 'Error fetching waste by city' });
  }
});

// GET /api/data/waste-by-year — Year-over-year trends
router.get('/waste-by-year', async (req, res) => {
  try {
    const data = await WasteData.aggregate([
      {
        $group: {
          _id: '$year',
          totalGenerated: { $sum: '$wasteGenerated' },
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgCost: { $avg: '$costOfWasteManagement' },
          avgEfficiency: { $avg: '$municipalEfficiencyScore' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const result = data.map(d => ({
      year: d._id,
      totalGenerated: d.totalGenerated,
      avgRecyclingRate: Math.round(d.avgRecyclingRate * 10) / 10,
      avgCost: Math.round(d.avgCost),
      avgEfficiency: Math.round(d.avgEfficiency * 10) / 10,
      count: d.count
    }));

    res.json({ yearly: result });
  } catch (error) {
    console.error('Waste by year error:', error);
    res.status(500).json({ message: 'Error fetching waste by year' });
  }
});

// GET /api/data/disposal-methods — Distribution of disposal methods
router.get('/disposal-methods', async (req, res) => {
  try {
    const data = await WasteData.aggregate([
      {
        $group: {
          _id: '$disposalMethod',
          totalGenerated: { $sum: '$wasteGenerated' },
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgCost: { $avg: '$costOfWasteManagement' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalGenerated: -1 } }
    ]);

    const grandTotal = data.reduce((sum, d) => sum + d.totalGenerated, 0);
    const result = data.map(d => ({
      method: d._id,
      totalGenerated: d.totalGenerated,
      percentage: Math.round((d.totalGenerated / grandTotal) * 100 * 10) / 10,
      avgRecyclingRate: Math.round(d.avgRecyclingRate * 10) / 10,
      avgCost: Math.round(d.avgCost),
      count: d.count
    }));

    res.json({ methods: result, grandTotal });
  } catch (error) {
    console.error('Disposal methods error:', error);
    res.status(500).json({ message: 'Error fetching disposal methods' });
  }
});

// GET /api/data/efficiency-report — Recycling rates and efficiency per city
router.get('/efficiency-report', async (req, res) => {
  try {
    const cityEfficiency = await WasteData.aggregate([
      {
        $group: {
          _id: '$city',
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgEfficiency: { $avg: '$municipalEfficiencyScore' },
          avgCost: { $avg: '$costOfWasteManagement' },
          totalWaste: { $sum: '$wasteGenerated' },
          avgAwareness: { $avg: '$awarenessCampaignsCount' }
        }
      },
      { $sort: { avgRecyclingRate: -1 } }
    ]);

    const typeEfficiency = await WasteData.aggregate([
      {
        $group: {
          _id: '$wasteType',
          avgRecyclingRate: { $avg: '$recyclingRate' },
          totalWaste: { $sum: '$wasteGenerated' }
        }
      },
      { $sort: { avgRecyclingRate: -1 } }
    ]);

    const overallStats = await WasteData.aggregate([
      {
        $group: {
          _id: null,
          totalWaste: { $sum: '$wasteGenerated' },
          avgRecyclingRate: { $avg: '$recyclingRate' },
          avgEfficiency: { $avg: '$municipalEfficiencyScore' },
          totalCost: { $sum: '$costOfWasteManagement' },
          avgCost: { $avg: '$costOfWasteManagement' }
        }
      }
    ]);

    res.json({
      byCity: cityEfficiency.map(d => ({
        city: d._id,
        avgRecyclingRate: Math.round(d.avgRecyclingRate * 10) / 10,
        avgEfficiency: Math.round(d.avgEfficiency * 10) / 10,
        avgCost: Math.round(d.avgCost),
        totalWaste: d.totalWaste,
        avgAwareness: Math.round(d.avgAwareness * 10) / 10
      })),
      byType: typeEfficiency.map(d => ({
        wasteType: d._id,
        avgRecyclingRate: Math.round(d.avgRecyclingRate * 10) / 10,
        totalWaste: d.totalWaste
      })),
      overall: overallStats[0] ? {
        totalWaste: overallStats[0].totalWaste,
        avgRecyclingRate: Math.round(overallStats[0].avgRecyclingRate * 10) / 10,
        avgEfficiency: Math.round(overallStats[0].avgEfficiency * 10) / 10,
        totalCost: Math.round(overallStats[0].totalCost),
        avgCost: Math.round(overallStats[0].avgCost)
      } : {}
    });
  } catch (error) {
    console.error('Efficiency report error:', error);
    res.status(500).json({ message: 'Error fetching efficiency report' });
  }
});

module.exports = router;
