require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const LOCATIONS = [
  // Odisha
  { name: 'Sambalpur',    latitude: 21.47, longitude: 83.97 },
  { name: 'Bhubaneswar', latitude: 20.30, longitude: 85.84 },
  { name: 'Cuttack',     latitude: 20.46, longitude: 85.88 },
  { name: 'Puri',        latitude: 19.81, longitude: 85.83 },
  { name: 'Balasore',    latitude: 21.49, longitude: 86.93 },

  // Arunachal Pradesh
  { name: 'Itanagar',    latitude: 27.08, longitude: 93.60 },
  { name: 'Pasighat',    latitude: 28.06, longitude: 95.32 },
  { name: 'Naharlagun',  latitude: 27.10, longitude: 93.69 },

  // Uttarakhand
  { name: 'Haridwar',    latitude: 29.94, longitude: 78.16 },
  { name: 'Dehradun',    latitude: 30.32, longitude: 78.03 },
  { name: 'Rishikesh',   latitude: 30.09, longitude: 78.27 },
  { name: 'Roorkee',     latitude: 29.87, longitude: 77.89 },

  // Assam
  { name: 'Guwahati',    latitude: 26.14, longitude: 91.74 },
  { name: 'Dibrugarh',   latitude: 27.47, longitude: 94.91 },
  { name: 'Silchar',     latitude: 24.82, longitude: 92.79 },

  // Bihar
  { name: 'Patna',       latitude: 25.59, longitude: 85.13 },
  { name: 'Darbhanga',   latitude: 26.15, longitude: 85.89 },
  { name: 'Muzaffarpur', latitude: 26.12, longitude: 85.36 },

  // West Bengal
  { name: 'Kolkata',     latitude: 22.57, longitude: 88.36 },
  { name: 'Malda',       latitude: 25.00, longitude: 88.14 },

  // Kerala
  { name: 'Kochi',       latitude: 9.93,  longitude: 76.26 },
  { name: 'Thrissur',    latitude: 10.52, longitude: 76.21 },

  // Himachal Pradesh
  { name: 'Mandi',       latitude: 31.71, longitude: 76.93 },
  { name: 'Kullu',       latitude: 31.95, longitude: 77.11 },
];

async function fetchWeather(location) {
  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: location.latitude,
      longitude: location.longitude,
      hourly: 'precipitation,temperature_2m,relativehumidity_2m,windspeed_10m',
      timezone: 'Asia/Kolkata',
      forecast_days: 1
    }
  });

  const data = response.data;
  const currentHour = new Date().getHours();

  const record = {
    location_name:  location.name,
    latitude:       location.latitude,
    longitude:      location.longitude,
    timestamp:      new Date().toISOString(),
    rainfall_mm:    data.hourly.precipitation[currentHour]       ?? 0,
    temperature_c:  data.hourly.temperature_2m[currentHour]      ?? null,
    humidity_pct:   data.hourly.relativehumidity_2m[currentHour] ?? null,
    wind_speed_kmh: data.hourly.windspeed_10m[currentHour]       ?? null,
  };

  const { error } = await supabase
    .from('weather_readings')
    .insert(record);

  if (error) throw new Error(error.message);

  console.log(
    `[${location.name}] Rain: ${record.rainfall_mm}mm | ` +
    `Temp: ${record.temperature_c}°C | ` +
    `Humidity: ${record.humidity_pct}% | ` +
    `Wind: ${record.wind_speed_kmh} km/h`
  );
}

async function collectAll() {
  const time = new Date().toLocaleTimeString('en-IN');
  console.log(`\n--- Collecting data at ${time} ---`);

  for (const loc of LOCATIONS) {
    try {
      await fetchWeather(loc);
    } catch (err) {
      console.error(`[ERROR] ${loc.name}: ${err.message}`);
    }
  }

  console.log('--- Done ---');
}

async function main() {
  console.log('✓ Supabase client ready');

  // Run immediately on start
  await collectAll();

  // Then every hour automatically
  cron.schedule('0 * * * *', collectAll);
  console.log('\n✓ Scheduler active — collecting every hour');
}

main();