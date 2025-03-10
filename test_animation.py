import json
from animation_generator import AnimationGenerator
from pathlib import Path
import os
from dotenv import load_dotenv

def test_animation_generation():
    # Load environment variables
    load_dotenv()
    
    # Initialize generator
    generator = AnimationGenerator(api_key=os.getenv('OPENAI_API_KEY'))
    
    # Load test data
    data_path = Path('static/data/shared_memory_visualization.json')
    script_path = Path('static/data/shared_memory_script.json')
    
    with open(data_path) as f:
        visualization_data = json.load(f)
    
    with open(script_path) as f:
        script_data = json.load(f)
    
    # Generate animation timestamps
    animation_steps = generator.generate_animation_timestamps(
        narration=script_data['script'],
        visualization_data=visualization_data
    )
    
    # Print results
    print("\nGenerated Animation Steps:")
    for step in animation_steps:
        print(f"\nTimestamp: {step['timestamp']}s")
        print(f"Nodes to highlight: {step['nodeIds']}")
        print(f"Duration: {step['duration']}s")
        print(f"Transition: {step['transition']}")
    
    # Save results for inspection
    output_path = Path('test_output.json')
    with open(output_path, 'w') as f:
        json.dump({
            'input_narration': script_data['script'],
            'animation_steps': animation_steps
        }, f, indent=2)
    
    print(f"\nSaved detailed results to {output_path}")

if __name__ == "__main__":
    test_animation_generation()
