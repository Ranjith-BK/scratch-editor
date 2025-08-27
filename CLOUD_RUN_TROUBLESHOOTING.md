# Cloud Run Deployment Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. Container Failed to Start (Port 8080)

**Error:** `The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.`

**Solutions:**

#### Option A: Use Simple Node.js Dockerfile (Recommended)
```bash
# Deploy with simple Dockerfile
./deploy-simple.ps1
```

#### Option B: Use Nginx Dockerfile
```bash
# Deploy with nginx Dockerfile
./deploy-cloudrun.ps1 -Dockerfile nginx
```

#### Option C: Manual Deployment
```bash
# Build with simple Dockerfile
docker build -f Dockerfile.simple -t gcr.io/theneural/scratch-editor .

# Push to registry
docker push gcr.io/theneural/scratch-editor

# Deploy to Cloud Run
gcloud run deploy scratch-editor \
    --image gcr.io/theneural/scratch-editor \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300
```

### 2. Check Container Logs

```bash
# View recent logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=scratch-editor' --limit=50

# View specific revision logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.revision_name=scratch-editor-00013-2mg' --limit=50
```

### 3. Test Container Locally

```bash
# Build and test locally
docker build -f Dockerfile.simple -t scratch-editor-test .
docker run -p 8080:8080 scratch-editor-test

# Test in browser: http://localhost:8080
```

### 4. Health Check Issues

The container must respond to health checks on port 8080. Both Dockerfiles include health check endpoints:

- **Nginx:** `/health` endpoint returns "healthy"
- **Simple:** Root endpoint `/` should return the HTML page

### 5. Resource Limits

If you're hitting resource limits:

```bash
# Deploy with more resources
gcloud run deploy scratch-editor \
    --image gcr.io/theneural/scratch-editor \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 600
```

### 6. Startup Timeout

Increase startup timeout if needed:

```bash
# Deploy with longer timeout
gcloud run deploy scratch-editor \
    --image gcr.io/theneural/scratch-editor \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 600 \
    --max-instances 5
```

## 🔧 Debugging Steps

### Step 1: Check Docker Build
```bash
docker build -f Dockerfile.simple -t scratch-editor-test .
```

### Step 2: Test Container Locally
```bash
docker run -p 8080:8080 scratch-editor-test
```

### Step 3: Check Container Logs
```bash
docker logs <container_id>
```

### Step 4: Verify Port Binding
```bash
docker exec <container_id> netstat -tlnp
```

## 📋 Deployment Checklist

- [ ] Docker builds successfully
- [ ] Container runs locally on port 8080
- [ ] Health check endpoint responds
- [ ] Container responds to HTTP requests
- [ ] Image pushes to Google Container Registry
- [ ] Cloud Run deployment succeeds
- [ ] Service is accessible via HTTPS

## 🆘 Still Having Issues?

1. **Check the logs:** Use the logging commands above
2. **Try the simple Dockerfile:** It's more reliable for Cloud Run
3. **Verify port binding:** Container must listen on 0.0.0.0:8080
4. **Check resource limits:** Ensure enough CPU/memory
5. **Verify health checks:** Container must respond quickly

## 📞 Support Commands

```bash
# Get service status
gcloud run services describe scratch-editor --region us-central1

# List all revisions
gcloud run revisions list --service=scratch-editor --region us-central1

# Delete failed service
gcloud run services delete scratch-editor --region us-central1

# View all logs
gcloud logging read 'resource.type=cloud_run_revision' --limit=100
```
