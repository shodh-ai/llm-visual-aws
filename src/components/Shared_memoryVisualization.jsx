import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const SharedMemoryVisualization = ({ data }) => {
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;
    
    // Clear any previous visualization
    d3.select(containerRef.current).selectAll('*').remove();
    
    // Create visualization
    simulationRef.current = createVisualization(data, containerRef.current);
    
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [data]);

  return (
    <div 
      id="visualization-container" 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', border: '1px solid #eaeaea' }}
    />
  );
};

const createVisualization = (data, containerElement) => {
  // Get container dimensions
  const container = d3.select(containerElement);
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;
  
  // Create SVG
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('background-color', '#fff');
  
  // Create main group
  const g = svg.append('g');
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 2])
    .on('zoom', (event) => g.attr('transform', event.transform));
  
  svg.call(zoom);

  // Add arrowhead markers for bidirectional connections
  const defs = svg.append('defs');
  
  defs.append('marker')
    .attr('id', 'arrowhead-up')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#4a5568');
    
  defs.append('marker')
    .attr('id', 'arrowhead-down')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('orient', 'auto-start-reverse')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#4a5568');

  // Group nodes by type
  const nodesByType = {};
  data.nodes.forEach(node => {
    if (!nodesByType[node.type]) {
      nodesByType[node.type] = [];
    }
    nodesByType[node.type].push(node);
  });

  // Set initial positions in a grid layout
  // CPU layer (top row)
  const cpuNodes = nodesByType['cpu'] || [];
  const cpuCount = cpuNodes.length;
  const cpuSpacing = width / (cpuCount + 1);
  
  cpuNodes.forEach((node, index) => {
    node.x = cpuSpacing * (index + 1);
    node.y = height * 0.2;
  });
  
  // Network layer (middle row)
  const networkNodes = nodesByType['network'] || [];
  networkNodes.forEach(node => {
    node.x = width / 2;
    node.y = height * 0.4;
    // Only fix the network node's position
    node.fx = width / 2;
    node.fy = height * 0.4;
  });
  
  // Bottom row - disks on left, shared memory on right
  const diskNodes = nodesByType['disk'] || [];
  const diskCount = diskNodes.length;
  const diskArea = width * 0.6;
  const diskSpacing = diskArea / (diskCount + 1);
  
  diskNodes.forEach((node, index) => {
    node.x = diskSpacing * (index + 1);
    node.y = height * 0.7;
  });
  
  // Position shared memory on the right side
  const memoryNodes = nodesByType['memory'] || [];
  memoryNodes.forEach(node => {
    node.x = width * 0.8;
    node.y = height * 0.7;
  });

  // Create links before nodes
  const links = g.append('g')
    .attr('class', 'links')
    .selectAll('path')
    .data(data.edges)
    .join('path')
    .attr('class', 'connection')
    .style('fill', 'none')
    .style('stroke', '#4a5568')
    .style('stroke-width', '2px')
    .style('marker-end', 'url(#arrowhead-up)')
    .style('marker-start', 'url(#arrowhead-down)');

  // Create nodes
  const nodes = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(data.nodes)
    .join('g')
    .attr('class', d => `node ${d.type}`)
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  // Draw shapes based on node type
  nodes.each(function(d) {
    const node = d3.select(this);
    
    if (d.type === 'memory') {
      // Memory nodes (rectangles)
      node.append('rect')
        .attr('width', 120)
        .attr('height', 50)
        .attr('x', -60)
        .attr('y', -25)
        .attr('rx', 2)
        .style('fill', '#ffffff')
        .style('stroke', '#4ade80')
        .style('stroke-width', '2px');
    } else if (d.type === 'cpu') {
      // CPU nodes (rectangles)
      node.append('rect')
        .attr('width', 80)
        .attr('height', 40)
        .attr('x', -40)
        .attr('y', -20)
        .attr('rx', 2)
        .style('fill', '#ffffff')
        .style('stroke', '#000000')
        .style('stroke-width', '2px');
    } else if (d.type === 'disk') {
      // Disk nodes (cylinders)
      const cylinderHeight = 80;
      const cylinderWidth = 80;
      const ellipseHeight = cylinderHeight * 0.2;
      
      // Cylinder body
      node.append('path')
        .attr('d', `
          M${-cylinderWidth/2},${-cylinderHeight/2 + ellipseHeight}
          v${cylinderHeight - ellipseHeight*2}
          a${cylinderWidth/2},${ellipseHeight} 0 0 0 ${cylinderWidth},0
          v${-cylinderHeight + ellipseHeight*2}
          a${cylinderWidth/2},${ellipseHeight} 0 0 0 ${-cylinderWidth},0
          z
        `)
        .style('fill', '#ffffff')
        .style('stroke', '#4ade80')
        .style('stroke-width', '2px');
        
      // Top ellipse
      node.append('ellipse')
        .attr('cx', 0)
        .attr('cy', -cylinderHeight/2 + ellipseHeight)
        .attr('rx', cylinderWidth/2)
        .attr('ry', ellipseHeight)
        .style('fill', '#ffffff')
        .style('stroke', '#4ade80')
        .style('stroke-width', '2px');
    } else if (d.type === 'network') {
      // Network node (rectangle)
      const networkWidth = width * 0.8;
      node.append('rect')
        .attr('width', networkWidth)
        .attr('height', 40)
        .attr('x', -networkWidth / 2)
        .attr('y', -20)
        .attr('rx', 2)
        .style('fill', '#ffffff')
        .style('stroke', '#4ade80')
        .style('stroke-width', '2px');
    }
    
    // Add text labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', 2)
      .style('fill', d.type === 'cpu' ? '#000000' : '#4ade80')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('font-family', 'sans-serif')
      .text(d.name);
  });

  // Setup simulation with modified forces
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.edges)
      .id(d => d.id)
      .distance(d => {
        // Link distances for organized layout
        if (d.source.type === 'cpu' && d.target.type === 'network') return 120;
        if (d.source.type === 'network' && d.target.type === 'disk') return 150;
        if (d.source.type === 'network' && d.target.type === 'memory') return 150;
        return 200;
      })
      .strength(0.1)
    )
    .force('charge', d3.forceManyBody().strength(-100))
    .force('collision', d3.forceCollide().radius(80))
    // Strong y-positioning force to maintain layers
    .force('y', d3.forceY().y(d => {
      // Layer-based y positioning
      if (d.type === 'cpu') return height * 0.2;
      if (d.type === 'network') return height * 0.4;
      if (d.type === 'disk' || d.type === 'memory') return height * 0.7;
      return height / 2;
    }).strength(0.7))
    // X positioning force
    .force('x', d3.forceX().x(d => {
      if (d.type === 'network') return width / 2;
      if (d.type === 'memory') return width * 0.8;
      return d.x;
    }).strength(d => {
      if (d.type === 'network') return 1;
      if (d.type === 'memory') return 0.7;
      return 0.3;
    }))
    .on('tick', ticked);

  // Tick function to update positions
  function ticked() {
    links.attr('d', d => {
      const sourceX = d.source.x;
      const sourceY = d.source.y;
      const targetX = d.target.x;
      const targetY = d.target.y;
      
      // Calculate path for bidirectional arrows
      if (d.type === 'bidirectional') {
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const angle = Math.atan2(dy, dx);
        
        const offset = 5;
        const sourceXOffset = sourceX + offset * Math.sin(angle);
        const sourceYOffset = sourceY - offset * Math.cos(angle);
        const targetXOffset = targetX + offset * Math.sin(angle);
        const targetYOffset = targetY - offset * Math.cos(angle);
        
        return `M${sourceXOffset},${sourceYOffset} L${targetXOffset},${targetYOffset}`;
      } else {
        return `M${sourceX},${sourceY} L${targetX},${targetY}`;
      }
    });
    
    nodes.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  // Drag functions
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
    if (d.type !== 'network') { // Keep network node fixed
      d.fx = null;
      d.fy = null;
    }
  }

  // Initial simulation with higher alpha to settle positions
  simulation.alpha(0.5).restart();
  
  return simulation;
};

export default SharedMemoryVisualization;