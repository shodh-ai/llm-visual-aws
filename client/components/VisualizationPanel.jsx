import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const VisualizationPanel = ({ 
  data, 
  isLoading, 
  highlightedElements, 
  topic 
}) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  
  // Create visualization when data changes
  useEffect(() => {
    if (!data || !containerRef.current) return;
    
    // Clear any previous visualization
    d3.select(containerRef.current).selectAll('*').remove();
    
    // Create the visualization based on the data
    createVisualization();
    
    // Cleanup function
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [data, topic]);
  
  // Update highlighted elements when they change
  useEffect(() => {
    if (!data || !svgRef.current || !highlightedElements) return;
    
    // Remove previous highlights
    d3.select(svgRef.current)
      .selectAll('.node')
      .classed('highlighted', false);
    
    // Add new highlights
    highlightedElements.forEach(id => {
      d3.select(svgRef.current)
        .selectAll('.node')
        .filter(d => d.id === id)
        .classed('highlighted', true);
    });
  }, [highlightedElements, data]);
  
  // Create the visualization
  const createVisualization = () => {
    // Get container dimensions
    const container = d3.select(containerRef.current);
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    
    // Create SVG
    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');
    
    svgRef.current = svg.node();
    
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create a container for the zoomable content
    const g = svg.append('g');
    
    // Extract nodes and links from data
    const nodes = data.nodes || [];
    const links = data.edges || [];
    
    // Create force simulation
    simulationRef.current = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));
    
    // Create links
    const link = g.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => d.value || 1);
    
    // Create nodes
    const node = g.append('g')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(drag(simulationRef.current));
    
    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.type === 'relationship' ? 30 : 20)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);
    
    // Add labels for nodes
    node.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.name || d.id)
      .attr('fill', 'white')
      .attr('font-size', '12px');
    
    // Update positions on simulation tick
    simulationRef.current.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
  };
  
  // Get node color based on type
  const getNodeColor = (node) => {
    switch (node.type) {
      case 'entity':
        return '#4299e1';
      case 'relationship':
        return '#9f7aea';
      case 'attribute':
        return '#48bb78';
      default:
        return '#718096';
    }
  };
  
  // Drag function for nodes
  const drag = (simulation) => {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };
  
  return (
    <div className="visualization-panel" ref={containerRef}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading visualization...</p>
        </div>
      )}
      
      {!data && !isLoading && (
        <div className="empty-state">
          <p>Select a topic to view its visualization</p>
        </div>
      )}
      
      <style jsx>{`
        .visualization-panel {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(255, 255, 255, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        
        .empty-state {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          font-style: italic;
        }
        
        :global(.node.highlighted circle) {
          stroke: #ffd700;
          stroke-width: 3px;
          filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5));
        }
      `}</style>
    </div>
  );
};

export default VisualizationPanel; 