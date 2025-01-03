document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('viewFullReport');
    
    button.addEventListener('click', function() {
        // Disable button to prevent double-clicks
        button.disabled = true;
        
        // Send message to analyze current page
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            // Inject content script first
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
            }, () => {
                // Now send the message
                chrome.tabs.sendMessage(tabs[0].id, {action: 'ANALYZE_PAGE'}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError.message);
                        button.disabled = false;
                        return;
                    }
                    
                    // Open dashboard in new tab
                    chrome.tabs.create({url: 'dashboard.html'}, () => {
                        button.disabled = false;
                    });
                });
            });
        });
    });
}); 