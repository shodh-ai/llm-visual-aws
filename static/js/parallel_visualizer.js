export class ParallelDatabaseVisualizer {
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
    }
    
    drawSharedNothing() {
        // Clear previous visualization
        this.g.selectAll('*').remove();
        
        // Define nodes for a shared-nothing architecture
        const nodes = [
            { id: 'node1', label: 'Node 1', type: 'compute', x: 100, y: 100 },
            { id: 'node2', label: 'Node 2', type: 'compute', x: 300, y: 100 },
            { id: 'node3', label: 'Node 3', type: 'compute', x: 500, y: 100 },
            { id: 'disk1', label: 'Disk 1', type: 'storage', x: 100, y: 250 },
            { id: 'disk2', label: 'Disk 2', type: 'storage', x: 300, y: 250 },
            { id: 'disk3', label: 'Disk 3', type: 'storage', x: 500, y: 250 }
        ];
        
        // Define links between nodes and their dedicated storage
        const links = [
            { source: 'node1', target: 'disk1' },
            { source: 'node2', target: 'disk2' },
            { source: 'node3', target: 'disk3' }
        ];
        
        this.drawNodes(nodes);
        this.drawLinks(nodes, links);
    }
    
    drawSharedDisk() {
        // Clear previous visualization
        this.g.selectAll('*').remove();
        
        // Define nodes for a shared-disk architecture
        const nodes = [
            { id: 'node1', label: 'Node 1', type: 'compute', x: 100, y: 100 },
            { id: 'node2', label: 'Node 2', type: 'compute', x: 300, y: 100 },
            { id: 'node3', label: 'Node 3', type: 'compute', x: 500, y: 100 },
            { id: 'san', label: 'Shared Storage', type: 'storage', x: 300, y: 250 }
        ];
        
        // Define links between all nodes and shared storage
        const links = [
            { source: 'node1', target: 'san' },
            { source: 'node2', target: 'san' },
            { source: 'node3', target: 'san' }
        ];
        
        this.drawNodes(nodes);
        this.drawLinks(nodes, links);
    }
    
    drawNodes(nodes) {
        // Draw compute nodes
        const nodeGroups = this.g.selectAll('.node')
            .data(nodes)
            .join('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // Add node circles
        nodeGroups.append('circle')
            .attr('r', d => d.type === 'storage' ? 40 : 30)
            .attr('class', d => `node-circle ${d.type}`);
        
        // Add node labels
        nodeGroups.append('text')
            .attr('class', 'node-label')
            .attr('dy', '.35em')
            .text(d => d.label);
    }
    
    drawLinks(nodes, links) {
        // Create a map of nodes by id for easy lookup
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        
        // Draw links between nodes
        this.g.selectAll('.link')
            .data(links)
            .join('line')
            .attr('class', 'link')
            .attr('x1', d => nodeMap.get(d.source).x)
            .attr('y1', d => nodeMap.get(d.source).y)
            .attr('x2', d => nodeMap.get(d.target).x)
            .attr('y2', d => nodeMap.get(d.target).y);
    }
    
    animate(instructions) {
        if (instructions.type === 'shared-nothing') {
            this.drawSharedNothing();
        } else if (instructions.type === 'shared-disk') {
            this.drawSharedDisk();
        }
        
        // Highlight specific nodes or connections based on instructions
        if (instructions.highlight) {
            instructions.highlight.forEach(id => {
                this.g.selectAll('.node')
                    .filter(d => d.id === id)
                    .select('circle')
                    .transition()
                    .duration(500)
                    .style('stroke', '#ff6188')
                    .style('stroke-width', '4px');
            });
        }
    }
}
