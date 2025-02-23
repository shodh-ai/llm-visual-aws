# Database Schema and Architecture Visualizer

An interactive React-based web application that provides multiple visualizations for understanding database concepts, including Entity-Relationship models, Document models, and Hierarchical structures.

## Prerequisites

- Python 3.8 or higher
- Node.js 16+ and npm
- Anthropic API key (for AI narration)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/llm_visual.git
   cd llm_visual
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Install JavaScript dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   - Create a `.env` file in the project root
   - Add your API keys:
     ```
     ANTHROPIC_API_KEY=your_api_key_here
     ```

5. Start the development servers:
   ```bash
   # Terminal 1: Start the FastAPI backend
   python app.py

   # Terminal 2: Start the Vite development server
   npm run dev
   ```

## Usage

1. Access the application:
   - Open `http://localhost:5174` in your browser

2. Select a visualization type:
   - Entity-Relationship Model: Explore database schema relationships
   - Document Model: Understand document-based database structures
   - Hierarchical Model: Visualize tree-based data organizations
   - Add more ***

## Project Structure

```
llm_visual/
├── src/                  # React source code
│   ├── components/       # React components
│   │   ├── App.jsx
│   │   ├── ERVisualization.jsx
│   │   ├── DocumentVisualization.jsx
│   │   └── HierarchicalVisualization.jsx
│   └── index.jsx         # React entry point
├── app.py               # FastAPI backend
├── static/
│   ├── data/            # Visualization data
│   │   ├── er_visualization.json
│   │   ├── document_visualization.json
│   │   └── hierarchical_visualization.json
│   └── dist/            # Production build output
├── vite.config.js       # Vite configuration
├── package.json         # npm dependencies
└── requirements.txt     # Python dependencies
```

## Technologies Used

### Backend
- FastAPI: Modern, fast web framework
- Python: Server-side logic
- Anthropic Claude API: AI-powered narration

### Frontend
- React: UI framework
- D3.js: Interactive visualizations
- Vite: Build tool and development server

### Data Visualization
- Interactive node-link diagrams
- Force-directed layouts
- Hierarchical tree layouts
- Zoom and pan capabilities

