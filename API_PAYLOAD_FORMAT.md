# ML Extension API Payload Format

The ML extension now automatically includes `session_id` and `project_id` in all API request payloads. This document shows the expected format for each endpoint.

## Base Payload Structure

All API requests automatically include:
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8"
}
```

## API Endpoints and Payloads

### 1. Get Project Name
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8"
}
```

**Expected Response:**
```json
{
  "name": "My Project Name",
  "description": "Optional description",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 2. Add Training Data
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}/examples`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8",
  "text": "Hello world",
  "label": "greeting"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Training data added successfully"
}
```

### 3. Train Model
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}/train`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Training started",
  "data": {
    "status": "training",
    "job_id": "job_123"
  }
}
```

### 4. Check Model Status
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}/train`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8",
  "check_status": true,
  "expected_status": "ready"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "accuracy": 0.95
  }
}
```

### 5. Make Prediction
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}/predict`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8",
  "text": "Hello there"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "prediction": {
      "label": "greeting",
      "confidence": 0.92
    }
  }
}
```

### 6. Get Training Examples
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}/examples`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8",
  "get_examples": true
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "text": "Hello world",
      "label": "greeting"
    },
    {
      "text": "Goodbye",
      "label": "farewell"
    }
  ]
}
```

### 7. Test Connection
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8",
  "test_connection": true
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

### 8. Check Project Name Status
**Endpoint:** `POST /api/guests/session/{session_id}/projects/{project_id}`

**Payload:**
```json
{
  "session_id": "session_aa3bffbf72c444c5",
  "project_id": "eff8a1b8-4998-442a-a3a2-2e386ddbc9b8",
  "check_project_name": true
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "name": "My Project Name"
  }
}
```

## Important Notes

1. **All requests are POST**: The extension now uses POST for all endpoints to send payloads
2. **Automatic ID inclusion**: `session_id` and `project_id` are automatically added to every request
3. **Payload merging**: Custom payloads are merged with the base session/project IDs
4. **CORS required**: Your backend must allow CORS from `localhost:8601` (Scratch editor)

## Backend CORS Configuration

Add this to your FastAPI backend:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8601"],  # Scratch editor
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)
```

## Testing

Use the extension's built-in testing functions:
- `MLExtension.testConnection()` - Test API connectivity
- `MLExtension.testCORS()` - Test CORS configuration
- `MLExtension.checkProjectNameStatus()` - Check project name status
