export class DatabaseVisualizer {
    constructor(svgId) {
        this.svg = d3.select(`#${svgId}`);
        this.width = parseInt(this.svg.style('width'));
        this.height = parseInt(this.svg.style('height'));
        this.margin = { top: 80, right: 100, bottom: 80, left: 100 };
        this.tableWidth = 180;
        this.rowHeight = 25;
        
        this.initializeSVG();
        this.initializeSchema();
    }

    initializeSVG() {
        this.svg.selectAll('*').remove();
        
        // Initialize zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
        
        this.svg.call(this.zoom);
        
        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
        
        this.relationshipGroup = this.g.append('g').attr('class', 'relationships');
        this.tableGroup = this.g.append('g').attr('class', 'tables');
        this.annotationGroup = this.g.append('g').attr('class', 'annotations');
        this.labelGroup = this.g.append('g').attr('class', 'labels');
    }



    initializeSchema() {
        // Adjusted positions to prevent overlap
        this.tables = [
            {
                name: 'Users',
                columns: ['id', 'username', 'email', 'created_at'],
                x: 50,
                y: 50
            },
            {
                name: 'Orders',
                columns: ['id', 'user_id', 'total_amount', 'status', 'created_at'],
                x: 350,
                y: 50
            },
            {
                name: 'OrderItems',
                columns: ['id', 'order_id', 'product_id', 'quantity', 'unit_price'],
                x: 350,
                y: 250
            },
            {
                name: 'Products',
                columns: ['id', 'name', 'description', 'price', 'stock'],
                x: 650,
                y: 250
            }
        ];
        
        this.relationships = [
            { source: 'Users', target: 'Orders', type: 'one-to-many' },
            { source: 'Orders', target: 'OrderItems', type: 'one-to-many' },
            { source: 'Products', target: 'OrderItems', type: 'one-to-many' }
        ];
        
        this.drawSchema();
    }
    
    drawSchema() {
        // Draw relationships first so they appear behind tables
        this.relationshipGroup.selectAll('.relationship')
            .data(this.relationships)
            .join('path')
            .attr('class', 'relationship')
            .attr('d', d => {
                const source = this.tables.find(t => t.name === d.source);
                const target = this.tables.find(t => t.name === d.target);
                const sourceX = source.x + this.tableWidth/2;
                const sourceY = source.y + this.rowHeight/2;
                const targetX = target.x + this.tableWidth/2;
                const targetY = target.y + this.rowHeight/2;
                
                // Create curved path
                return `M ${sourceX} ${sourceY} 
                        C ${sourceX} ${(sourceY + targetY)/2},
                          ${targetX} ${(sourceY + targetY)/2},
                          ${targetX} ${targetY}`;
            });
        
        // Draw tables
        const tables = this.tableGroup.selectAll('.table')
            .data(this.tables)
            .join('g')
            .attr('class', 'table')
            .attr('data-name', d => d.name)
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // Add table rectangle with white background
        tables.append('rect')
            .attr('class', 'table-rect')
            .attr('width', this.tableWidth)
            .attr('height', d => (d.columns.length + 1) * this.rowHeight)
            .attr('rx', 5)
            .attr('ry', 5);
        
        // Add table name
        tables.append('text')
            .attr('class', 'table-name')
            .attr('x', this.tableWidth/2)
            .attr('y', this.rowHeight/2 + 5)
            .text(d => d.name);
        
        // Add columns with better spacing
        tables.selectAll('.column')
            .data(d => d.columns.map((col, i) => ({ name: col, index: i })))
            .join('text')
            .attr('class', 'column')
            .attr('x', this.tableWidth/2)
            .attr('y', d => (d.index + 1.5) * this.rowHeight + 5)
            .text(d => d.name);
    }

    reset() {
        this.initializeSVG();
        this.initializeSchema();
    }

    resize() {
        this.width = parseInt(this.svg.style('width'));
        this.height = parseInt(this.svg.style('height'));
        this.reset();
    }


    addLabel(x, y, text, isHighlighted = false) {
        const label = this.labelGroup.append('g')
            .attr('class', 'label-group')
            .attr('transform', `translate(${x}, ${y})`);

        // Add background rectangle
        const padding = 8;
        const textNode = label.append('text')
            .attr('class', isHighlighted ? 'highlight-annotation' : 'label')
            .text(text);
        
        const bbox = textNode.node().getBBox();
        
        label.insert('rect', 'text')
            .attr('x', bbox.x - padding)
            .attr('y', bbox.y - padding)
            .attr('width', bbox.width + 2 * padding)
            .attr('height', bbox.height + 2 * padding)
            .attr('rx', 4)
            .attr('ry', 4)
            .attr('class', isHighlighted ? 'highlight-annotation-bg' : 'label-bg');

        return bbox;
    }

    // Function to find optimal label position
    findLabelPosition(table, existingLabels) {
        const positions = [
            { x: table.x + this.tableWidth + 10, y: table.y }, // right
            { x: table.x - 10, y: table.y, anchor: 'end' }, // left
            { x: table.x + this.tableWidth/2, y: table.y - 30 }, // top
            { x: table.x + this.tableWidth/2, y: table.y + (table.columns.length + 1) * this.rowHeight + 30 } // bottom
        ];

        for (const pos of positions) {
            let overlaps = false;
            for (const existing of existingLabels) {
                const dx = Math.abs(pos.x - existing.x);
                const dy = Math.abs(pos.y - existing.y);
                if (dx < 100 && dy < 30) {
                    overlaps = true;
                    break;
                }
            }
            if (!overlaps) return pos;
        }
        return positions[0]; // fallback to right side if all positions overlap
    }
    
    animate(instructions, labels) {
        this.g.selectAll('.highlight').classed('highlight', false);
        this.labelGroup.selectAll('*').remove();
        
        if (!instructions || !labels) return;
        
        const existingLabels = [];
        
        instructions.forEach((instruction, idx) => {
            if (instruction.type === 'highlight') {
                instruction.tables.forEach((tableName, tableIdx) => {
                    const table = this.tables.find(t => t.name === tableName);
                    const tableElement = this.g.select(`[data-name="${tableName}"]`);
                    tableElement.select('.table-rect').classed('highlight', true);
                    
                    // Add meaningful label
                    if (labels[tableIdx]) {
                        const position = this.findLabelPosition(table, existingLabels);
                        const bbox = this.addLabel(
                            position.x, 
                            position.y, 
                            labels[tableIdx], 
                            true
                        );
                        existingLabels.push({
                            x: position.x,
                            y: position.y,
                            width: bbox.width,
                            height: bbox.height
                        });
                    }
                });
            }
        });
    }
}
