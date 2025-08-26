#!/bin/bash

# Deploy scratch-editor to Cloud Run
# Make sure you have gcloud CLI installed and configured

set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="scratch-editor"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying scratch-editor to Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service Name: $SERVICE_NAME"

# Check if gcloud is configured
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: gcloud not configured. Please run 'gcloud auth login' and 'gcloud config set project YOUR_PROJECT_ID'"
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .

# Push the image to Container Registry
echo "⬆️  Pushing image to Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo "✅ Deployment successful!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 Monitor your service: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
