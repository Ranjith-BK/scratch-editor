@echo off
REM Deploy scratch-editor to Cloud Run
REM Make sure you have gcloud CLI installed and configured

setlocal enabledelayedexpansion

REM Configuration
for /f "tokens=*" %%i in ('gcloud config get-value project') do set PROJECT_ID=%%i
set REGION=us-central1
set SERVICE_NAME=scratch-editor
set IMAGE_NAME=gcr.io/%PROJECT_ID%/%SERVICE_NAME%

echo 🚀 Deploying scratch-editor to Cloud Run...
echo Project ID: %PROJECT_ID%
echo Region: %REGION%
echo Service Name: %SERVICE_NAME%

REM Check if gcloud is configured
if "%PROJECT_ID%"=="" (
    echo ❌ Error: gcloud not configured. Please run 'gcloud auth login' and 'gcloud config set project YOUR_PROJECT_ID'
    pause
    exit /b 1
)

REM Build the Docker image
echo 📦 Building Docker image...
docker build -t %IMAGE_NAME% .

REM Push the image to Container Registry
echo ⬆️  Pushing image to Container Registry...
docker push %IMAGE_NAME%

REM Deploy to Cloud Run
echo 🚀 Deploying to Cloud Run...
gcloud run deploy %SERVICE_NAME% ^
    --image %IMAGE_NAME% ^
    --platform managed ^
    --region %REGION% ^
    --allow-unauthenticated ^
    --port 8080 ^
    --memory 1Gi ^
    --cpu 1 ^
    --max-instances 10 ^
    --set-env-vars NODE_ENV=production

REM Get the service URL
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i

echo ✅ Deployment successful!
echo 🌐 Service URL: %SERVICE_URL%
echo 📊 Monitor your service: https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%

pause
