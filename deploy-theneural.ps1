# Deploy scratch-editor to Cloud Run for TheNeural Project
# Project ID: theneural
# Project Name: TheNeural

Write-Host "🚀 Deploying scratch-editor to Cloud Run for TheNeural Project..." -ForegroundColor Blue

# Set project ID
$ProjectId = "theneural"
$ServiceName = "scratch-editor"
$Region = "us-central1"
$ImageName = "gcr.io/$ProjectId/$ServiceName"

Write-Host "Project ID: $ProjectId" -ForegroundColor Cyan
Write-Host "Project Name: TheNeural" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service Name: $ServiceName" -ForegroundColor Cyan

# Verify gcloud is configured for this project
$CurrentProject = gcloud config get-value project
if ($CurrentProject -ne $ProjectId) {
    Write-Host "⚠️  Warning: Current gcloud project is '$CurrentProject', but we're deploying to '$ProjectId'" -ForegroundColor Yellow
    $Continue = Read-Host "Continue anyway? (y/N)"
    if ($Continue -ne "y" -and $Continue -ne "Y") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Build Docker image
Write-Host "`n📦 Building Docker image..." -ForegroundColor Yellow
docker build -t $ImageName .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Push to Container Registry
Write-Host "`n⬆️  Pushing image to Container Registry..." -ForegroundColor Yellow
docker push $ImageName
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push image" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Deploy to Cloud Run
Write-Host "`n🚀 Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --image $ImageName `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --max-instances 10 `
    --set-env-vars NODE_ENV=production

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Get service URL
$ServiceUrl = gcloud run services describe $ServiceName --platform managed --region $Region --format "value(status.url)"

Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
Write-Host "🌐 Service URL: $ServiceUrl" -ForegroundColor Green
Write-Host "📊 Monitor: https://console.cloud.google.com/run/detail/$Region/$ServiceName?project=$ProjectId" -ForegroundColor Cyan
Write-Host "🔗 Health Check: $ServiceUrl/health" -ForegroundColor Blue

Write-Host "`n🎉 Your Scratch Editor with ML extension is now live on Google Cloud Run!" -ForegroundColor Green
Write-Host "Project: TheNeural (theneural)" -ForegroundColor Cyan

Read-Host "Press Enter to exit"
