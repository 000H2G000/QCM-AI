// Popup script that runs when the extension popup is opened

// Hard-coded API key for direct access
const DEFAULT_API_KEY = "AIzaSyC81Q4I38YQGFoJ07S2MkWYdW4MMAPJAfs";

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup DOM loaded');
  
  // Get UI elements
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const viewHistoryButton = document.getElementById('viewHistory');
  const clearHistoryButton = document.getElementById('clearHistory');
  const statusDiv = document.getElementById('status');
  const toggleDebugButton = document.getElementById('toggleDebug');
  const debugPanel = document.getElementById('debug-panel');
  const debugLog = document.getElementById('debug-log');
  const clearDebugLogButton = document.getElementById('clearDebugLog');
  const testApiButton = document.getElementById('testApi');
  
  console.log('UI elements initialized');

  // Debug log function
  function addDebugEntry(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'debug-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    const color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#3498db');
    
    entry.innerHTML = `<span style="color:#95a5a6;">[${timestamp}]</span> <span style="color:${color}">${message}</span>`;
    
    debugLog.appendChild(entry);
    debugLog.scrollTop = debugLog.scrollHeight;
    
    console.log(`[DEBUG] ${message}`);
  }
  
  // Function to request context menu creation
  function requestContextMenuCreation() {
    addDebugEntry('Requesting context menu creation...');
    chrome.runtime.sendMessage({action: 'createContextMenu'}, function(response) {
      if (chrome.runtime.lastError) {
        addDebugEntry('Error creating context menu: ' + chrome.runtime.lastError.message, 'error');
      } else {
        addDebugEntry('Context menu creation requested', 'success');
      }
    });
  }
  
  // Request context menu creation when popup opens
  setTimeout(requestContextMenuCreation, 500);
  
  // Toggle debug panel
  toggleDebugButton.addEventListener('click', function() {
    if (debugPanel.style.display === 'none' || !debugPanel.style.display) {
      debugPanel.style.display = 'block';
      toggleDebugButton.textContent = 'Hide Debug Panel';
      addDebugEntry('Debug panel opened');
    } else {
      debugPanel.style.display = 'none';
      toggleDebugButton.textContent = 'Show Debug Panel';
    }
  });
  
  // Clear debug log
  clearDebugLogButton.addEventListener('click', function() {
    debugLog.innerHTML = '';
    addDebugEntry('Debug log cleared');
  });
  
  // Test API connection
  testApiButton.addEventListener('click', function() {
    addDebugEntry('Testing API connection...');
    
    // Use the value from the input field or the default key if empty
    let apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      apiKey = DEFAULT_API_KEY;
      addDebugEntry(`No API key in input field, using default key: ${apiKey.substring(0, 5)}...`);
    } else {
      addDebugEntry(`Using API key from input: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
    }
    
    // Simple test query
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const data = {
      contents: [{
        parts: [{
          text: "Hello! This is a test message to verify the API connection is working."
        }]
      }]
    };
    
    addDebugEntry('Sending test request to Gemini API...');
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => {
      addDebugEntry(`API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`API error: ${text}`);
        });
      }
      
      return response.json();
    })
    .then(result => {
      addDebugEntry('API connection successful!', 'success');
      addDebugEntry(`Response: ${JSON.stringify(result).substring(0, 100)}...`);
    })
    .catch(error => {
      addDebugEntry(`API test failed: ${error.message}`, 'error');
    });
  });

  // Initialize with default API key immediately
  apiKeyInput.value = DEFAULT_API_KEY;
  statusDiv.textContent = 'Default API key is set';
  addDebugEntry('Default API key loaded');
  
  // Save the default API key to storage
  chrome.runtime.sendMessage({
    action: 'saveApiKey',
    apiKey: DEFAULT_API_KEY
  }, function(response) {
    if (response && response.success) {
      addDebugEntry('Default API key saved to storage', 'success');
    }
  });

  // Handler for save API key button
  saveApiKeyButton.addEventListener('click', function() {
    console.log('Save API key button clicked');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      console.log('Error: Empty API key');
      statusDiv.textContent = 'Please enter a valid API key';
      addDebugEntry('Error: Empty API key', 'error');
      return;
    }
    
    console.log('Saving API key:', apiKey.substring(0, 5) + '...');
    addDebugEntry('Saving new API key');
    statusDiv.textContent = 'Saving API key...';
    
    chrome.runtime.sendMessage({
      action: 'saveApiKey',
      apiKey: apiKey
    }, function(response) {
      console.log('Save API key response:', response);
      
      if (response && response.success) {
        statusDiv.textContent = 'API key saved successfully!';
        console.log('API key saved successfully');
        addDebugEntry('API key saved successfully', 'success');
      } else {
        statusDiv.textContent = 'Error saving API key';
        console.error('Error saving API key');
        addDebugEntry('Error saving API key', 'error');
      }
    });
  });

  // Handler for view history button
  viewHistoryButton.addEventListener('click', function() {
    console.log('View history button clicked');
    addDebugEntry('Opening history page');
    statusDiv.textContent = 'Loading answer history...';
    
    chrome.tabs.create({
      url: 'history.html'
    });
    
    console.log('History page opened in new tab');
  });

  // Handler for clear history button
  clearHistoryButton.addEventListener('click', function() {
    console.log('Clear history button clicked');
    
    if (confirm('Are you sure you want to clear all your answer history?')) {
      console.log('User confirmed history deletion');
      addDebugEntry('Clearing answer history');
      statusDiv.textContent = 'Clearing history...';
      
      chrome.runtime.sendMessage({
        action: 'clearSavedQuestions'
      }, function(response) {
        console.log('Clear history response:', response);
        
        if (response && response.success) {
          statusDiv.textContent = 'History cleared successfully!';
          console.log('History cleared successfully');
          addDebugEntry('History cleared successfully', 'success');
        } else {
          statusDiv.textContent = 'Error clearing history';
          console.error('Error clearing history');
          addDebugEntry('Error clearing history', 'error');
        }
      });
    } else {
      console.log('User cancelled history deletion');
      addDebugEntry('History deletion cancelled');
    }
  });

  // Check connection with background script
  console.log('Checking connection with background script');
  addDebugEntry('Checking connection with background script');
  chrome.runtime.sendMessage({action: 'popupOpen'}, function(response) {
    console.log('Background connection check response:', response);
    
    if (response && response.status === 'ok') {
      console.log('Connected to background script');
      addDebugEntry('Connected to background script', 'success');
    } else {
      console.error('Error connecting to background script');
      statusDiv.textContent = 'Error connecting to extension background';
      addDebugEntry('Error connecting to background script', 'error');
    }
  });
  
  console.log('Popup initialization complete');
  addDebugEntry('Popup initialization complete');

  // Add event listener for the fix context menu button
  const fixContextMenuButton = document.getElementById('fixContextMenu');
  if (fixContextMenuButton) {
    fixContextMenuButton.addEventListener('click', function() {
      console.log('Fix context menu button clicked');
      addDebugEntry('Manually triggering context menu fix');
      statusDiv.textContent = 'Fixing context menu...';
      
      // Request context menu creation
      requestContextMenuCreation();
      
      // Show a success message
      setTimeout(() => {
        statusDiv.textContent = 'Context menu fix attempted. Please try again.';
      }, 1000);
    });
  }
}); 