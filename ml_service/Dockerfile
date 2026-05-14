FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the ML service
COPY . .

# Expose the port HuggingFace expects
EXPOSE 7860

# Start FastAPI on port 7860 (HuggingFace default)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
