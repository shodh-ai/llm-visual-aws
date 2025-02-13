export class ParallelDatabaseVisualizer {
    constructor(svgId) {
        this.svg = d3.select(`#${svgId}`);
        this.width = parseInt(this.svg.style('width'));
        this.height = parseInt(this.svg.style('height'));
        this.margin = { top: 80, right: 100, bottom: 80, left: 100 };
        
        this.initializeSVG();
        // Initialize with shared-nothing architecture by default
        this.drawSharedNothing();
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
        
        this.nodesGroup = this.g.append('g').attr('class', 'nodes');
        this.linksGroup = this.g.append('g').attr('class', 'links');
        this.labelGroup = this.g.append('g').attr('class', 'labels');
    }
    
    drawNodes(nodes) {
        const nodeGroups = this.nodesGroup.selectAll('.node')
            .data(nodes)
            .join('g')
            .attr('class', 'node')
            .attr('data-id', d => d.id)
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // Background for better visibility
        nodeGroups.append('circle')
            .attr('class', 'node-bg')
            .attr('r', d => d.type === 'storage' ? 45 : 35)
            .attr('fill', '#1e1e1e');
        
        // Node circle
        nodeGroups.append('circle')
            .attr('class', d => `node-circle ${d.type}`)
            .attr('r', d => d.type === 'storage' ? 40 : 30);
        
        // Node label with background
        nodeGroups.append('text')
            .attr('class', 'node-label')
            .attr('dy', '.35em')
            .attr('text-anchor', 'middle')
            .text(d => d.label);
    }
    
    drawLinks(nodes, links) {
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        
        this.linksGroup.selectAll('.link')
            .data(links)
            .join('path')
            .attr('class', 'link')
            .attr('d', d => {
                const source = nodeMap.get(d.source);
                const target = nodeMap.get(d.target);
                return `M ${source.x} ${source.y} 
                        C ${source.x} ${(source.y + target.y)/2},
                          ${target.x} ${(source.y + target.y)/2},
                          ${target.x} ${target.y}`;
            });
    }
    
    drawSharedNothing() {
        // Clear previous visualization
        this.g.selectAll('*').remove();
        
        // Define nodes for a shared-nothing architecture
        const nodes = [
            { id: 'node1', label: 'Node 1', type: 'compute', x: 100, y: 100 },
            { id: 'node2', label: 'Node 2', type: 'compute', x: 300, y: 100 },
            { id: 'node3', label: 'Node 3', type: 'compute', x: 500, y: 100 },
            { id: 'disk1', label: 'Disk 1', type: 'storage', x: 100, y: 300 },
            { id: 'disk2', label: 'Disk 2', type: 'storage', x: 300, y: 300 },
            { id: 'disk3', label: 'Disk 3', type: 'storage', x: 500, y: 300 }
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
            { id: 'san', label: 'Shared Storage', type: 'storage', x: 300, y: 300 }
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

    reset() {
        this.initializeSVG();
        this.drawSharedNothing();
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

    animate(instructions) {
        if (!instructions) return;
        
        this.labelGroup.selectAll('*').remove();
        
        // Clear existing visualization
        this.initializeSVG();
        
        // Draw appropriate architecture
        if (instructions.type === 'shared-nothing') {
            this.drawSharedNothing();
        } else if (instructions.type === 'shared-disk') {
            this.drawSharedDisk();
        }
        
        // Highlight specific nodes or connections based on instructions
        if (instructions.highlight) {
            instructions.highlight.forEach((id) => {
                const node = this.g.select(`[data-id="${id}"]`);
                if (!node.empty()) {
                    node.select('.node-circle')
                        .classed('highlight', true)
                        .transition()
                        .duration(500);
                }
            });
        }
    }
}
