import React, { useEffect, useRef, useState } from 'react';

const RealtimeAudioPlayer = ({ topic, doubt, sessionId, onComplete }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [text, setText] = useState('');
  const [highlightedWord, setHighlightedWord] = useState('');
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [debugInfo, setDebugInfo] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [events, setEvents] = useState([]);
  const [nodesToHighlight, setNodesToHighlight] = useState([]);
  
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const sessionInProgressRef = useRef(false); // Track if a session is already in progress
  const sessionStartedTimeRef = useRef(null); // Track when the session started
  
  // Helper function to add debug info
  const addDebugInfo = (message) => {
    console.log(`[RealtimeAudioPlayer] ${message}`);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().substr(11, 8)}: ${message}`]);
  };
  
  // Start WebRTC session
  useEffect(() => {
    if (!topic || !doubt) {
      setConnectionStatus('Missing topic or doubt');
      addDebugInfo('Missing topic or doubt');
      return;
    }
    
    // Only start a new session if one isn't already in progress
    if (!sessionInProgressRef.current) {
      sessionInProgressRef.current = true;
      sessionStartedTimeRef.current = Date.now();
      addDebugInfo(`Starting new session with ID: ${sessionId}`);
      startSession();
    } else {
      // Log that we're skipping duplicate session start
      const timeSinceStart = Date.now() - (sessionStartedTimeRef.current || 0);
      addDebugInfo(`Skipping duplicate session start (${timeSinceStart}ms after first start)`);
    }
    
    // Cleanup function
    return () => {
      addDebugInfo('Component unmounting, cleaning up session');
      stopSession();
      sessionInProgressRef.current = false;
      sessionStartedTimeRef.current = null;
    };
  }, [topic, doubt, sessionId]);
  
  // Start WebRTC session
  const startSession = async () => {
    try {
      // Prevent multiple simultaneous connections
      if (peerConnectionRef.current) {
        addDebugInfo('A peer connection already exists, stopping it first');
        stopSession();
      }
      
      setConnectionStatus('Starting session...');
      addDebugInfo(`Starting WebRTC session for topic: ${topic}, doubt: ${doubt}`);
      
      // Get an ephemeral key from the server
      const baseUrl = window.location.origin; // Get the base URL from the current window location
      let tokenUrl = `${baseUrl}/token?topic=${encodeURIComponent(topic)}&doubt=${encodeURIComponent(doubt)}`;
      addDebugInfo(`Fetching token from ${tokenUrl}`);
      
      let tokenResponse;
      try {
        tokenResponse = await fetch(tokenUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
      } catch (fetchError) {
        // If the relative URL fails, try a direct URL to the server
        addDebugInfo(`Fetch failed with error: ${fetchError.message}`);
        addDebugInfo('Trying direct URL to server as fallback');
        
        tokenUrl = `http://localhost:3000/token?topic=${encodeURIComponent(topic)}&doubt=${encodeURIComponent(doubt)}`;
        addDebugInfo(`Fetching token from fallback URL: ${tokenUrl}`);
        
        tokenResponse = await fetch(tokenUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
      }
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        addDebugInfo(`Token fetch failed with status ${tokenResponse.status}: ${errorText}`);
        throw new Error(`Failed to get token: ${tokenResponse.status} ${tokenResponse.statusText}`);
      }
      
      let data;
      try {
        const responseText = await tokenResponse.text();
        addDebugInfo(`Token response: ${responseText}`);
        data = JSON.parse(responseText);
      } catch (parseError) {
        addDebugInfo(`Failed to parse token response as JSON: ${parseError.message}`);
        throw new Error(`Failed to parse token response: ${parseError.message}`);
      }
      
      const EPHEMERAL_KEY = data.client_secret.value;
      
      addDebugInfo(`Received ephemeral key from server (length: ${EPHEMERAL_KEY.length})`);
      
      // Check if the key looks like a valid OpenAI API key
      if (!EPHEMERAL_KEY.startsWith('sk-')) {
        addDebugInfo(`Warning: API key doesn't start with 'sk-', which is unusual for OpenAI API keys`);
      }
      
      // Create a peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
      
      // Set up to play remote audio from the model
      audioElementRef.current = document.createElement('audio');
      audioElementRef.current.autoplay = true;
      
      pc.ontrack = (e) => {
        addDebugInfo('Received audio track from OpenAI');
        audioElementRef.current.srcObject = e.streams[0];
        setIsPlaying(true);
      };
      
      // Add local audio track for microphone input
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        microphoneStreamRef.current = ms;
        pc.addTrack(ms.getTracks()[0]);
        addDebugInfo('Added microphone track to peer connection');
      } catch (micError) {
        console.error('Microphone access error:', micError);
        addDebugInfo(`Microphone error: ${micError.message}`);
        // Continue without microphone
      }
      
      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      
      dc.onopen = () => {
        addDebugInfo('Data channel opened');
        setIsConnected(true);
        setConnectionStatus('Connected to OpenAI');
        
        // Get visualization data from the token response
        const visualizationData = data.visualization_data;
        
        // Prepare a detailed prompt with visualization context
        let prompt = `Topic: ${topic}\nDoubt: ${doubt}\n\n`;
        
        // Add visualization context if available
        if (visualizationData) {
          prompt += "Visualization Context:\n";
          
          // Add nodes information
          if (visualizationData.nodes && visualizationData.nodes.length > 0) {
            prompt += "Nodes:\n";
            visualizationData.nodes.forEach(node => {
              prompt += `- ${node.name} (ID: ${node.id}, Type: ${node.type || 'N/A'})\n`;
              
              // Add attributes if available
              if (node.attributes && node.attributes.length > 0) {
                prompt += "  Attributes:\n";
                node.attributes.forEach(attr => {
                  prompt += `  - ${attr.name}${attr.isKey ? ' (Primary Key)' : ''}\n`;
                });
              }
            });
          }
          
          // Add edges information
          if (visualizationData.edges && visualizationData.edges.length > 0) {
            prompt += "\nEdges:\n";
            visualizationData.edges.forEach(edge => {
              prompt += `- ${edge.source} → ${edge.target} (Type: ${edge.type}${edge.description ? `, ${edge.description}` : ''})\n`;
            });
          }
          
          // Add narration if available
          if (visualizationData.narration) {
            prompt += "\nVisualization Description:\n";
            prompt += visualizationData.narration + "\n";
          }
        }
        
        // Send the detailed prompt
        sendTextMessage(prompt);
      };
      
      dc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          addDebugInfo(`Received message of type: ${data.type}`);
          
          // Add to events
          setEvents(prev => [data, ...prev]);
          
          // Process different event types
          if (data.type === 'conversation.item.delta') {
            if (data.delta?.content?.[0]?.type === 'text_delta') {
              const textDelta = data.delta.content[0].text_delta.text;
              setText(prev => prev + textDelta);
              
              // Check for node IDs in the response
              // This is a simple approach - in a real app, you might want more sophisticated parsing
              const visualizationData = data.visualization_data;
              if (visualizationData && visualizationData.nodes) {
                const nodeIds = visualizationData.nodes.map(node => node.id);
                // Check if the text delta contains any node IDs
                nodeIds.forEach(nodeId => {
                  if (textDelta.includes(nodeId)) {
                    setNodesToHighlight(prev => {
                      if (!prev.includes(nodeId)) {
                        return [...prev, nodeId];
                      }
                      return prev;
                    });
                  }
                });
              }
            }
          } else if (data.type === 'conversation.item.complete') {
            addDebugInfo('Conversation complete');
            setConnectionStatus('Response complete');
            setIsComplete(true);
          } else if (data.type === 'error') {
            // Log detailed error information
            addDebugInfo(`Error from OpenAI: ${JSON.stringify(data)}`);
            setError(`OpenAI error: ${data.error?.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
          addDebugInfo(`Error parsing message: ${error.message}`);
          addDebugInfo(`Raw message data: ${e.data.substring(0, 200)}${e.data.length > 200 ? '...' : ''}`);
        }
      };
      
      dc.onerror = (dcError) => {
        console.error('Data channel error:', dcError);
        addDebugInfo(`Data channel error: ${dcError.message || 'Unknown error'}`);
        setError('Connection error with OpenAI. Please try again.');
      };
      
      dc.onclose = () => {
        addDebugInfo('Data channel closed');
        setIsConnected(false);
        setConnectionStatus('Disconnected');
      };
      
      // Start the session using SDP
      addDebugInfo('Creating offer');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      const openaiBaseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      
      addDebugInfo('Sending SDP offer to OpenAI');
      const sdpResponse = await fetch(`${openaiBaseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp'
        }
      });
      
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        addDebugInfo(`SDP negotiation failed with status ${sdpResponse.status}: ${errorText}`);
        throw new Error(`SDP negotiation failed: ${sdpResponse.status} ${sdpResponse.statusText}`);
      }
      
      const sdpAnswer = await sdpResponse.text();
      addDebugInfo(`Received SDP answer from OpenAI (length: ${sdpAnswer.length})`);
      
      if (!sdpAnswer || sdpAnswer.trim() === '') {
        addDebugInfo('Received empty SDP answer from OpenAI');
        throw new Error('Received empty SDP answer from OpenAI');
      }
      
      try {
        const answer = {
          type: 'answer',
          sdp: sdpAnswer
        };
        
        await pc.setRemoteDescription(answer);
        addDebugInfo('Set remote description, WebRTC connection established');
      } catch (sdpError) {
        addDebugInfo(`Error setting remote description: ${sdpError.message}`);
        throw new Error(`Failed to set remote description: ${sdpError.message}`);
      }
      
    } catch (error) {
      console.error('Error starting session:', error);
      setError(`Failed to start session: ${error.message}`);
      setConnectionStatus('Connection failed');
      addDebugInfo(`Session error: ${error.message}`);
      stopSession();
    }
  };
  
  // Stop WebRTC session
  const stopSession = () => {
    // If no session is in progress, don't try to stop anything
    if (!sessionInProgressRef.current && !peerConnectionRef.current && !dataChannelRef.current) {
      addDebugInfo('No active session to stop');
      return;
    }
    
    addDebugInfo('Stopping session');
    
    // Close data channel
    if (dataChannelRef.current) {
      try {
        if (dataChannelRef.current.readyState === 'open') {
          addDebugInfo('Closing data channel');
          dataChannelRef.current.close();
        } else {
          addDebugInfo(`Data channel in state: ${dataChannelRef.current.readyState}, not closing`);
        }
      } catch (err) {
        addDebugInfo(`Error closing data channel: ${err.message}`);
      }
      dataChannelRef.current = null;
    }
    
    // Stop microphone tracks
    if (microphoneStreamRef.current) {
      try {
        addDebugInfo('Stopping microphone tracks');
        microphoneStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      } catch (err) {
        addDebugInfo(`Error stopping microphone tracks: ${err.message}`);
      }
      microphoneStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        addDebugInfo('Closing peer connection');
        peerConnectionRef.current.close();
      } catch (err) {
        addDebugInfo(`Error closing peer connection: ${err.message}`);
      }
      peerConnectionRef.current = null;
    }
    
    // Clean up audio element
    if (audioElementRef.current) {
      try {
        if (audioElementRef.current.srcObject) {
          addDebugInfo('Cleaning up audio element');
          audioElementRef.current.srcObject = null;
        }
      } catch (err) {
        addDebugInfo(`Error cleaning up audio element: ${err.message}`);
      }
      audioElementRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    
    // Mark session as no longer in progress
    sessionInProgressRef.current = false;
  };
  
  // Send a text message to the model
  const sendTextMessage = (message) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      addDebugInfo('Cannot send message - data channel not open');
      return;
    }
    
    addDebugInfo(`Sending text message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
    const event = {
      type: 'conversation.item.create',
      event_id: crypto.randomUUID(),
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: message
          }
        ]
      }
    };
    
    // Add to events
    setEvents(prev => [event, ...prev]);
    
    // Send the event
    dataChannelRef.current.send(JSON.stringify(event));
    
    // Send response.create event to trigger model response
    const responseEvent = {
      type: 'response.create',
      event_id: crypto.randomUUID()
    };
    
    // Add to events
    setEvents(prev => [responseEvent, ...prev]);
    
    // Send the event
    dataChannelRef.current.send(JSON.stringify(responseEvent));
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (!audioElementRef.current) return;
    
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    audioElementRef.current.muted = newMutedState;
    addDebugInfo(`Audio ${newMutedState ? 'muted' : 'unmuted'}`);
  };
  
  // Handle return to visualization
  const handleReturn = () => {
    addDebugInfo('User clicked return to visualization');
    stopSession();
    if (onComplete) {
      onComplete(nodesToHighlight);
    }
  };
  
  return (
    <div className="realtime-player">
      <div className="connection-status">
        Status: {connectionStatus}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="text-display">
        {text || "Waiting for response..."}
        {highlightedWord && <span className="highlighted-word">{highlightedWord}</span>}
      </div>
      
      <div className="controls">
        <button 
          onClick={toggleMute} 
          className={`mute-button ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        
        {isPlaying && <span className="playing-indicator">Playing audio...</span>}
        
        {isComplete && (
          <button 
            onClick={handleReturn}
            className="return-button"
          >
            Close AI Response
          </button>
        )}
      </div>
      
      <div className="debug-info">
        <details>
          <summary>Debug Info ({debugInfo.length} entries)</summary>
          <pre>
            {debugInfo.map((info, index) => (
              <div key={index}>{info}</div>
            ))}
          </pre>
        </details>
        
        <details>
          <summary>Events ({events.length})</summary>
          <pre>
            {events.map((event, index) => (
              <div key={index} className="event-item">
                <div>{event.type}</div>
                <pre>{JSON.stringify(event, null, 2)}</pre>
              </div>
            ))}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default RealtimeAudioPlayer; 