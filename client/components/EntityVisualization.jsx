import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const EntityVisualization = ({ data }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Clear any existing content
    d3.select(containerRef.current).selectAll('*').remove();

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 800;

    // Create SVG
    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);

    // Add diagram labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height / 6 + 80)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-lg font-bold')
      .text('Entity-Relationship (ER) model');

    g.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2 + 80)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-lg font-bold')
      .text('Strong Entity & Weak Entity');

    g.append('text')
      .attr('x', width / 2)
      .attr('y', (5 * height) / 6 + 80)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-lg font-bold')
      .text('Multivalued & Associative Entity');

    // Define arrow markers
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-10 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M-10,-5L0,0L-10,5')
      .attr('fill', '#ff5733');

    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.edges).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(12));

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(data.edges)
      .join('line')
      .attr('class', 'relationship-link')
      .style('stroke', '#ff5733')
      .style('stroke-width', 2)
      .attr('marker-end', d => {
        if (d.type === 'attribute' || 
            (d.source === 'student' && d.target === 'study') || 
            (d.source === 'study' && d.target === 'course')) {
          return null;
        }
        return 'url(#arrowhead)';
      });

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'er-node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add shapes for different node types
    node.each(function(d) {
      const erNode = d3.select(this);
      
      if (d.id === 'works_on') {
        // Associative entity
        erNode.append('rect')
          .attr('width', 120)
          .attr('height', 50)
          .attr('x', -60)
          .attr('y', -25)
          .style('fill', '#1e3a8a')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);

        erNode.append('polygon')
          .attr('points', '-55,0 0,-25 55,0 0,25')
          .style('fill', '#047857')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      }
      else if (['student', 'course', 'customer', 'employee', 'project'].includes(d.id)) {
        // Strong entities
        erNode.append('rect')
          .attr('width', 120)
          .attr('height', 50)
          .attr('x', -60)
          .attr('y', -25)
          .style('fill', '#1e3a8a')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      }
      else if (['study', 'borrows', 'works_on'].includes(d.id)) {
        // Relationships
        erNode.append('polygon')
          .attr('points', '-50,0 0,-30 50,0 0,30')
          .style('fill', '#047857')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      }
      else if (d.id === 'loan') {
        // Weak entity
        erNode.append('rect')
          .attr('width', 130)
          .attr('height', 60)
          .attr('x', -65)
          .attr('y', -30)
          .style('fill', 'none')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);

        erNode.append('rect')
          .attr('width', 120)
          .attr('height', 50)
          .attr('x', -60)
          .attr('y', -25)
          .style('fill', '#1e3a8a')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      }
      else if (d.type === 'attribute') {
        // Attributes
        erNode.append('circle')
          .attr('r', 25)
          .style('fill', 'white')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      }
      else if (d.type === 'multivalued') {
        // Double circle for multivalued attributes
        erNode.append('circle')
          .attr('r', 25)
          .style('fill', 'white')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      
        erNode.append('circle')
          .attr('r', 30)
          .style('fill', 'none')
          .style('stroke', '#ff5733')
          .style('stroke-width', 2);
      }      

      // Add node text
      const nodeText = erNode.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.40em')
        .attr('fill', (d.type === 'attribute' || d.type === 'multivalued') ? '#000000' : 'white')
        .attr('class', 'text-sm font-bold')
        .style('font-size', '12px')
        .text(d.name || d.id);
    });

    // Position nodes
    const topSection = height / 6;
    const middleSection = height / 2;
    const bottomSection = (5 * height) / 6;

    // Set initial positions
    data.nodes.forEach(node => {
      const positions = {
        student: { x: width / 2 - 200, y: topSection },
        course: { x: width / 2 + 200, y: topSection },
        study: { x: width / 2, y: topSection },
        customer: { x: width / 2 - 200, y: middleSection },
        loan: { x: width / 2 + 200, y: middleSection },
        borrows: { x: width / 2, y: middleSection },
        employee: { x: width / 2 - 200, y: bottomSection },
        project: { x: width / 2 + 200, y: bottomSection },
        works_on: { x: width / 2, y: bottomSection },
      };

      // Position skills node to the left of employee node
      if (node.id === 'skills') {
        node.fx = width / 2 - 350;
        node.fy = bottomSection;
      } 
      else if (positions[node.id]) {
        node.fx = positions[node.id].x;
        node.fy = positions[node.id].y;
      }
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

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
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data]);

  return (
    <div 
      id="visualization-container" 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default EntityVisualization;