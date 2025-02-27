import React, { useState, useRef, useEffect } from 'react';
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
    oop_concepts: OOPConceptsVisualization
};

const App = () => {
    const [topic, setTopic] = useState('');
    const [data, setData] = useState(null);
    const visualizationRef = useRef(null);

    useEffect(() => {
        if (!topic) return;

        fetch(`/api/visualization`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic })
        })
        .then(async response => {
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            return response.json();
        })
        .then(responseData => {
            setData({
                nodes: responseData.nodes,
                edges: responseData.edges,
                narration: responseData.narration
            });
        })
        .catch(error => {
            console.error('Error loading visualization:', error);
            setData(null);
        });
    }, [topic]);


    const handleTopicChange = (e) => {
        setTopic(e.target.value);
    };

    const handleNodeClick = (node) => {
        console.log('Clicked:', node);
        if (visualizationRef.current?.highlightNode) {
            visualizationRef.current.highlightNode(node.id);
            setTimeout(() => {
                visualizationRef.current?.resetHighlights();
            }, 2000);
        }
    };

    const renderVisualization = () => {
        if (!data || !topic) return null;

        const VisualizationComponent = VISUALIZATIONS[topic];
        if (!VisualizationComponent) {
            return <div>Visualization type not supported</div>;
        }

        const props = {
            data: {
                nodes: data.nodes,
                edges: data.edges
            },
            onNodeClick: handleNodeClick,
            ref: visualizationRef
        };

        return <VisualizationComponent {...props} />;
    };

    return (
        <div className="app-container">
            <div className="controls">
                <select value={topic} onChange={handleTopicChange}>
                    <option value="">Select a visualization</option>
                    <option value="er">Entity-Relationship Model</option>
                    <option value="document">Document Model</option>
                    <option value="hierarchical">Hierarchical Model</option>
                    <option value="entity">Entity Model</option>
                    <option value="attribute">Attribute Model</option>
                    <option value="shared_memory">Shared Memory Model</option>
                    <option value="shared_disk">Shared Disk Model</option>
                    <option value="shared_nothing">Shared Nothing Model</option>
                    <option value="distributed_database">Distributed Database Model</option>
                    <option value="oop_concepts">OOP Concepts Model</option>
                </select>
            </div>
            <div className="content-container">
                <div className="visualization-container">
                    {renderVisualization()}
                </div>
                {data?.narration && (
                    <div className="narration-container">
                        <h3>Narration</h3>
                        <div className="narration-text">
                            {data.narration}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .app-container {
                    padding: 20px;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background-color: #f8fafc;
                }
                .controls {
                    margin-bottom: 20px;
                    text-align: center;
                }
                .content-container {
                    flex: 1;
                    min-height: 0;
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                }
                .visualization-container {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                }
                .narration-container {
                    background-color: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    padding: 20px;
                    overflow-y: auto;
                }
                .narration-container h3 {
                    margin-top: 0;
                    color: #1e40af;
                    font-size: 1.2rem;
                    margin-bottom: 1rem;
                }
                .narration-text {
                    color: #374151;
                    line-height: 1.6;
                    font-size: 1rem;
                    white-space: pre-wrap;
                }
            `}</style>
        </div>
    );
};

export default App;