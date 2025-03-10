from typing import List, Dict, Any
import openai
import json
import os

class AnimationGenerator:
    def __init__(self, api_key: str = None):
        """Initialize the AnimationGenerator with OpenAI API key."""
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        openai.api_key = self.api_key

    def generate_animation_timestamps(self, narration: str, visualization_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate animation timestamps based on narration and visualization data."""
        prompt = self._create_prompt(narration, visualization_data)
        
        try:
            client = openai.OpenAI()
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{
                    "role": "system",
                    "content": """You are an expert at creating synchronized animations for database visualizations.
                    Your task is to analyze the narration and create precise timestamps for highlighting visualization components.
                    Output should be a JSON array of animation steps, each with:
                    - timestamp: time in seconds when the highlight should occur
                    - nodeIds: array of node IDs to highlight
                    - duration: how long the highlight should last in seconds
                    - transition: transition effect (e.g., "fade", "instant")"""
                }, {
                    "role": "user",
                    "content": prompt
                }],
                temperature=0.2,
                max_tokens=1000
            )
            
            # Extract and validate the generated timestamps
            animation_data = self._parse_response(response.choices[0].message.content)
            return self._validate_timestamps(animation_data, visualization_data)
        except Exception as e:
            print(f"Error generating animation timestamps: {e}")
            return []

    def _create_prompt(self, narration: str, visualization_data: Dict[str, Any]) -> str:
        """Create a detailed prompt for the OpenAI model."""
        nodes = visualization_data.get("nodes", [])
        node_descriptions = [f"- {node['id']}: {node['name']} (type: {node['type']})" 
                           for node in nodes]
        
        return f"""Given the following visualization components and narration, 
        create precise animation timestamps for highlighting components.

        Available Components:
        {chr(10).join(node_descriptions)}

        Narration:
        {narration}

        Create a JSON array of animation steps that synchronize with this narration.
        Each step should specify:
        1. When to highlight components (timestamp in seconds)
        2. Which components to highlight (array of node IDs)
        3. How long to maintain the highlight (duration in seconds)
        4. Transition effect to use

        Example format:
        [
            {{
                "timestamp": 0.0,
                "nodeIds": ["cpu1"],
                "duration": 2.0,
                "transition": "fade"
            }},
            ...
        ]"""

    def _parse_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse and validate the OpenAI response."""
        try:
            # Extract JSON from the response text
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No valid JSON array found in response")
            
            json_str = response_text[start_idx:end_idx]
            animation_data = json.loads(json_str)
            
            if not isinstance(animation_data, list):
                raise ValueError("Response is not a list of animation steps")
                
            return animation_data
        except json.JSONDecodeError as e:
            print(f"Error parsing response: {e}")
            return []

    def _validate_timestamps(self, animation_data: List[Dict[str, Any]], 
                           visualization_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate the generated timestamps against visualization data."""
        valid_node_ids = {node["id"] for node in visualization_data.get("nodes", [])}
        
        validated_steps = []
        for step in animation_data:
            if not all(key in step for key in ["timestamp", "nodeIds", "duration", "transition"]):
                continue
                
            valid_nodes = [node_id for node_id in step["nodeIds"] if node_id in valid_node_ids]
            if not valid_nodes:
                continue
                
            if not isinstance(step["timestamp"], (int, float)) or not isinstance(step["duration"], (int, float)):
                continue
                
            validated_step = {
                "timestamp": float(step["timestamp"]),
                "nodeIds": valid_nodes,
                "duration": float(step["duration"]),
                "transition": step["transition"]
            }
            validated_steps.append(validated_step)
            
        return sorted(validated_steps, key=lambda x: x["timestamp"])
