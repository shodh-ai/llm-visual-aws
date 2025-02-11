export class DatabaseVisualizer {
    constructor(svgId) {
        this.svg = d3.select(`#${svgId}`);
        this.width = parseInt(this.svg.style('width'));
        this.height = parseInt(this.svg.style('height'));
        this.margin = { top: 50, right: 50, bottom: 50, left: 50 };
        
        // Clear any existing content
        this.svg.selectAll('*').remove();
        
        // Initialize zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on('zoom', (event) => {
                this.svg.select('g').attr('transform', event.transform);
            });
        
        this.svg.call(this.zoom);
        
        // Add main group for all elements
        this.g = this.svg.append('g');
        
        // Center the visualization
        this.g.attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        
        // Initialize the schema
        this.initializeSchema();
    }
    
    initializeSchema() {
        const tables = [
            {
                name: 'Users',
                columns: ['id', 'username', 'email', 'created_at'],
                x: 100,
                y: 100
            },
            {
                name: 'Orders',
                columns: ['id', 'user_id', 'total_amount', 'status', 'created_at'],
                x: 400,
                y: 100
            },
            {
                name: 'OrderItems',
                columns: ['id', 'order_id', 'product_id', 'quantity', 'unit_price'],
                x: 400,
                y: 300
            },
            {
                name: 'Products',
                columns: ['id', 'name', 'description', 'price', 'stock'],
                x: 700,
                y: 300
            }
        ];
        
        // Define relationships
        const relationships = [
            { source: 'Users', target: 'Orders', type: 'one-to-many' },
            { source: 'Orders', target: 'OrderItems', type: 'one-to-many' },
            { source: 'Products', target: 'OrderItems', type: 'one-to-many' }
        ];
        
        this.tables = tables;
        this.relationships = relationships;
        
        // Draw the schema
        this.drawSchema();
    }
    
    drawSchema() {
        const tableWidth = 200;
        const rowHeight = 25;
        
        const relationshipLines = this.g.selectAll('.relationship')
            .data(this.relationships)
            .join('line')
            .attr('class', 'relationship')
            .attr('x1', d => this.tables.find(t => t.name === d.source).x + tableWidth/2)
            .attr('y1', d => this.tables.find(t => t.name === d.source).y + rowHeight/2)
            .attr('x2', d => this.tables.find(t => t.name === d.target).x + tableWidth/2)
            .attr('y2', d => this.tables.find(t => t.name === d.target).y + rowHeight/2);
        
        // Draw tables
        const tables = this.g.selectAll('.table')
            .data(this.tables)
            .join('g')
            .attr('class', 'table')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // Add table rectangle
        tables.append('rect')
            .attr('class', 'table-rect')
            .attr('width', tableWidth)
            .attr('height', d => (d.columns.length + 1) * rowHeight); // +1 for table name
        
        // Add table name
        tables.append('text')
            .attr('class', 'table-name')
            .attr('x', tableWidth/2)
            .attr('y', rowHeight/2 + 5)
            .text(d => d.name);
        
        // Add columns
        tables.selectAll('.column')
            .data(d => d.columns.map((col, i) => ({ name: col, index: i })))
            .join('text')
            .attr('class', 'column')
            .attr('x', tableWidth/2)
            .attr('y', d => (d.index + 1.5) * rowHeight + 5)
            .text(d => d.name);
    }
    
    animate(instructions) {
        // Reset any previous animations
        this.g.selectAll('.table-rect')
            .classed('highlight', false)
            .style('stroke', '#64ffda')
            .style('stroke-width', '2px');
        
        // Remove any existing tooltips and connection lines
        this.g.selectAll('.highlight-tooltip').remove();
        this.g.selectAll('.connection-line').remove();
        
        // Process each instruction
        instructions.forEach(instruction => {
            if (instruction.type === 'highlight' || instruction.type === 'normalize') {
                // Highlight specified tables
                const highlightedTables = this.g.selectAll('.table')
                    .filter(d => instruction.tables.includes(d.name));
                
                highlightedTables.select('.table-rect')
                    .classed('highlight', true)
                    .transition()
                    .duration(500);
                
                // Add tooltips if description provided
                if (instruction.description) {
                    highlightedTables.each((d, i, nodes) => {
                        const table = d3.select(nodes[i]);
                        table.append('title')
                            .text(instruction.description);
                    });
                }
            } else if (instruction.type === 'connect') {
                // Find the tables to connect
                const [sourceTable, targetTable] = instruction.tables;
                const source = this.tables.find(t => t.name === sourceTable);
                const target = this.tables.find(t => t.name === targetTable);
                
                if (source && target) {
                    // Draw connection line
                    const line = this.g.append('line')
                        .attr('class', 'connection-line')
                        .attr('x1', source.x + 100)
                        .attr('y1', source.y + 12.5)
                        .attr('x2', target.x + 100)
                        .attr('y2', target.y + 12.5);
                    
                    // Add tooltip if description provided
                    if (instruction.description) {
                        line.append('title')
                            .text(instruction.description);
                    }
                    
                    // Highlight connected tables
                    this.g.selectAll('.table')
                        .filter(d => [sourceTable, targetTable].includes(d.name))
                        .select('.table-rect')
                        .classed('highlight', true)
                        .transition()
                        .duration(500);
                }
            }
        });
    }
}
