# LLM Visual - Interactive Database Visualization

An interactive visualization system for learning database concepts with AI-powered narration and doubt resolution.

## API Documentation

### 1. Get Visualization Data
Retrieves the visualization data for a specific topic.

**Endpoint:** `POST /api/visualization`

**Request Body:**
```json
{
    "topic": string  // e.g., "shared_memory", "shared_disk", "shared_nothing"
}
```

**Response Body:**
```json
{
    "nodes": [
        {
            "id": string,
            "name": string,
            "type": string,
            "properties": [
                {
                    "name": string,
                    "type": string,
                    "isPrimary": boolean,
                    "isForeign": boolean
                }
            ]
        }
    ],
    "edges": [
        {
            "source": string,
            "target": string,
            "type": string,
            "description": string
        }
    ],
    "jsx_code": string,
    "topic": string,
    "narration": string,
    "narration_timestamps": [
        {
            "word": string,
            "start_time": number,
            "end_time": number,
            "node_id": string | string[]
        }
    ],
    "animation_states": [
        {
            "component_id": string,
            "state": object,
            "duration": number
        }
    ],
    "node_id": string
}
```

### 2. Generate Narration
Generates audio narration for the visualization.

**Endpoint:** `POST /api/narration/{topic}`

**Path Parameters:**
- `topic`: The visualization topic

**Response Body:**
```json
{
    "audio_url": string,
    "duration": number,
    "word_timings": [
        {
            "word": string,
            "start_time": number,
            "end_time": number,
            "node_id": string | string[]
        }
    ],
    "script": string
}
```

### 3. Handle Doubt
Processes user doubts and generates explanations.

**Endpoint:** `POST /api/doubt`

**Request Body:**
```json
{
    "topic": string,
    "doubt": string,
    "current_time": number,
    "current_state": object
}
```

**Response Body:**
```json
{
    "narration": string,
    "narration_timestamps": [
        {
            "word": string,
            "start_time": number,
            "end_time": number,
            "node_id": string | string[]
        }
    ],
    "nodes": [
        {
            "id": string,
            "name": string,
            "type": string,
            "properties": array
        }
    ],
    "edges": [
        {
            "source": string,
            "target": string,
            "type": string,
            "description": string
        }
    ],
    "highlights": string[]
}
```

### 4. Get Highlights
Retrieves highlight information for a specific timestamp.

**Endpoint:** `GET /api/highlights/{topic}/{timestamp}`

**Path Parameters:**
- `topic`: The visualization topic
- `timestamp`: Current timestamp in milliseconds

**Response Body:**
```json
{
    "highlights": [
        {
            "id": string,
            "type": string
        }
    ]
}
```

### 5. Process Doubt (Enhanced)
Enhanced doubt processing with additional context.

**Endpoint:** `POST /api/process-doubt`

**Request Body:**
```json
{
    "doubt": string,
    "topic": string,
    "current_state": {
        "highlightedElements": array,
        "currentTime": number
    }
}
```

**Response Body:**
```json
{
    "narration": {
        "explanation": string,
        "componentDetails": {
            [componentId: string]: {
                "description": string,
                "type": string,
                "properties": array
            }
        }
    },
    "highlightedElements": string[],
    "relatedConcepts": array,
    "interactiveElements": [
        {
            "type": string,
            "message": string
        }
    ]
}
```

## Error Responses
All APIs may return the following error responses:

```json
{
    "detail": string,
    "status_code": number,
    "error": string
}
```

Common status codes:
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

## Notes
- All timestamps are in milliseconds
- Audio files are served from `/static/audio/{filename}`
- Node IDs in word_timings can be either a single string or an array of strings
- The system supports real-time highlighting and animation based on narration timing

