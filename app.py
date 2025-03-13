#app.py
from pydantic import BaseModel, Field
from openai import OpenAI, AsyncOpenAI
import os
from dotenv import load_dotenv
import logging
import json
import argparse
import sys
from typing import List, Optional, Union, Generator
from pathlib import Path
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Define data models
class VisualizationNode(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    attributes: Optional[List[dict]] = None

class VisualizationEdge(BaseModel):
    source: str
    target: str
    type: str
    description: Optional[str] = None

class WordTiming(BaseModel):
    word: str
    start_time: int = Field(description="Time in milliseconds from start")
    end_time: int = Field(description="Time in milliseconds from start")
    node_id: Optional[Union[str, List[str]]] = Field(None, description="ID of the node(s) to highlight")

class VisualizationData(BaseModel):
    nodes: List[VisualizationNode]
    edges: List[VisualizationEdge]
    topic: str
    narration: Optional[str] = None
    narration_timestamps: Optional[List[WordTiming]] = None

class DoubtResponse(BaseModel):
    narration: Optional[str] = None
    narration_timestamps: Optional[List[WordTiming]] = None
    highlights: Optional[List[str]] = None

# Helper functions
def generate_word_timings(text: str) -> List[WordTiming]:
    """Generate simple word timings for narration."""
    words = text.split()
    total_duration = len(words) * 500  # Approximate 500ms per word
    
    timings = []
    current_time = 0
    
    for word in words:
        word_duration = len(word) * 30 + 200  # Longer words take more time
        
        timing = WordTiming(
            word=word,
            start_time=current_time,
            end_time=current_time + word_duration
        )
        
        timings.append(timing)
        current_time += word_duration
    
    return timings

def load_visualization_data(topic: str) -> VisualizationData:
    """Load visualization data for a given topic."""
    try:
        # For the ER model, return a simple mock dataset
        if topic == 'er':
            # Create a simple ER diagram with entities and relationships
            nodes = [
                VisualizationNode(
                    id="student",
                    name="Student",
                    type="entity",
                    attributes=[
                        {"name": "student_id", "isKey": True},
                        {"name": "name", "isKey": False},
                        {"name": "email", "isKey": False}
                    ]
                ),
                VisualizationNode(
                    id="course",
                    name="Course",
                    type="entity",
                    attributes=[
                        {"name": "course_id", "isKey": True},
                        {"name": "title", "isKey": False},
                        {"name": "credits", "isKey": False}
                    ]
                ),
                VisualizationNode(
                    id="enrollment",
                    name="Enrolls",
                    type="relationship"
                )
            ]
            
            edges = [
                VisualizationEdge(
                    source="student",
                    target="enrollment",
                    type="participates"
                ),
                VisualizationEdge(
                    source="enrollment",
                    target="course",
                    type="participates"
                )
            ]
            
            # Create a simple narration
            narration = "This Entity-Relationship diagram shows a Student entity connected to a Course entity through an Enrollment relationship. Each Student has attributes like student_id (primary key), name, and email. Each Course has attributes like course_id (primary key), title, and credits. The Enrollment relationship represents how students enroll in courses."
            
            # Generate simple word timings
            narration_timestamps = generate_word_timings(narration)
            
            return VisualizationData(
                nodes=nodes,
                edges=edges,
                topic=topic,
                narration=narration,
                narration_timestamps=narration_timestamps
            )
        
        # For Document Database visualization
        elif topic == 'document':
            nodes = [
                VisualizationNode(
                    id="user_collection",
                    name="Users Collection",
                    type="collection",
                    document={
                        "_id": "user123",
                        "name": "John Doe",
                        "email": "john@example.com",
                        "preferences": {
                            "theme": "dark",
                            "notifications": True
                        },
                        "posts": [
                            {"id": "post1", "title": "First Post"},
                            {"id": "post2", "title": "Second Post"}
                        ]
                    }
                ),
                VisualizationNode(
                    id="post_collection",
                    name="Posts Collection",
                    type="collection",
                    document={
                        "_id": "post1",
                        "title": "First Post",
                        "content": "This is the content of the first post",
                        "author_id": "user123",
                        "comments": [
                            {"user_id": "user456", "text": "Great post!"},
                            {"user_id": "user789", "text": "Thanks for sharing"}
                        ],
                        "tags": ["database", "nosql", "document"]
                    }
                )
            ]
            
            edges = [
                VisualizationEdge(
                    source="user_collection",
                    target="post_collection",
                    type="reference",
                    description="User -> Posts"
                )
            ]
            
            narration = "This Document Database visualization shows two collections: Users and Posts. The Users collection contains documents with embedded arrays and nested objects, demonstrating the flexible schema of document databases. The Posts collection references users and contains embedded comments, showing how document databases can model relationships without formal joins."
            
            narration_timestamps = generate_word_timings(narration)
            
            return VisualizationData(
                nodes=nodes,
                edges=edges,
                topic=topic,
                narration=narration,
                narration_timestamps=narration_timestamps
            )
            
        # For Hierarchical Database visualization
        elif topic == 'hierarchical':
            nodes = [
                VisualizationNode(
                    id="root",
                    name="University",
                    type="root"
                ),
                VisualizationNode(
                    id="department1",
                    name="Computer Science",
                    type="branch"
                ),
                VisualizationNode(
                    id="department2",
                    name="Mathematics",
                    type="branch"
                ),
                VisualizationNode(
                    id="course1",
                    name="Database Systems",
                    type="leaf"
                ),
                VisualizationNode(
                    id="course2",
                    name="Algorithms",
                    type="leaf"
                ),
                VisualizationNode(
                    id="course3",
                    name="Calculus",
                    type="leaf"
                )
            ]
            
            edges = [
                VisualizationEdge(
                    source="root",
                    target="department1",
                    type="parent-child"
                ),
                VisualizationEdge(
                    source="root",
                    target="department2",
                    type="parent-child"
                ),
                VisualizationEdge(
                    source="department1",
                    target="course1",
                    type="parent-child"
                ),
                VisualizationEdge(
                    source="department1",
                    target="course2",
                    type="parent-child"
                ),
                VisualizationEdge(
                    source="department2",
                    target="course3",
                    type="parent-child"
                )
            ]
            
            narration = "This Hierarchical Database visualization shows a university structure with departments and courses. The University is the root node, with Computer Science and Mathematics as branch nodes. Each department has courses as leaf nodes. This tree-like structure demonstrates how hierarchical databases organize data in parent-child relationships."
            
            narration_timestamps = generate_word_timings(narration)
            
            return VisualizationData(
                nodes=nodes,
                edges=edges,
                topic=topic,
                narration=narration,
                narration_timestamps=narration_timestamps
            )
            
        # For other topics, create a generic visualization with appropriate structure
        else:
            # Generic visualization with a few nodes and edges
            nodes = [
                VisualizationNode(
                    id=f"{topic}_node1",
                    name=f"{topic.capitalize()} Node 1",
                    type="generic"
                ),
                VisualizationNode(
                    id=f"{topic}_node2",
                    name=f"{topic.capitalize()} Node 2",
                    type="generic"
                ),
                VisualizationNode(
                    id=f"{topic}_node3",
                    name=f"{topic.capitalize()} Node 3",
                    type="generic"
                )
            ]
            
            edges = [
                VisualizationEdge(
                    source=f"{topic}_node1",
                    target=f"{topic}_node2",
                    type="connection"
                ),
                VisualizationEdge(
                    source=f"{topic}_node2",
                    target=f"{topic}_node3",
                    type="connection"
                )
            ]
            
            narration = f"This is a visualization of a {topic.replace('_', ' ')} database model. It shows three nodes connected in a simple structure. In a real implementation, this would contain more detailed information specific to the {topic.replace('_', ' ')} model."
            
            narration_timestamps = generate_word_timings(narration)
            
            return VisualizationData(
                nodes=nodes,
                edges=edges,
                topic=topic,
                narration=narration,
                narration_timestamps=narration_timestamps
            )
    
    except Exception as e:
        logger.error(f"Error loading visualization data for {topic}: {str(e)}")
        # Return a minimal valid response instead of raising an exception
        return VisualizationData(
            nodes=[VisualizationNode(id="error", name="Error", type="error")],
            edges=[],
            topic=topic,
            narration=f"Error loading visualization: {str(e)}"
        )

def process_doubt(topic: str, doubt: str, stream=False) -> Union[DoubtResponse, Generator]:
    """Process a doubt about a visualization.
    
    Args:
        topic: The visualization topic
        doubt: The user's doubt or question
        stream: If True, return a generator that yields response chunks
        
    Returns:
        Either a DoubtResponse object or a generator yielding response chunks
    """
    try:
        # Load the visualization data
        viz_data = load_visualization_data(topic)
        
        # Try to use OpenAI to generate a response
        try:
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            # Prepare the prompt
            prompt = f"""
            Topic: {topic}
            Doubt: {doubt}
            
            Visualization data:
            Nodes: {viz_data.nodes}
            Edges: {viz_data.edges}
            
            Please provide a clear explanation addressing this doubt about the visualization.
            """
            
            # Find relevant nodes to highlight
            highlights = []
            for node in viz_data.nodes:
                if node.name.lower() in doubt.lower() or node.id.lower() in doubt.lower():
                    highlights.append(node.id)
            
            if stream:
                # Return a generator that yields response chunks
                def response_generator():
                    try:
                        # Create a streaming response
                        stream_response = client.chat.completions.create(
                            model="gpt-3.5-turbo",
                            messages=[
                                {"role": "system", "content": "You are a helpful assistant explaining database visualizations."},
                                {"role": "user", "content": prompt}
                            ],
                            stream=True
                        )
                        
                        # Collect the full response for word timings
                        full_response = ""
                        text_buffer = ""
                        audio_buffer_size = 50  # Characters before generating audio
                        
                        # Yield each chunk as it comes in
                        for chunk in stream_response:
                            if chunk.choices[0].delta.content:
                                content = chunk.choices[0].delta.content
                                full_response += content
                                text_buffer += content
                                
                                # Send text chunk immediately
                                yield {
                                    "type": "chunk",
                                    "content": content,
                                    "highlights": highlights
                                }
                                
                                # If we have enough text, generate audio
                                if len(text_buffer) >= audio_buffer_size:
                                    # Generate audio for the buffer
                                    audio_response = client.audio.speech.create(
                                        model="tts-1",
                                        voice="alloy",
                                        input=text_buffer,
                                        response_format="mp3"
                                    )
                                    
                                    # Yield audio chunk
                                    yield {
                                        "type": "audio_chunk",
                                        "audio_data": audio_response.content.hex(),
                                        "text": text_buffer
                                    }
                                    
                                    # Clear the buffer
                                    text_buffer = ""
                        
                        # Generate audio for any remaining text
                        if text_buffer:
                            try:
                                audio_response = client.audio.speech.create(
                                    model="tts-1",
                                    voice="alloy",
                                    input=text_buffer,
                                    response_format="mp3"
                                )
                                
                                yield {
                                    "type": "audio_chunk",
                                    "audio_data": audio_response.content.hex(),
                                    "text": text_buffer
                                }
                            except Exception as e:
                                logger.error(f"Error generating final audio chunk: {str(e)}")
                        
                        # Generate word timings for the full response
                        narration_timestamps = generate_word_timings(full_response)
                        
                        # Send word timings in smaller chunks to avoid large JSON objects
                        if narration_timestamps:
                            # Split the timestamps into chunks of 20
                            timestamp_chunks = [narration_timestamps[i:i+20] for i in range(0, len(narration_timestamps), 20)]
                            
                            # Send each chunk separately
                            for i, chunk in enumerate(timestamp_chunks):
                                yield {
                                    "type": "timing_chunk",
                                    "chunk_index": i,
                                    "total_chunks": len(timestamp_chunks),
                                    "timestamps": [t.model_dump() for t in chunk]
                                }
                        
                        # Yield the complete response without timestamps
                        yield {
                            "type": "complete",
                            "narration": full_response,
                            "highlights": highlights
                        }
                    except Exception as e:
                        logger.error(f"Error in streaming response: {str(e)}")
                        yield {
                            "type": "error",
                            "content": f"Error generating response: {str(e)}"
                        }
                
                return response_generator()
            else:
                # Get the response (non-streaming)
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant explaining database visualizations."},
                        {"role": "user", "content": prompt}
                    ]
                )
                
                narration = response.choices[0].message.content
                
                # Generate word timings
                narration_timestamps = generate_word_timings(narration)
                
                return DoubtResponse(
                    narration=narration,
                    narration_timestamps=narration_timestamps,
                    highlights=highlights
                )
        except Exception as api_error:
            logger.error(f"OpenAI API error: {str(api_error)}")
            # Fallback to a generic response
            narration = f"I couldn't process your question about '{doubt}' due to a technical issue. The visualization shows {len(viz_data.nodes)} nodes and {len(viz_data.edges)} edges representing a {topic} diagram."
            
            if stream:
                def error_generator():
                    yield {
                        "type": "error",
                        "content": narration
                    }
                return error_generator()
            else:
                # Generate word timings
                narration_timestamps = generate_word_timings(narration)
                
                return DoubtResponse(
                    narration=narration,
                    narration_timestamps=narration_timestamps,
                    highlights=[]
                )
    
    except Exception as e:
        logger.error(f"Error processing doubt: {str(e)}")
        # Return a valid response even in case of error
        error_message = f"Sorry, I couldn't process your question about '{doubt}'. Please try again or ask a different question."
        
        if stream:
            def error_generator():
                yield {
                    "type": "error",
                    "content": error_message
                }
            return error_generator()
        else:
            return DoubtResponse(
                narration=error_message,
                narration_timestamps=[],
                highlights=[]
            )

async def generate_streaming_audio(text, chunk_size=100):
    """Generate audio in chunks for streaming."""
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # Split text into chunks for audio generation
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        current_chunk.append(word)
        current_length += len(word) + 1  # +1 for space
        
        if current_length >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_length = 0
    
    # Add any remaining words
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    # Generate audio for each chunk
    for chunk_text in chunks:
        try:
            response = await client.audio.speech.create(
                model="tts-1",
                voice="alloy",  # You can make this configurable
                input=chunk_text,
                response_format="mp3"
            )
            
            # Return the audio data
            yield {
                "type": "audio_chunk",
                "audio_data": response.content.hex(),  # Convert binary to hex string for JSON
                "text": chunk_text
            }
        except Exception as e:
            logger.error(f"Error generating audio: {str(e)}")
            yield {
                "type": "error",
                "content": f"Error generating audio: {str(e)}"
            }

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Generate visualization data')
    parser.add_argument("--topic", help="Topic to visualize")
    parser.add_argument("--doubt", help="Doubt to process")
    parser.add_argument("--stream", action="store_true", help="Use streaming mode for responses")
    args = parser.parse_args()
    
    try:
        if args.topic and args.doubt:
            # Process doubt
            if args.stream:
                # In streaming mode, print each chunk as it comes in
                for chunk in process_doubt(args.topic, args.doubt, stream=True):
                    # Ensure each JSON object is on its own line with a clear delimiter
                    json_str = json.dumps(chunk)
                    print(f"JSON_OBJECT_START{json_str}JSON_OBJECT_END", flush=True)
                    sys.stdout.flush()
            else:
                # In non-streaming mode, print the complete response
                result = process_doubt(args.topic, args.doubt)
                print(json.dumps(result.model_dump()), flush=True)
        elif args.topic:
            # Generate visualization data
            result = load_visualization_data(args.topic)
            print(json.dumps(result.model_dump()), flush=True)
        else:
            parser.print_help()
    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
