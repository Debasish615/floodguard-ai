import pandas as pd
import numpy as np
import os

os.makedirs('data', exist_ok=True)
np.random.seed(42)
n = 5000

# Simulate realistic weather patterns for Odisha region
rainfall      = np.random.exponential(scale=15, size=n)
temperature   = np.random.normal(loc=30, scale=5, size=n)
humidity      = np.random.uniform(40, 100, size=n)
wind_speed    = np.random.uniform(0, 60, size=n)
river_level   = rainfall * 0.3 + np.random.normal(0, 1, size=n)

# Simulate 7-day cumulative rainfall (key flood indicator)
cumulative_rain = np.convolve(
    rainfall, np.ones(7)/7, mode='same'
) + np.random.normal(0, 2, size=n)

# Flood logic — realistic conditions
flood = (
    (rainfall > 40) &
    (river_level > 12) &
    (humidity > 80)
).astype(int)

# Add some edge cases to make model more realistic
flood = np.where(rainfall > 80, 1, flood)
flood = np.where(cumulative_rain > 50, 1, flood)

df = pd.DataFrame({
    'rainfall_mm':       np.round(rainfall, 2),
    'temperature_c':     np.round(temperature, 2),
    'humidity_pct':      np.round(humidity, 2),
    'wind_speed_kmh':    np.round(wind_speed, 2),
    'river_level_m':     np.round(river_level, 2),
    'cumulative_rain_7d': np.round(cumulative_rain, 2),
    'flood':             flood
})

df.to_csv('data/flood_data.csv', index=False)

print(f"✓ Generated {n} rows")
print(f"✓ Flood cases: {flood.sum()} ({flood.mean()*100:.1f}%)")
print(f"✓ No flood cases: {(flood==0).sum()} ({(flood==0).mean()*100:.1f}%)")
print(f"\nSample data:")
print(df.head())
print(f"\nSaved to data/flood_data.csv")