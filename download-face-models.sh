#!/bin/bash

# Download face-api.js models from CDN
# These models are required for face detection and recognition

BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
MODELS_DIR="public/models/face-api"

echo "Downloading face-api.js models to ${MODELS_DIR}..."

# Create directory if it doesn't exist
mkdir -p "${MODELS_DIR}"

# Download Tiny Face Detector models
echo "Downloading Tiny Face Detector..."
curl -L "${BASE_URL}/tiny_face_detector_model-weights_manifest.json" -o "${MODELS_DIR}/tiny_face_detector_model-weights_manifest.json"
curl -L "${BASE_URL}/tiny_face_detector_model-shard1" -o "${MODELS_DIR}/tiny_face_detector_model-shard1"

# Download Face Landmark 68 models
echo "Downloading Face Landmark 68 Net..."
curl -L "${BASE_URL}/face_landmark_68_model-weights_manifest.json" -o "${MODELS_DIR}/face_landmark_68_model-weights_manifest.json"
curl -L "${BASE_URL}/face_landmark_68_model-shard1" -o "${MODELS_DIR}/face_landmark_68_model-shard1"

# Download Face Recognition models
echo "Downloading Face Recognition Net..."
curl -L "${BASE_URL}/face_recognition_model-weights_manifest.json" -o "${MODELS_DIR}/face_recognition_model-weights_manifest.json"
curl -L "${BASE_URL}/face_recognition_model-shard1" -o "${MODELS_DIR}/face_recognition_model-shard1"
curl -L "${BASE_URL}/face_recognition_model-shard2" -o "${MODELS_DIR}/face_recognition_model-shard2"

echo "✓ All face-api.js models downloaded successfully!"
echo "Models location: ${MODELS_DIR}"
