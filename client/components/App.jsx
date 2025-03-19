import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import VisualizationPanel from './VisualizationPanel';
import ControlPanel from './ControlPanel';
import DoubtBox from './DoubtBox';
import '../styles/streaming.css';
import RealtimeAudioPlayer from "./RealTimeAudioPlayer"

// Import visualization components
import ERVisualization from './ERVisualization';
import DocumentVisualization from './DocumentVisualization';
import HierarchicalVisualization from './HierarchicalVisualization';
import EntityVisualization from './EntityVisualization';
import AttributeVisualization from './AttributeVisualization';
import SharedMemoryVisualization from './Shared_memoryVisualization';
import SharedDiskVisualization from './Shared_diskVisualization';
import SharedNothingVisualization from './Shared_nothingVisualization';
import DistributedDatabaseVisualization from './Distributed_databaseVisualization';
import OOPConceptsVisualization from './Oop_conceptsVisualization';
import RelationalQueryVisualization from './RelationalqueryVisualization';
import NormalFormVisualization from './NormalizationVisualization';
import ActiveDBVisualization from './ActivedbVisualization';
import QueryProcessingVisualization from './QueryprocessingVisualization';
import MobiledbVisualization from './MobiledbVisualization';
import GISVisualization from './GisVisualization';
import BusinessPolicyVisualization from './BusinessPolicyVisualization';

// Define the VISUALIZATIONS object
const VISUALIZATIONS = {
  er: ERVisualization,
  document: DocumentVisualization,
  hierarchical: HierarchicalVisualization,
  entity: EntityVisualization,
  attribute: AttributeVisualization,
  shared_memory: SharedMemoryVisualization,
  shared_disk: SharedDiskVisualization,
  shared_nothing: SharedNothingVisualization,
  distributed_database: DistributedDatabaseVisualization,
  oop_concepts: OOPConceptsVisualization,
  relationalQuery: RelationalQueryVisualization,
  normalization: NormalFormVisualization,
  activedb: ActiveDBVisualization,
  queryprocessing: QueryProcessingVisualization,
  mobiledb: MobiledbVisualization,
  gis: GISVisualization,
  businesspolicy: BusinessPolicyVisualization
};

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
  const [highlightedElements, setHighlightedElements] = useState([]);
  const [doubt, setDoubt] = useState('');
  const [doubtResponse, setDoubtResponse] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [realtimeSession, setRealtimeSession] = useState(null);
  
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

    // Socket event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      
      // If this is the initial load, automatically select the ER model
      if (isInitialLoad) {
        setIsInitialLoad(false);
        handleTopicChange('er');
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('visualization_response', (data) => {
      console.log('Received visualization data:', data);
      setVisualizationData(data);
      
      // Make visualization data available globally for the RealtimeAudioPlayer
      window.visualizationData = data;
      
      setIsLoading(false);
      
      // Automatically start a WebRTC session for the topic
      initiateWebRTCSession(data.topic || selectedTopic);
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      setError(`Error: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isInitialLoad]);

  const handleTopicChange = (topic) => {
    setSelectedTopic(topic);
    setDoubtResponse(null);
    
    // Reset highlighted elements
    setHighlightedElements([]);
    
    // Immediately load a placeholder visualization while waiting for server
    const placeholderData = getPlaceholderData(topic);
    setVisualizationData(placeholderData);
    
    if (topic) {
      loadVisualization(topic);
    }
  };

  // Function to get placeholder data for instant rendering
  const getPlaceholderData = (topic) => {
    // Basic placeholder data for ER model
    if (topic === 'er') {
      return {
        nodes: [
          { id: "student", name: "Student", type: "entity", attributes: [
            { name: "student_id", isKey: true },
            { name: "name", isKey: false },
            { name: "email", isKey: false }
          ]},
          { id: "course", name: "Course", type: "entity", attributes: [
            { name: "course_id", isKey: true },
            { name: "title", isKey: false },
            { name: "credits", isKey: false }
          ]},
          { id: "enrollment", name: "Enrolls", type: "relationship" }
        ],
        edges: [
          { source: "student", target: "enrollment", type: "participates" },
          { source: "enrollment", target: "course", type: "participates" }
        ],
        topic: topic,
        narration: "Loading narration...",
        narration_timestamps: []
      };
    }
    
    // Placeholder data for Document Database
    else if (topic === 'document') {
      return {
        nodes: [
          { 
            id: "user_collection", 
            name: "Users Collection", 
            type: "collection",
            document: {
              "_id": "user123",
              "name": "John Doe",
              "email": "john@example.com",
              "preferences": {
                "theme": "dark",
                "notifications": true
              },
              "posts": [
                {"id": "post1", "title": "First Post"},
                {"id": "post2", "title": "Second Post"}
              ]
            }
          },
          { 
            id: "post_collection", 
            name: "Posts Collection", 
            type: "collection",
            document: {
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
          }
        ],
        edges: [
          { source: "user_collection", target: "post_collection", type: "reference", description: "User -> Posts" }
        ],
        topic: topic,
        narration: "Loading narration...",
        narration_timestamps: []
      };
    }
    
    // Placeholder data for Hierarchical Database
    else if (topic === 'hierarchical') {
      return {
        nodes: [
          { id: "root", name: "University", type: "root" },
          { id: "department1", name: "Computer Science", type: "branch" },
          { id: "department2", name: "Mathematics", type: "branch" },
          { id: "course1", name: "Database Systems", type: "leaf" },
          { id: "course2", name: "Algorithms", type: "leaf" },
          { id: "course3", name: "Calculus", type: "leaf" }
        ],
        edges: [
          { source: "root", target: "department1", type: "parent-child" },
          { source: "root", target: "department2", type: "parent-child" },
          { source: "department1", target: "course1", type: "parent-child" },
          { source: "department1", target: "course2", type: "parent-child" },
          { source: "department2", target: "course3", type: "parent-child" }
        ],
        topic: topic,
        narration: "Loading narration...",
        narration_timestamps: []
      };
    }
    
    // Generic placeholder for other topics with a consistent structure
    else {
      return {
        nodes: [
          { id: `${topic}_node1`, name: `${topic.charAt(0).toUpperCase() + topic.slice(1)} Node 1`, type: "generic" },
          { id: `${topic}_node2`, name: `${topic.charAt(0).toUpperCase() + topic.slice(1)} Node 2`, type: "generic" },
          { id: `${topic}_node3`, name: `${topic.charAt(0).toUpperCase() + topic.slice(1)} Node 3`, type: "generic" }
        ],
        edges: [
          { source: `${topic}_node1`, target: `${topic}_node2`, type: "connection" },
          { source: `${topic}_node2`, target: `${topic}_node3`, type: "connection" }
        ],
        topic: topic,
        narration: `Loading ${topic.replace('_', ' ')} visualization...`,
        narration_timestamps: []
      };
    }
  };

  const loadVisualization = (topic) => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }

    setIsLoading(true);
    setError(null);

    console.log('Requesting visualization for topic:', topic);
    socket.emit('visualization', { topic });
  };

  // New function to initiate WebRTC session
  const initiateWebRTCSession = (topic, doubtText = '') => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    
    console.log('Initiating WebRTC session for topic:', topic);
    
    // Create a session ID
    const sessionId = Date.now().toString();
    
    // Set up the realtime session
    setRealtimeSession({
      sessionId: sessionId,
      topic: topic,
      doubt: doubtText,
      visualizationData: visualizationData
    });
    
    // Notify the server to start a WebRTC session
    socket.emit('start_webrtc_session', {
      sessionId: sessionId,
      topic: topic,
      doubt: doubtText
    });
  };

  // Handle doubt submission - simplified to always use WebRTC
  const handleDoubtSubmit = async (doubtText, currentState = {}) => {
    if (!socket || !doubtText.trim() || !selectedTopic) return;
    
    setIsLoading(true);
    setDoubt(doubtText);
    
    console.log('Submitting doubt via WebRTC:', doubtText);
    
    // Initiate a WebRTC session with the doubt
    initiateWebRTCSession(selectedTopic, doubtText);
    
    // Return a resolved promise since we're not waiting for a response
    return Promise.resolve({
      sessionId: realtimeSession?.sessionId || Date.now().toString(),
      topic: selectedTopic,
      doubt: doubtText
    });
  };

  const renderVisualization = () => {
    if (!visualizationData || !selectedTopic) return null;
    
    const VisualizationComponent = VISUALIZATIONS[selectedTopic];
    
    if (!VisualizationComponent) {
      return <div>No visualization component available for {selectedTopic}</div>;
    }
    
    return (
      <VisualizationComponent
        data={visualizationData}
        highlightedElements={highlightedElements}
        currentTime={Date.now()} // Just use current time as a placeholder
      />
    );
  };

  // Update the socket event handler for realtime session
  useEffect(() => {
    if (!socket) return;
    
    socket.on('start_webrtc_session', (data) => {
      console.log('WebRTC session request received:', data);
      
      // Only set realtimeSession if it's not already set
      setRealtimeSession(prevSession => {
        if (prevSession) {
          console.log('Ignoring duplicate WebRTC session request, session already active');
          return prevSession;
        }
        
        // Ensure we have visualization data
        if (!visualizationData && data.topic) {
          console.log('Requesting visualization data for topic:', data.topic);
          socket.emit('visualization', { topic: data.topic });
        }
        
        // Set highlighted elements to empty array to reset any previous highlights
        setHighlightedElements([]);
        
        return {
          sessionId: data.sessionId,
          topic: data.topic,
          doubt: data.doubt,
          visualizationData: visualizationData
        };
      });
    });
    
    return () => {
      socket.off('start_webrtc_session');
    };
  }, [socket, visualizationData]);

  // Add a function to handle the completion of the narration
  const handleNarrationComplete = (highlightedNodes, isComplete = true) => {
    console.log('Received highlighted nodes:', highlightedNodes, 'isComplete:', isComplete);
    
    // Update highlighted elements if provided
    if (highlightedNodes && highlightedNodes.length > 0) {
      console.log('Setting highlighted nodes:', highlightedNodes);
      setHighlightedElements([...highlightedNodes]);
    }
    
    // Only close the session if isComplete is true and we want to end the session
    if (isComplete) {
      console.log('Narration complete, but keeping WebRTC session active');
      // We don't reset the session here to keep it active
      // setRealtimeSession(null);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Database Visualization</h1>
        <div className="connection-status">
          {isConnected ? (
            <span className="connected">Connected</span>
          ) : (
            <span className="disconnected">Disconnected</span>
          )}
        </div>
      </header>
      
      <ControlPanel
        topics={TOPICS}
        selectedTopic={selectedTopic}
        onTopicChange={handleTopicChange}
        isLoading={isLoading}
        isPlaying={!!realtimeSession} // Use realtimeSession as a proxy for isPlaying
        onPlayPause={() => {
          // If we have a session, end it; otherwise start one
          if (realtimeSession) {
            setRealtimeSession(null);
          } else if (selectedTopic) {
            initiateWebRTCSession(selectedTopic);
          }
        }}
        hasVisualization={!!visualizationData}
      />
      
      <div className="main-content">
        <div className="visualization-container">
          <VisualizationPanel>
            {error ? (
              <div className="error">{error}</div>
            ) : (
              renderVisualization()
            )}
            {isLoading && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
              </div>
            )}
          </VisualizationPanel>
        </div>
        
        {realtimeSession ? (
          <div className="realtime-container">
            <RealtimeAudioPlayer 
              topic={realtimeSession.topic}
              doubt={realtimeSession.doubt}
              sessionId={realtimeSession.sessionId}
              onComplete={handleNarrationComplete}
              visualizationData={visualizationData}
            />
          </div>
        ) : (
          <div className="placeholder-message">
            <h3>Interactive Database Learning</h3>
            <p>Select a topic from the dropdown above to start exploring.</p>
            <p>The visualization will appear with real-time audio explanation.</p>
            <p>You can ask questions about the topic using the doubt box below.</p>
          </div>
        )}
      </div>
      
      <DoubtBox
        onSubmit={handleDoubtSubmit}
        isLoading={isLoading}
        doubtResponse={doubtResponse}
        socket={socket}
      />
    </div>
  );
};

export default App; 