import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const DocumentVisualization = ({ data, highlightedElements, currentTime }) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const simulationRef = useRef(null);
    
    // Function to calculate collection height based on document content
    const calculateCollectionHeight = (document, level = 0) => {
        let height = 30; // Header height
        
        const processValue = (value, currentLevel) => {
            if (Array.isArray(value)) {
                height += 25; // Array header
                value.forEach(item => {
                    if (typeof item === 'object' && item !== null) {
                        processValue(item, currentLevel + 1);
                    } else {
                        height += 25;
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                Object.entries(value).forEach(([key, val]) => {
                    height += 25;
                    if (typeof val === 'object' && val !== null) {
                        processValue(val, currentLevel + 1);
                    }
                });
            }
        };

        processValue(document, level);
        return height;
    };

    // Function to recursively render document content
    const renderDocument = (parent, content, x, y, level = 0, indentSize = 20) => {
        if (Array.isArray(content)) {
            // Render array
            parent.append('text')
                .attr('x', x + level * indentSize)
                .attr('y', y)
                .style('fill', '#a0aec0')
                .style('font-family', 'monospace')
                .style('font-size', '12px')
                .text('[');
            
            content.forEach((item, index) => {
                y += 25;
                if (typeof item === 'object' && item !== null) {
                    y = renderDocument(parent, item, x, y, level + 1, indentSize);
                } else {
                    parent.append('text')
                        .attr('x', x + (level + 1) * indentSize)
                        .attr('y', y)
                        .style('fill', '#e2e8f0')
                        .style('font-family', 'monospace')
                        .style('font-size', '12px')
                        .text(JSON.stringify(item) + (index < content.length - 1 ? ',' : ''));
                }
            });
            
            y += 25;
            parent.append('text')
                .attr('x', x + level * indentSize)
                .attr('y', y)
                .style('fill', '#a0aec0')
                .style('font-family', 'monospace')
                .style('font-size', '12px')
                .text(']');
                
        } else if (typeof content === 'object' && content !== null) {
            // Render object
            Object.entries(content).forEach(([key, value]) => {
                parent.append('text')
                    .attr('x', x + level * indentSize)
                    .attr('y', y)
                    .style('fill', '#a0aec0')
                    .style('font-family', 'monospace')
                    .style('font-size', '12px')
                    .text(key + ': ');

                if (typeof value === 'object' && value !== null) {
                    y += 25;
                    y = renderDocument(parent, value, x, y, level + 1, indentSize);
                } else {
                    parent.append('text')
                        .attr('x', x + level * indentSize + key.length * 7 + 10)
                        .attr('y', y)
                        .style('fill', '#e2e8f0')
                        .style('font-family', 'monospace')
                        .style('font-size', '12px')
                        .text(JSON.stringify(value));
                }
                y += 25;
            });
        }
        return y;
    };

    useEffect(() => {
        if (!containerRef.current || !data || !data.nodes) {
            console.error('Missing required data for DocumentVisualization', { data });
            return;
        }

        // Check if nodes have the document property
        const nodesWithDocuments = data.nodes.filter(node => node.document);
        if (nodesWithDocuments.length === 0) {
            console.error('No document data found in nodes', { nodes: data.nodes });
            
            // Try to extract document data from attributes if available
            const processedNodes = data.nodes.map(node => {
                if (!node.document && node.attributes) {
                    // Create a document object from attributes
                    const document = {};
                    node.attributes.forEach(attr => {
                        document[attr.name] = attr.isKey ? `${attr.name} (Primary Key)` : attr.name;
                    });
                    return { ...node, document };
                }
                return node;
            });
            
            // Update data.nodes with processed nodes
            data.nodes = processedNodes;
        }

        // Log the node IDs for debugging
        console.log('DocumentVisualization: Available node IDs:', data.nodes.map(node => node.id));
        console.log('DocumentVisualization: Current highlighted elements:', highlightedElements);
        console.log('DocumentVisualization: Current time:', currentTime);

        // Constants
        const collectionWidth = 400;
        const padding = 20;

        // Get container dimensions
        const container = d3.select(containerRef.current);
        const width = container.node().clientWidth;
        const height = container.node().clientHeight;

        // Clear any existing SVG
        container.selectAll('*').remove();

        // Create SVG with zoom support
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background-color', '#1a202c');
            
        svgRef.current = svg;

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 2])
            .on('zoom', (event) => g.attr('transform', event.transform));

        svg.call(zoom);

        // Create a container for the zoomable content
        const g = svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        // Calculate collection heights
        const nodes = data.nodes.map(node => ({
            ...node,
            height: calculateCollectionHeight(node.document || {})
        }));

        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(data.edges || [])
                .id(d => d.id)
                .distance(400)
                .strength(0.2))
            .force('charge', d3.forceManyBody()
                .strength(-2000))
            .force('collide', d3.forceCollide()
                .radius(d => Math.max(collectionWidth, d.height)/2 + 50)
                .strength(1))
            .force('x', d3.forceX(0).strength(0.1))
            .force('y', d3.forceY(0).strength(0.1));
            
        simulationRef.current = simulation;

        // Create reference lines
        if (data.edges) {
            const reference = g.selectAll('.reference')
                .data(data.edges)
                .join('g')
                .attr('class', d => `reference reference-${d.source}-${d.target}`);

            reference.append('path')
                .attr('class', 'reference-path')
                .style('fill', 'none')
                .style('stroke', '#4299e1')
                .style('stroke-width', '2px')
                .style('stroke-dasharray', '5,5')
                .style('opacity', 0.6);

            reference.append('text')
                .attr('class', 'reference-label')
                .style('fill', '#4299e1')
                .style('font-size', '12px')
                .style('font-family', 'monospace')
                .text(d => d.description || d.type);
        }

        // Create collections
        const collection = g.selectAll('.collection')
            .data(nodes)
            .join('g')
            .attr('class', d => `collection collection-${d.id}`)
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        // Add collection background
        collection.append('rect')
            .attr('class', 'collection-bg')
            .attr('x', -collectionWidth/2)
            .attr('y', d => -d.height/2)
            .attr('width', collectionWidth)
            .attr('height', d => d.height)
            .attr('rx', 8)
            .style('fill', '#2a4365')
            .style('stroke', '#4299e1')
            .style('stroke-width', '2px');

        // Add collection header
        collection.append('rect')
            .attr('class', 'collection-header')
            .attr('x', -collectionWidth/2)
            .attr('y', d => -d.height/2)
            .attr('width', collectionWidth)
            .attr('height', 30)
            .attr('rx', 8)
            .style('fill', '#4299e1');

        // Add collection name
        collection.append('text')
            .attr('class', 'collection-name')
            .attr('x', -collectionWidth/2 + padding)
            .attr('y', d => -d.height/2 + 20)
            .style('fill', 'white')
            .style('font-weight', 'bold')
            .style('font-size', '14px')
            .text(d => d.name);

        // Render document content for each collection
        collection.each(function(d) {
            const documentGroup = d3.select(this);
            if (d.document) {
                renderDocument(
                    documentGroup,
                    d.document,
                    -collectionWidth/2 + padding,
                    -d.height/2 + 50
                );
            }
        });

        // Update force simulation on tick
        simulation.on('tick', () => {
            // Update reference paths and labels
            if (data.edges) {
                g.selectAll('.reference').each(function(d) {
                    const path = d3.select(this).select('.reference-path');
                    const label = d3.select(this).select('.reference-label');
                    
                    if (!d.source || !d.target) return;
                    
                    const sourceX = d.source.x || 0;
                    const sourceY = d.source.y || 0;
                    const targetX = d.target.x || 0;
                    const targetY = d.target.y || 0;
                    
                    const pathData = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
                    
                    path.attr('d', pathData);
                    
                    // Position label at midpoint
                    const midX = (sourceX + targetX) / 2;
                    const midY = (sourceY + targetY) / 2;
                    
                    label.attr('x', midX)
                        .attr('y', midY - 10)
                        .style('text-anchor', 'middle');
                });
            }

            // Update collection positions
            collection.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
        });

        // Apply highlighting based on highlightedElements
        if (highlightedElements && highlightedElements.length > 0) {
            console.log('Applying highlights to DocumentVisualization:', highlightedElements);
            
            // Reset all elements to normal state
            svg.selectAll('.collection-bg, .reference-path')
                .style('stroke', '#4299e1')
                .style('stroke-width', '2px')
                .style('opacity', 0.6);
            
            // Highlight specified elements
            highlightedElements.forEach(id => {
                console.log('Highlighting element:', id);
                
                // Highlight collections - use exact ID matching
                const collectionElements = svg.selectAll(`.collection-${id} .collection-bg`);
                collectionElements
                    .style('stroke', '#f56565')
                    .style('stroke-width', '4px')
                    .style('opacity', 1);
                
                console.log(`Found ${collectionElements.size()} collection elements for ID: ${id}`);
                
                // Highlight references - use exact ID matching
                const referenceElements = svg.selectAll(`.reference-${id}`)
                    .selectAll('.reference-path');
                referenceElements
                    .style('stroke', '#f56565')
                    .style('stroke-width', '4px')
                    .style('opacity', 1);
                
                console.log(`Found ${referenceElements.size()} reference elements for ID: ${id}`);
                
                // If no elements were found, try a more specific approach
                if (collectionElements.size() === 0 && referenceElements.size() === 0) {
                    console.log(`No elements found with exact ID ${id}, trying more specific selectors`);
                    
                    // Try to find the collection by data attribute
                    const collectionsByData = g.selectAll('.collection')
                        .filter(function(d) {
                            return d.id === id;
                        });
                    
                    if (collectionsByData.size() > 0) {
                        console.log(`Found ${collectionsByData.size()} collections by data attribute for ID: ${id}`);
                        collectionsByData.select('.collection-bg')
                            .style('stroke', '#f56565')
                            .style('stroke-width', '4px')
                            .style('opacity', 1);
                    } else {
                        console.log(`No collections found by data attribute for ID: ${id}`);
                    }
                    
                    // Try to find references by data attribute
                    const referencesByData = g.selectAll('.reference')
                        .filter(function(d) {
                            return d.source === id || d.target === id || 
                                   (d.source && d.source.id === id) || 
                                   (d.target && d.target.id === id);
                        });
                    
                    if (referencesByData.size() > 0) {
                        console.log(`Found ${referencesByData.size()} references by data attribute for ID: ${id}`);
                        referencesByData.select('.reference-path')
                            .style('stroke', '#f56565')
                            .style('stroke-width', '4px')
                            .style('opacity', 1);
                    } else {
                        console.log(`No references found by data attribute for ID: ${id}`);
                    }
                }
            });
        } else {
            console.log('No highlights to apply in DocumentVisualization');
        }

        // Cleanup function
        return () => {
            simulation.stop();
        };
    }, [data, highlightedElements, currentTime]); // Re-run effect when data, highlightedElements, or currentTime changes

    return (
        <div 
            ref={containerRef} 
            style={{ width: "100%", height: "100%" }} 
        />
    );
};

// Assign to global variable so it's accessible
window.DocumentVisualization = DocumentVisualization;

export default DocumentVisualization;
