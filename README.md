# Database Visualization Application

An interactive application for visualizing database concepts with real-time narration and interaction.

## Overview

This application provides interactive visualizations for various database concepts, with narration and the ability to ask questions about the visualizations. It uses a Node.js backend with Socket.IO for real-time communication and a React frontend for the user interface.

## Architecture

The application has been simplified to have a clear separation of concerns:

- **Frontend**: All frontend code is in the `client` directory, using React and D3.js for visualizations
- **Backend**: Node.js server with Express and Socket.IO, which communicates with a Python script for generating visualizations and processing questions

## Features

- Interactive database concept visualizations
- Real-time narration with synchronized highlighting
- Ask questions about visualizations
- Audio playback of narration

## Directory Structure

```
├── client/                  # Frontend code
│   ├── components/          # React components
│   ├── assets/              # Static assets
│   ├── pages/               # Page components
│   └── utils/               # Utility functions
├── static/                  # Static data files
│   └── data/                # JSON data for visualizations
├── app.py                   # Python script for visualization and doubt processing
├── server.js                # Node.js server with Socket.IO
└── requirements.txt         # Python dependencies
```

## Setup and Installation

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/database-visualization.git
   cd database-visualization
   ```

2. Install Node.js dependencies:
   ```
   npm install
   cd client
   npm install
   cd ..
   ```

3. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Running the Application

1. Start the development server:
   ```
   npm run dev
   ```

   This will start both the Node.js server and the React development server.

2. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

## Building for Production

1. Build the client:
   ```
   npm run build
   ```

2. Start the production server:
   ```
   npm start
   ```

## License

ISC

