import React, { useState } from 'react';

const DoubtBox = ({ topic, onSubmitDoubt }) => {
    const [doubt, setDoubt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!doubt.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            await onSubmitDoubt(doubt);
            setDoubt(''); // Clear the input after successful submission
        } catch (err) {
            setError('Failed to process your doubt. Please try again.');
            console.error('Error submitting doubt:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="doubt-box" style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            marginTop: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
            <h3 style={{ 
                marginBottom: '15px',
                color: '#2c3e50',
                fontSize: '1.2rem'
            }}>
                Ask About the Visualization
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                    <input
                        type="text"
                        value={doubt}
                        onChange={(e) => setDoubt(e.target.value)}
                        placeholder="Ask any question about the visualization..."
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '6px',
                            border: '2px solid #e2e8f0',
                            fontSize: '1rem',
                            transition: 'border-color 0.2s',
                            outline: 'none',
                            backgroundColor: isLoading ? '#f5f5f5' : 'white'
                        }}
                    />
                </div>
                
                {error && (
                    <div style={{
                        color: '#e74c3c',
                        fontSize: '0.9rem',
                        marginTop: '-8px'
                    }}>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!doubt.trim() || isLoading}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: doubt.trim() && !isLoading ? 'pointer' : 'not-allowed',
                        opacity: doubt.trim() && !isLoading ? 1 : 0.7,
                        fontSize: '1rem',
                        fontWeight: '500',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    {isLoading ? (
                        <>
                            <span className="loading-spinner" style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #ffffff',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            Processing...
                        </>
                    ) : 'Ask Question'}
                </button>
            </form>

            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .doubt-box input:focus {
                    border-color: #3b82f6;
                }
                .doubt-box button:not(:disabled):hover {
                    background-color: #1d4ed8;
                }
            `}</style>
        </div>
    );
};

export default DoubtBox;
