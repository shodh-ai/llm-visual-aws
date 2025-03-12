import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { spawn } from 'child_process';
import 'dotenv/config';

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
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 30000,
  allowEIO3: true
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'client/dist')));

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle visualization request
  socket.on('visualization', async (data) => {
    try {
      console.log('Visualization request:', data);
      
      // Spawn Python process to handle visualization
      const pythonProcess = spawn('python', ['app.py', '--topic', data.topic]);
      
      let visualizationData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        visualizationData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python error: ${data}`);
        socket.emit('error', { message: 'Error generating visualization' });
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const jsonData = JSON.parse(visualizationData);
            socket.emit('visualization_data', jsonData);
          } catch (error) {
            console.error('Error parsing visualization data:', error);
            socket.emit('error', { message: 'Error parsing visualization data' });
          }
        } else {
          console.error(`Python process exited with code ${code}`);
          socket.emit('error', { message: 'Error generating visualization' });
        }
      });
    } catch (error) {
      console.error('Error handling visualization request:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Handle doubt processing
  socket.on('process-doubt', async (data) => {
    try {
      console.log('Processing doubt:', data);
      
      // Spawn Python process to handle doubt
      const pythonProcess = spawn('python', ['socket_bridge.py', '--mode', 'doubt']);
      
      // Send data to Python process
      pythonProcess.stdin.write(JSON.stringify(data) + '\n');
      
      // Handle text chunks
      pythonProcess.stdout.on('data', (chunk) => {
        const textChunk = chunk.toString();
        console.log('Received from Python:', textChunk);
        
        // Split by newlines in case multiple JSON objects are received
        const lines = textChunk.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const jsonData = JSON.parse(line.trim());
            
            if (jsonData.type === 'text_chunk') {
              socket.emit('text_chunk', jsonData.content);
            } else if (jsonData.type === 'audio_chunk') {
              socket.emit('audio_chunk', Buffer.from(jsonData.content, 'base64'));
            } else if (jsonData.type === 'response_data') {
              socket.emit('response_data', jsonData.content);
            } else if (jsonData.type === 'timing') {
              socket.emit('timing', jsonData.content);
            } else if (jsonData.type === 'end') {
              socket.emit('end', jsonData.content || {});
            } else if (jsonData.type === 'error') {
              socket.emit('error', { message: jsonData.content });
            }
          } catch (error) {
            console.error('Error parsing Python output:', error);
            console.error('Problematic line:', line);
            // Only emit as text if it looks like text, not a parsing error
            if (line.length > 0 && !line.includes('Traceback') && !line.includes('Error:')) {
              socket.emit('text_chunk', line);
            }
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        console.error(`Python error: ${errorText}`);
        
        // Don't emit errors for INFO log messages
        if (!errorText.includes('INFO:') && !errorText.includes('DEBUG:')) {
          socket.emit('error', { message: 'Error processing doubt' });
        }
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          socket.emit('error', { message: 'Error processing doubt' });
        }
        socket.emit('end', {});
      });
    } catch (error) {
      console.error('Error handling doubt request:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API routes
app.post('/api/visualization', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    // Spawn Python process to handle visualization
    const pythonProcess = spawn('python', ['app.py', '--topic', topic]);
    
    let visualizationData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      visualizationData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python error: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const jsonData = JSON.parse(visualizationData);
          res.json(jsonData);
        } catch (error) {
          console.error('Error parsing visualization data:', error);
          res.status(500).json({ error: 'Error parsing visualization data' });
        }
      } else {
        console.error(`Python process exited with code ${code}`);
        res.status(500).json({ error: 'Error generating visualization' });
      }
    });
  } catch (error) {
    console.error('Error handling visualization request:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'client/dist/index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});