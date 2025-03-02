import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import DoubtBox from './DoubtBox';

const VisualizationController = ({ 
  visualizationComponent: VisualizationComponent,
  data,
  topic
}) => {
  const [highlightedElements, setHighlightedElements] = useState([]);
  const [narration, setNarration] = useState('');
  const [originalNarration, setOriginalNarration] = useState('');
  const [isOriginalNarration, setIsOriginalNarration] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [narrationTimestamps, setNarrationTimestamps] = useState([]);
  
  // Add new state for caching
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [originalTimestamps, setOriginalTimestamps] = useState([]);
  const [originalPlaybackPosition, setOriginalPlaybackPosition] = useState(0);
  
  // Add new state for enhanced features
  const [interactiveElements, setInteractiveElements] = useState([]);
  const [relatedConcepts, setRelatedConcepts] = useState([]);
  const [showingExample, setShowingExample] = useState(false);
  
  const visualizationRef = useRef(null);
  const audioRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Initialize narration from data prop
  useEffect(() => {
    if (data?.narration) {
      setNarration(data.narration);
      setOriginalNarration(data.narration);
      setIsOriginalNarration(true);
      
      // Check if we have cached audio for this narration
      const cachedAudioUrl = localStorage.getItem(`${topic}_audio_url`);
      const cachedWordTimings = localStorage.getItem(`${topic}_word_timings`);
      const cachedNarrationText = localStorage.getItem(`${topic}_narration_text`);

      if (cachedAudioUrl && cachedWordTimings && cachedNarrationText === data.narration) {
        console.log('Using cached audio file:', cachedAudioUrl);
        // Verify the cached audio file is still accessible
        fetch(cachedAudioUrl)
          .then(response => {
            if (response.ok) {
              setOriginalAudioUrl(cachedAudioUrl);
              setOriginalTimestamps(JSON.parse(cachedWordTimings));
              setAudioUrl(cachedAudioUrl);
              setNarrationTimestamps(JSON.parse(cachedWordTimings));
            } else {
              throw new Error('Cached audio file not accessible');
            }
          })
          .catch(error => {
            console.warn('Cached audio not available, generating new audio:', error);
            generateNarrationAudio(data.narration, true);
          });
      } else {
        // Generate new audio if no cache or narration text has changed
        generateNarrationAudio(data.narration, true);
      }
    }
  }, [data]);

  const generateNarrationAudio = async (text, isOriginal = false) => {
    try {
      console.log('Generating audio for text:', text);
      const response = await fetch('/api/narration/' + topic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Audio generation result:', result);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.audio_url) {
        throw new Error('No audio URL returned from server');
      }

      // Test audio availability before setting URL
      try {
        const audioTest = await fetch(result.audio_url);
        if (!audioTest.ok) {
          throw new Error(`Audio file not accessible: ${audioTest.status}`);
        }
      } catch (audioError) {
        console.error('Audio file test failed:', audioError);
        throw new Error('Generated audio file is not accessible');
      }

      console.log('Setting audio URL:', result.audio_url);
      
      // Store audio data in appropriate state based on whether it's original or not
      if (isOriginal) {
        setOriginalAudioUrl(result.audio_url);
        setOriginalTimestamps(result.word_timings || []);
        setAudioUrl(result.audio_url);
        setNarrationTimestamps(result.word_timings || []);
      } else {
        setAudioUrl(result.audio_url);
        setNarrationTimestamps(result.word_timings || []);
      }

    } catch (error) {
      console.error('Error generating audio:', error);
      console.error('Error details:', {
        topic,
        textLength: text?.length,
        error: error.toString()
      });
      if (isOriginal) {
        setOriginalAudioUrl(null);
        setOriginalTimestamps([]);
      }
      setAudioUrl(null);
      setNarrationTimestamps([]);
      // Show error to user
      setNarration(prev => prev + '\n\nError generating audio: ' + error.message);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      cancelAnimationFrame(animationFrameRef.current);
      // Store current position if playing original narration
      if (isOriginalNarration) {
        setOriginalPlaybackPosition(audioRef.current.currentTime * 1000);
      }
    } else {
      // If returning to original narration, set the time to stored position
      if (isOriginalNarration && originalPlaybackPosition > 0) {
        audioRef.current.currentTime = originalPlaybackPosition / 1000;
      }
      audioRef.current.play();
      updateHighlights();
    }
    setIsPlaying(!isPlaying);
  };

  const updateHighlights = () => {
    if (!audioRef.current || !narrationTimestamps.length) return;

    const currentTime = audioRef.current.currentTime * 1000; // Convert to milliseconds
    setCurrentTime(currentTime);

    // Find current word timings
    const currentTimings = narrationTimestamps.filter(
      timing => currentTime >= timing.start_time && currentTime <= timing.end_time
    );

    // Update highlights based on current timings
    if (currentTimings.length > 0) {
      const elementsToHighlight = currentTimings
        .filter(timing => timing.node_id) // Only include timings with node_ids
        .map(timing => ({
          id: timing.node_id,
          type: 'highlight'
        }));

      if (elementsToHighlight.length > 0) {
        setHighlightedElements(elementsToHighlight);
      }
    } else {
      // Clear highlights if no current timings
      setHighlightedElements([]);
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateHighlights);
  };

  // Add cleanup for highlights when audio ends or errors
  const handleAudioEnd = () => {
    setIsPlaying(false);
    setHighlightedElements([]);
    cancelAnimationFrame(animationFrameRef.current);
  };

  const handleAudioError = (error) => {
    console.error('Audio playback error:', error);
    setIsPlaying(false);
    setAudioUrl(null);
    setHighlightedElements([]); // Clear highlights on error
    // Attempt to regenerate audio
    if (narration) {
      console.log('Attempting to regenerate audio...');
      generateNarrationAudio(narration);
    }
  };

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleRestoreOriginalNarration = () => {
    setNarration(originalNarration);
    setHighlightedElements([]);
    setIsOriginalNarration(true);
    // Use cached original audio if available
    if (originalAudioUrl) {
      setAudioUrl(originalAudioUrl);
      setNarrationTimestamps(originalTimestamps);
      // Reset current playback if audio is not playing
      if (!isPlaying && audioRef.current) {
        audioRef.current.currentTime = originalPlaybackPosition / 1000;
      }
    } else {
      // Regenerate if not cached (shouldn't happen in normal flow)
      generateNarrationAudio(originalNarration, true);
    }
  };

  const handleDoubtSubmission = async (doubt) => {
    try {
        if (isPlaying && isOriginalNarration && audioRef.current) {
            setOriginalPlaybackPosition(audioRef.current.currentTime * 1000);
            audioRef.current.pause();
            setIsPlaying(false);
        }

        setNarration("Processing your question...");

        const response = await fetch('/api/process-doubt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                doubt,
                topic,
                currentState: {
                    data,
                    highlightedElements,
                    currentTime: audioRef.current?.currentTime * 1000 || 0,
                    isOriginalNarration,
                    currentNarration: narration
                },
                relevantNodes: data.nodes
                    .filter(node => highlightedElements.some(h => h.id === node.id))
                    .map(node => ({
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        properties: node.properties || node.columns
                    }))
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }

        // Try to parse the response if it's a string
        let parsedResult = result;
        if (typeof result === 'string') {
            try {
                parsedResult = JSON.parse(result);
            } catch (e) {
                console.warn('Could not parse response as JSON, using as-is');
                parsedResult = { explanation: result };
            }
        }

        // Format the response for better readability
        let formattedNarration = '';
        
        // Add the question for context
        formattedNarration += `Q: ${doubt}\n\n`;
        
        // Add the main explanation
        if (parsedResult.explanation) {
            formattedNarration += parsedResult.explanation + '\n\n';
        }

        // Add any additional context or related information
        if (parsedResult.additionalInfo) {
            formattedNarration += parsedResult.additionalInfo + '\n\n';
        }

        // Add component details with improved formatting
        if (parsedResult.componentDetails) {
            formattedNarration += 'Key Components:\n';
            Object.entries(parsedResult.componentDetails).forEach(([key, value]) => {
                formattedNarration += `• ${key}: ${typeof value === 'string' ? value : value.description}\n`;
            });
            formattedNarration += '\n';
        }

        // Add examples section
        if (parsedResult.examples?.length) {
            formattedNarration += 'Examples:\n';
            parsedResult.examples.forEach((example, i) => {
                formattedNarration += `${i + 1}. ${example}\n`;
            });
            formattedNarration += '\n';
        }

        // Add recommendations section
        if (parsedResult.recommendations?.length) {
            formattedNarration += 'Recommendations:\n';
            parsedResult.recommendations.forEach(rec => {
                formattedNarration += `• ${rec}\n`;
            });
        }

        setNarration(formattedNarration);
        setIsOriginalNarration(false);
        
        if (parsedResult.highlightElements) {
            setHighlightedElements(parsedResult.highlightElements);
        }

        if (formattedNarration) {
            generateNarrationAudio(formattedNarration, false);
        }

    } catch (error) {
        console.error('Error processing doubt:', error);
        setNarration(`I apologize, but I encountered an error while processing your question:\n${error.message}\n\nPlease try rephrasing your question or ask about a different aspect of the topic.`);
        setIsOriginalNarration(false);
    }
};

  // Add components for enhanced features
  const renderInteractiveElements = () => {
    if (!interactiveElements.length) return null;

    return (
      <div className="interactive-suggestions">
        {interactiveElements.map((element, index) => (
          <div key={index} className="interactive-suggestion">
            <span className={`icon ${element.type}`} />
            <span className="message">{element.message}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderRelatedConcepts = () => {
    if (!relatedConcepts.length) return null;

    return (
      <div className="related-concepts">
        <h4>Related Concepts</h4>
        <div className="concept-list">
          {relatedConcepts.map((concept, index) => (
            <button
              key={index}
              className="concept-button"
              onClick={() => handleDoubtSubmission(`Tell me about ${concept}`)}
            >
              {concept}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Add a helper function to format the doubt response
  const formatDoubtResponse = (response) => {
    const { explanation, components, examples, recommendations } = response;
    let formatted = '';

    if (explanation) {
      formatted += `${explanation}\n\n`;
    }

    if (components?.length) {
      formatted += 'Key Components:\n';
      components.forEach(comp => {
        formatted += `• ${comp.name}: ${comp.description}\n`;
      });
      formatted += '\n';
    }

    if (examples?.length) {
      formatted += 'Examples:\n';
      examples.forEach(example => {
        formatted += `• ${example}\n`;
      });
      formatted += '\n';
    }

    if (recommendations?.length) {
      formatted += 'Recommendations:\n';
      recommendations.forEach(rec => {
        formatted += `• ${rec}\n`;
      });
    }

    return formatted;
  };

  // Add debug logging for render
  useEffect(() => {
    console.log('Current state:', {
      hasNarration: Boolean(narration),
      hasAudioUrl: Boolean(audioUrl),
      isOriginalNarration,
      originalPlaybackPosition,
      audioUrl,
      isPlaying
    });
  }, [narration, audioUrl, isPlaying, isOriginalNarration, originalPlaybackPosition]);

  return (
    <div className="visualization-controller">
      <div className="main-panel">
        <div className="visualization-and-narration">
          <div className="visualization-container">
            <VisualizationComponent
              data={data}
              highlightedElements={highlightedElements}
              ref={visualizationRef}
            />
            {renderInteractiveElements()}
          </div>
          {narration && (
            <div className="narration-box">
              <div className="narration-header">
                <h3>Explanation</h3>
                <div className="narration-controls">
                  {!isOriginalNarration && (
                    <button 
                      className="restore-button"
                      onClick={handleRestoreOriginalNarration}
                    >
                      Restore Original
                    </button>
                  )}
                  <button 
                    className="play-button"
                    onClick={handlePlayPause}
                    disabled={!audioUrl}
                  >
                    {isPlaying ? 'Pause' : 'Play'} Narration
                  </button>
                </div>
              </div>
              <div className="narration-text">
                {narration}
              </div>
              {renderRelatedConcepts()}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={handleAudioEnd}
                  onError={handleAudioError}
                  style={{ display: 'none' }}
                />
              )}
            </div>
          )}
        </div>
        <div className="doubt-box-container">
          <DoubtBox
            topic={topic}
            onSubmitDoubt={handleDoubtSubmission}
          />
        </div>
      </div>
      <style jsx>{`
        .visualization-controller {
          width: 100%;
          height: 100%;
          padding: 20px;
        }

        .main-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
        }

        .visualization-and-narration {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          flex: 1;
          min-height: 0;
        }

        .visualization-container {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          height: 100%;
        }

        .narration-box {
          background: #ffffff;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow-y: auto;
          max-height: 100%;
        }

        .narration-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .narration-header h3 {
          margin: 0;
          color: #2d3748;
          font-size: 16px;
          font-weight: 600;
        }

        .narration-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .restore-button, .play-button {
          padding: 4px 8px;
          font-size: 12px;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .restore-button {
          color: #4299e1;
          border: 1px solid #4299e1;
        }

        .restore-button:hover {
          background: #4299e1;
          color: white;
        }

        .play-button {
          color: #48bb78;
          border: 1px solid #48bb78;
          opacity: 1;
        }

        .play-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .play-button:not(:disabled):hover {
          background: #48bb78;
          color: white;
        }

        .narration-text {
          font-size: 14px;
          line-height: 1.6;
          color: #4a5568;
          white-space: pre-wrap;
        }

        .doubt-box-container {
          padding: 15px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .interactive-suggestions {
          position: absolute;
          bottom: 20px;
          left: 20px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .interactive-suggestion {
          background: rgba(255, 255, 255, 0.9);
          padding: 8px 12px;
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #4a5568;
        }

        .interactive-suggestion .icon {
          width: 20px;
          height: 20px;
          background-size: contain;
        }

        .related-concepts {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }

        .related-concepts h4 {
          margin: 0 0 10px;
          font-size: 14px;
          color: #2d3748;
        }

        .concept-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .concept-button {
          padding: 4px 8px;
          background: #edf2f7;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.2s;
        }

        .concept-button:hover {
          background: #e2e8f0;
          color: #2d3748;
        }
      `}</style>
    </div>
  );
};

export default VisualizationController; 