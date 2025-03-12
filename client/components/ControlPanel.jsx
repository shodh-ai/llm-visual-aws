import React, { useState } from 'react';

const ControlPanel = ({ 
  topics, 
  selectedTopic, 
  onTopicChange, 
  onDoubtSubmit, 
  isLoading, 
  isConnected 
}) => {
  const [doubt, setDoubt] = useState('');
  
  const handleTopicChange = (e) => {
    onTopicChange(e.target.value);
  };
  
  const handleDoubtSubmit = (e) => {
    e.preventDefault();
    if (doubt.trim()) {
      onDoubtSubmit(doubt);
    }
  };
  
  return (
    <div className="control-panel card">
      <div className="topic-selector">
        <label htmlFor="topic-select">Select a topic:</label>
        <select 
          id="topic-select"
          value={selectedTopic} 
          onChange={handleTopicChange}
          disabled={isLoading}
        >
          <option value="">-- Select a topic --</option>
          {topics.map(topic => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="doubt-form">
        <form onSubmit={handleDoubtSubmit}>
          <label htmlFor="doubt-input">Ask a question:</label>
          <div className="input-group">
            <input
              id="doubt-input"
              type="text"
              value={doubt}
              onChange={(e) => setDoubt(e.target.value)}
              placeholder="Ask a question about the visualization..."
              disabled={isLoading || !isConnected || !selectedTopic}
            />
            <button 
              type="submit" 
              className="btn"
              disabled={isLoading || !isConnected || !selectedTopic || !doubt.trim()}
            >
              {isLoading ? 'Processing...' : 'Ask'}
            </button>
          </div>
        </form>
      </div>
      
      <style jsx>{`
        .control-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .topic-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        label {
          font-weight: 500;
          color: var(--text-color);
        }
        
        select {
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 16px;
          background-color: white;
        }
        
        .doubt-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .input-group {
          display: flex;
          gap: 10px;
        }
        
        input {
          flex: 1;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 16px;
        }
        
        input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ControlPanel; 