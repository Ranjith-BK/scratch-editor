# Simple Cloud Run Deployment for Scratch Editor
# Uses the simple Node.js-based Dockerfile

Write-Host "=== Simple Scratch Editor Deployment ===" -ForegroundColor Green

# Build and deploy with simple Dockerfile
Write-Host "Building with simple Node.js Dockerfile..." -ForegroundColor Blue
docker build -f Dockerfile.simple -t gcr.io/theneural/scratch-editor .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "Pushing to Google Container Registry..." -ForegroundColor Blue
docker push gcr.io/theneural/scratch-editor

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying to Cloud Run..." -ForegroundColor Blue
gcloud run deploy scratch-editor `
    --image gcr.io/theneural/scratch-editor `
    --platform managed `
    --region us-central1 `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --timeout 300

Write-Host "✅ Deployment complete!" -ForegroundColor Green
