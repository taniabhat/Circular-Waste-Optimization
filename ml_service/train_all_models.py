"""
UWRMS — Train All Missing Models
Trains BiLSTM forecaster and RL agent, saves to trained_models/
Run once before starting the server.
"""
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import joblib
import os
import json

SAVE_DIR = "trained_models"
CSV_PATH = "../Waste_Management_and_Recycling_India_preprocessed.csv"

# ============================================================
# 1. BiLSTM FORECASTER
# ============================================================
class BiLSTMForecaster(nn.Module):
    def __init__(self, input_size=1, hidden_size=128, num_layers=2, output_size=3):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True, bidirectional=True)
        self.fc = nn.Linear(hidden_size * 2, output_size)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.fc(out[:, -1, :])
        return out


def train_bilstm():
    print("\n[1/2] Training BiLSTM Forecaster...")
    df = pd.read_csv(CSV_PATH)

    # Create a synthetic daily time series from the yearly aggregate data
    yearly = df.groupby("Year")["Waste Generated (Tons/Day)"].mean().sort_index()
    print(f"  Yearly means: {dict(yearly)}")

    # Generate 365 days per year with realistic variation
    np.random.seed(42)
    daily_values = []
    for year, mean_val in yearly.items():
        for day in range(365):
            # Add weekly seasonality + random noise
            seasonal = mean_val * (1 + 0.15 * np.sin(2 * np.pi * day / 7))
            noise = np.random.normal(0, mean_val * 0.05)
            daily_values.append(max(0, seasonal + noise))

    series = np.array(daily_values, dtype=np.float32)

    # Normalize
    series_mean = series.mean()
    series_std = series.std()
    series_norm = (series - series_mean) / series_std

    # Save normalization params
    norm_params = {"mean": float(series_mean), "std": float(series_std)}
    with open(os.path.join(SAVE_DIR, "lstm_norm_params.json"), "w") as f:
        json.dump(norm_params, f)

    # Create sliding windows: input 30 days -> predict next 3 values (6h/12h/24h proxy)
    SEQ_LEN = 30
    PRED_LEN = 3
    X, Y = [], []
    for i in range(len(series_norm) - SEQ_LEN - PRED_LEN):
        X.append(series_norm[i:i + SEQ_LEN])
        Y.append(series_norm[i + SEQ_LEN:i + SEQ_LEN + PRED_LEN])

    X = torch.tensor(np.array(X), dtype=torch.float32).unsqueeze(-1)  # (N, 30, 1)
    Y = torch.tensor(np.array(Y), dtype=torch.float32)               # (N, 3)

    print(f"  Training samples: {len(X)}")

    # Train
    model = BiLSTMForecaster(input_size=1, hidden_size=128, num_layers=2, output_size=3)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    model.train()
    EPOCHS = 30
    BATCH = 64

    for epoch in range(EPOCHS):
        total_loss = 0
        indices = torch.randperm(len(X))
        for start in range(0, len(X), BATCH):
            batch_idx = indices[start:start + BATCH]
            xb, yb = X[batch_idx], Y[batch_idx]
            pred = model(xb)
            loss = criterion(pred, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch + 1}/{EPOCHS} — Loss: {total_loss / (len(X) // BATCH):.6f}")

    # Save
    torch.save(model.state_dict(), os.path.join(SAVE_DIR, "bilstm_forecaster.pth"))
    print("  [OK] BiLSTM saved to trained_models/bilstm_forecaster.pth")


# ============================================================
# 2. RL AGENT (Tabular Q-Learning)
# ============================================================
def train_rl_agent():
    print("\n[2/2] Training RL Waste Routing Agent (Q-Learning)...")

    # State: (waste_type_idx, ph_bucket, moisture_bucket, methane_bucket)
    # Action: 0=Biogas, 1=Compost, 2=Recycle, 3=EnergyRecovery, 4=Pyrolysis
    ACTIONS = ["Biogas Module", "Compost Module", "Recycle Module", "Energy Recovery", "Pyrolysis Unit"]
    WASTE_TYPES = ["Organic", "Plastic", "E-Waste", "Construction", "Hazardous"]

    # Reward function based on domain knowledge
    # reward[waste_type_idx][action_idx] = expected reward
    REWARD_TABLE = {
        0: [9.0, 7.0, 1.0, 3.0, 2.0],   # Organic → best: Biogas/Compost
        1: [0.5, 0.5, 9.0, 4.0, 5.0],   # Plastic → best: Recycle
        2: [0.0, 0.0, 8.0, 5.0, 3.0],   # E-Waste → best: Recycle
        3: [0.5, 1.0, 6.0, 3.0, 7.0],   # Construction → best: Pyrolysis/Recycle
        4: [1.0, 0.5, 2.0, 6.0, 8.0],   # Hazardous → best: Pyrolysis/Energy
    }

    q_table = {}
    alpha = 0.1   # learning rate
    gamma = 0.99  # discount factor
    epsilon = 0.3 # exploration

    np.random.seed(42)
    EPISODES = 5000

    for ep in range(EPISODES):
        waste_type = np.random.randint(0, 5)
        ph_bucket = np.random.randint(0, 3)       # 0=acidic, 1=neutral, 2=alkaline
        moisture_bucket = np.random.randint(0, 3)  # 0=dry, 1=moderate, 2=wet
        methane_bucket = np.random.randint(0, 3)   # 0=low, 1=medium, 2=high

        state = (waste_type, ph_bucket, moisture_bucket, methane_bucket)

        if state not in q_table:
            q_table[state] = np.zeros(5)

        # Epsilon-greedy
        if np.random.random() < epsilon:
            action = np.random.randint(0, 5)
        else:
            action = int(np.argmax(q_table[state]))

        # Compute reward with bonuses
        reward = REWARD_TABLE[waste_type][action]

        # Bonus for organic + wet + acidic → Biogas
        if waste_type == 0 and action == 0 and moisture_bucket == 2 and ph_bucket == 0:
            reward += 2.0  # ClosedLoopBonus

        # Bonus for organic + neutral → Compost
        if waste_type == 0 and action == 1 and ph_bucket == 1:
            reward += 1.5

        # Bonus for high methane + Biogas
        if methane_bucket == 2 and action == 0:
            reward += 1.0

        # Q-update (single-step, terminal)
        q_table[state][action] += alpha * (reward - q_table[state][action])

        # Decay epsilon
        epsilon = max(0.01, epsilon * 0.9995)

    # Convert q_table keys to strings for JSON serialization
    serializable_q = {}
    for state, values in q_table.items():
        key = f"{state[0]}_{state[1]}_{state[2]}_{state[3]}"
        serializable_q[key] = values.tolist()

    # Save
    save_data = {"q_table": serializable_q, "actions": ACTIONS, "waste_types": WASTE_TYPES}
    with open(os.path.join(SAVE_DIR, "rl_agent.json"), "w") as f:
        json.dump(save_data, f)

    print(f"  Trained over {EPISODES} episodes, {len(q_table)} unique states")
    print("  [OK] RL Agent saved to trained_models/rl_agent.json")

    # Print sample policy
    print("\n  Sample Policy:")
    for wt_idx, wt_name in enumerate(WASTE_TYPES):
        state = (wt_idx, 1, 1, 1)  # neutral conditions
        if state in q_table:
            best = ACTIONS[int(np.argmax(q_table[state]))]
            print(f"    {wt_name} (neutral) → {best}")


if __name__ == "__main__":
    os.makedirs(SAVE_DIR, exist_ok=True)
    train_bilstm()
    train_rl_agent()
    print("\n[DONE] All models trained successfully!")
