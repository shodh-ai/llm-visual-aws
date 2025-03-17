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

def process_doubt(topic: str, doubt: str, current_state=None, stream=False) -> Union[DoubtResponse, Generator]:
    """Process a doubt about a visualization topic."""
    try:
        # Load visualization data for context
        visualization_data = load_visualization_data(topic)
        
        # Initialize OpenAI client
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Define the function for highlighting elements
        functions = [
            {
                "name": "highlight_elements",
                "description": "Highlight specific elements in the visualization to explain concepts",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "element_ids": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "description": "IDs of the elements to highlight in the visualization"
                        },
                        "explanation": {
                            "type": "string",
                            "description": "Explanation of the highlighted elements and how they relate to the doubt"
                        }
                    },
                    "required": ["element_ids", "explanation"]
                }
            }
        ]
        
        # Prepare the messages for the API call
        messages = [
            {"role": "system", "content": f"""You are an AI assistant helping students understand database concepts through visualizations.
            
            The current visualization is about: {topic.replace('_', ' ').title()}
            
            You have access to the following visualization data:
            - Nodes: {[{"id": node.id, "name": node.name, "type": node.type} for node in visualization_data.nodes]}
            - Edges: {[{"source": edge.source, "target": edge.target, "type": edge.type} for edge in visualization_data.edges]}
            
            When answering questions, use the highlight_elements function to highlight relevant parts of the visualization.
            Be specific about which elements should be highlighted to help the student understand the concept.
            """},
            {"role": "user", "content": doubt}
        ]
        
        # Add current state context if available
        if current_state:
            highlighted_elements = current_state.get("highlighted_elements", [])
            if highlighted_elements:
                messages.append({
                    "role": "system", 
                    "content": f"The student is currently looking at these highlighted elements: {highlighted_elements}"
                })
        
        # Make the API call with function calling
        if stream:
            def response_generator():
                try:
                    # Stream the response
                    response_stream = client.chat.completions.create(
                        model="gpt-4",
                        messages=messages,
                        functions=functions,
                        function_call="auto",
                        stream=True
                    )
                    
                    # Variables to collect the streamed response
                    collected_messages = []
                    function_name = None
                    function_args = ""
                    
                    # Process the streamed response
                    for chunk in response_stream:
                        if chunk.choices[0].delta.function_call:
                            # Handle function call
                            if function_name is None and chunk.choices[0].delta.function_call.name:
                                function_name = chunk.choices[0].delta.function_call.name
                                yield json.dumps({"type": "function_call_start", "function": function_name}) + "\n"
                            
                            if chunk.choices[0].delta.function_call.arguments:
                                function_args += chunk.choices[0].delta.function_call.arguments
                                # Don't yield partial JSON as it might be invalid
                        elif chunk.choices[0].delta.content:
                            # Handle regular content
                            content = chunk.choices[0].delta.content
                            collected_messages.append(content)
                            yield json.dumps({"type": "content", "content": content}) + "\n"
                    
                    # Process function call if it was made
                    highlights = []
                    explanation = ""
                    
                    if function_name == "highlight_elements" and function_args:
                        try:
                            args = json.loads(function_args)
                            highlights = args.get("element_ids", [])
                            explanation = args.get("explanation", "")
                            
                            # Generate word timings with node_id for highlighting
                            narration_timestamps = []
                            if explanation:
                                # Basic word timing generation
                                words = explanation.split()
                                current_time = 0
                                
                                # Distribute highlights across the explanation
                                highlight_indices = []
                                if highlights:
                                    # Distribute highlight points evenly through the explanation
                                    step = len(words) // (len(highlights) + 1)
                                    for i in range(len(highlights)):
                                        highlight_indices.append((i + 1) * step)
                                
                                for i, word in enumerate(words):
                                    word_duration = len(word) * 30 + 200  # Longer words take more time
                                    
                                    # Determine if this word should trigger a highlight
                                    node_id = None
                                    if highlight_indices and i in highlight_indices:
                                        highlight_index = highlight_indices.index(i)
                                        if highlight_index < len(highlights):
                                            node_id = highlights[highlight_index]
                                    
                                    timing = WordTiming(
                                        word=word,
                                        start_time=current_time,
                                        end_time=current_time + word_duration,
                                        node_id=node_id
                                    )
                                    
                                    narration_timestamps.append(timing)
                                    current_time += word_duration
                            
                            # Yield the final response with highlights
                            yield json.dumps({
                                "type": "final",
                                "narration": explanation,
                                "highlights": highlights,
                                "narration_timestamps": [t.dict() for t in narration_timestamps]
                            }) + "\n"
                        except json.JSONDecodeError:
                            # Handle invalid JSON in function arguments
                            yield json.dumps({
                                "type": "error",
                                "error": "Invalid function arguments"
                            }) + "\n"
                    else:
                        # If no function call was made, use the collected messages
                        full_response = "".join(collected_messages)
                        narration_timestamps = generate_word_timings(full_response)
                        
                        yield json.dumps({
                            "type": "final",
                            "narration": full_response,
                            "highlights": [],
                            "narration_timestamps": [t.dict() for t in narration_timestamps]
                        }) + "\n"
                        
                except Exception as e:
                    logger.error(f"Error in streaming response: {str(e)}")
                    yield json.dumps({"type": "error", "error": str(e)}) + "\n"
            
            return response_generator()
        else:
            # Non-streaming response
            response = client.chat.completions.create(
                model="gpt-4",
                messages=messages,
                functions=functions,
                function_call="auto"
            )
            
            # Process the response
            message = response.choices[0].message
            
            # Check if a function was called
            highlights = []
            explanation = ""
            
            if message.function_call and message.function_call.name == "highlight_elements":
                try:
                    args = json.loads(message.function_call.arguments)
                    highlights = args.get("element_ids", [])
                    explanation = args.get("explanation", "")
                except json.JSONDecodeError:
                    # Handle invalid JSON
                    explanation = "I couldn't process the highlighting function. " + (message.content or "")
            else:
                # Use the regular content if no function was called
                explanation = message.content
            
            # Generate word timings with node_id for highlighting
            narration_timestamps = []
            if explanation:
                # Basic word timing generation
                words = explanation.split()
                current_time = 0
                
                # Distribute highlights across the explanation
                highlight_indices = []
                if highlights:
                    # Distribute highlight points evenly through the explanation
                    step = len(words) // (len(highlights) + 1)
                    for i in range(len(highlights)):
                        highlight_indices.append((i + 1) * step)
                
                for i, word in enumerate(words):
                    word_duration = len(word) * 30 + 200  # Longer words take more time
                    
                    # Determine if this word should trigger a highlight
                    node_id = None
                    if highlight_indices and i in highlight_indices:
                        highlight_index = highlight_indices.index(i)
                        if highlight_index < len(highlights):
                            node_id = highlights[highlight_index]
                    
                    timing = WordTiming(
                        word=word,
                        start_time=current_time,
                        end_time=current_time + word_duration,
                        node_id=node_id
                    )
                    
                    narration_timestamps.append(timing)
                    current_time += word_duration
            
            # Return the response
            return DoubtResponse(
                narration=explanation,
                narration_timestamps=narration_timestamps,
                highlights=highlights
            )
    
    except Exception as e:
        logger.error(f"Error processing doubt: {str(e)}")
        if stream:
            def error_generator():
                yield json.dumps({"type": "error", "error": str(e)}) + "\n"
            return error_generator()
        else:
            return DoubtResponse(
                narration=f"Sorry, I encountered an error: {str(e)}",
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
    """Main entry point for the application."""
    parser = argparse.ArgumentParser(description='Generate visualization data')
    parser.add_argument('--topic', type=str, help='Visualization topic')
    parser.add_argument('--doubt', action='store_true', help='Process a doubt')
    args = parser.parse_args()
    
    if args.doubt and args.topic:
        # Process a doubt from stdin
        try:
            # Read the doubt request from stdin
            doubt_request = json.loads(sys.stdin.read())
            
            # Extract the doubt and current state
            doubt = doubt_request.get('doubt', '')
            current_state = doubt_request.get('current_state', {})
            
            # Process the doubt
            response = process_doubt(args.topic, doubt, current_state)
            
            # Print the response as JSON
            print(json.dumps(response.dict() if hasattr(response, 'dict') else response))
        except Exception as e:
            logger.error(f"Error processing doubt from stdin: {str(e)}")
            print(json.dumps({
                "error": str(e),
                "narration": f"Sorry, I encountered an error: {str(e)}",
                "narration_timestamps": [],
                "highlights": []
            }))
    elif args.topic:
        # Generate visualization data for the topic
        try:
            visualization_data = load_visualization_data(args.topic)
            print(visualization_data.json())
        except Exception as e:
            logger.error(f"Error generating visualization data: {str(e)}")
            print(json.dumps({"error": str(e)}))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
