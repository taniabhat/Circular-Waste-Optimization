/**
 * Seed Script — Imports CSV data into MongoDB
 * Run once: node scripts/seedData.js
 */

const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const WasteData = require('../models/WasteData');

// CSV file path
const CSV_PATH = path.join(__dirname, '..', '..', 'Waste_Management_and_Recycling_India_preprocessed.csv');

// Extract actual value from one-hot encoded columns
function extractOneHotValue(row, prefix, fallbackValues) {
  for (const key of Object.keys(row)) {
    if (key.startsWith(prefix)) {
      const val = String(row[key]).trim().toLowerCase();
      if (val === 'true' || val === '1') {
        return key.replace(prefix, '').trim();
      }
    }
  }
  // If no match found, use a fallback from provided values
  if (fallbackValues && fallbackValues.length > 0) {
    return fallbackValues[Math.floor(Math.random() * fallbackValues.length)];
  }
  return 'Unknown';
}

async function seedData() {
  try {
    await connectDB();
    console.log('🗑️  Clearing existing waste data...');
    await WasteData.deleteMany({});

    const records = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row) => {
          // Reverse one-hot encoding
          const city = extractOneHotValue(row, 'City/District_', ['Delhi', 'Mumbai', 'Bengaluru']);
          const disposalMethod = extractOneHotValue(row, 'Disposal Method_', ['Incineration', 'Landfill', 'Recycling']);
          const landfillName = extractOneHotValue(row, 'Landfill Name_', [city + ' Landfill']);

          records.push({
            wasteType: row['Waste Type'],
            wasteGenerated: parseFloat(row['Waste Generated (Tons/Day)']),
            recyclingRate: parseFloat(row['Recycling Rate (%)']),
            populationDensity: parseFloat(row['Population Density (People/km²)']),
            municipalEfficiencyScore: parseFloat(row['Municipal Efficiency Score (1-10)']),
            costOfWasteManagement: parseFloat(row['Cost of Waste Management (₹/Ton)']),
            awarenessCampaignsCount: parseInt(row['Awareness Campaigns Count']),
            landfillCapacity: parseFloat(row['Landfill Capacity (Tons)']),
            year: parseInt(row['Year']),
            landfillLatitude: parseFloat(row['Landfill_Latitude']),
            landfillLongitude: parseFloat(row['Landfill_Longitude']),
            city,
            disposalMethod,
            landfillName
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`📄 Parsed ${records.length} records from CSV`);

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await WasteData.insertMany(batch);
      console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
    }

    console.log(`\n🎉 Successfully seeded ${records.length} waste data records!`);

    // Print summary
    const typeCounts = {};
    const cityCounts = {};
    records.forEach(r => {
      typeCounts[r.wasteType] = (typeCounts[r.wasteType] || 0) + 1;
      cityCounts[r.city] = (cityCounts[r.city] || 0) + 1;
    });

    console.log('\n📊 Data Summary:');
    console.log('   Waste Types:', Object.keys(typeCounts).join(', '));
    console.log('   Type counts:', JSON.stringify(typeCounts));
    console.log(`   Cities: ${Object.keys(cityCounts).length} unique`);
    console.log('   Years:', [...new Set(records.map(r => r.year))].sort().join(', '));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedData();
