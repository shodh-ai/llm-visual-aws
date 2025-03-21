import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { spawn } from 'child_process';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set');
  console.error('Please set the OPENAI_API_KEY environment variable in your .env file');
  process.exit(1);
} else {
  console.log('OpenAI API key found. Length:', process.env.OPENAI_API_KEY.length);
}

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'client/dist')));

// Cache for visualization data
const visualizationCache = new Map();

// Endpoint to get an ephemeral token for WebRTC connection
app.get('/token', async (req, res) => {
  try {
    const topic = req.query.topic;
    const doubt = req.query.doubt;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    console.log(`Token request for topic: ${topic}, doubt: ${doubt || 'none'}`);
    
    // Get visualization data for context
    let visualizationData = null;
    const cacheKey = `viz_${topic}`;
    
    if (visualizationCache.has(cacheKey)) {
      visualizationData = visualizationCache.get(cacheKey);
      console.log('Using cached visualization data for token');
    } else {
      // Fetch visualization data if not in cache
      try {
        const pythonProcess = spawn('python', ['app.py', '--topic', topic]);
        let vizDataStr = '';
        
        pythonProcess.stdout.on('data', (data) => {
          vizDataStr += data.toString();
        });
        
        await new Promise((resolve, reject) => {
          pythonProcess.on('close', (code) => {
            if (code === 0 && vizDataStr) {
              try {
                visualizationData = JSON.parse(vizDataStr);
                visualizationCache.set(cacheKey, visualizationData);
                console.log('Generated and cached visualization data for token');
                resolve();
              } catch (error) {
                console.error('Error parsing visualization data:', error);
                reject(error);
              }
            } else {
              reject(new Error('Failed to generate visualization data'));
            }
          });
          
          pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error: ${data}`);
          });
        });
      } catch (error) {
        console.error('Error fetching visualization data for token:', error);
        // Continue without visualization data
      }
    }
    
    // Verify we have a valid API key
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.error('Invalid or missing OpenAI API key');
      return res.status(500).json({ error: 'Invalid or missing OpenAI API key' });
    }
    
    // Return the API key as an ephemeral token along with visualization context
    return res.json({
      client_secret: {
        value: process.env.OPENAI_API_KEY
      },
      visualization_data: visualizationData,
      topic: topic,
      doubt: doubt,
      sessionId: uuidv4() // Include a session ID
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({ error: 'Failed to generate token: ' + error.message });
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle visualization request
  socket.on('visualization', async (data) => {
    try {
      console.log('Visualization request:', data);
      
      // Check cache first
      const cacheKey = `viz_${data.topic}`;
      if (visualizationCache.has(cacheKey)) {
        console.log('Serving visualization from cache');
        socket.emit('visualization_response', visualizationCache.get(cacheKey));
        return;
      }
      
      // Spawn Python process to handle visualization
      const pythonProcess = spawn('python', ['app.py', '--topic', data.topic]);
      
      let visualizationData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        visualizationData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python error: ${data}`);
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        
        if (code === 0 && visualizationData) {
          try {
            const parsedData = JSON.parse(visualizationData);
            
            // Cache the result
            visualizationCache.set(cacheKey, parsedData);
            
            // Send to client
            socket.emit('visualization_response', parsedData);
          } catch (error) {
            console.error('Error parsing visualization data:', error);
            socket.emit('error', { message: 'Failed to parse visualization data' });
          }
        } else {
          socket.emit('error', { message: 'Failed to generate visualization' });
        }
      });
    } catch (error) {
      console.error('Error handling visualization request:', error);
      socket.emit('error', { message: error.message || 'An error occurred' });
    }
  });

  // Handle doubt request - now signals the client to start a WebRTC session
  socket.on('doubt', async (data) => {
    try {
      console.log('Doubt request:', data);
      
      // Generate a session ID
      const sessionId = uuidv4();
      
      // Check if we have visualization data in cache
      const cacheKey = `viz_${data.topic}`;
      let visualizationData = null;
      
      if (visualizationCache.has(cacheKey)) {
        visualizationData = visualizationCache.get(cacheKey);
        console.log('Using cached visualization data');
      } else {
        // Fetch visualization data if not in cache
        try {
          const pythonProcess = spawn('python', ['app.py', '--topic', data.topic]);
          let vizDataStr = '';
          
          pythonProcess.stdout.on('data', (chunk) => {
            vizDataStr += chunk.toString();
          });
          
          await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
              if (code === 0 && vizDataStr) {
                try {
                  visualizationData = JSON.parse(vizDataStr);
                  visualizationCache.set(cacheKey, visualizationData);
                  resolve();
                } catch (error) {
                  console.error('Error parsing visualization data:', error);
                  reject(error);
                }
              } else {
                reject(new Error('Failed to generate visualization data'));
              }
            });
            
            pythonProcess.stderr.on('data', (data) => {
              console.error(`Python error: ${data}`);
            });
          });
        } catch (error) {
          console.error('Error fetching visualization data:', error);
          // Continue without visualization data
        }
      }
      
      // Check if the client wants to use WebRTC
      if (data.use_webrtc) {
        console.log('Client requested WebRTC session');
        
        // Signal the client to start a WebRTC session
        socket.emit('start_webrtc_session', {
          sessionId,
          topic: data.topic,
          doubt: data.doubt,
          visualizationData
        });
        
        return; // Exit early as we're using WebRTC
      }
      
      // If not using WebRTC, process the doubt using Python
      const currentState = data.current_state || {};
      const currentTime = data.current_time || 0;
      
      // Convert the doubt request to JSON for the Python process
      const doubtRequest = {
        topic: data.topic,
        doubt: data.doubt,
        current_state: currentState,
        current_time: currentTime
      };
      
      // Spawn Python process to handle the doubt
      const pythonProcess = spawn('python', [
        'app.py', 
        '--doubt', 
        '--topic', data.topic
      ]);
      
      // Send the doubt request to the Python process
      pythonProcess.stdin.write(JSON.stringify(doubtRequest));
      pythonProcess.stdin.end();
      
      let responseData = '';
      
      pythonProcess.stdout.on('data', (chunk) => {
        responseData += chunk.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python error: ${data}`);
      });
      
      pythonProcess.on('close', async (code) => {
        console.log(`Python doubt process exited with code ${code}`);
        
        if (code === 0 && responseData) {
          try {
            const parsedResponse = JSON.parse(responseData);
            
            // Process the response
            const doubtResponse = {
              narration: parsedResponse.narration || "I couldn't generate a response for your question.",
              narration_timestamps: parsedResponse.narration_timestamps || [],
              highlights: parsedResponse.highlights || []
            };
            
            // Generate audio for the narration if needed
            if (doubtResponse.narration && !parsedResponse.audio_url) {
              try {
                // Use a text-to-speech service to generate audio
                // This is a placeholder - implement your preferred TTS solution
                console.log('Generating audio for doubt response');
                
                // For now, we'll just send the response without audio
                socket.emit('doubt_response', doubtResponse);
              } catch (audioError) {
                console.error('Error generating audio:', audioError);
                socket.emit('doubt_response', doubtResponse);
              }
            } else {
              // Send the response with the provided audio URL
              if (parsedResponse.audio_url) {
                doubtResponse.audio_url = parsedResponse.audio_url;
              }
              
              socket.emit('doubt_response', doubtResponse);
            }
          } catch (error) {
            console.error('Error parsing doubt response:', error);
            socket.emit('error', { message: 'Failed to parse doubt response' });
          }
        } else {
          socket.emit('error', { message: 'Failed to process doubt' });
        }
      });
    } catch (error) {
      console.error('Error handling doubt request:', error);
      socket.emit('error', { message: error.message || 'An error occurred' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Upgrade HTTP connections to WebSocket
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  console.log(`WebSocket upgrade request for path: ${pathname}`);
  
  if (pathname.startsWith('/socket.io/')) {
    console.log('Allowing Socket.IO WebSocket upgrade');
    // Let Socket.IO handle its own upgrades
    return;
  } else {
    console.log(`Rejecting WebSocket upgrade for unknown path: ${pathname}`);
    socket.destroy();
  }
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'client/dist/index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});