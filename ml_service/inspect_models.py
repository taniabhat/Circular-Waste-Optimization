import joblib
import sys

try:
    rf_model = joblib.load("trained_models/random_forest.pkl")
    iso_model = joblib.load("trained_models/isolation_forest.pkl")
    
    print("--- Random Forest ---")
    if hasattr(rf_model, "feature_names_in_"):
        print(f"Expected Features: {list(rf_model.feature_names_in_)}")
    elif hasattr(rf_model, "steps"):
        for name, step in rf_model.steps:
            if hasattr(step, "feature_names_in_"):
                 print(f"Pipeline Step '{name}' Expected Features: {list(step.feature_names_in_)}")
                 break
        else:
            print("No feature names found in Pipeline.")
    else:
        print(f"No feature names saved. Expected number of features: {rf_model.n_features_in_}")
        
    print("\n--- Isolation Forest ---")
    if hasattr(iso_model, "feature_names_in_"):
        print(f"Expected Features: {list(iso_model.feature_names_in_)}")
    elif hasattr(iso_model, "steps"):
        for name, step in iso_model.steps:
            if hasattr(step, "feature_names_in_"):
                 print(f"Pipeline Step '{name}' Expected Features: {list(step.feature_names_in_)}")
                 break
        else:
            print("No feature names found in Pipeline.")
    else:
        print(f"No feature names saved. Expected number of features: {iso_model.n_features_in_}")

except Exception as e:
    print(f"Error reading models: {e}")
