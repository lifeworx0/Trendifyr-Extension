// Function to analyze content type and characteristics
async function analyzeContent(url, elementData) {
    return new Promise((resolve) => {
        const analysis = {
            type: elementData.type || 'unknown',
            format: 'unknown',
            characteristics: [],
            timestamp: Date.now(),
            pageUrl: elementData.pageUrl
        };

        // Determine content type and characteristics from elementData
        if (elementData.tagName === 'IMG') {
            analysis.type = url.toLowerCase().endsWith('.gif') ? 'gif' : 'image';
            
            // Get characteristics
            const characteristics = [];
            const src = (elementData.src || '').toLowerCase();
            const alt = (elementData.alt || '').toLowerCase();
            const title = (elementData.title || '').toLowerCase();
            const classList = elementData.classList || [];
            
            // Detect content types
            if (src.includes('illustration') || src.includes('vector') ||
                src.includes('drawing') || alt.includes('illustration')) {
                characteristics.push('illustration');
            }
            if (src.includes('meme') || alt.includes('meme') || title.includes('meme')) {
                characteristics.push('meme');
            }
            if (src.includes('user') || src.includes('profile') ||
                alt.includes('profile') || src.includes('avatar') ||
                classList.includes('profile') || classList.includes('avatar')) {
                characteristics.push('profile');
            }
            if (src.includes('social') || src.includes('facebook') || 
                src.includes('twitter') || src.includes('instagram')) {
                characteristics.push('social');
            }
            
            // Set format based on dimensions
            if (elementData.width && elementData.height) {
                const ratio = elementData.width / elementData.height;
                analysis.format = ratio > 1.3 ? 'landscape' : 
                                ratio < 0.8 ? 'vertical' : 'square';
            }
            
            analysis.characteristics = characteristics;
        } 
        else if (elementData.tagName === 'VIDEO' || elementData.tagName === 'IFRAME') {
            analysis.type = 'video';
            const characteristics = [];
            
            // Detect video types
            if (url.includes('youtube')) {
                characteristics.push('youtube');
            } else if (url.includes('vimeo')) {
                characteristics.push('vimeo');
            }
            
            if (elementData.attributes && elementData.attributes.live) {
                characteristics.push('livestream');
            }
            
            // Set format based on dimensions
            if (elementData.width && elementData.height) {
                const ratio = elementData.width / elementData.height;
                analysis.format = ratio > 1.3 ? 'landscape' : 
                                ratio < 0.8 ? 'vertical' : 'square';
            }
            
            analysis.characteristics = characteristics;
        }

        resolve(analysis);
    });
}

// Listen for clicks on the extension button
chrome.action.onClicked.addListener((tab) => {
    // First analyze the current page
    chrome.tabs.sendMessage(tab.id, { action: 'ANALYZE_PAGE' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error sending analyze message:', chrome.runtime.lastError);
            return;
        }
        
        // After analysis, open the dashboard
        chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
        });
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_CONTENT') {
        analyzeContent(message.url, message.elementData)
            .then(analysis => {
                // Store the analysis
                chrome.storage.local.get(['trendsData'], function(result) {
                    let trendsData = result.trendsData || [];
                    if (!Array.isArray(trendsData)) {
                        trendsData = [];
                    }
                    
                    // Add new analysis
                    trendsData.push({
                        ...message.elementData,
                        ...analysis
                    });
                    
                    // Keep only last 1000 items
                    if (trendsData.length > 1000) {
                        trendsData.shift();
                    }
                    
                    // Store updated data
                    chrome.storage.local.set({ trendsData }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Error saving data:', chrome.runtime.lastError);
                        } else {
                            console.log('Saved analysis, total items:', trendsData.length);
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Error analyzing content:', error);
            });
    }
    return true;
});

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        trendsData: [],
        lastAnalysis: null
    }, () => {
        console.log('Storage initialized');
    });
}); 