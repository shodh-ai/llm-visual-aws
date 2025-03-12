import React from 'react';

const ResponsePanel = ({ 
  response, 
  audioUrl, 
  isAudioPlaying, 
  onPlayAudio, 
  audioRef 
}) => {
  return (
    <div className="response-panel card">
      <h2>Response</h2>
      
      {audioUrl && (
        <div className="audio-player">
          <button 
            onClick={onPlayAudio}
            className="btn play-btn"
            disabled={!audioUrl}
          >
            {isAudioPlaying ? 'Pause Audio' : 'Play Audio'}
          </button>
          
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            controls 
            className="audio-control"
          />
        </div>
      )}
      
      <div className="response-content">
        {response ? (
          <p>{response}</p>
        ) : (
          <p className="empty-response">Select a topic and ask a question to see a response.</p>
        )}
      </div>
      
      <style jsx>{`
        .response-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        h2 {
          color: var(--text-color);
          font-size: 1.5rem;
          margin: 0;
        }
        
        .audio-player {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 10px;
        }
        
        .play-btn {
          align-self: flex-start;
        }
        
        .audio-control {
          width: 100%;
          border-radius: 4px;
        }
        
        .response-content {
          background-color: var(--background-color);
          padding: 15px;
          border-radius: 4px;
          max-height: 300px;
          overflow-y: auto;
          line-height: 1.6;
        }
        
        .empty-response {
          color: #666;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default ResponsePanel; 