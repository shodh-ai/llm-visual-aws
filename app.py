from flask import Flask, render_template, request, jsonify, send_from_directory
from anthropic import Anthropic, HUMAN_PROMPT, AI_PROMPT
import os
from dotenv import load_dotenv
import logging
import json

logging.basicConfig(level=logging.INFO)
load_dotenv()

app = Flask(__name__, static_folder='static')

@app.route('/static/js/<path:filename>')
def serve_static(filename):
    return send_from_directory('static/js', filename)

client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze_schema', methods=['POST'])
def analyze_schema():
    try:
        prompt = request.json.get('prompt')
        if not prompt:
            return jsonify({
                'error': 'Please provide a question about database design.'
            }), 400
        
        # Generate schema analysis instructions based on user prompt
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",
            system="You are a database design expert. Generate instructions for analyzing a sample e-commerce database schema.",
            messages=[{
                "role": "user",
                "content": f"""Analyze the following e-commerce database schema:

Tables:
- Users (id, username, email, created_at)
- Orders (id, user_id, total_amount, status, created_at)
- OrderItems (id, order_id, product_id, quantity, unit_price)
- Products (id, name, description, price, stock)

Based on this prompt: {prompt}

Provide TWO things:
1. A clear explanation of the database schema analysis
2. A JSON array with visualization instructions

Valid instruction types:
1. 'highlight': Highlight specific tables
   {{
     "type": "highlight",
     "tables": ["Orders", "OrderItems"],
     "description": "Optional description of what's being highlighted"
   }}

2. 'connect': Show relationship between two tables
   {{
     "type": "connect",
     "tables": ["Orders", "OrderItems"],
     "fields": ["id", "order_id"],
     "description": "Optional description of the relationship"
   }}

Format your response exactly like this:
---EXPLANATION---
[Your detailed explanation here]

---JSON---
[{{
    "type": "highlight",
    "tables": ["Orders", "OrderItems"],
    "description": "Core tables for order processing"
}}]"""
            }],
            temperature=0,
            max_tokens=2000
        )
        
        try:
            app.logger.info(f"Raw response from Claude (schema): {response}")
            app.logger.info(f"Response content type: {type(response.content)}")
            app.logger.info(f"Response content: {response.content}")
            
            if isinstance(response.content, list) and len(response.content) > 0:
                content = response.content[0].text
            else:
                content = response.content
                
            app.logger.info(f"Extracted content (schema): {content}")
            
            # Split content into explanation and JSON parts
            parts = content.split('---JSON---')
            if len(parts) != 2:
                raise ValueError("Response not in expected format")
                
            explanation = parts[0].replace('---EXPLANATION---', '').strip()
            json_str = parts[1].strip()
            
            # Try to find and extract the JSON object
            try:
                start = min(p for p in [json_str.find('{'), json_str.find('[')] if p != -1)
                end = max(json_str.rfind('}'), json_str.rfind(']'))
                if start == -1 or end == -1:
                    raise ValueError("No JSON object found in response")
                    
                json_str = json_str[start:end + 1]
                instructions = json.loads(json_str)
                app.logger.info(f"Successfully parsed JSON: {instructions}")
            except json.JSONDecodeError as e:
                app.logger.error(f"Failed to parse JSON: {str(e)}")
                app.logger.error(f"JSON string was: {json_str}")
                raise ValueError("Invalid JSON in response")
            if not isinstance(instructions, list):
                raise ValueError('Generated content is not a list of instructions')
            
            # Validate each instruction
            valid_types = {'normalize', 'highlight', 'connect'}
            for instruction in instructions:
                if not isinstance(instruction, dict):
                    raise ValueError('Invalid instruction format')
                    
                if 'type' not in instruction:
                    raise ValueError('Missing type field in instruction')
                if instruction['type'] not in valid_types:
                    raise ValueError(f'Invalid instruction type: {instruction["type"]}')
                if 'tables' not in instruction:
                    raise ValueError('Missing tables field in instruction')
                if not isinstance(instruction['tables'], list):
                    raise ValueError('Invalid tables value')
                    
                if instruction['type'] == 'connect':
                    if 'fields' not in instruction:
                        raise ValueError('Missing fields in connect instruction')
                    if not isinstance(instruction['fields'], list):
                        raise ValueError('Invalid fields value')
                    if len(instruction['fields']) != 2:
                        raise ValueError('Connect instruction must specify exactly two fields')
            
            return jsonify({
                'animation': json.dumps(instructions),
                'explanation': explanation
            })
            
        except Exception as e:
            app.logger.error(f"Error processing schema response: {str(e)}")
            return jsonify({
                'error': f"Error processing response: {str(e)}"
            }), 500
            
    except Exception as e:
        app.logger.error(f"Error in schema analysis: {str(e)}")
        return jsonify({
            'error': f"Error: {str(e)}"
        }), 500

@app.route('/analyze_parallel', methods=['POST'])
def analyze_parallel():
    try:
        prompt = request.json.get('prompt')
        if not prompt:
            return jsonify({
                'error': 'Please provide a question about parallel database architectures.'
            }), 400
        
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",
            system="You are a database expert specializing in parallel database architectures.",
            messages=[{
                "role": "user",
                "content": f"""Based on this question about parallel database architectures: {prompt}

Provide TWO things:
1. A clear explanation of the parallel database architecture
2. A JSON object with visualization instructions

Format your response exactly like this:
---EXPLANATION---
[Your detailed explanation here]

---JSON---
{{
    "type": "shared-nothing" or "shared-disk",
    "highlight": [optional array of node IDs to emphasize]
}}"""
            }],
            temperature=0,
            max_tokens=2000
        )
        
        try:
            app.logger.info(f"Raw response from Claude (parallel): {response}")
            app.logger.info(f"Response content type: {type(response.content)}")
            app.logger.info(f"Response content: {response.content}")
            
            if isinstance(response.content, list) and len(response.content) > 0:
                content = response.content[0].text
            else:
                content = response.content
                
            app.logger.info(f"Extracted content (parallel): {content}")
            
            parts = content.split('---JSON---')
            if len(parts) != 2:
                raise ValueError("Response not in expected format")
                
            explanation = parts[0].replace('---EXPLANATION---', '').strip()
            json_str = parts[1].strip()
            
            # Try to find and extract the JSON object
            try:
                start = min(p for p in [json_str.find('{'), json_str.find('[')] if p != -1)
                end = max(json_str.rfind('}'), json_str.rfind(']'))
                if start == -1 or end == -1:
                    raise ValueError("No JSON object found in response")
                    
                json_str = json_str[start:end + 1]
                instructions = json.loads(json_str)
                app.logger.info(f"Successfully parsed JSON: {instructions}")
            except json.JSONDecodeError as e:
                app.logger.error(f"Failed to parse JSON: {str(e)}")
                app.logger.error(f"JSON string was: {json_str}")
                raise ValueError("Invalid JSON in response")
            
            if not isinstance(instructions, dict):
                raise ValueError('Generated content is not a JSON object')
            if 'type' not in instructions:
                raise ValueError('Missing type field in instruction')
            if instructions['type'] not in ['shared-nothing', 'shared-disk']:
                raise ValueError('Invalid architecture type')
            if 'highlight' in instructions and not isinstance(instructions['highlight'], list):
                raise ValueError('Invalid highlight value')
            
            return jsonify({
                'animation': json.dumps(instructions),
                'explanation': explanation
            })
            
        except Exception as e:
            app.logger.error(f"Error processing parallel architecture response: {str(e)}")
            return jsonify({
                'error': f"Error processing response: {str(e)}"
            }), 500
            
    except Exception as e:
        app.logger.error(f"Error in parallel architecture analysis: {str(e)}")
        return jsonify({
            'error': f"Error: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
