# Cloud Run Deployment Script for Scratch Editor
# This script provides options to deploy with different Docker configurations

param(
    [string]$ProjectId = "theneural",
    [string]$ServiceName = "scratch-editor",
    [string]$Region = "us-central1",
    [string]$Dockerfile = "nginx"  # Options: "nginx" or "simple"
)

Write-Host "=== Scratch Editor Cloud Run Deployment ===" -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Yellow
Write-Host "Service: $ServiceName" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Dockerfile: $Dockerfile" -ForegroundColor Yellow
Write-Host ""

# Check if gcloud is available
try {
    $gcloudVersion = gcloud --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud not found"
    }
    Write-Host "✅ gcloud CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud CLI not found. Please install Google Cloud SDK first." -ForegroundColor Red
    Write-Host "Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is available
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not found"
    }
    Write-Host "✅ Docker found" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker not found. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Set the project
Write-Host "Setting project to $ProjectId..." -ForegroundColor Blue
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project" -ForegroundColor Red
    exit 1
}

# Enable required APIs
Write-Host "Enabling required APIs..." -ForegroundColor Blue
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Build and deploy based on Dockerfile choice
if ($Dockerfile -eq "simple") {
    Write-Host "Using simple Node.js-based Dockerfile..." -ForegroundColor Blue
    $dockerfilePath = "Dockerfile.simple"
} else {
    Write-Host "Using nginx-based Dockerfile..." -ForegroundColor Blue
    $dockerfilePath = "Dockerfile"
}

# Build the Docker image
$imageName = "gcr.io/$ProjectId/$ServiceName"
Write-Host "Building Docker image: $imageName" -ForegroundColor Blue
docker build -f $dockerfilePath -t $imageName .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

# Push the image to Google Container Registry
Write-Host "Pushing image to Google Container Registry..." -ForegroundColor Blue
docker push $imageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Blue
gcloud run deploy $ServiceName `
    --image $imageName `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --timeout 300 `
    --max-instances 10

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Run deployment failed" -ForegroundColor Red
    Write-Host "Check the logs for more details:" -ForegroundColor Yellow
    Write-Host "gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName' --limit=50" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host "Service URL: https://$ServiceName-$Region-$ProjectId.a.run.app" -ForegroundColor Yellow

# Show service status
Write-Host ""
Write-Host "Checking service status..." -ForegroundColor Blue
gcloud run services describe $ServiceName --region $Region --format="value(status.url)"

Write-Host ""
Write-Host "To view logs:" -ForegroundColor Cyan
Write-Host "gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName' --limit=50" -ForegroundColor Cyan

Write-Host ""
Write-Host "To delete the service:" -ForegroundColor Cyan
Write-Host "gcloud run services delete $ServiceName --region $Region" -ForegroundColor Cyan
