// Background script (service worker) that runs in the background

// Default API Key - preloaded for convenience
// insert your gemini api key
const DEFAULT_API_KEY = "";

// Helper function to safely send messages to tabs with retry
function safeSendMessage(tabId, message, callback, maxRetries = 2) {
  // Check if tab exists first
  chrome.tabs.get(tabId, (tab) => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.error(`Tab ${tabId} doesn't exist:`, lastError.message);
      if (callback) callback({success: false, error: 'Tab not found'});
      return;
    }
    
    // First, try to inject the content script to ensure it's loaded
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      func: () => {
        // This function runs in the context of the tab
        // Just a check to see if we can execute scripts in this tab
        return true;
      }
    }).then(() => {
      // After ensuring we can inject scripts, try to send the message with retries
      let retries = 0;
      
      const attemptSend = () => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          const error = chrome.runtime.lastError;
          
          // If there's an error and we have retries left
          if (error && retries < maxRetries) {
            console.log(`Retrying message send to tab ${tabId}, attempt ${retries + 1} of ${maxRetries}`);
            retries++;
            // Wait a bit before retrying to give content script time to load
            setTimeout(attemptSend, 500 * retries); // Increased timeout for better reliability
            return;
          }
          
          // If there's still an error after all retries
          if (error) {
            console.error(`Failed to send message to tab ${tabId} after ${maxRetries} retries:`, error.message);
            
            // As a last resort, try to inject the content script directly
            try {
              console.log("Attempting to inject content script as last resort");
              chrome.scripting.executeScript({
                target: {tabId: tabId},
                files: ["content.js"]
              }).then(() => {
                // Try one final time after injection
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, message, (finalResponse) => {
                    const finalError = chrome.runtime.lastError;
                    if (finalError) {
                      console.error("Final attempt failed:", finalError.message);
                      if (callback) callback({success: false, error: finalError.message});
                    } else {
                      console.log("Message sent successfully after content script injection");
                      if (callback) callback({success: true, response: finalResponse});
                    }
                  });
                }, 300);
              }).catch((err) => {
                console.error("Failed to inject content script:", err);
                if (callback) callback({success: false, error: err.message || error.message});
              });
            } catch (injectionError) {
              console.error("Error during injection attempt:", injectionError);
              if (callback) callback({success: false, error: injectionError.message || error.message});
            }
            return;
          }
          
          // Success!
          if (callback) callback({success: true, response});
        });
      };
      
      attemptSend();
    }).catch((err) => {
      console.error(`Cannot execute script in tab ${tabId}:`, err);
      // Try using a notification if possible
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'showNotification',
          message: `Error: Cannot execute script in this tab`
        });
      } catch (e) {
        console.error("Failed to show notification:", e);
      }
      if (callback) callback({success: false, error: err.message});
    });
  });
}

// Check if context menu API is available and handle it safely
function safeCreateContextMenu() {
  console.log('Attempting to create context menu');
  
  // Check if the contextMenus API is available
  if (typeof chrome !== 'undefined' && chrome.contextMenus) {
    try {
      // Create context menu item
      chrome.contextMenus.removeAll(() => {
        // Text selection option
        chrome.contextMenus.create({
          id: "answerQuestion",
          title: "Answer text question",
          contexts: ["selection"]
        }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('Error creating text context menu:', lastError.message || 'Unknown error');
          } else {
            console.log('Text context menu created successfully');
          }
        });
        
        // Screenshot option (for entire page)
        chrome.contextMenus.create({
          id: "answerScreenshot",
          title: "Answer screenshot question",
          contexts: ["page"]
        }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('Error creating screenshot context menu:', lastError.message || 'Unknown error');
          } else {
            console.log('Screenshot context menu created successfully');
          }
        });
      });
    } catch (error) {
      console.error('Error creating context menu:', error);
    }
  } else {
    console.error('Context menu API not available!');
  }
}

// Initialize storage with default settings
function initializeStorage() {
  console.log('Initializing storage');
  
  try {
    chrome.storage.local.set({
      geminiApiKey: DEFAULT_API_KEY,
      savedQuestions: []
    }, function() {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error('Error initializing storage:', lastError.message || 'Unknown error');
      } else {
        console.log('Storage initialized with default API key');
      }
    });
  } catch (error) {
    console.error('Error during storage initialization:', error);
  }
}

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('QCM Helper Extension installed');
  
  // Initialize storage first
  initializeStorage();
  
  // Delay context menu creation to ensure APIs are loaded
  setTimeout(safeCreateContextMenu, 1000);
  
  console.log('Installation handler completed');
});

// Also register for startup to ensure context menu is created
chrome.runtime.onStartup.addListener(function() {
  console.log('Extension starting up');
  
  // Delay context menu creation to ensure APIs are loaded
  setTimeout(safeCreateContextMenu, 1000);
});

// Handle context menu clicks if API is available
if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('Context menu clicked:', info.menuItemId);
    
    // Always use the API key directly
    const apiKey = DEFAULT_API_KEY;
    console.log('Using API key:', apiKey.substring(0, 5) + '...');
    
    if (info.menuItemId === "answerQuestion") {
      // Handle text-based question
      const selectedText = info.selectionText;
      console.log('Selected text:', selectedText);
      
      // Ensure content script is loaded
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ["content.js"]
      }).then(() => {
        // Wait a bit to ensure content script is initialized
        setTimeout(() => {
          // Process the text question without showing loading message
          processWithGeminiText(selectedText, apiKey, tab);
        }, 300);
      }).catch(err => {
        console.error("Failed to inject content script:", err);
        // Try to process anyway
        processWithGeminiText(selectedText, apiKey, tab);
      });
    } 
    else if (info.menuItemId === "answerScreenshot") {
      // Handle screenshot-based question
      console.log('Taking screenshot for question analysis');
      
      // Ensure content script is loaded
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ["content.js"]
      }).then(() => {
        // Wait a bit to ensure content script is initialized
        setTimeout(() => {
          // Capture screenshot without showing notification
          captureScreenshot(tab.id, apiKey);
        }, 300);
      }).catch(err => {
        console.error("Failed to inject content script:", err);
        // Try to capture anyway
        captureScreenshot(tab.id, apiKey);
      });
    }
  });
}

// Function to capture screenshot
async function captureScreenshot(tabId, apiKey) {
  try {
    console.log('Capturing screenshot of tab:', tabId);
    
    // Use the scripting API to capture screenshot
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, async function(dataUrl) {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error('Screenshot error:', lastError.message || 'Unknown error');
        return;
      }
      
      console.log('Screenshot captured successfully');
      
      // Process image with Gemini
      await processWithGeminiImage(dataUrl, apiKey, tabId);
    });
  } catch (error) {
    console.error('Error in screenshot capture:', error);
  }
}

// Function to convert data URL to Base64
function dataURLToBase64(dataURL) {
  // Remove the prefix (data:image/png;base64,)
  return dataURL.split(',')[1];
}

// Function to process question with Gemini AI (text version)
async function processWithGeminiText(questionText, apiKey, tab) {
  try {
    console.log('Starting Gemini text processing');
    
    // Don't show any loading notifications to the user
    
    // Prepare API request to Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    console.log('API URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    
    const data = {
      contents: [{
        parts: [{
          text: `You are a helpful assistant specializing in answering multiple choice questions accurately. 
                Analyze this question and select ALL correct answer(s):
                ${questionText}
                
                ONLY respond with the letter(s) of ALL correct answer(s) (A, B, C, or D).
                If there are multiple correct answers (2, 3, or even all 4), list ALL the letters with spaces between them.
                Example formats:
                - If only A is correct: "A"
                - If A and C are correct: "A C"
                - If A, B, and D are correct: "A B D"
                - If all are correct: "A B C D"
                
                Do not add any punctuation, explanation, or formatting. Just the letters separated by spaces.`
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 800
      }
    };
    
    console.log('Request payload:', JSON.stringify(data));
    
    // Make API call
    console.log('Sending request to Gemini API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    // Process response
    console.log('Response received, status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API response:', JSON.stringify(result));
    
    let answerText;
    
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      answerText = result.candidates[0].content.parts[0].text;
      console.log('Generated answer:', answerText);
      
      // Keep original answer for processing on the content side
      // Don't process the answer text here, let the content script handle it
      
      // Store question and answer
      saveQuestionAnswer(questionText, answerText);
      
      // Try to inject content script first
      try {
        console.log("Ensuring content script is injected before sending answer");
        await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ["content.js"]
        });
        
        // Short delay to ensure content script is ready
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.log("Content script injection not needed or failed:", err);
      }
      
      // Send answer to content script - use safe send
      safeSendMessage(tab.id, {
        action: 'displayAnswer',
        questionText: questionText,
        answerText: answerText
      }, (result) => {
        if (result.success) {
          console.log('Answer sent to content script for display');
        } else {
          console.error('Failed to display answer:', result.error);
          
          // For debugging only, invisible to user
          console.log(`Couldn't display answer: ${answerText}`);
        }
      });
    } else {
      console.error('Invalid response structure:', result);
      throw new Error('Invalid response from Gemini API');
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
  }
}

// Function to process question with Gemini AI (image version)
async function processWithGeminiImage(imageDataUrl, apiKey, tabId) {
  try {
    console.log('Starting Gemini image processing');
    
    // Convert data URL to base64
    const base64Image = dataURLToBase64(imageDataUrl);
    
    // Using Gemini Pro Vision model that can process images
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-vision:generateContent?key=${apiKey}`;
    
    const data = {
      contents: [{
        parts: [
          {
            text: `Analyze this screenshot of a multiple choice question. 
                  ONLY respond with the letter(s) of ALL correct answer(s) (A, B, C, or D).
                  If there are multiple correct answers (2, 3, or even all 4), list ALL the letters with spaces between them.
                  Example formats:
                  - If only A is correct: "A"
                  - If A and C are correct: "A C"
                  - If A, B, and D are correct: "A B D"
                  - If all are correct: "A B C D"
                  
                  Do not add any punctuation, explanation, or formatting. Just the letters separated by spaces.`
          },
          {
            inline_data: {
              mime_type: "image/png",
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 800
      }
    };
    
    console.log('Sending image request to Gemini API...');
    
    // Make API call
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    // Process response
    console.log('Response received, status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API response:', JSON.stringify(result));
    
    let answerText;
    
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      answerText = result.candidates[0].content.parts[0].text;
      console.log('Generated answer from image:', answerText);
      
      // Keep original answer for processing on the content side
      // Don't process the answer text here, let the content script handle it
      
      // Store screenshot question and answer
      saveQuestionAnswer("Screenshot question", answerText);
      
      // Try to inject content script first
      try {
        console.log("Ensuring content script is injected before sending answer");
        await chrome.scripting.executeScript({
          target: {tabId: tabId},
          files: ["content.js"]
        });
        
        // Short delay to ensure content script is ready
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.log("Content script injection not needed or failed:", err);
      }
      
      // Send answer to content script
      safeSendMessage(tabId, {
        action: 'displayAnswer',
        questionText: "Screenshot question",
        answerText: answerText
      }, (result) => {
        if (!result.success) {
          // For debugging only
          console.log(`Couldn't display answer: ${answerText}`);
        } else {
          console.log('Screenshot answer sent to content script');
        }
      });
    } else {
      console.error('Invalid response structure from image API:', result);
      throw new Error('Invalid response from Gemini API for image');
    }
  } catch (error) {
    console.error('Error processing image with Gemini:', error);
  }
}

// Function to save question and answer to storage
function saveQuestionAnswer(question, answer) {
  console.log('Saving question and answer to storage');
  
  chrome.storage.local.get(['savedQuestions'], function(result) {
    const savedQuestions = result.savedQuestions || [];
    savedQuestions.push({
      question: question,
      answer: answer,
      timestamp: new Date().toISOString()
    });
    
    // Save back to storage
    chrome.storage.local.set({
      savedQuestions: savedQuestions
    }, function() {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error('Error saving to storage:', lastError.message || 'Unknown error');
      } else {
        console.log('Question and answer saved successfully');
      }
    });
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);

  // Handle different message actions
  if (request.action === 'ping') {
    // Simple ping to check if extension is running
    console.log('Received ping, responding with pong');
    sendResponse({status: 'pong', version: '1.0', timestamp: new Date().toISOString()});
    return true;
  }
  
  if (request.action === 'popupOpen') {
    // Respond to the popup opening
    console.log('Popup opened, responding with status OK');
    sendResponse({status: 'ok'});
    return true;
  }
  
  if (request.action === 'saveApiKey') {
    // Save API key to storage
    console.log('Saving new API key to storage');
    chrome.storage.local.set({
      geminiApiKey: request.apiKey
    }, function() {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error('Error saving API key:', lastError.message || 'Unknown error');
        sendResponse({success: false, error: lastError.message || 'Unknown error'});
      } else {
        console.log('API key saved successfully');
        sendResponse({success: true});
      }
    });
    return true;
  }
  
  if (request.action === 'getApiKey') {
    // Retrieve API key from storage
    console.log('Retrieving API key from storage');
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      const apiKey = result.geminiApiKey || DEFAULT_API_KEY;
      console.log('API key found:', apiKey.substring(0, 5) + '...');
      sendResponse({
        apiKey: apiKey,
        success: true
      });
    });
    return true;
  }
  
  if (request.action === 'getSavedQuestions') {
    // Retrieve saved questions from storage
    console.log('Retrieving saved questions from storage');
    chrome.storage.local.get(['savedQuestions'], function(result) {
      const questions = result.savedQuestions || [];
      console.log('Found', questions.length, 'saved questions');
      sendResponse({
        data: questions,
        success: true
      });
    });
    return true;
  }
  
  if (request.action === 'clearSavedQuestions') {
    // Clear saved questions
    console.log('Clearing all saved questions');
    chrome.storage.local.set({savedQuestions: []}, function() {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error('Error clearing questions:', lastError.message || 'Unknown error');
        sendResponse({success: false, error: lastError.message || 'Unknown error'});
      } else {
        console.log('Questions cleared successfully');
        sendResponse({success: true});
      }
    });
    return true;
  }
  
  if (request.action === 'createContextMenu') {
    // Allow popup to trigger context menu creation
    console.log('Received request to create context menu');
    safeCreateContextMenu();
    sendResponse({success: true});
    return true;
  }
}); 
