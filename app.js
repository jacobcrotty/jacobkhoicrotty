// QuickBooks Transaction Categorizer Web App

// Chart of Accounts
const CHART_OF_ACCOUNTS = `
Distribution - Deanna: Equity, Partner Distributions
Distribution - Mark: Equity, Partner Distributions
Opening Balance Equity: Equity, Opening Balance Equity
Retained Earnings: Equity, Retained Earnings
Billable Expense Income: Income, Service/Fee Income
Returns: Income, Discounts/Refunds Given
Services: Income, Service/Fee Income
Uncategorized Income: Income, Service/Fee Income
Cost of Goods Sold: Cost of Goods Sold, Other Costs of Services - COS
Airplanes - Fuel & Gas: Cost of Goods Sold, Other Costs of Services - COS
Airplanes - Supplies & Materials: Cost of Goods Sold, Other Costs of Services - COS
Tools (COGS): Cost of Goods Sold, Supplies & Materials - COGS
Vehicles - Fuel & Gas: Cost of Goods Sold, Other Costs of Services - COS
Vehicles - Repairs & Maintenance: Cost of Goods Sold, Other Costs of Services - COS
Vehicles - Supplies & Materials: Cost of Goods Sold, Supplies & Materials - COGS
Bank Fees: Expenses, Other Business Expenses
Business Licenses: Expenses, Legal & Professional Fees
Contract Labor & Outside Services: Expenses, Cost of Labor
Legal & Accounting Fees: Expenses, Legal & Professional Fees
Meals: Expenses, Entertainment Meals
Rent: Expenses, Other Business Expenses
Shipping & Freight: Expenses, Shipping, Freight & Delivery
Software & Subscription Expenses: Expenses, Other Business Expenses
Supplies: Expenses, Supplies & Materials
Travel: Expenses, Travel
Uncategorized Expense: Expenses, Other Miscellaneous Service Cost
Utilities & Maintenance: Expenses, Utilities
Reconciliation Discrepancies: Other Expense, Other Miscellaneous Expense
`.trim();

// DOM Elements
let uploadArea, fileInput, fileSelected, fileName, removeFileBtn;
let apiKeyInput, analyzeBtn, statusMessage;
let resultsSection, loadingIndicator, resultsContent;
let statsGrid, searchInput, categoryFilter, confidenceFilter, transactionsList;
let exportCsvBtn, copyBtn;

// State
let selectedFile = null;
let transactions = [];
let filteredTransactions = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    loadApiKey();
});

function initializeElements() {
    uploadArea = document.getElementById('uploadArea');
    fileInput = document.getElementById('fileInput');
    fileSelected = document.getElementById('fileSelected');
    fileName = document.getElementById('fileName');
    removeFileBtn = document.getElementById('removeFile');
    
    apiKeyInput = document.getElementById('apiKeyInput');
    analyzeBtn = document.getElementById('analyzeBtn');
    statusMessage = document.getElementById('statusMessage');
    
    resultsSection = document.getElementById('resultsSection');
    loadingIndicator = document.getElementById('loadingIndicator');
    resultsContent = document.getElementById('resultsContent');
    
    statsGrid = document.getElementById('statsGrid');
    searchInput = document.getElementById('searchInput');
    categoryFilter = document.getElementById('categoryFilter');
    confidenceFilter = document.getElementById('confidenceFilter');
    transactionsList = document.getElementById('transactionsList');
    
    exportCsvBtn = document.getElementById('exportCsvBtn');
    copyBtn = document.getElementById('copyBtn');
}

function setupEventListeners() {
    // File upload
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    removeFileBtn.addEventListener('click', handleFileRemove);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // API Key
    apiKeyInput.addEventListener('input', handleApiKeyInput);
    
    // Analyze button
    analyzeBtn.addEventListener('click', handleAnalyze);
    
    // Filters
    searchInput?.addEventListener('input', applyFilters);
    categoryFilter?.addEventListener('change', applyFilters);
    confidenceFilter?.addEventListener('change', applyFilters);
    
    // Export buttons
    exportCsvBtn?.addEventListener('click', exportToCsv);
    copyBtn?.addEventListener('click', copyToClipboard);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        showStatus('Please select a PDF file', 'error');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    
    uploadArea.querySelector('.upload-prompt').classList.add('hidden');
    fileSelected.classList.remove('hidden');
    
    showStatus(`✅ PDF loaded: ${file.name}`, 'success');
    updateAnalyzeButton();
}

function handleFileRemove(e) {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    
    uploadArea.querySelector('.upload-prompt').classList.remove('hidden');
    fileSelected.classList.add('hidden');
    
    statusMessage.classList.add('hidden');
    updateAnalyzeButton();
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect({ target: { files: [file] } });
    } else {
        showStatus('Please drop a PDF file', 'error');
    }
}

function handleApiKeyInput() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem('anthropic_api_key', apiKey);
    }
    updateAnalyzeButton();
}

function loadApiKey() {
    const savedKey = localStorage.getItem('anthropic_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }
}

function updateAnalyzeButton() {
    const hasFile = selectedFile !== null;
    const hasApiKey = apiKeyInput.value.trim().length > 0;
    analyzeBtn.disabled = !(hasFile && hasApiKey);
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
}

async function handleAnalyze() {
    if (!selectedFile) {
        showStatus('Please select a PDF file', 'error');
        return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showStatus('Please enter your Anthropic API key', 'error');
        return;
    }
    
    // Show loading
    resultsSection.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    resultsContent.classList.add('hidden');
    analyzeBtn.disabled = true;
    
    try {
        // Convert PDF to base64
        const base64Data = await fileToBase64(selectedFile);
        
        // Call Claude API
        const result = await analyzeWithClaude(base64Data, apiKey);
        
        // Display results
        transactions = result;
        filteredTransactions = result;
        displayResults(result);
        
        loadingIndicator.classList.add('hidden');
        resultsContent.classList.remove('hidden');
        
    } catch (error) {
        console.error('Analysis error:', error);
        loadingIndicator.classList.add('hidden');
        resultsContent.innerHTML = `
            <div class="status-message error">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
        resultsContent.classList.remove('hidden');
    } finally {
        analyzeBtn.disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function analyzeWithClaude(base64Data, apiKey) {
    try {
        // Use the backend proxy to avoid CORS issues
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey,
                base64Data: base64Data,
                chartOfAccounts: CHART_OF_ACCOUNTS
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        return JSON.parse(data.result);
        
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Make sure the Flask backend is running (python server.py)');
        }
        throw error;
    }
}

function displayResults(transactions) {
    // Display stats
    displayStats(transactions);
    
    // Populate category filter
    populateCategoryFilter(transactions);
    
    // Display transactions
    displayTransactions(transactions);
}

function displayStats(transactions) {
    const total = transactions.length;
    const expenses = transactions.filter(t => t.amount < 0);
    const income = transactions.filter(t => t.amount >= 0);
    
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    
    const highConfidence = transactions.filter(t => t.confidence === 'high').length;
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Total Transactions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value negative">$${totalExpenses.toFixed(2)}</div>
            <div class="stat-label">Total Expenses</div>
        </div>
        <div class="stat-card">
            <div class="stat-value positive">$${totalIncome.toFixed(2)}</div>
            <div class="stat-label">Total Income</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${highConfidence}</div>
            <div class="stat-label">High Confidence</div>
        </div>
    `;
}

function populateCategoryFilter(transactions) {
    const categories = [...new Set(transactions.map(t => t.suggestedCategory))].sort();
    
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

function displayTransactions(transactions) {
    transactionsList.innerHTML = transactions.map(transaction => {
        const amountClass = transaction.amount < 0 ? 'negative' : 'positive';
        const amountPrefix = transaction.amount < 0 ? '-$' : '$';
        const absAmount = Math.abs(transaction.amount).toFixed(2);
        
        const confidenceEmoji = {
            'high': '🟢',
            'medium': '🟡',
            'low': '🔴'
        }[transaction.confidence] || '⚪';
        
        return `
            <div class="transaction-card ${transaction.confidence}-confidence" data-category="${transaction.suggestedCategory}" data-confidence="${transaction.confidence}">
                <div class="transaction-header">
                    <div>
                        <div class="transaction-date">${transaction.date}</div>
                        <div class="transaction-description">${escapeHtml(transaction.description)}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix}${absAmount}
                    </div>
                </div>
                <div class="transaction-category">
                    <div class="category-name">📁 ${escapeHtml(transaction.suggestedCategory)}</div>
                    ${transaction.reasoning ? `<div class="category-reasoning">${escapeHtml(transaction.reasoning)}</div>` : ''}
                </div>
                <div>
                    <span class="confidence-badge ${transaction.confidence}">
                        ${confidenceEmoji} ${transaction.confidence} confidence
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedConfidence = confidenceFilter.value;
    
    filteredTransactions = transactions.filter(transaction => {
        const matchesSearch = !searchTerm || 
            transaction.description.toLowerCase().includes(searchTerm) ||
            transaction.suggestedCategory.toLowerCase().includes(searchTerm);
        
        const matchesCategory = selectedCategory === 'all' || 
            transaction.suggestedCategory === selectedCategory;
        
        const matchesConfidence = selectedConfidence === 'all' || 
            transaction.confidence === selectedConfidence;
        
        return matchesSearch && matchesCategory && matchesConfidence;
    });
    
    displayTransactions(filteredTransactions);
}

function exportToCsv() {
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Confidence', 'Reasoning'];
    const rows = filteredTransactions.map(t => [
        t.date,
        t.description,
        t.amount,
        t.suggestedCategory,
        t.confidence,
        t.reasoning || ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickbooks-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function copyToClipboard() {
    const text = filteredTransactions.map(t => 
        `${t.date} | ${t.description} | ${t.amount} | ${t.suggestedCategory} | ${t.confidence}`
    ).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
