// Content script that runs in the context of web pages

console.log('QCM Helper content script loaded');
console.log('Content script initialized and ready to process questions');

try {
  // Create and append notification element (only for technical notifications, not visible to user)
  const notificationElement = document.createElement('div');
  notificationElement.id = 'qcm-helper-notification';
  notificationElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #333;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transition: opacity 0.3s, transform 0.3s;
    opacity: 0;
    transform: translateY(20px);
    max-width: 300px;
    pointer-events: none;
  `;
  document.body.appendChild(notificationElement);
  console.log('Notification element created and appended to body');

  // Create and append answer display in bottom right corner
  const answerDisplay = document.createElement('div');
  answerDisplay.id = 'qcm-helper-answer-display';
  answerDisplay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #333;
    color: white;
    padding: 5px 8px;
    border-radius: 3px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    letter-spacing: 2px;
    z-index: 10001;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s, transform 0.3s;
  `;
  document.body.appendChild(answerDisplay);
  console.log('Answer display created and appended to body');

  // Create and append answer modal (keeping it for backup but not used)
  const answerModal = document.createElement('div');
  answerModal.id = 'qcm-helper-answer-modal';
  answerModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background-color: white;
    padding: 25px;
    border-radius: 8px;
    width: 70%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    position: relative;
  `;

  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #333;
  `;
  closeButton.onclick = closeModal;

  const questionSection = document.createElement('div');
  questionSection.style.cssText = `
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
  `;

  const questionTitle = document.createElement('h3');
  questionTitle.textContent = 'Question:';
  questionTitle.style.cssText = `
    margin-top: 0;
    color: #333;
    font-size: 18px;
  `;

  const questionContent = document.createElement('div');
  questionContent.style.cssText = `
    margin-bottom: 10px;
    white-space: pre-wrap;
    font-family: Arial, sans-serif;
  `;

  questionSection.appendChild(questionTitle);
  questionSection.appendChild(questionContent);

  const answerSection = document.createElement('div');

  const answerTitle = document.createElement('h3');
  answerTitle.textContent = 'Answer:';
  answerTitle.style.cssText = `
    color: #333;
    font-size: 18px;
  `;

  const answerContent = document.createElement('div');
  answerContent.style.cssText = `
    white-space: pre-wrap;
    font-family: Arial, sans-serif;
    line-height: 1.5;
  `;

  answerSection.appendChild(answerTitle);
  answerSection.appendChild(answerContent);

  modalContent.appendChild(closeButton);
  modalContent.appendChild(questionSection);
  modalContent.appendChild(answerSection);
  answerModal.appendChild(modalContent);
  document.body.appendChild(answerModal);
  console.log('Answer modal created and appended to body');

  // Function to show technical notification (hidden from user)
  function showNotification(message, duration = 3000) {
    console.log('Technical notification:', message);
    // Don't actually show the notification to the user
    // Just log it for debugging purposes
  }

  // Function to display answer in bottom right corner
  function displayAnswer(questionText, answerText) {
    console.log('Displaying answer:', answerText);
    
    // First try to extract answer letters directly if they're separated by spaces
    // This handles the case when the API correctly returns "A B C"
    let answerLetters = '';
    
    // Clean up the text first - remove any punctuation and unnecessary spaces
    const cleanedText = answerText.replace(/[^\sA-D]/gi, '').trim();
    
    // If the cleaned text is already in the format we want (like "A B C")
    const spaceSeparatedMatch = cleanedText.match(/^[A-D](\s+[A-D])*$/i);
    if (spaceSeparatedMatch) {
      // Use the already formatted answer
      answerLetters = cleanedText.toUpperCase();
    } else {
      // Otherwise, extract letters individually
      // Extract all answer letters (A, B, C, D) from anywhere in the text
      const validLetters = ['A', 'B', 'C', 'D'];
      let foundLetters = new Set();
      
      // Try multiple approaches to find letters
      
      // Approach 1: Look for patterns like "A)", "B.", etc.
      const patternMatches = answerText.match(/[A-D](?:\)|\.|\:|\s|$)/gi);
      if (patternMatches) {
        patternMatches.forEach(match => {
          const letter = match.charAt(0).toUpperCase();
          if (validLetters.includes(letter)) {
            foundLetters.add(letter);
          }
        });
      }
      
      // Approach 2: Look for single letters separated by spaces, commas, or other separators
      const words = answerText.split(/[\s,;\/]+/);
      words.forEach(word => {
        if (word.length === 1 && validLetters.includes(word.toUpperCase())) {
          foundLetters.add(word.toUpperCase());
        }
      });
      
      // Approach 3: Just extract any A, B, C, D as a fallback
      if (foundLetters.size === 0) {
        for (const char of answerText) {
          const upperChar = char.toUpperCase();
          if (validLetters.includes(upperChar)) {
            foundLetters.add(upperChar);
          }
        }
      }
      
      // Sort the letters and join them with spaces
      answerLetters = Array.from(foundLetters).sort().join(' ');
    }
    
    // If we still don't have any answer letters, use the original text
    if (!answerLetters) {
      answerLetters = answerText.length <= 5 ? answerText : answerText.charAt(0).toUpperCase();
    }
    
    // Display the answer letter(s) in the bottom right corner
    answerDisplay.textContent = answerLetters;
    answerDisplay.style.opacity = '1';
    answerDisplay.style.transform = 'translateY(0)';
    
    // Hide the answer after 10 seconds
    setTimeout(() => {
      answerDisplay.style.opacity = '0';
      answerDisplay.style.transform = 'translateY(20px)';
    }, 10000);
    
    // Also update the modal content (as backup)
    questionContent.textContent = questionText;
    answerContent.textContent = answerText;
  }

  // Function to close modal
  function closeModal() {
    console.log('Closing answer modal');
    answerModal.style.opacity = '0';
    setTimeout(() => {
      answerModal.style.visibility = 'hidden';
    }, 300);
  }

  // Close modal when clicking outside
  answerModal.addEventListener('click', function(e) {
    if (e.target === answerModal) {
      closeModal();
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content script received message:', request);
    
    if (request.action === 'showNotification') {
      showNotification(request.message);
      console.log('Technical notification logged:', request.message);
      sendResponse({success: true});
    }
    
    if (request.action === 'displayAnswer') {
      displayAnswer(request.questionText, request.answerText);
      console.log('Answer displayed');
      sendResponse({success: true});
    }
    
    return true;
  });

  console.log('Content script event handlers registered successfully');
} catch (error) {
  console.error('Error initializing content script:', error);
  // Try to show a basic alert if something goes wrong
  try {
    alert('QCM Helper Error: ' + error.message);
  } catch (e) {
    // Last resort if even the alert fails
    console.error('Critical error:', e);
  }
} 