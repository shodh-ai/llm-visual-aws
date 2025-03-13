import React, { useEffect, useRef, useState } from 'react';

const RealtimeAudioPlayer = ({ prompt, connectionId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [text, setText] = useState('');
  const [highlightedWord, setHighlightedWord] = useState('');
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isProcessingAudioRef = useRef(false);
  
  // Connect to WebSocket when component mounts
  useEffect(() => {
    if (!prompt || !connectionId) return;
    
    // Create WebSocket connection
    const ws = new WebSocket(`ws://${window.location.host}/realtime`);
    wsRef.current = ws;
    
    // Initialize audio context on user interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);
    
    // Handle WebSocket events
    ws.onopen = () => {
      console.log('Connected to realtime WebSocket');
      setIsConnected(true);
      
      // Start the realtime session
      ws.send(JSON.stringify({
        type: 'start_realtime',
        connectionId: connectionId
      }));
      
      // Send the prompt
      ws.send(JSON.stringify({
        type: 'text',
        text: prompt
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'text') {
        // Update text
        setText(prevText => prevText + data.text);
      } else if (data.type === 'audio') {
        // Queue audio for playback
        if (!isMuted) {
          const audioData = new Uint8Array(data.audio_data);
          audioQueueRef.current.push(audioData);
          processAudioQueue();
        }
      } else if (data.type === 'word') {
        // Update highlighted word
        setHighlightedWord(data.word);
      } else if (data.type === 'error') {
        console.error('Realtime error:', data.message);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };
    
    // Clean up on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'end' }));
        ws.close();
      }
      document.removeEventListener('click', initAudio);
    };
  }, [prompt, connectionId, isMuted]);
  
  // Process audio queue
  const processAudioQueue = async () => {
    if (isProcessingAudioRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) {
      return;
    }
    
    isProcessingAudioRef.current = true;
    setIsPlaying(true);
    
    try {
      const audioData = audioQueueRef.current.shift();
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        isProcessingAudioRef.current = false;
        if (audioQueueRef.current.length > 0) {
          processAudioQueue();
        } else {
          setIsPlaying(false);
        }
      };
      
      source.start();
    } catch (error) {
      console.error('Error processing audio:', error);
      isProcessingAudioRef.current = false;
      setIsPlaying(false);
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  return (
    <div className="realtime-player">
      <div className="text-display">
        {text}
        <span className="highlighted-word">{highlightedWord}</span>
      </div>
      
      <div className="controls">
        <button 
          onClick={toggleMute} 
          className={`mute-button ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        
        {isPlaying && <span className="playing-indicator">Playing audio...</span>}
      </div>
    </div>
  );
};

export default RealtimeAudioPlayer;
