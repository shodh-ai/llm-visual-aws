import { DatabaseVisualizer } from './database_visualizer.js';
import { ParallelDatabaseVisualizer } from './parallel_visualizer.js';

let schemaViz = null;
let parallelViz = null;
let currentTab = 'schema';

// Initialize visualizers
document.addEventListener('DOMContentLoaded', () => {
    schemaViz = new DatabaseVisualizer('schema-viz');
    parallelViz = new ParallelDatabaseVisualizer('parallel-viz');
    
    // Tab switching logic
    const schemaTrigger = document.getElementById('schema-tab');
    const parallelTrigger = document.getElementById('parallel-tab');
    const schemaContent = document.getElementById('schema-content');
    const parallelContent = document.getElementById('parallel-content');
    
    schemaTrigger.addEventListener('click', () => {
        currentTab = 'schema';
        schemaContent.classList.remove('hidden');
        parallelContent.classList.add('hidden');
        schemaTrigger.classList.add('border-teal-400', 'text-teal-400');
        parallelTrigger.classList.remove('border-teal-400', 'text-teal-400');
        schemaViz.resize();
    });
    
    parallelTrigger.addEventListener('click', () => {
        currentTab = 'parallel';
        parallelContent.classList.remove('hidden');
        schemaContent.classList.add('hidden');
        parallelTrigger.classList.add('border-teal-400', 'text-teal-400');
        schemaTrigger.classList.remove('border-teal-400', 'text-teal-400');
        parallelViz.resize();
    });
    
    // Handle visualization buttons
    document.getElementById('analyze-schema').addEventListener('click', handleSchemaVisualization);
    document.getElementById('analyze-parallel').addEventListener('click', handleParallelVisualization);
    
    // Initial resize
    window.addEventListener('resize', () => {
        if (currentTab === 'schema') {
            schemaViz.resize();
        } else {
            parallelViz.resize();
        }
    });
});

function handleSchemaVisualization() {
    const prompt = document.getElementById('schema-prompt').value;
    const loading = document.getElementById('schema-loading');
    
    loading.classList.remove('hidden');
    
    // Process the prompt and update visualization
    setTimeout(() => {
        const instructions = analyzeSchemaPrompt(prompt);
        updateSchemaExplanation(instructions.explanation);
        schemaViz.animate(instructions.highlights, instructions.labels);
        loading.classList.add('hidden');
    }, 500);
}

function handleParallelVisualization() {
    const prompt = document.getElementById('parallel-prompt').value;
    const loading = document.getElementById('parallel-loading');
    
    loading.classList.remove('hidden');
    
    // Process the prompt and update visualization
    setTimeout(() => {
        const instructions = analyzeParallelPrompt(prompt);
        updateParallelExplanation(instructions.explanation);
        parallelViz.animate(instructions);
        loading.classList.add('hidden');
    }, 500);
}

function analyzeSchemaPrompt(prompt) {
    // Add more patterns as needed
    const patterns = {
        normalization: {
            highlights: [{ type: 'highlight', tables: ['Orders', 'OrderItems'] }],
            labels: ['Potential denormalization', 'Consider splitting'],
            explanation: 'The Orders and OrderItems tables show signs of potential denormalization. The OrderItems table could be normalized further by separating order-specific and product-specific information.'
        },
        relationships: {
            highlights: [{ type: 'highlight', tables: ['Users', 'Orders', 'OrderItems', 'Products'] }],
            labels: ['One-to-Many', 'Many-to-One', 'One-to-Many'],
            explanation: 'The schema demonstrates a typical e-commerce relationship pattern. Users can have multiple Orders, each Order can have multiple OrderItems, and Products can be referenced by multiple OrderItems.'
        }
    };

    // Match prompt to pattern or return default
    const lowercasePrompt = prompt.toLowerCase();
    if (lowercasePrompt.includes('normal')) {
        return patterns.normalization;
    } else if (lowercasePrompt.includes('relationship')) {
        return patterns.relationships;
    }
    
    return {
        highlights: [],
        labels: [],
        explanation: 'Please enter a specific question about the database schema.'
    };
}

function analyzeParallelPrompt(prompt) {
    const lowercasePrompt = prompt.toLowerCase();
    
    if (lowercasePrompt.includes('shared-nothing') || lowercasePrompt.includes('shared nothing')) {
        return {
            type: 'shared-nothing',
            explanation: 'In a shared-nothing architecture, each node operates independently with its own dedicated storage. This approach provides excellent scalability and eliminates resource contention, but requires careful data partitioning.',
            highlight: ['node1', 'node2', 'node3']
        };
    } else if (lowercasePrompt.includes('shared-disk') || lowercasePrompt.includes('shared disk')) {
        return {
            type: 'shared-disk',
            explanation: 'Shared-disk architecture allows all nodes to access a common storage system. This simplifies data management but can create I/O bottlenecks and requires sophisticated distributed locking mechanisms.',
            highlight: ['node1', 'node2', 'node3', 'san']
        };
    }
    
    return {
        type: 'shared-nothing',
        explanation: 'Please enter a specific question about parallel database architecture.',
        highlight: []
    };
}

function updateSchemaExplanation(text) {
    const container = document.getElementById('schema-steps');
    container.innerHTML = `<div class="explanation-text text-white">${text}</div>`;
}

function updateParallelExplanation(text) {
    const container = document.getElementById('parallel-steps');
    container.innerHTML = `<div class="explanation-text text-white">${text}</div>`;
}