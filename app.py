#app.py
from fastapi import FastAPI, HTTPException, Response, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from openai import OpenAI, AsyncOpenAI
from anthropic import Anthropic
from animation_generator import AnimationGenerator
import os
from dotenv import load_dotenv
import logging
import json
from pathlib import Path
import tempfile
from typing import Dict, List, Optional, Union, Any, AsyncGenerator
from datetime import datetime
from flask import jsonify
import requests
import hashlib
import asyncio
from realtime_audio import handle_websocket_connection, handle_doubt_websocket, stream_text_to_speech
import traceback

logging.basicConfig(level=logging.INFO)
load_dotenv()

app = FastAPI(
    title="Database Visualization API",
    description="API for database visualization and narration",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open('static/index.html') as f:
        return f.read()

# Initialize API clients
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
anthropic_client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

# Define the audio directory
AUDIO_DIR = Path("static/audio")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

class Property(BaseModel):
    name: str
    type: Optional[str] = None
    isPrimary: bool = False
    isForeign: bool = False

class NodeProperty(BaseModel):
    name: str
    type: str

class VisualizationNode(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    properties: Optional[Union[List[str], List[NodeProperty]]] = None
    columns: Optional[List[Property]] = None
    attributes: Optional[List[dict]] = None
    document: Optional[dict] = None

class VisualizationEdge(BaseModel):
    source: str
    target: str
    type: str
    description: Optional[str] = None

class VisualizationRequest(BaseModel):
    topic: str

class WordTiming(BaseModel):
    word: str
    start_time: int = Field(description="Time in milliseconds from start")
    end_time: int = Field(description="Time in milliseconds from start")
    node_id: Optional[Union[str, List[str]]] = Field(None, description="ID of the node(s) to highlight")

class AnimationState(BaseModel):
    component_id: str
    state: Dict[str, Any]
    duration: int = Field(description="Duration in milliseconds")

class VisualizationData(BaseModel):
    nodes: List[VisualizationNode]
    edges: List[VisualizationEdge]
    jsx_code: str
    topic: str  # This will remain as the original topic ID for backward compatibility
    topic_name: Optional[str] = None  # Add the topic name
    topic_id: Optional[str] = None  # Add the topic ID explicitly
    narration: Optional[str] = None
    narration_timestamps: Optional[List[WordTiming]] = None
    animation_states: Optional[List[AnimationState]] = None
    node_id: Optional[str] = Field(None, description="ID of node to highlight")

class DoubtRequest(BaseModel):
    topic: str
    doubt: str
    current_time: Optional[int] = None
    current_state: Optional[dict] = None

class NarrationData(BaseModel):
    audio_url: str
    duration: int = Field(description="Total duration in milliseconds")
    word_timings: List[WordTiming]
    script: str
    topic: Optional[str] = None  # Add the topic field
    topic_name: Optional[str] = None  # Add the topic name
    topic_id: Optional[str] = None  # Add the topic ID

class DoubtResponse(BaseModel):
    narration: Optional[str] = None
    narration_timestamps: Optional[List[WordTiming]] = None
    nodes: Optional[List[VisualizationNode]] = None
    edges: Optional[List[VisualizationEdge]] = None
    highlights: Optional[List[str]] = None
    jsx_code: Optional[str] = None
    topic: Optional[str] = None  # Add the topic field
    topic_name: Optional[str] = None  # Add the topic name
    topic_id: Optional[str] = None  # Add the topic ID

# Add a mapping between topic IDs and topic names
TOPIC_ID_MAP = {
    "1": "schema",
    "2": "parallel_db",
    "3": "hierarchical",
    "4": "network",
    "5": "er",
    "6": "document",
    "7": "history",
    "8": "xml",
    "9": "entity",
    "10": "attribute",
    "22": "shared_disk",
    "23": "shared_memory",
    "24": "shared_nothing",
    "25": "distributed_database",
    "26": "oop_concepts",
    "27": "relational",
    "28": "relationalQuery",
    "29": "normalization",
    "30": "activedb",
    "31": "queryprocessing",
    "32": "mobiledb",
    "33": "gis",
    "34": "businesspolicy"
}

# Reverse mapping for looking up IDs by name
TOPIC_NAME_TO_ID = {v: k for k, v in TOPIC_ID_MAP.items()}

def get_topic_name(topic_id_or_name: str) -> str:
    """Convert a topic ID to a topic name if needed"""
    if topic_id_or_name in TOPIC_ID_MAP:
        return TOPIC_ID_MAP[topic_id_or_name]
    return topic_id_or_name

def get_topic_id(topic_name: str) -> str:
    """Convert a topic name to a topic ID if possible"""
    return TOPIC_NAME_TO_ID.get(topic_name, topic_name)

def load_visualization_data(topic: str) -> VisualizationData:
    """Load visualization data and JSX code for a specific topic"""
    data_path = Path('static/data') / f'{topic}_visualization.json'
    script_path = Path('static/data') / f'{topic}_script.json'
    jsx_path = Path('src/components') / f'{topic}Visualization.jsx'
    
    with open(data_path) as f:
        data = json.load(f)
        
    # Load narration script and generate animation steps if available
    narration = None
    animation_steps = None
    if script_path.exists():
        with open(script_path) as f:
            script_data = json.load(f)
            narration = script_data.get('script', '')
            
            # Generate animation steps using OpenAI
            if narration:
                try:
                    generator = AnimationGenerator()
                    animation_steps = generator.generate_animation_timestamps(
                        narration=narration,
                        visualization_data={'nodes': data['nodes'], 'edges': data['edges']}
                    )
                except Exception as e:
                    logging.error(f"Error generating animation steps: {e}")
                    animation_steps = []
    
    jsx_code = ""
    if jsx_path.exists():
        with open(jsx_path) as f:
            jsx_code = f.read()
    
    nodes = []
    for n in data['nodes']:
        if topic == 'schema':
            node_data = {
                'id': n['id'],
                'name': n['name'],
                'columns': [Property(**col) for col in n['columns']]
            }
        elif topic == 'er':
            node_data = {
                'id': n['id'],
                'name': n['name'],
                'type': n.get('type'),
                'attributes': n.get('attributes', [])
            }
        else:
            node_data = {
                'id': n['id'],
                'name': n['name'],
                'type': n.get('type'),
                'properties': n.get('properties', [])
            }
        nodes.append(VisualizationNode(**node_data))
    
    # Get topic ID if this is a topic name
    topic_id = get_topic_id(topic)
    
    return VisualizationData(
        nodes=nodes,
        edges=[VisualizationEdge(**e) for e in data['edges']],
        jsx_code=jsx_code,
        topic=topic,  # Use topic name as the main topic field
        topic_name=topic,  # Set the topic name
        topic_id=topic_id,  # Set the topic ID explicitly
        narration=narration,
        animation_states=[AnimationState(
            component_id=step['nodeIds'][0],
            state={'highlighted': True},
            duration=int(step['duration'] * 1000)
        ) for step in (animation_steps or [])]
    )

def load_narration_script(topic: str) -> Dict:
    """Load the narration script with component mappings"""
    # Convert topic ID to name if needed
    topic_name = get_topic_name(topic)
    
    # First try with _script.json suffix
    script_path = Path('static/data') / f'{topic_name}_script.json'
    if not script_path.exists():
        # Fallback to just script.json
        script_path = Path('static/data') / 'parallel_db_script.json'
        if not script_path.exists():
            raise FileNotFoundError(f"No script file found for topic {topic_name}")
    
    with open(script_path) as f:
        script_data = json.load(f)
    
    # Enhance the script with interactive elements
    script_data = enhance_script_with_interactive_elements(script_data, topic_name)
    
    return script_data

def enhance_script_with_interactive_elements(script_data: Dict, topic: str) -> Dict:
    """Enhance the script with interactive, teacher-like elements"""
    # Get the original script
    original_script = script_data.get('script', '')
    
    # Only enhance if the script doesn't already have interactive elements
    if not any(phrase in original_script for phrase in 
              ["Do you understand", "Can you see", "What do you think", "Let's consider", "?"]):
        
        # Add interactive elements to the script
        paragraphs = original_script.split('\n\n')
        enhanced_paragraphs = []
        
        # Add interactive elements to appropriate paragraphs
        for i, paragraph in enumerate(paragraphs):
            enhanced_paragraph = paragraph
            
            # Add a question after the first paragraph
            if i == 0 and len(paragraphs) > 1:
                enhanced_paragraph += f" Do you understand how this works?"
            
            # Add a reflective prompt in the middle
            elif i == len(paragraphs) // 2 and len(paragraphs) > 2:
                enhanced_paragraph += f" What do you think would happen if we modified this component?"
            
            # Add a comprehension check near the end
            elif i == len(paragraphs) - 1 and len(paragraphs) > 1:
                enhanced_paragraph += f" Can you see why this architecture is designed this way?"
            
            enhanced_paragraphs.append(enhanced_paragraph)
        
        # Add a final reflection prompt
        if len(paragraphs) > 0:
            enhanced_paragraphs.append("Take a moment to think about how this concept relates to other database architectures we've discussed.")
        
        # Update the script
        script_data['script'] = '\n\n'.join(enhanced_paragraphs)
    
    return script_data

def generate_word_timings(text: str, audio_duration: int) -> List[WordTiming]:
    """Generate word-level timings for the narration"""
    words = text.split()
    avg_word_duration = audio_duration / len(words)
    
    timings = []
    current_time = 0
    
    for word in words:
        # Adjust duration based on word length
        word_duration = avg_word_duration * (len(word) / 5)  # 5 is average word length
        timings.append(WordTiming(
            word=word,
            start_time=int(current_time),
            end_time=int(current_time + word_duration)
        ))
        current_time += word_duration
    
    return timings

@app.post("/api/visualization", response_model=VisualizationData, tags=["Visualization"])
async def get_visualization(request: VisualizationRequest):
    topic_id = request.topic
    topic_name = get_topic_name(topic_id)
    
    logging.info(f"Received visualization request for topic ID: {topic_id}, mapped to: {topic_name}")
    
    valid_topics = [
        'schema', 'parallel_db', 'hierarchical', 'network', 'er', 'document', 'history', 'xml', 
        'entity', 'attribute', 'shared_memory', 'shared_disk', 'shared_nothing', 'distributed_database', 
        'oop_concepts', 'relational', 'relationalQuery', 'normalization', 'activedb', 'queryprocessing', 
        'mobiledb', 'gis', 'businesspolicy']
    
    if topic_name not in valid_topics:
        error_msg = f"Invalid topic '{topic_name}' (ID: {topic_id}). Must be one of: {', '.join(valid_topics)}"
        logging.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    
    try:
        # Load visualization data
        data = load_visualization_data(topic_name)
        
        # Load JSX code
        jsx_path = Path('src/components') / f'{topic_name.capitalize()}Visualization.jsx'
        if not jsx_path.exists():
            jsx_path = Path('static/js') / f'{topic_name}Visualization.jsx'
        
        if not jsx_path.exists():
            error_msg = f"JSX code not found for topic '{topic_name}' (ID: {topic_id})"
            logging.error(error_msg)
            raise HTTPException(status_code=404, detail=error_msg)
        
        with open(jsx_path) as f:
            jsx_code = f.read()
            
            # For test visualization, use a simple component
            if topic_name == 'test':
                jsx_code = '''
                (props) => {
                    const { data } = props;
                    return React.createElement(
                        "div",
                        { 
                            style: { 
                                width: "100%", 
                                height: "100%", 
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                fontSize: "24px",
                                color: "#4299e1"
                            }
                        },
                        `${data.nodes.length} Nodes and ${data.edges.length} Edges`
                    );
                }
                '''.strip()
            else:
                # Extract the component definition for other components
                import re
                component_match = re.search(r'const\s+\w+\s*=\s*\(\s*props\s*\)\s*=>\s*{([^}]+)}', jsx_code)
                if component_match:
                    # Get the component body and clean it up
                    component_body = component_match.group(1).strip()
                    # Remove any return statement if present
                    component_body = re.sub(r'^\s*return\s+', '', component_body)
                    jsx_code = component_body
            
        # Load narration text and timestamps
        narration = None
        narration_timestamps = None
        animation_states = None
        try:
            script_data = load_narration_script(topic_name)
            narration = script_data.get('script', '')
            narration_timestamps = script_data.get('narration_timestamps', [])
            
            if narration_timestamps:
                for timestamp in narration_timestamps:
                    if 'node_ids' in timestamp and 'node_id' not in timestamp:
                        timestamp['node_id'] = timestamp.pop('node_ids')
            
            animation_states = script_data.get('animation_states', [])
            
            if len(narration_timestamps) != len(animation_states):
                logging.warning(f"Mismatch between narration timestamps and animation states for topic: {topic_name}")
            
            logging.info(f"Successfully loaded narration and animation data for topic: {topic_name}")
        except FileNotFoundError:
            logging.warning(f"No narration script found for topic: {topic_name}")
        except Exception as e:
            logging.error(f"Error loading narration for topic {topic_name}: {str(e)}")
        
        response_data = VisualizationData(
            nodes=data.nodes,
            edges=data.edges,
            jsx_code=jsx_code,  
            topic=topic_name, 
            topic_name=topic_name,
            topic_id=topic_id,
            narration=narration,
            narration_timestamps=narration_timestamps,
            animation_states=animation_states
        )
        
        logging.info(f"Successfully loaded visualization data and JSX code for topic: {topic_name}")
        return response_data
        
    except FileNotFoundError as e:
        error_msg = f"Visualization data not found for topic '{topic_name}' (ID: {topic_id}): {str(e)}"
        logging.error(error_msg)
        raise HTTPException(status_code=404, detail=error_msg)
    except Exception as e:
        error_msg = f"Error loading visualization for topic '{topic_name}' (ID: {topic_id}): {str(e)}"
        logging.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/api/narration/{topic}", response_model=NarrationData, tags=["Narration"])
async def generate_narration(topic: str, request: Request):
    try:
        topic_name = get_topic_name(topic)
        topic_id = topic  # Keep the original topic ID
        logging.info(f"Received narration request for topic ID: {topic_id}, mapped to: {topic_name}")
        
        # Validate topic
        valid_topics = ['schema', 'parallel_db', 'hierarchical', 'network', 'er', 'document', 'history', 'xml', 'entity', 'attribute', 'shared_memory', 'shared_disk', 'shared_nothing', 'distributed_database', 'oop_concepts', 'relational', 'relationalQuery', 'normalization', 'activedb', 'queryprocessing', 'mobiledb', 'gis', 'businesspolicy']
        if topic_name not in valid_topics:            
            raise HTTPException(status_code=400, detail=f"Invalid topic '{topic_name}' (ID: {topic_id})")

        # Get request body
        try:
            body = await request.json()
            logging.info(f"Request body: {body}")
        except json.JSONDecodeError as e:
            logging.error(f"JSON decode error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid JSON in request body: {str(e)}")

        text = body.get('text')
        if not text:
            logging.error("No text provided in request body")
            raise HTTPException(status_code=400, detail="Text is required in request body")

        # Make the narration more interactive and teacher-like if it's not already
        text = enhance_narration_text(text, topic_name)

        # Create a hash of the text to use as a unique identifier
        text_hash = hashlib.md5(text.encode()).hexdigest()
        cached_audio_filename = f'{topic_name}_narration_{text_hash}.mp3'
        cached_audio_path = AUDIO_DIR / cached_audio_filename

        # Check if audio file already exists
        if cached_audio_path.exists():
            logging.info(f"Found existing audio file: {cached_audio_filename}")
            
            # Calculate duration and generate word timings
            words = text.split()
            word_count = len(words)
            duration_ms = int((word_count / 150) * 60 * 1000)  # Convert to milliseconds

            # Load visualization data for node highlighting
            try:
                visualization_data = load_visualization_data(topic_name)
                nodes = visualization_data.nodes
            except Exception as e:
                logging.warning(f"Could not load visualization data for highlighting: {e}")
                nodes = []

            # Generate word timings
            word_timings = []
            current_time = 0
            
            for word in words:
                word_duration = (len(word) / 5) * (duration_ms / word_count)
                if word.endswith(('.', '!', '?', ',')):
                    word_duration *= 1.5
                
                node_id = find_node_for_word(word, nodes)
                
                timing = WordTiming(
                    word=word,
                    start_time=int(current_time),
                    end_time=int(current_time + word_duration),
                    node_id=node_id
                )
                
                word_timings.append(timing)
                current_time += word_duration

            # Construct the audio URL using the request base URL
            base_url = str(request.base_url)
            audio_url = f"{base_url}static/audio/{cached_audio_filename}"
            
            response_data = NarrationData(
                audio_url=audio_url,
                duration=int(current_time),
                word_timings=word_timings,
                script=text,
                topic=topic_name,
                topic_name=topic_name,
                topic_id=topic_id
            )
            logging.info(f"Using cached audio file: {audio_url}")
            return response_data

        logging.info(f"Generating new audio for topic {topic_name} with text length: {len(text)}")

        # Check for OpenAI API key
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            logging.error("OpenAI API key not configured")
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        logging.info("OpenAI API key found, proceeding with audio generation")

        try:
            # Import AsyncOpenAI client for realtime API
            from openai import AsyncOpenAI
            
            # Initialize AsyncOpenAI client
            async_client = AsyncOpenAI(api_key=api_key)
            
            # Generate audio using OpenAI's text-to-speech with realtime API
            logging.info("Calling OpenAI TTS API with realtime streaming...")
            
            # Collect audio chunks
            audio_chunks = []
            async for chunk in stream_text_to_speech(text, voice="alloy"):
                # Skip the header chunk which is JSON
                if isinstance(chunk, bytes) and not (chunk.startswith(b'{')):
                    audio_chunks.append(chunk)
            
            # Combine all chunks
            audio_content = b''.join(audio_chunks)
            
            # Save audio file with text hash
            logging.info(f"Saving audio to {cached_audio_path}")
            with open(cached_audio_path, 'wb') as f:
                f.write(audio_content)
            logging.info("Successfully saved audio file")
        except Exception as openai_error:
            logging.warning(f"OpenAI TTS failed: {str(openai_error)}. Falling back to gTTS.")
            try:
                # Fallback to gTTS
                from gtts import gTTS
                
                logging.info("Using gTTS as fallback for audio generation")
                tts = gTTS(text=text, lang='en', slow=False)
                logging.info(f"Saving gTTS audio to {cached_audio_path}")
                tts.save(str(cached_audio_path))
                logging.info("Successfully saved gTTS audio file")
            except Exception as gtts_error:
                logging.error(f"gTTS fallback also failed: {str(gtts_error)}")
                if cached_audio_path.exists():
                    cached_audio_path.unlink()
                raise HTTPException(status_code=500, detail=f"Error generating audio: {str(gtts_error)}")

        # Rest of the existing code for duration calculation and word timing generation
        words = text.split()
        word_count = len(words)
        duration_ms = int((word_count / 150) * 60 * 1000)

        try:
            visualization_data = load_visualization_data(topic_name)
            nodes = visualization_data.nodes
        except Exception as e:
            logging.warning(f"Could not load visualization data for highlighting: {e}")
            nodes = []

        # Generate word timings
        word_timings = []
        current_time = 0
        
        for word in words:
            word_duration = (len(word) / 5) * (duration_ms / word_count)
            if word.endswith(('.', '!', '?', ',')):
                word_duration *= 1.5
            
            node_id = find_node_for_word(word, nodes)
            
            timing = WordTiming(
                word=word,
                start_time=int(current_time),
                end_time=int(current_time + word_duration),
                node_id=node_id
            )
            
            word_timings.append(timing)
            current_time += word_duration

        # Construct the audio URL using the request base URL
        base_url = str(request.base_url)
        audio_url = f"{base_url}static/audio/{cached_audio_filename}"
        
        response_data = NarrationData(
            audio_url=audio_url,
            duration=int(current_time),
            word_timings=word_timings,
            script=text,
            topic=topic_name,
            topic_name=topic_name,
            topic_id=topic_id
        )
        logging.info(f"Audio URL generated: {audio_url}")
        return response_data

    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f'Unexpected error in narration endpoint: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/static/audio/{filename}")
async def serve_audio(filename: str):
    """Serve generated audio files"""
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        logging.error(f"Audio file not found: {file_path}")
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=filename
    )

@app.get("/api/highlights/{topic}/{timestamp}", tags=["Highlights"])
def get_highlights(topic: str, timestamp: int):
    """Get component highlights for a specific timestamp"""
    try:
        if topic not in ['schema', 'parallel_db', 'hierarchical', 'network', 'er', 'document', 'history', 'xml', 'entity', 'attribute', 'shared_memory', 'shared_disk', 'shared_nothing', 'distributed_database', 'oop_concepts', 'relational', 'relationalQuery', 'normalization', 'activedb', 'queryprocessing', 'mobiledb', 'gis', 'businesspolicy']:

            return JSONResponse(status_code=400, content={'error': 'Invalid topic'})
        # Load narration script to get component mappings and word timings
        script_data = load_narration_script(topic)
        component_mappings = script_data.get('component_mappings', {})
        
        # Generate word timings for the script
        script = script_data['script']
        audio_duration = 30000  # Placeholder duration
        word_timings = generate_word_timings(script, audio_duration)
        
        # Find words being spoken at the current timestamp
        active_components = set()
        for timing in word_timings:
            if timing.start_time <= timestamp <= timing.end_time:
                word_lower = timing.word.lower()
                if word_lower in component_mappings:
                    node_id = component_mappings[word_lower]
                    active_components.add(node_id)
        
        # Format response
        highlights = [
            {
                'node_id': node_id,
                'highlight_type': 'primary',
                'duration': 1000  # Duration to keep highlight visible
            }
            for node_id in active_components
        ]

        return jsonify({'active_components': highlights})

    except FileNotFoundError:
        return jsonify({'error': 'Component mapping not found'}), 404
    except Exception as e:
        logging.error(f'Error getting highlights: {e}')
        return jsonify({'error': 'Internal server error'}), 500

@app.post("/api/doubt", response_model=DoubtResponse)
async def handle_doubt(request: DoubtRequest):
    try:
        # Load the current visualization data
        try:
            topic_id = request.topic
            topic_name = get_topic_name(topic_id)
            current_data = load_visualization_data(topic_name)
            if not current_data:
                raise HTTPException(status_code=404, detail=f"Visualization data not found for topic: {topic_name} (ID: {topic_id})")
        except Exception as e:
            logging.error(f"Error loading visualization data: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error loading visualization data: {str(e)}")
        
        # Create a description of the visualization
        try:
            viz_description = f"This is a visualization of {topic_name} with the following components:\n"
            for node in current_data.nodes:
                node_desc = f"- {node.id}: {node.name}"
                if node.type:
                    node_desc += f" (type: {node.type})"
                viz_description += node_desc + "\n"
            
            # Add edge relationships
            viz_description += "\nRelationships between components:\n"
            for edge in current_data.edges:
                viz_description += f"- {edge.source} is connected to {edge.target}"
                if edge.type:
                    viz_description += f" ({edge.type})"
                viz_description += "\n"
        except Exception as e:
            logging.error(f"Error creating visualization description: {str(e)}")
            viz_description = f"A visualization about {topic_name}"

        # Prepare the context for the AI
        context = {
            "topic": topic_name,
            "topic_id": topic_id,
            "doubt": request.doubt,
            "current_time": request.current_time,
            "current_state": request.current_state or {},
            "visualization_description": viz_description
        }
        
        try:
            # Process the doubt using Claude
            response = anthropic_client.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=1000,
                temperature=0.7,
                system="""You are an expert in database visualization and education. You are a skilled teacher who engages students through interactive explanations. Your task is to:
1. Provide clear, concise explanations of database concepts
2. Identify relevant components in visualizations
3. Suggest visual highlights to emphasize important elements
4. Give brief practical examples
5. Ask thoughtful questions to check understanding

IMPORTANT: Keep your responses concise and focused. The total response should be under 300 words to ensure it can be converted to audio.

Format your response in JSON with these sections:
{
    "explanation": "Brief, clear explanation with 1-2 interactive questions",
    "additionalInfo": "Additional context and background (optional)",
    "componentDetails": {
        "componentName": "Brief details about this component (optional)"
    },
    "examples": ["Brief practical example (optional)"],
    "comprehensionQuestions": ["1-2 questions to check understanding"],
    "highlightElements": [
        {
            "id": "component_id",
            "type": "highlight",
            "emphasis": "normal|strong|subtle"
        }
    ]
}

Use a conversational, teacher-like tone throughout your explanation.
""",
                messages=[{
                    "role": "user",
                    "content": f"""I'm looking at a visualization about {topic_name} (ID: {topic_id}). Here's my question: {request.doubt}
                    
Visualization structure:
{viz_description}

Current state:
{json.dumps(context['current_state'], indent=2)}

Please help me understand this better by:
1. Providing a clear explanation
2. Suggesting which elements should be highlighted
3. If needed, suggesting modifications to the visualization
4. Including 1-2 questions to check my understanding

IMPORTANT: Keep your response under 300 words total to ensure it can be converted to audio."""
                }]
            )
            
            # Parse the AI response
            try:
                ai_response = json.loads(response.content[0].text)
            except json.JSONDecodeError:
                # Fallback to just using the explanation if JSON parsing fails
                ai_response = {
                    "explanation": response.content[0].text,
                    "highlights": [],
                    "modifications": None,
                    "new_narration": None
                }
        except Exception as e:
            logging.error(f"Error processing doubt with AI: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing doubt with AI: {str(e)}")
        
        try:
            # Prepare the response
            # Check if the response is already a JSON string and parse it if needed
            if isinstance(ai_response, str):
                try:
                    ai_response = json.loads(ai_response)
                except json.JSONDecodeError:
                    ai_response = {"explanation": ai_response}
            
            # Extract highlights from highlightElements if present
            highlights = []
            if "highlightElements" in ai_response:
                highlights = [item["id"] for item in ai_response["highlightElements"] if "id" in item]
            elif "highlights" in ai_response:
                highlights = ai_response["highlights"]
            
            # Prepare a formatted narration from the AI response
            formatted_narration = ""
            if "explanation" in ai_response:
                formatted_narration += ai_response["explanation"] + "\n\n"
            
            if "additionalInfo" in ai_response and ai_response["additionalInfo"]:
                formatted_narration += ai_response["additionalInfo"] + "\n\n"
                
            if "componentDetails" in ai_response and ai_response["componentDetails"]:
                formatted_narration += "Key Components:\n"
                for comp_name, comp_details in ai_response["componentDetails"].items():
                    details = comp_details if isinstance(comp_details, str) else comp_details.get("description", "")
                    formatted_narration += f"• {comp_name}: {details}\n"
                formatted_narration += "\n"
                
            if "examples" in ai_response and ai_response["examples"]:
                formatted_narration += "Examples:\n"
                for i, example in enumerate(ai_response["examples"]):
                    formatted_narration += f"{i+1}. {example}\n"
                formatted_narration += "\n"
                
            if "recommendations" in ai_response and ai_response["recommendations"]:
                formatted_narration += "Recommendations:\n"
                for rec in ai_response["recommendations"]:
                    formatted_narration += f"• {rec}\n"
            
            # Add comprehension questions
            if "comprehensionQuestions" in ai_response and ai_response["comprehensionQuestions"]:
                formatted_narration += "Check Your Understanding:\n"
                for question in ai_response["comprehensionQuestions"]:
                    formatted_narration += f"? {question}\n"
                formatted_narration += "\n"
            
            # Add reflection prompts
            if "reflectionPrompts" in ai_response and ai_response["reflectionPrompts"]:
                formatted_narration += "For Deeper Understanding:\n"
                for prompt in ai_response["reflectionPrompts"]:
                    formatted_narration += f"→ {prompt}\n"
            
            # Use the formatted narration or fallback to the original response
            narration_text = formatted_narration.strip() or ai_response.get("new_narration") or ai_response.get("explanation", "No explanation provided")
            
            doubt_response = DoubtResponse(
                narration=narration_text,
                highlights=highlights,
                jsx_code=current_data.jsx_code,
                topic=topic_name,  # Add the topic field with the topic name
                topic_name=topic_name,
                topic_id=topic_id
            )
            
            # Apply any suggested modifications to the visualization
            if ai_response.get("modifications"):
                try:
                    modified_data = apply_modifications(current_data.__dict__, ai_response["modifications"])
                    doubt_response.nodes = [VisualizationNode(**node) for node in modified_data["nodes"]]
                    doubt_response.edges = [VisualizationEdge(**edge) for edge in modified_data["edges"]]
                except Exception as e:
                    logging.error(f"Error applying modifications: {str(e)}")
                    # Continue without modifications if they fail
                
                # Generate new narration timestamps if needed
                if doubt_response.narration:
                    try:
                        doubt_response.narration_timestamps = generate_word_timings(
                            doubt_response.narration,
                            len(doubt_response.narration.split()) * 500 
                        )
                    except Exception as e:
                        logging.error(f"Error generating narration timestamps: {str(e)}")
            
            return doubt_response
            
        except Exception as e:
            logging.error(f"Error preparing doubt response: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error preparing doubt response: {str(e)}")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Unexpected error in doubt endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def apply_modifications(current_data: dict, modifications: dict) -> dict:
    """Apply modifications to the visualization data"""
    # Create a deep copy to avoid modifying the original data
    modified_data = json.loads(json.dumps(current_data))
    
    if modifications.get("nodes"):
        # Update existing nodes or add new ones
        node_map = {node["id"]: node for node in modified_data["nodes"]}
        for mod_node in modifications["nodes"]:
            if mod_node["id"] in node_map:
                node_map[mod_node["id"]].update(mod_node)
            else:
                modified_data["nodes"].append(mod_node)
    
    if modifications.get("edges"):
        # Update existing edges or add new ones
        edge_map = {(edge["source"], edge["target"]): edge for edge in modified_data["edges"]}
        for mod_edge in modifications["edges"]:
            key = (mod_edge["source"], mod_edge["target"])
            if key in edge_map:
                edge_map[key].update(mod_edge)
            else:
                modified_data["edges"].append(mod_edge)
    
    return modified_data

def find_node_for_word(word: str, nodes: List[VisualizationNode]) -> Optional[str]:
    """Find a node ID that matches the word being spoken"""
    word_lower = word.lower()
    
    # First try exact matches with node names
    for node in nodes:
        if node.name.lower() == word_lower:
            return node.id
            
    # Then try partial matches
    for node in nodes:
        if word_lower in node.name.lower():
            return node.id
            
    # Try matching with node types
    for node in nodes:
        if node.type and word_lower in node.type.lower():
            return node.id
            
    return None

@app.post("/api/process-doubt")
async def process_doubt(request: Request):
    try:
        data = await request.json()
        doubt = data.get('doubt')
        topic_id = data.get('topic')
        topic_name = get_topic_name(topic_id)
        current_state = data.get('currentState', {})
        relevant_nodes = data.get('relevantNodes', [])
        
        logging.info(f"Processing doubt for topic ID: {topic_id}, mapped to: {topic_name}")
        
        # Prepare visualization context
        visualization_context = f"""
Current Topic: {topic_name} (ID: {topic_id})
Current Visualization State:
- Highlighted Elements: {current_state.get('highlightedElements', [])}
- Current Time: {current_state.get('currentTime', 0)}ms
- Is Original Narration: {current_state.get('isOriginalNarration', True)}

Relevant Components:
{json.dumps(relevant_nodes, indent=2)}

Current Narration:
{current_state.get('currentNarration', '')}
"""

        # Import AsyncOpenAI client for realtime API
        from openai import AsyncOpenAI
        
        # Initialize AsyncOpenAI client
        async_client = AsyncOpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
        
        try:
            # Use the OpenAI API for chat completions (non-streaming for REST API)
            system_message = """You are an expert in database visualization and education. You are a skilled teacher who engages students through interactive explanations. Your task is to:
1. Provide clear, concise explanations of database concepts
2. Identify relevant components in visualizations
3. Suggest visual highlights to emphasize important elements
4. Give brief practical examples
5. Ask thoughtful questions to check understanding

IMPORTANT: Keep your responses concise and focused. The total response should be under 300 words to ensure it can be converted to audio.

Format your response in JSON with these sections:
{
    "explanation": "Brief, clear explanation with 1-2 interactive questions",
    "additionalInfo": "Additional context and background (optional)",
    "componentDetails": {
        "componentName": "Brief details about this component (optional)"
    },
    "examples": ["Brief practical example (optional)"],
    "comprehensionQuestions": ["1-2 questions to check understanding"],
    "highlightElements": [
        {
            "id": "component_id",
            "type": "highlight",
            "emphasis": "normal|strong|subtle"
        }
    ]
}

Use a conversational, teacher-like tone throughout your explanation.
"""
            user_message = f"""User Question: {doubt}

Visualization Context:
{visualization_context}

Please provide a concise response that:
1. Directly answers the user's question (be brief but thorough)
2. Explains only the most relevant concepts
3. References specific components in the visualization
4. Includes 1-2 questions to check understanding
5. Uses a conversational, teacher-like tone

IMPORTANT: Keep your response under 300 words total to ensure it can be converted to audio."""

            # Use the OpenAI API for chat completions (non-streaming for REST API)
            response = await async_client.chat.completions.create(
                model="gpt-4o-realtime-preview-2024-12-17",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            # Extract the response text
            response_text = response.choices[0].message.content
            
            # Parse the response as JSON
            try:
                ai_response = json.loads(response_text)
            except json.JSONDecodeError as json_error:
                logging.error(f"JSON parsing error: {str(json_error)}")
                logging.error(f"Response text: {response_text[:200]}...")
                # Fallback to basic response if JSON parsing fails
                ai_response = {
                    "explanation": response_text,
                    "highlightElements": []
                }

            # Enhance the response with additional processing
            enhanced_response = enhance_response(ai_response, topic_name, relevant_nodes)
            
            # Add topic information to the response
            enhanced_response["topic"] = topic_name
            enhanced_response["topic_name"] = topic_name
            enhanced_response["topic_id"] = topic_id
            
            return enhanced_response

        except Exception as e:
            logging.error(f"Error generating AI response: {str(e)}")
            logging.error(f"Error traceback: {traceback.format_exc()}")
            return {
                "error": f"Error generating response: {str(e)}"
            }
    
    except Exception as e:
        logging.error(f"Error in doubt endpoint: {str(e)}")
        return {
            "error": str(e)
        }

def enhance_response(ai_response: dict, topic: str, relevant_nodes: list) -> dict:
    """Enhance the AI response with additional processing"""
    enhanced = ai_response.copy()

    if "highlightElements" in enhanced:
        for i, highlight in enumerate(enhanced["highlightElements"]):
            highlight["duration"] = 2000  
            highlight["delay"] = i * 1000 

    if "componentDetails" in enhanced:
        for component, details in enhanced["componentDetails"].items():
            matching_node = next((node for node in relevant_nodes if node["id"] == component), None)
            if matching_node:
                enhanced["componentDetails"][component] = {
                    "description": details if isinstance(details, str) else details.get("description", str(details)),
                    "type": matching_node.get("type", "default"),
                    "properties": matching_node.get("properties", [])
                }

    # Add section for related concepts
    topic_name = get_topic_name(topic)  # Convert topic ID to name if needed
    if topic_name in TOPIC_RELATIONSHIPS:
        enhanced["relatedConcepts"] = TOPIC_RELATIONSHIPS[topic_name]

    # Add interactive elements suggestions
    enhanced["interactiveElements"] = suggest_interactive_elements(topic_name, enhanced.get("explanation", ""))
    
    # Add comprehension questions if not already present
    if "comprehensionQuestions" not in enhanced or not enhanced["comprehensionQuestions"]:
        enhanced["comprehensionQuestions"] = generate_comprehension_questions(topic_name, enhanced.get("explanation", ""))

    return enhanced

def suggest_interactive_elements(topic: str, explanation: str) -> list:
    """Suggest interactive elements based on the topic and explanation"""
    suggestions = []
    
    # Add zoom suggestions for complex diagrams
    if any(word in explanation.lower() for word in ["architecture", "structure", "layout"]):
        suggestions.append({
            "type": "zoom",
            "message": "You can zoom in to see more details of this component"
        })

    # Add click suggestions for components mentioned in explanation
    if any(word in explanation.lower() for word in ["click", "select", "choose"]):
        suggestions.append({
            "type": "click",
            "message": "Click on components to see more details"
        })

    # Add animation suggestions for process explanations
    if any(word in explanation.lower() for word in ["process", "flow", "sequence"]):
        suggestions.append({
            "type": "animate",
            "message": "Watch the animation to see how this process works"
        })

    return suggestions

def generate_comprehension_questions(topic: str, explanation: str) -> list:
    """Generate comprehension questions based on the topic and explanation"""
    questions = []
    
    # Generic questions based on topic
    topic_questions = {
        "schema": ["Can you identify the main components of a database schema?", 
                  "How does a schema help in organizing database structure?"],
        "parallel_db": ["What are the key advantages of parallel database processing?", 
                       "How do parallel databases improve performance?"],
        "hierarchical": ["How does data flow in a hierarchical database model?", 
                        "What are the limitations of hierarchical databases?"],
        "network": ["How does a network database differ from a hierarchical one?", 
                   "What problem does the network model solve?"],
        "er": ["Can you identify the entities and relationships in this diagram?", 
              "How would you represent a many-to-many relationship in an ER diagram?"],
        "document": ["What makes document databases different from relational databases?", 
                    "When would you choose a document database over a relational one?"],
        "relational": ["How do tables relate to each other in a relational database?", 
                      "What is the purpose of primary and foreign keys?"],
        "distributed_database": ["How does data consistency work in a distributed database?", 
                               "What are the trade-offs between consistency and availability?"],
        "shared_memory": ["How do multiple processors access shared memory?", 
                         "What synchronization issues might arise in shared memory systems?"],
        "shared_disk": ["What's the difference between shared disk and shared memory architectures?", 
                       "How does shared disk architecture handle concurrent access?"],
        "shared_nothing": ["Why is shared nothing architecture good for scalability?", 
                          "How does data partitioning work in shared nothing systems?"]
    }
    
    # Add topic-specific questions if available
    if topic in topic_questions:
        questions.extend(topic_questions[topic])
    
    # Add generic questions if we don't have enough
    if len(questions) < 2:
        generic_questions = [
            "Do you understand how these components interact with each other?",
            "Can you explain why this architecture is designed this way?",
            "What would happen if one of these components failed?",
            "How does this concept relate to what you already know about databases?",
            "Can you think of a real-world application for this concept?"
        ]
        # Add generic questions to reach at least 2 questions
        questions.extend(generic_questions[:max(0, 2 - len(questions))])

    return questions[:3]  # Return at most 3 questions

def enhance_narration_text(text: str, topic: str) -> str:
    """Enhance narration text with interactive, teacher-like elements"""
    # Only enhance if the text doesn't already have interactive elements
    if not any(phrase in text for phrase in 
              ["Do you understand", "Can you see", "What do you think", "Let's consider", "?"]):
        
        # Add interactive elements to the text
        paragraphs = text.split('\n\n')
        enhanced_paragraphs = []
        
        # Add interactive elements to appropriate paragraphs
        for i, paragraph in enumerate(paragraphs):
            enhanced_paragraph = paragraph
            
            # Add a question after the first paragraph
            if i == 0 and len(paragraphs) > 1:
                enhanced_paragraph += " Do you understand how this works?"
            
            # Add a reflective prompt in the middle
            elif i == len(paragraphs) // 2 and len(paragraphs) > 2:
                enhanced_paragraph += " What do you think would happen if we modified this component?"
            
            # Add a comprehension check near the end
            elif i == len(paragraphs) - 1 and len(paragraphs) > 1:
                enhanced_paragraph += " Can you see why this architecture is designed this way?"
            
            enhanced_paragraphs.append(enhanced_paragraph)
        
        # Add a final reflection prompt
        if len(paragraphs) > 0:
            enhanced_paragraphs.append("Take a moment to think about how this concept relates to other database architectures we've discussed.")
        
        # Update the text
        text = '\n\n'.join(enhanced_paragraphs)
    
    return text

# Topic relationships for suggesting related concepts
TOPIC_RELATIONSHIPS = {
    "shared_memory": [
        "parallel_processing",
        "cache_coherence",
        "memory_consistency",
        "distributed_systems"
    ],
    "distributed_database": [
        "data_replication",
        "consistency_models",
        "transaction_management",
        "distributed_query_processing"
    ],
    # Add more topics as needed
}

# WebSocket endpoints for real-time audio streaming
# These are being replaced by Socket.IO implementation in server.js
# Keeping these commented out for reference
# @app.websocket("/ws/narration/{topic}")
# async def websocket_narration(websocket: WebSocket, topic: str):
#     """
#     WebSocket endpoint for real-time audio narration streaming.
#     
#     Args:
#         websocket: The WebSocket connection
#         topic: The topic for narration
#     """
#     await handle_websocket_connection(websocket, topic)
# 
# @app.websocket("/ws/doubt")
# async def websocket_doubt(websocket: WebSocket):
#     """
#     WebSocket endpoint for real-time doubt handling.
#     
#     Args:
#         websocket: The WebSocket connection
#     """
#     await handle_doubt_websocket(websocket)
# 
# @app.websocket("/ws/test")
# async def websocket_test(websocket: WebSocket):
#     """
#     Simple WebSocket endpoint for testing connection.
#     
#     Args:
#         websocket: The WebSocket connection
#     """
#     logging.info("Test WebSocket connection received")
#     await websocket.accept()
#     logging.info("Test WebSocket connection accepted")
#     
#     try:
#         await websocket.send_json({"status": "connected", "message": "WebSocket connection successful"})
#         logging.info("Test message sent")
#     except Exception as e:
#         logging.error(f"Error in test WebSocket: {str(e)}")
#     finally:
#         await websocket.close()
#         logging.info("Test WebSocket connection closed")
# 
# @app.websocket("/ws/process-doubt")
# async def websocket_process_doubt(websocket: WebSocket):
#     """
#     WebSocket endpoint for real-time doubt processing with audio streaming.
#     """

async def generate_word_timings(text: str, audio_duration: int, nodes: List[Dict] = None) -> List[Dict]:
    """
    Generate word timings for text-to-speech synchronization.
    
    Args:
        text: The text to generate timings for
        audio_duration: The duration of the audio in milliseconds
        nodes: Optional list of nodes for highlighting
        
    Returns:
        List of word timing objects
    """
    words = text.split()
    word_count = len(words)
    word_timings = []
    current_time = 0
    
    for word in words:
        word_duration = (len(word) / 5) * (audio_duration / word_count)
        if word.endswith(('.', '!', '?', ',')):
            word_duration *= 1.5
        
        node_id = None
        if nodes:
            word_lower = word.lower()
            for node in nodes:
                if node.get('name', '').lower() == word_lower or word_lower in node.get('name', '').lower():
                    node_id = node.get('id')
                    break
        
        timing = {
            "word": word,
            "start_time": int(current_time),
            "end_time": int(current_time + word_duration),
            "node_id": node_id
        }
        
        word_timings.append(timing)
        current_time += word_duration
    
    return word_timings

@app.get("/src/components/{file_path:path}")
async def get_jsx_component(file_path: str):
    """Serve JSX component files from the src/components directory"""
    file_path = Path("src/components") / file_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Component file not found: {file_path}")
    
    content = file_path.read_text()
    return Response(content=content, media_type="application/javascript")

if __name__ == "__main__":
    import uvicorn
    import argparse
    import sys
    import json
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Database Visualization API')
    parser.add_argument('--topic', type=str, help='Topic to generate visualization for')
    args = parser.parse_args()
    
    # If --topic is provided, generate visualization and print to stdout
    if args.topic:
        try:
            visualization_data = load_visualization_data(args.topic)
            # Convert to dict using dict() or model_dump() based on Pydantic version
            try:
                data_dict = visualization_data.model_dump()
            except AttributeError:
                data_dict = visualization_data.dict()
            print(json.dumps(data_dict))
            sys.exit(0)
        except Exception as e:
            print(f"Error generating visualization: {str(e)}", file=sys.stderr)
            sys.exit(1)
    else:
        # Otherwise, run the FastAPI app
        uvicorn.run(app, host="127.0.0.1", port=8000)
