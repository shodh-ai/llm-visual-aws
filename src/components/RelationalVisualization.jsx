import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const RelationalVisualization = ({ data }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      console.error('Invalid data format for relational visualization');
      return;
    }

    const container = d3.select(containerRef.current);
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const tableWidth = 250;
    const tablePadding = 10;

    container.selectAll('*').remove();

    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background-color', '#f7fafc');

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const zoom = d3.zoom()
      .scaleExtent([0.5, 2])
      .on('zoom', event => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // For each node, determine the table's height using its columns/properties
    data.nodes.forEach(node => {
      const columns = node.columns || node.properties || [];
      node.height = 40 + columns.length * 25 + tablePadding;
    });

    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.edges || [])
        .id(d => d.id)
        .distance(300)
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-1000))
      .force('collide', d3.forceCollide().radius(() => tableWidth / 2 + 50).strength(1))
      .force('x', d3.forceX(0).strength(0.1))
      .force('y', d3.forceY(0).strength(0.1));

    if (data.edges) {
      const relationships = g
        .selectAll('.relationship')
        .data(data.edges)
        .join('g')
        .attr('class', 'relationship');

      relationships.append('line')
        .attr('class', 'relationship-line')
        .style('stroke', '#718096')
        .style('stroke-width', '2px')
        .style('stroke-dasharray', '5,5')
        .style('opacity', 0.7);

      relationships.append('text')
        .attr('class', 'relationship-label')
        .style('fill', '#4a5568')
        .style('font-size', '12px')
        .style('font-family', 'monospace')
        .text(d => d.description || '');
    }

    const tables = g
      .selectAll('.table')
      .data(data.nodes)
      .join('g')
      .attr('class', 'table')
      .call(
        d3.drag()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded)
      );

    tables.append('rect')
      .attr('class', 'table-bg')
      .attr('x', -tableWidth / 2)
      .attr('y', d => -d.height / 2)
      .attr('width', tableWidth)
      .attr('height', d => d.height)
      .attr('rx', 5)
      .style('fill', '#ffffff')
      .style('stroke', '#2c3e50')
      .style('stroke-width', '2px');

    tables.append('rect')
      .attr('class', 'table-header')
      .attr('x', -tableWidth / 2)
      .attr('y', d => -d.height / 2)
      .attr('width', tableWidth)
      .attr('height', 40)
      .attr('rx', 5)
      .style('fill', '#2c3e50');

    tables.append('text')
      .attr('class', 'table-name')
      .attr('x', -tableWidth / 2 + 10)
      .attr('y', d => -d.height / 2 + 25)
      .style('fill', '#ffffff')
      .style('font-weight', 'bold')
      .style('font-size', '16px')
      .style('font-family', 'sans-serif')
      .text(d => d.name);

    tables.each(function (d) {
      const tableGroup = d3.select(this);
      const startY = -d.height / 2 + 50;
      const columns = d.columns || d.properties || [];
      columns.forEach((col, i) => {
        tableGroup.append('text')
          .attr('x', -tableWidth / 2 + 10)
          .attr('y', startY + i * 25)
          .style('fill', '#2c3e50')
          .style('font-family', 'monospace')
          .style('font-size', '12px')
          .text(
            col.name +
            ' : ' +
            col.type +
            (col.primary ? ' (PK)' : '') +
            (col.foreign ? ' (FK)' : '')
          );
      });
    });

    simulation.on('tick', () => {
      if (data.edges) {
        g.selectAll('.relationship').each(function (d) {
          const line = d3.select(this).select('.relationship-line');
          const label = d3.select(this).select('.relationship-label');

          if (!d.source || !d.target) return;

          const sourceX = d.source.x || 0;
          const sourceY = d.source.y || 0;
          const targetX = d.target.x || 0;
          const targetY = d.target.y || 0;

          line.attr('x1', sourceX)
            .attr('y1', sourceY)
            .attr('x2', targetX)
            .attr('y2', targetY);

          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          label.attr('x', midX)
            .attr('y', midY - 5)
            .style('text-anchor', 'middle');
        });
      }
      tables.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default RelationalVisualization;
