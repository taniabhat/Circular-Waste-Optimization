import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

print("Starting IoT Sensor Model Retraining...")
csv_path = "../Waste_Management_and_Recycling_India_preprocessed.csv"
print(f"Loading macro dataset from: {csv_path}")
df = pd.read_csv(csv_path)
waste_types = df["Waste Type"].unique()
print(f"Found {len(waste_types)} unique waste types: {waste_types}")
print("\nGenerating realistic IoT sensor mappings for each waste type...")
synthetic_data = []

np.random.seed(42)
num_samples_per_type = 1000

for w_type in waste_types:
    for _ in range(num_samples_per_type):
        # Default ranges
        weight = np.random.uniform(10, 60)
        moist = np.random.uniform(10, 90)
        
        temp = np.random.uniform(20, 45)
        ph = np.random.uniform(4.0, 9.0)
        methane = np.random.uniform(0, 3000)
        
        # Make specific waste types have realistic sensor profiles
        if "Organic" in w_type:
            moist = np.random.uniform(60, 90)     # Very wet
            methane = np.random.uniform(1000, 2500) # High biogas potential
            ph = np.random.uniform(5.0, 6.5)      # Acidic
        elif "Plastic" in w_type:
            moist = np.random.uniform(5, 20)      # Dry
            methane = np.random.uniform(0, 100)   # No gas
            ph = np.random.uniform(6.5, 7.5)      # Neutral
        elif "E-Waste" in w_type or "Metal" in w_type:
            moist = np.random.uniform(0, 10)
            methane = np.random.uniform(0, 50)
            weight = np.random.uniform(30, 80)    # Heavy
        elif "Construction" in w_type:
            moist = np.random.uniform(5, 15)
            weight = np.random.uniform(50, 100)   # Very heavy
            methane = np.random.uniform(0, 20)
            
        synthetic_data.append({
            "weight_kg": weight,
            "moisture_pct": moist,
            "temperature_c": temp,
            "ph_level": ph,
            "methane_voc_ppm": methane,
            "target_label": w_type
        })

iot_df = pd.DataFrame(synthetic_data)

# 3. Train the Random Forest
print("\nTraining Random Forest Classifier on IoT data...")
X = iot_df[["weight_kg", "moisture_pct", "temperature_c", "ph_level", "methane_voc_ppm"]]

# We need to map the string labels to integer Cluster IDs (0-7) 
# so it doesn't break the existing main.py code which expects an integer.
label_mapping = {label: idx for idx, label in enumerate(waste_types)}
y = iot_df["target_label"].map(label_mapping)

# Save the reverse mapping to a text file so we know what is what
with open("trained_models/cluster_mapping.txt", "w") as f:
    for label, idx in label_mapping.items():
        f.write(f"{idx}: {label}\n")

rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
rf.fit(X, y)

score = rf.score(X, y)
print(f"Model Accuracy on realistic sensor data: {score * 100:.2f}%")

# 4. Save the model
model_path = "trained_models/random_forest_iot.pkl"
joblib.dump(rf, model_path)
print(f"Saved new optimized model to: {model_path}")
print("Please update main.py to load 'random_forest_iot.pkl' and use raw sensor values!")
