import { DatabaseVisualizer } from './database_visualizer.js';
import { ParallelDatabaseVisualizer } from './parallel_visualizer.js';

// Initialize visualizers
const schemaVisualizer = new DatabaseVisualizer('schema-viz');
const parallelVisualizer = new ParallelDatabaseVisualizer('parallel-viz');

// Get DOM elements
const schemaTab = document.getElementById('schema-tab');
const parallelTab = document.getElementById('parallel-tab');
const schemaContent = document.getElementById('schema-content');
const parallelContent = document.getElementById('parallel-content');

const schemaButton = document.getElementById('analyze-schema');
const parallelButton = document.getElementById('analyze-parallel');
const schemaLoading = document.getElementById('schema-loading');
const parallelLoading = document.getElementById('parallel-loading');
const schemaPrompt = document.getElementById('schema-prompt');
const parallelPrompt = document.getElementById('parallel-prompt');

// Tab switching logic
schemaTab.addEventListener('click', () => {
    schemaTab.classList.add('border-teal-400', 'text-teal-400', 'bg-gray-800');
    parallelTab.classList.remove('border-teal-400', 'text-teal-400', 'bg-gray-800');
    schemaContent.classList.remove('hidden');
    parallelContent.classList.add('hidden');
    
    // Hide parallel explanation when switching tabs
    document.querySelector('#parallel-explanation').classList.add('hidden');
});

parallelTab.addEventListener('click', () => {
    parallelTab.classList.add('border-teal-400', 'text-teal-400', 'bg-gray-800');
    schemaTab.classList.remove('border-teal-400', 'text-teal-400', 'bg-gray-800');
    parallelContent.classList.remove('hidden');
    schemaContent.classList.add('hidden');
    
    // Hide schema explanation when switching tabs
    document.querySelector('#schema-explanation').classList.add('hidden');
});

// Schema analysis
schemaButton.addEventListener('click', async () => {
    const prompt = schemaPrompt.value.trim();
    if (!prompt) {
        alert('Please enter a question about database design.');
        return;
    }
    
    schemaButton.disabled = true;
    schemaLoading.classList.remove('hidden');
    
    try {
        const response = await fetch('/analyze_schema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Server error');
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Update visualization
        schemaVisualizer.animate(JSON.parse(data.animation));
        
        const explanationDiv = document.querySelector('#schema-explanation');
        const explanationText = explanationDiv.querySelector('p');
        
        if (data.explanation) {
            explanationDiv.classList.remove('hidden');
            explanationText.textContent = data.explanation;
        } else {
            explanationDiv.classList.add('hidden');
            explanationText.textContent = '';
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'An error occurred while analyzing the database schema.');
    } finally {
        schemaButton.disabled = false;
        schemaLoading.classList.add('hidden');
    }
});

// Parallel architecture analysis
parallelButton.addEventListener('click', async () => {
    const prompt = parallelPrompt.value.trim();
    if (!prompt) {
        alert('Please enter a question about parallel database architectures.');
        return;
    }
    
    parallelButton.disabled = true;
    parallelLoading.classList.remove('hidden');
    
    try {
        const response = await fetch('/analyze_parallel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Server error');
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Update visualization
        parallelVisualizer.animate(JSON.parse(data.animation));
        
        // Show explanation
        const explanationDiv = document.querySelector('#parallel-explanation');
        const explanationText = explanationDiv.querySelector('p');
        
        if (data.explanation) {
            explanationDiv.classList.remove('hidden');
            explanationText.textContent = data.explanation;
        } else {
            explanationDiv.classList.add('hidden');
            explanationText.textContent = '';
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'An error occurred while analyzing the parallel architecture.');
    } finally {
        parallelButton.disabled = false;
        parallelLoading.classList.add('hidden');
    }
});
