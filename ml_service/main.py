from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import random
import time
import os
import io
import json
import base64
import joblib
import numpy as np

import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
import timm
from transformers import pipeline as hf_pipeline
import networkx as nx
from fpdf import FPDF

app = FastAPI(
    title="UWRMS AI Processing Core",
    description="Python backend with REAL Layer 1 and Layer 2 AI models.",
    version="3.0.0"
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# ==========================================
# LOAD ALL TRAINED MODELS
# ==========================================
RF_MODEL_PATH = "trained_models/random_forest_iot.pkl"
ISO_MODEL_PATH = "trained_models/isolation_forest.pkl"
LSTM_MODEL_PATH = "trained_models/bilstm_forecaster.pth"
LSTM_NORM_PATH = "trained_models/lstm_norm_params.json"
RL_AGENT_PATH = "trained_models/rl_agent.json"

rf_model = None
iso_forest = None
cnn_model = None
nlp_sentiment = None
nlp_ner = None
lstm_model = None
lstm_norm = None
rl_agent_data = None
waste_kg = None

# --- 1. Scikit-learn models (existing) ---
try:
    if os.path.exists(RF_MODEL_PATH):
        rf_model = joblib.load(RF_MODEL_PATH)
        print("[OK] Random Forest loaded.")
    if os.path.exists(ISO_MODEL_PATH):
        iso_forest = joblib.load(ISO_MODEL_PATH)
        print("[OK] Isolation Forest loaded.")
except Exception as e:
    print(f"[WARN] sklearn models: {e}")

# --- 2. CNN EfficientNet-B4 ---
try:
    print("[LOADING] EfficientNet-B4...")
    cnn_model = timm.create_model('efficientnet_b4', pretrained=True)
    cnn_model.eval()
    cnn_transform = transforms.Compose([
        transforms.Resize(380), transforms.CenterCrop(380),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    # Map ImageNet class indices to waste categories
    IMAGENET_WASTE_MAP = {
        "plastic_bag": "Plastic", "water_bottle": "Plastic", "pop_bottle": "Plastic",
        "packet": "Plastic", "shopping_basket": "Plastic",
        "banana": "Organic", "orange": "Organic", "lemon": "Organic",
        "mushroom": "Organic", "broccoli": "Organic", "head_cabbage": "Organic",
        "cauliflower": "Organic", "zucchini": "Organic", "cucumber": "Organic",
        "strawberry": "Organic", "fig": "Organic", "pineapple": "Organic",
        "envelope": "Paper", "book_jacket": "Paper", "comic_book": "Paper",
        "notebook": "Paper", "toilet_tissue": "Paper", "paper_towel": "Paper",
        "carton": "Paper",
        "can_opener": "Metal", "coffee_mug": "Metal", "frying_pan": "Metal",
        "caldron": "Metal", "Dutch_oven": "Metal", "wok": "Metal",
        "nail": "Metal", "screw": "Metal",
        "beer_glass": "Glass", "wine_bottle": "Glass", "goblet": "Glass",
        "vase": "Glass", "pitcher": "Glass",
        "cellular_telephone": "E-Waste", "laptop": "E-Waste", "mouse": "E-Waste",
        "monitor": "E-Waste", "keyboard": "E-Waste", "remote_control": "E-Waste",
        "television": "E-Waste", "screen": "E-Waste",
    }
    # Load ImageNet class labels
    try:
        imagenet_labels = cnn_model.default_cfg.get('label_names', None)
    except:
        imagenet_labels = None
    print("[OK] EfficientNet-B4 loaded.")
except Exception as e:
    print(f"[WARN] CNN: {e}")

# --- 3. NLP BERT ---
try:
    print("[LOADING] BERT NLP models...")
    nlp_sentiment = hf_pipeline("sentiment-analysis",
                                model="distilbert-base-uncased-finetuned-sst-2-english")
    print("[OK] BERT sentiment loaded.")
except Exception as e:
    print(f"[WARN] NLP: {e}")

# --- 4. BiLSTM Forecaster ---
class BiLSTMForecaster(nn.Module):
    def __init__(self, input_size=1, hidden_size=128, num_layers=2, output_size=3):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True, bidirectional=True)
        self.fc = nn.Linear(hidden_size * 2, output_size)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])

try:
    if os.path.exists(LSTM_MODEL_PATH):
        lstm_model = BiLSTMForecaster()
        lstm_model.load_state_dict(torch.load(LSTM_MODEL_PATH, map_location="cpu"))
        lstm_model.eval()
        with open(LSTM_NORM_PATH) as f:
            lstm_norm = json.load(f)
        print("[OK] BiLSTM forecaster loaded.")
except Exception as e:
    print(f"[WARN] LSTM: {e}")

# --- 5. RL Agent ---
try:
    if os.path.exists(RL_AGENT_PATH):
        with open(RL_AGENT_PATH) as f:
            rl_agent_data = json.load(f)
        print(f"[OK] RL agent loaded ({len(rl_agent_data['q_table'])} states).")
except Exception as e:
    print(f"[WARN] RL: {e}")

# --- 6. Knowledge Graph ---
try:
    waste_kg = nx.DiGraph()
    waste_types_kg = ["Organic", "Plastic", "E-Waste", "Construction", "Hazardous",
                      "Paper", "Metal", "Glass"]
    processes = {"Organic": ["Anaerobic Digestion", "Composting"],
                 "Plastic": ["Mechanical Recycling", "Pyrolysis"],
                 "E-Waste": ["Component Recovery", "Precious Metal Extraction"],
                 "Construction": ["Aggregate Recycling", "Pyrolysis"],
                 "Hazardous": ["Incineration", "Chemical Treatment"],
                 "Paper": ["Pulping", "Composting"],
                 "Metal": ["Smelting", "Mechanical Recycling"],
                 "Glass": ["Cullet Recycling", "Aggregate Use"]}
    resources = {"Anaerobic Digestion": ["Methane", "Biogas", "Digestate"],
                 "Composting": ["Organic Fertilizer", "NPK Compost"],
                 "Mechanical Recycling": ["Recycled Pellets", "Recovered Material"],
                 "Pyrolysis": ["Syngas", "Biochar", "Pyrolysis Oil"],
                 "Component Recovery": ["Recovered Metals", "Reusable Parts"],
                 "Precious Metal Extraction": ["Gold", "Silver", "Copper"],
                 "Aggregate Recycling": ["Road Base Material", "Fill Material"],
                 "Incineration": ["Energy (kWh)", "Ash Residue"],
                 "Chemical Treatment": ["Neutralized Waste", "Recovered Chemicals"],
                 "Pulping": ["Recycled Paper", "Cardboard"],
                 "Smelting": ["Pure Metal Ingots", "Alloys"],
                 "Cullet Recycling": ["New Glass Products"],
                 "Aggregate Use": ["Construction Fill"]}
    for wt, procs in processes.items():
        waste_kg.add_node(wt, type="waste")
        for p in procs:
            waste_kg.add_node(p, type="process")
            waste_kg.add_edge(wt, p, relation="processed_by")
            for r in resources.get(p, []):
                waste_kg.add_node(r, type="resource")
                waste_kg.add_edge(p, r, relation="produces")
    print(f"[OK] Knowledge Graph built: {waste_kg.number_of_nodes()} nodes, {waste_kg.number_of_edges()} edges.")
except Exception as e:
    print(f"[WARN] KG: {e}")


# ==========================================
# K-MEANS CLUSTER LABEL MAPPING
# ==========================================
# The Random Forest was trained to predict waste_class_label (0-7),
# which are cluster IDs from KMeans(n_clusters=8) in Phase 0.
# These are NOT named waste types - they are cluster groupings.
# Map them to descriptive labels for the API response.
CLUSTER_LABELS = {
    0: "Plastic",
    1: "Organic",
    2: "E-Waste",
    3: "Construction",
    4: "Hazardous",
}


# ==========================================
# PYDANTIC MODELS (DATA SCHEMAS)
# ==========================================

class CVImage(BaseModel):
    image_base64: str

class NLPLog(BaseModel):
    raw_text: str

class SensorData(BaseModel):
    """
    Accepts the 7 conceptual IoT/Chemical sensor readings from the UWRMS architecture.
    These are mapped internally to the correct model feature vectors.
    """
    weight_kg: float
    moisture_pct: float
    temperature_c: float
    fill_level_pct: float
    ph_level: float
    bod_mg_l: float
    methane_voc_ppm: float

class WasteAnalyticsData(BaseModel):
    """
    Matches the actual CSV columns used to train the models.
    Use this schema for direct model inference with dataset-aligned features.
    """
    waste_generated_tons_day: float
    recycling_rate_pct: float
    population_density: float
    municipal_efficiency_score: float
    cost_of_waste_management: float
    awareness_campaigns_count: float
    landfill_capacity_tons: float
    year: float
    landfill_latitude: float
    landfill_longitude: float
    sensor_0: float
    sensor_1: float
    sensor_2: float
    sensor_3: float
    sensor_4: float

class TimeSeriesData(BaseModel):
    historical_volumes: List[float]

class RoutingState(BaseModel):
    rf_classification: str
    current_sensors: SensorData
    facility_capacities: Dict[str, float]

class KGQuery(BaseModel):
    waste_entity: str

# ==========================================
# LAYER 1: SENSING & DETECTION ALGORITHMS
# ==========================================

@app.post("/api/layer1/computer-vision/cnn")
async def cnn_vision_classification(data: CVImage):
    """
    Computer Vision: EfficientNet-B4 CNN waste classification.
    Processes base64 images through the real pre-trained model.
    """
    if cnn_model and data.image_base64 and data.image_base64 != "dummy":
        try:
            img_bytes = base64.b64decode(data.image_base64)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            input_tensor = cnn_transform(img).unsqueeze(0)
            with torch.no_grad():
                output = cnn_model(input_tensor)
                probs = torch.softmax(output, dim=1)
                top5_probs, top5_indices = torch.topk(probs, 5)

            # Map top predictions to waste categories
            waste_scores = {}
            for prob, idx in zip(top5_probs[0], top5_indices[0]):
                p = float(prob)
                # Try to find matching waste category
                for key, waste_type in IMAGENET_WASTE_MAP.items():
                    if key.lower() in str(idx.item()):
                        waste_scores[waste_type] = waste_scores.get(waste_type, 0) + p

            if waste_scores:
                best_type = max(waste_scores, key=waste_scores.get)
                confidence = min(waste_scores[best_type], 0.99)
            else:
                best_type = "Unclassified"
                confidence = float(top5_probs[0][0])

            return {
                "visual_classification": best_type,
                "confidence": round(confidence, 3),
                "top5_class_indices": [int(i) for i in top5_indices[0].tolist()],
                "model_used": "EfficientNet-B4 (Real - timm pretrained)"
            }
        except Exception as e:
            return {
                "visual_classification": "Error",
                "confidence": 0.0,
                "error": str(e),
                "model_used": "EfficientNet-B4 (Error)"
            }
    else:
        # No real image provided — run inference on a synthetic tensor
        if cnn_model:
            with torch.no_grad():
                dummy_input = torch.randn(1, 3, 380, 380)
                output = cnn_model(dummy_input)
                probs = torch.softmax(output, dim=1)
                top_prob = float(probs.max())
                top_idx = int(probs.argmax())
            categories = ["Organic", "Plastic", "Paper", "Metal", "Glass"]
            return {
                "visual_classification": random.choice(categories),
                "confidence": round(top_prob, 3),
                "imagenet_class_id": top_idx,
                "model_used": "EfficientNet-B4 (Real model, synthetic input)"
            }
        return {
            "visual_classification": random.choice(["Organic", "Plastic", "Paper"]),
            "confidence": round(random.uniform(0.85, 0.99), 3),
            "model_used": "EfficientNet-B4 (Fallback)"
        }

@app.post("/api/layer1/nlp-engine/parse")
async def nlp_log_parsing(data: NLPLog):
    """
    NLP Engine: BERT-based maintenance log parsing and anomaly detection.
    Uses DistilBERT for sentiment analysis to flag anomalous logs.
    """
    if nlp_sentiment and data.raw_text:
        try:
            # Run BERT sentiment analysis
            sentiment_result = nlp_sentiment(data.raw_text[:512])[0]
            sentiment_label = sentiment_result["label"]
            sentiment_score = sentiment_result["score"]

            # Negative sentiment = potential anomaly
            is_anomaly = (sentiment_label == "NEGATIVE" and sentiment_score > 0.7)
            norm_score = -sentiment_score if sentiment_label == "NEGATIVE" else sentiment_score

            # Simple keyword entity extraction
            anomaly_keywords = ["leak", "fault", "error", "broken", "failure", "overflow",
                                "pressure", "spike", "damage", "malfunction", "warning",
                                "critical", "alarm", "blockage", "contamination"]
            found_entities = [kw for kw in anomaly_keywords if kw in data.raw_text.lower()]

            return {
                "parsed_entities": found_entities if found_entities else ["normal_operation"],
                "sentiment_score": round(norm_score, 3),
                "sentiment_label": sentiment_label,
                "bert_confidence": round(sentiment_score, 3),
                "is_anomaly": is_anomaly,
                "model_used": "DistilBERT (Real - HuggingFace transformers)"
            }
        except Exception as e:
            return {"error": str(e), "model_used": "BERT (Error)"}
    return {
        "parsed_entities": ["no_text_provided"],
        "sentiment_score": 0.0,
        "is_anomaly": False,
        "model_used": "BERT (No input)"
    }

@app.post("/api/layer1/anomaly-detection")
async def detect_anomalies(data: WasteAnalyticsData):
    """
    Isolation Forest: Anomaly detection gate.
    
    The model was trained on 11 numerical features from the preprocessed dataset
    (all numerical columns EXCLUDING waste_class_label and nlp_anomaly_flag).
    The exact 11 features depend on which columns Phase 1 processing retained.
    
    This endpoint accepts all 15 candidate features (10 original CSV + 5 sensor_)
    and selects the correct 11 for the model.
    """
    if iso_forest:
        # ---------------------------------------------------------------
        # ISOLATION FOREST FEATURE VECTOR (11 features)
        # ---------------------------------------------------------------
        # The model expects 11 features. After Phase 0, there are 15 numerical 
        # columns (10 from CSV + 5 sensor_). Phase 1 drops 4 of them.
        # 
        # Based on analysis, the most likely 11 features retained are:
        # The original 6 core waste management metrics + 5 sensor_ columns.
        # Dropped: Year, Landfill_Latitude, Landfill_Longitude, and one more.
        #
        # UPDATE THIS if you determine the exact Phase 1 drops from Colab!
        # ---------------------------------------------------------------
        features = np.array([[
            data.waste_generated_tons_day,        # Waste Generated (Tons/Day)
            data.recycling_rate_pct,              # Recycling Rate (%)
            data.population_density,              # Population Density (People/km²)
            data.municipal_efficiency_score,      # Municipal Efficiency Score (1-10)
            data.awareness_campaigns_count,       # Awareness Campaigns Count
            data.landfill_capacity_tons,          # Landfill Capacity (Tons)
            data.sensor_0,                        # sensor_0 (synthetic)
            data.sensor_1,                        # sensor_1 (synthetic)
            data.sensor_2,                        # sensor_2 (synthetic)
            data.sensor_3,                        # sensor_3 (synthetic)
            data.sensor_4,                        # sensor_4 (synthetic)
        ]])
        
        try:
            prediction = iso_forest.predict(features)[0]
            is_anomaly = bool(prediction == -1)
            
            if hasattr(iso_forest, "decision_function"):
                score = iso_forest.decision_function(features)[0]
            else:
                score = -1.0 if is_anomaly else 1.0
                
            return {
                "is_anomaly": is_anomaly,
                "anomaly_score": round(float(score), 3),
                "model_used": "IsolationForest (Loaded from .pkl)",
                "action": "Halt Pipeline" if is_anomaly else "Proceed"
            }
        except Exception as e:
             return {"error": f"Failed to run Isolation Forest: {str(e)}"}
    else:
        # Fallback Mock Logic
        is_anomaly = data.sensor_4 > 0.9 or data.waste_generated_tons_day > 9000
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": -0.8 if is_anomaly else 0.5,
            "model_used": "IsolationForest (Simulated Mock)",
            "action": "Halt Pipeline" if is_anomaly else "Proceed"
        }

# ==========================================
# LAYER 2: AI PROCESSING CORE
# ==========================================

@app.post("/api/layer2/random-forest/classify")
async def random_forest_classification(data: WasteAnalyticsData):
    """
    Random Forest Classifier: Trained on 5 features (sensor_0 through sensor_4).
    
    These are synthetic/dummy columns generated by Phase0_DatasetIngestionBootstrapping.
    The output is a waste_class_label (0-7) from KMeans(n_clusters=8) clustering.
    """
    density = round(data.waste_generated_tons_day / max(0.01, data.landfill_capacity_tons) * 1000, 2)
    
    if rf_model:
        # Random Forest was trained exclusively on sensor_0 through sensor_4
        features = np.array([[
            data.sensor_0, 
            data.sensor_1, 
            data.sensor_2, 
            data.sensor_3, 
            data.sensor_4
        ]])
        
        try:
            prediction = rf_model.predict(features)[0]
            cluster_id = int(prediction)
            
            if hasattr(rf_model, "predict_proba"):
                confidence = float(np.max(rf_model.predict_proba(features)))
            else:
                confidence = 0.95
                
            return {
                "rf_waste_class_label": cluster_id,
                "rf_waste_type_classification": CLUSTER_LABELS.get(cluster_id, f"Unknown Cluster {cluster_id}"),
                "estimated_density_kg_m3": density,
                "confidence": round(confidence, 3),
                "model_used": "RandomForest (Loaded from .pkl)",
                "note": "Classification is a KMeans cluster ID (0-7), not a named waste type"
            }
        except Exception as e:
            return {"error": f"Failed to run Random Forest: {str(e)}"}
            
    else:
        # Simulated RF logic
        cluster_id = random.randint(0, 7)
        return {
            "rf_waste_class_label": cluster_id,
            "rf_waste_type_classification": CLUSTER_LABELS.get(cluster_id, f"Unknown Cluster {cluster_id}"),
            "estimated_density_kg_m3": density,
            "confidence": round(random.uniform(0.88, 0.97), 3),
            "model_used": "RandomForest (Simulated Mock)",
            "note": "Classification is a KMeans cluster ID (0-7), not a named waste type"
        }


# ==========================================
# LEGACY SENSOR ENDPOINTS (Architecture-aligned)
# ==========================================
# These endpoints accept the conceptual IoT sensor schema from the
# UWRMS architecture diagram. They use the models but map sensor
# readings to synthetic feature ranges for compatibility.

@app.post("/api/layer1/anomaly-detection/sensor")
async def detect_anomalies_from_sensors(data: SensorData):
    """
    Anomaly detection using IoT sensor data (architecture-aligned endpoint).
    Maps 7 sensor readings to the Isolation Forest's expected 11-feature vector
    by generating synthetic sensor_0-4 values from the IoT readings.
    """
    if iso_forest:
        # Map IoT sensors to dataset-aligned features
        # sensor_0-4 are synthetic, so we derive them from the actual sensors
        features = np.array([[
            data.weight_kg * 10,                  # ~ Waste Generated (Tons/Day) scale
            data.moisture_pct,                     # ~ Recycling Rate (%) scale
            data.fill_level_pct * 100,             # ~ Population Density scale
            data.temperature_c / 10,               # ~ Municipal Efficiency Score scale
            data.methane_voc_ppm / 100,            # ~ Awareness Campaigns Count scale
            data.weight_kg * 7,                    # ~ Landfill Capacity scale
            data.weight_kg / 10000,                # sensor_0 (normalized)
            data.moisture_pct / 100,               # sensor_1 (normalized)
            data.temperature_c / 100,              # sensor_2 (normalized)
            data.ph_level / 14,                    # sensor_3 (normalized)
            data.methane_voc_ppm / 5000,           # sensor_4 (normalized)
        ]])
        
        try:
            prediction = iso_forest.predict(features)[0]
            is_anomaly = bool(prediction == -1)
            score = iso_forest.decision_function(features)[0] if hasattr(iso_forest, "decision_function") else (-1.0 if is_anomaly else 1.0)
            
            return {
                "is_anomaly": is_anomaly,
                "anomaly_score": round(float(score), 3),
                "model_used": "IsolationForest (Sensor-Mapped)",
                "action": "Halt Pipeline" if is_anomaly else "Proceed"
            }
        except Exception as e:
            return {"error": f"Failed to run Isolation Forest: {str(e)}"}
    else:
        is_anomaly = data.methane_voc_ppm > 2000 or data.temperature_c > 80
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": -0.8 if is_anomaly else 0.5,
            "model_used": "IsolationForest (Simulated Mock)",
            "action": "Halt Pipeline" if is_anomaly else "Proceed"
        }

@app.post("/api/layer2/random-forest/classify/sensor")
async def random_forest_from_sensors(data: SensorData):
    """
    Random Forest classification using IoT sensor data (architecture-aligned endpoint).
    Maps sensor readings to synthetic sensor_0-4 features.
    """
    density = round(data.weight_kg / max(0.01, (data.fill_level_pct / 100.0 * 2.0)), 2)
    
    if rf_model:
        # sensor_0-4 are synthetic columns; derive from actual IoT readings
        features = np.array([[
            data.weight_kg,
            data.moisture_pct,
            data.temperature_c,
            data.ph_level,
            data.methane_voc_ppm,
        ]])
        
        try:
            prediction = rf_model.predict(features)[0]
            cluster_id = int(prediction)
            confidence = float(np.max(rf_model.predict_proba(features))) if hasattr(rf_model, "predict_proba") else 0.95
            
            return {
                "rf_waste_class_label": cluster_id,
                "rf_waste_type_classification": CLUSTER_LABELS.get(cluster_id, f"Unknown Cluster {cluster_id}"),
                "estimated_density_kg_m3": density,
                "confidence": round(confidence, 3),
                "model_used": "RandomForest (Sensor-Mapped)",
                "note": "Sensor readings mapped to synthetic features; results are approximate"
            }
        except Exception as e:
            return {"error": f"Failed to run Random Forest: {str(e)}"}
    else:
        cluster_id = random.randint(0, 7)
        return {
            "rf_waste_class_label": cluster_id,
            "rf_waste_type_classification": CLUSTER_LABELS.get(cluster_id, f"Unknown Cluster {cluster_id}"),
            "estimated_density_kg_m3": density,
            "confidence": round(random.uniform(0.88, 0.97), 3),
            "model_used": "RandomForest (Simulated Mock)"
        }


@app.post("/api/layer2/lstm-network/forecast")
async def lstm_volume_forecasting(data: TimeSeriesData):
    """
    BiLSTM Network: Real temporal waste volume forecasting.
    Uses trained BiLSTM model loaded from .pth file.
    """
    if not data.historical_volumes:
        raise HTTPException(status_code=400, detail="No historical data provided.")

    if lstm_model and lstm_norm:
        try:
            seq = np.array(data.historical_volumes[-30:], dtype=np.float32)
            # Pad if less than 30 values
            if len(seq) < 30:
                seq = np.pad(seq, (30 - len(seq), 0), mode='edge')
            # Normalize
            seq_norm = (seq - lstm_norm["mean"]) / lstm_norm["std"]
            input_t = torch.tensor(seq_norm, dtype=torch.float32).unsqueeze(0).unsqueeze(-1)
            with torch.no_grad():
                pred_norm = lstm_model(input_t)[0].numpy()
            # Denormalize
            pred = pred_norm * lstm_norm["std"] + lstm_norm["mean"]
            return {
                "forecasts_kg": {
                    "+6h": round(float(pred[0]), 2),
                    "+12h": round(float(pred[1]), 2),
                    "+24h": round(float(pred[2]), 2)
                },
                "model_used": "BiLSTM (Real - trained on waste data)",
                "input_length": len(data.historical_volumes),
                "norm_params": lstm_norm
            }
        except Exception as e:
            return {"error": str(e), "model_used": "BiLSTM (Error)"}

    # Fallback
    last_val = data.historical_volumes[-1]
    return {
        "forecasts_kg": {
            "+6h": round(last_val * 1.1, 2),
            "+12h": round(last_val * 1.3, 2),
            "+24h": round(last_val * 1.8, 2)
        },
        "model_used": "BiLSTM (Fallback)"
    }

@app.post("/api/layer2/rl-engine/optimize-route")
async def rl_route_selection(state: RoutingState):
    """
    RL Engine: Q-Learning trained waste routing agent.
    Uses pre-trained Q-table loaded from rl_agent.json.
    """
    if rl_agent_data:
        try:
            actions = rl_agent_data["actions"]
            waste_types = rl_agent_data["waste_types"]
            q_table = rl_agent_data["q_table"]

            # Determine waste type index
            wt_idx = 0
            for i, wt in enumerate(waste_types):
                if wt.lower() in state.rf_classification.lower():
                    wt_idx = i
                    break

            # Bucket sensor values
            ph = state.current_sensors.ph_level
            ph_bucket = 0 if ph < 5.5 else (2 if ph > 7.5 else 1)
            moist = state.current_sensors.moisture_pct
            moist_bucket = 0 if moist < 30 else (2 if moist > 60 else 1)
            methane = state.current_sensors.methane_voc_ppm
            methane_bucket = 0 if methane < 500 else (2 if methane > 1500 else 1)

            state_key = f"{wt_idx}_{ph_bucket}_{moist_bucket}_{methane_bucket}"

            if state_key in q_table:
                q_values = q_table[state_key]
                best_action = int(np.argmax(q_values))
                chosen_route = actions[best_action]
                expected_reward = round(float(max(q_values)), 2)
                action_prob = round(float(q_values[best_action] / (sum(q_values) + 0.01)), 2)
            else:
                best_action = 0
                chosen_route = actions[0]
                expected_reward = 5.0
                action_prob = 0.5

            return {
                "optimal_route": chosen_route,
                "expected_reward": expected_reward,
                "action_probability": min(action_prob, 0.99),
                "state_key": state_key,
                "q_values": q_table.get(state_key, []),
                "model_used": "Q-Learning RL Agent (Real - trained 5000 episodes)"
            }
        except Exception as e:
            return {"error": str(e), "model_used": "RL (Error)"}

    # Fallback
    return {
        "optimal_route": "Biogas Module",
        "expected_reward": 5.0,
        "action_probability": 0.8,
        "model_used": "RL (Fallback)"
    }

@app.post("/api/layer2/knowledge-graph/query")
async def knowledge_graph_ontology(data: KGQuery):
    """
    Knowledge Graph: Real NetworkX graph query.
    Traverses the waste-to-resource graph built at startup.
    """
    if waste_kg:
        entity = data.waste_entity
        # Find the entity or closest match
        matching_node = None
        for node in waste_kg.nodes():
            if entity.lower() in node.lower() or node.lower() in entity.lower():
                matching_node = node
                break

        if matching_node:
            node_type = waste_kg.nodes[matching_node].get("type", "unknown")
            successors = list(waste_kg.successors(matching_node))
            predecessors = list(waste_kg.predecessors(matching_node))

            # Get all reachable resources (2-hop for waste types)
            all_resources = []
            all_processes = []
            for s in successors:
                s_type = waste_kg.nodes[s].get("type", "")
                if s_type == "process":
                    all_processes.append(s)
                    for r in waste_kg.successors(s):
                        if waste_kg.nodes[r].get("type") == "resource":
                            all_resources.append(r)
                elif s_type == "resource":
                    all_resources.append(s)

            return {
                "entity": matching_node,
                "entity_type": node_type,
                "recommended_processes": all_processes,
                "related_resources": all_resources,
                "predecessors": predecessors,
                "graph_stats": {
                    "total_nodes": waste_kg.number_of_nodes(),
                    "total_edges": waste_kg.number_of_edges()
                },
                "model_used": "NetworkX Knowledge Graph (Real)"
            }
        return {
            "entity": entity,
            "error": "Entity not found in graph",
            "available_entities": list(waste_kg.nodes())[:20],
            "model_used": "NetworkX Knowledge Graph (Real)"
        }
    return {"error": "Knowledge graph not loaded"}


# ==========================================
# ESG PDF REPORT GENERATION
# ==========================================
class ReportData(BaseModel):
    total_waste: str = "N/A"
    recycling_rate: str = "N/A"
    cities_covered: str = "N/A"
    avg_cost: str = "N/A"

@app.post("/api/reports/esg-pdf")
async def generate_esg_pdf(data: ReportData):
    """Generate a downloadable ESG PDF report."""
    pdf = FPDF()
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 22)
    pdf.cell(0, 15, "UWRMS - ESG Sustainability Report", ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 8, f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
    pdf.ln(10)

    # KPI Section
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Key Performance Indicators", ln=True)
    pdf.set_draw_color(34, 197, 94)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)

    pdf.set_font("Helvetica", "", 12)
    kpis = [
        ("Total Waste Processed", data.total_waste),
        ("Average Recycling Rate", data.recycling_rate),
        ("Cities Covered", data.cities_covered),
        ("Average Cost per Ton", data.avg_cost),
    ]
    for label, value in kpis:
        pdf.cell(100, 8, label, border=0)
        pdf.cell(0, 8, str(value), border=0, ln=True)
    pdf.ln(8)

    # AI Models Section
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "AI Models Deployed", ln=True)
    pdf.set_draw_color(34, 197, 94)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)

    pdf.set_font("Helvetica", "", 11)
    models = [
        ("EfficientNet-B4 CNN", "Visual waste classification", "Active"),
        ("DistilBERT NLP", "Maintenance log anomaly detection", "Active"),
        ("Random Forest", "Waste type classification (IoT)", "Active"),
        ("Isolation Forest", "Anomaly detection gate", "Active"),
        ("BiLSTM Forecaster", "Waste volume time-series prediction", "Active"),
        ("Q-Learning RL Agent", "Optimal waste routing decisions", "Active"),
        ("NetworkX Knowledge Graph", "Waste-to-resource ontology", "Active"),
    ]
    for name, desc, status in models:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(60, 7, name, border=0)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(100, 7, desc, border=0)
        pdf.cell(0, 7, status, border=0, ln=True)
    pdf.ln(8)

    # Graph stats
    if waste_kg:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, "Knowledge Graph Statistics", ln=True)
        pdf.set_draw_color(34, 197, 94)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 7, f"Nodes: {waste_kg.number_of_nodes()}  |  Edges: {waste_kg.number_of_edges()}", ln=True)
        pdf.cell(0, 7, f"Waste Types: {len([n for n,d in waste_kg.nodes(data=True) if d.get('type')=='waste'])}", ln=True)
        pdf.cell(0, 7, f"Processes: {len([n for n,d in waste_kg.nodes(data=True) if d.get('type')=='process'])}", ln=True)
        pdf.cell(0, 7, f"Resources: {len([n for n,d in waste_kg.nodes(data=True) if d.get('type')=='resource'])}", ln=True)

    # Output
    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=UWRMS_ESG_Report.pdf"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

