import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import VisualizationPanel from './VisualizationPanel';
import ControlPanel from './ControlPanel';
import ResponsePanel from './ResponsePanel';

const TOPICS = [
  { id: 'er', name: 'Entity-Relationship Model' },
  { id: 'document', name: 'Document Database' },
  { id: 'hierarchical', name: 'Hierarchical Database' },
  { id: 'entity', name: 'Entity Model' },
  { id: 'attribute', name: 'Attribute Model' },
  { id: 'shared_memory', name: 'Shared Memory Architecture' },
  { id: 'shared_disk', name: 'Shared Disk Architecture' },
  { id: 'shared_nothing', name: 'Shared Nothing Architecture' },
  { id: 'distributed_database', name: 'Distributed Database' },
  { id: 'oop_concepts', name: 'OOP Concepts' },
  { id: 'relationalQuery', name: 'Relational Query' },
  { id: 'normalization', name: 'Normalization' },
  { id: 'activedb', name: 'Active Database' },
  { id: 'queryprocessing', name: 'Query Processing' },
  { id: 'mobiledb', name: 'Mobile Database' },
  { id: 'gis', name: 'Geographic Information System' },
  { id: 'businesspolicy', name: 'Business Policy' }
];

const App = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [visualizationData, setVisualizationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [highlightedElements, setHighlightedElements] = useState([]);
  
  const audioRef = useRef(null);
  const audioChunks = useRef([]);
  
  // Initialize Socket.IO connection
  useEffect(() => {
    // Configure Socket.IO client with proper options
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true
    });
    
    // Add connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server with ID:', newSocket.id);
      setIsConnected(true);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setError('Failed to connect to the server. Please try again.');
      setIsConnected(false);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      setIsConnected(false);
    });
    
    newSocket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      setError(error.message || 'An error occurred');
      setIsLoading(false);
    });
    
    newSocket.on('visualization_data', (data) => {
      console.log('Received visualization data:', data);
      setVisualizationData(data);
      setIsLoading(false);
    });
    
    newSocket.on('text_chunk', (chunk) => {
      console.log('Received text chunk');
      setResponse(prev => prev + chunk);
    });
    
    newSocket.on('response_data', (data) => {
      console.log('Received response data:', data);
      if (data.explanation) {
        setResponse(data.explanation);
      }
      if (data.highlightElements) {
        setHighlightedElements(data.highlightElements.map(h => h.id));
      }
    });
    
    newSocket.on('audio_chunk', (chunk) => {
      console.log('Received audio chunk');
      audioChunks.current.push(chunk);
    });
    
    newSocket.on('end', (data) => {
      console.log('Processing completed');
      setIsLoading(false);
      
      // Create audio blob from chunks
      if (audioChunks.current.length > 0) {
        const blob = new Blob(audioChunks.current, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Clean up previous URL
        return () => {
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
        };
      }
    });
    
    setSocket(newSocket);
    
    // Clean up on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);
  
  // Handle topic selection
  const handleTopicChange = (topic) => {
    setSelectedTopic(topic);
    setResponse('');
    setHighlightedElements([]);
    setAudioUrl(null);
    audioChunks.current = [];
    
    if (topic) {
      loadVisualization(topic);
    } else {
      setVisualizationData(null);
    }
  };
  
  // Load visualization data
  const loadVisualization = (topic) => {
    setIsLoading(true);
    setError(null);
    
    if (socket && isConnected) {
      socket.emit('visualization', { topic });
    } else {
      // Fallback to REST API
      fetch('/api/visualization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load visualization: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        setVisualizationData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading visualization:', error);
        setError(error.message);
        setIsLoading(false);
      });
    }
  };
  
  // Handle doubt submission
  const handleDoubtSubmit = (doubt) => {
    if (!doubt.trim() || !selectedTopic || !socket) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse('');
    setAudioUrl(null);
    audioChunks.current = [];
    
    socket.emit('process-doubt', {
      topic: selectedTopic,
      doubt: doubt,
      current_state: {
        highlightedElements: highlightedElements,
        currentTime: 0,
        isOriginalNarration: true,
        currentNarration: ''
      }
    });
  };
  
  // Handle audio playback
  const handlePlayAudio = () => {
    if (audioRef.current && audioUrl) {
      if (isAudioPlaying) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => {
            setIsAudioPlaying(true);
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            setError('Audio playback failed. Please try again.');
          });
      }
    }
  };
  
  return (
    <div className="container">
      <header>
        <h1>LLM Visualization</h1>
        <div className="connection-status">
          {isConnected ? (
            <span className="connected">Connected to server</span>
          ) : (
            <span className="disconnected">Not connected to server</span>
          )}
        </div>
      </header>
      
      <main>
        <ControlPanel 
          topics={TOPICS}
          selectedTopic={selectedTopic}
          onTopicChange={handleTopicChange}
          onDoubtSubmit={handleDoubtSubmit}
          isLoading={isLoading}
          isConnected={isConnected}
        />
        
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}
        
        <div className="visualization-wrapper">
          <VisualizationPanel 
            data={visualizationData}
            isLoading={isLoading}
            highlightedElements={highlightedElements}
            topic={selectedTopic}
          />
        </div>
        
        <ResponsePanel 
          response={response}
          audioUrl={audioUrl}
          isAudioPlaying={isAudioPlaying}
          onPlayAudio={handlePlayAudio}
          audioRef={audioRef}
        />
      </main>
      
      <style jsx>{`
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        h1 {
          color: var(--text-color);
        }
        
        .connection-status {
          font-size: 14px;
        }
        
        .connected {
          color: var(--success-color);
        }
        
        .disconnected {
          color: var(--error-color);
        }
        
        main {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .visualization-wrapper {
          height: 500px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          background-color: white;
        }
      `}</style>
    </div>
  );
};

export default App; 