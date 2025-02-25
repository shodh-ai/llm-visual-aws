import React from 'react';
import * as d3 from 'd3';

const ERVisualization = ({ data, onNodeClick }) => {
    const containerRef = React.useRef(null);
    React.useEffect(() => {
        // Validate input data
        if (!containerRef.current || !data || !data.nodes || !Array.isArray(data.nodes) || 
            data.nodes.length === 0 || !data.edges || !Array.isArray(data.edges)) {
            console.error('Invalid data format for ER visualization');
            return;
        }

        // Constants
        const entityWidth = 200;
        const relationshipSize = 120;
        const rowHeight = 25;

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

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 2])
            .on('zoom', (event) => g.attr('transform', event.transform));

        svg.call(zoom);

        // Create a container for the zoomable content
        const g = svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        // Calculate node heights
        const nodes = data.nodes.map(node => ({
            ...node,
            height: ((node.attributes ? node.attributes.length : 0) + 1) * rowHeight
        }));

        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(data.edges)
                .id(d => d.id)
                .distance(300)
                .strength(0.2))
            .force('charge', d3.forceManyBody()
                .strength(-2000))
            .force('collide', d3.forceCollide()
                .radius(d => d.type === 'relationship' ? relationshipSize/2 : entityWidth/2)
                .strength(1))
            .force('x', d3.forceX(0).strength(0.1))
            .force('y', d3.forceY(0).strength(0.1));

        // Create relationship lines
        const relationship = g.selectAll('.relationship-line')
            .data(data.edges)
            .join('g')
            .attr('class', 'relationship-line');

        // Add path for each relationship
        relationship.append('path')
            .attr('class', 'relationship-path')
            .style('fill', 'none')
            .style('stroke', '#4299e1')
            .style('stroke-width', '2px');

        // Add cardinality labels
        relationship.append('text')
            .attr('class', 'cardinality')
            .style('fill', '#4299e1')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('font-family', 'system-ui')
            .text(d => {
                switch(d.cardinality) {
                    case 'one': return '1';
                    case 'one_or_many': return 'N';
                    case 'zero_or_many': return '0..N';
                    case 'one_or_zero': return '0..1';
                    default: return '';
                }
            });

        // Create nodes (entities and relationships)
        const node = g.selectAll('.node')
            .data(nodes)
            .join('g')
            .attr('class', 'node')
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

        // Add shapes based on node type
        node.each(function(d) {
            const nodeGroup = d3.select(this);
            
            if (d.type === 'entity') {
                // Rectangle for entities
                nodeGroup.append('rect')
                    .attr('x', -entityWidth/2)
                    .attr('y', d => -d.height/2)
                    .attr('width', entityWidth)
                    .attr('height', d => d.height)
                    .attr('rx', 5)
                    .style('fill', '#2c5282')
                    .style('stroke', '#4299e1')
                    .style('stroke-width', '2px');
            } else {
                // Diamond for relationships
                const points = [
                    [0, -relationshipSize/2],
                    [relationshipSize/2, 0],
                    [0, relationshipSize/2],
                    [-relationshipSize/2, 0]
                ].map(point => point.join(',')).join(' ');
                
                nodeGroup.append('polygon')
                    .attr('points', points)
                    .style('fill', '#2a4365')
                    .style('stroke', '#4299e1')
                    .style('stroke-width', '2px');
            }

            // Add node name
            nodeGroup.append('text')
                .attr('class', 'node-name')
                .attr('y', d.type === 'relationship' ? 0 : -d.height/2 + rowHeight/2 + 5)
                .style('fill', 'white')
                .style('font-weight', 'bold')
                .style('font-size', '14px')
                .style('text-anchor', 'middle')
                .style('dominant-baseline', 'middle')
                .text(d.name);

            // Add attributes for entities
            if (d.type === 'entity' && d.attributes) {
                d.attributes.forEach((attr, i) => {
                    const y = -d.height/2 + (i + 1) * rowHeight + rowHeight/2;
                    
                    // Key attribute indicator
                    if (attr.isKey) {
                        nodeGroup.append('text')
                            .attr('x', -entityWidth/2 + 10)
                            .attr('y', y + 5)
                            .style('fill', '#ffd700')
                            .style('font-size', '12px')
                            .text('🔑');
                    }
                    
                    // Attribute name
                    nodeGroup.append('text')
                        .attr('x', -entityWidth/2 + (attr.isKey ? 25 : 10))
                        .attr('y', y + 5)
                        .style('fill', 'white')
                        .style('font-size', '12px')
                        .text(attr.name);
                });
            }

            // Add attributes for relationships (if any)
            if (d.type === 'relationship' && d.attributes) {
                d.attributes.forEach((attr, i) => {
                    nodeGroup.append('text')
                        .attr('y', relationshipSize/4 + (i + 1) * 20)
                        .style('fill', '#a0aec0')
                        .style('font-size', '12px')
                        .style('text-anchor', 'middle')
                        .text(attr.name);
                });
            }
        });

        // Update force simulation on tick
        simulation.on('tick', () => {
            // Update relationship lines
            relationship.each(function(d) {
                const path = d3.select(this).select('.relationship-path');
                const label = d3.select(this).select('.cardinality');
                
                if (!d.source || !d.target) return;
                
                const sourceX = d.source.x || 0;
                const sourceY = d.source.y || 0;
                const targetX = d.target.x || 0;
                const targetY = d.target.y || 0;
                
                // Calculate the angle of the line
                const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
                
                // Calculate points for the relationship line
                const pathData = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
                
                path.attr('d', pathData);
                
                // Position cardinality label
                const labelDistance = 30;
                const labelX = sourceX + labelDistance * Math.cos(angle);
                const labelY = sourceY + labelDistance * Math.sin(angle);
                
                label.attr('x', labelX)
                    .attr('y', labelY)
                    .style('text-anchor', 'middle')
                    .style('dominant-baseline', 'middle');
            });

            // Update node positions
            node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
        });

        // Cleanup function
        return () => {
            simulation.stop();
        };
    }, [data, onNodeClick]); // Re-run effect when data or onNodeClick changes

    return React.createElement("div", { 
        ref: containerRef, 
        style: { width: "100%", height: "100%" } 
    });
};

// Assign to global variable so it's accessible
window.ERVisualization = ERVisualization;

export default ERVisualization;
