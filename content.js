// Function to serialize element data
function serializeElement(element) {
    // Get the best available URL for the element
    let url = '';
    if (element.tagName === 'IMG') {
        url = element.currentSrc || element.src || element.dataset.src || '';
        
        // If it's a relative URL, make it absolute
        if (url && !url.startsWith('http')) {
            try {
                url = new URL(url, window.location.href).href;
            } catch (e) {
                console.error('Error converting relative URL:', e);
                return null;
            }
        }
    } else if (element.tagName === 'VIDEO' || element.tagName === 'IFRAME') {
        url = element.src || element.currentSrc || element.querySelector('source')?.src || '';
    }

    // Only proceed if we have a valid URL
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return null;

    // Get dimensions and calculate format
    const rect = element.getBoundingClientRect();
    const ratio = rect.width / rect.height;
    const format = ratio < 0.8 ? 'vertical' : ratio > 1.2 ? 'landscape' : 'square';

    return {
        type: element.tagName === 'IMG' ? (url.toLowerCase().endsWith('.gif') ? 'gif' : 'image') : 'video',
        url: url,
        src: url,
        width: element.naturalWidth || element.width || rect.width || 0,
        height: element.naturalHeight || element.height || rect.height || 0,
        format: format,
        alt: element.alt || '',
        title: element.title || '',
        classList: Array.from(element.classList),
        characteristics: determineCharacteristics(element),
        engagement: estimateEngagement(element),
        metadata: {
            keywords: extractKeywords(element),
            topics: extractTopics(element)
        },
        timestamp: Date.now(),
        pageUrl: window.location.href
    };
}

function determineCharacteristics(element) {
    const characteristics = [];
    const classList = Array.from(element.classList);
    const parentClasses = Array.from(element.parentElement?.classList || []);
    const size = element.getBoundingClientRect();

    // Check for profile pictures
    if (classList.includes('profile') || classList.includes('avatar') || 
        parentClasses.includes('profile') || parentClasses.includes('avatar') ||
        element.alt?.toLowerCase().includes('profile') ||
        element.alt?.toLowerCase().includes('avatar')) {
        characteristics.push('profile-picture');
        characteristics.push('personal-content');
    }

    // Check for icons
    if (size.width <= 48 && size.height <= 48) {
        characteristics.push('icon');
        if (element.closest('nav, header, footer')) {
            characteristics.push('social-icon');
        }
    }

    // Check for product images
    if (element.closest('.product, [class*="product"], [id*="product"]')) {
        characteristics.push('product-photo');
    }

    // Check for personal content
    if (element.closest('article, [class*="post"], [class*="comment"]')) {
        characteristics.push('personal-content');
    }

    return characteristics;
}

function estimateEngagement(element) {
    let engagement = 0;
    const parent = element.closest('article, [class*="post"], [class*="product"]');
    
    if (parent) {
        const engagementText = parent.textContent;
        const numbers = engagementText.match(/\d+/g);
        if (numbers) {
            engagement = numbers.reduce((sum, num) => sum + parseInt(num), 0);
        }
    }

    return engagement;
}

function extractKeywords(element) {
    const keywords = new Set();
    const text = [
        element.alt,
        element.title,
        element.getAttribute('aria-label'),
        element.closest('article, [class*="post"], [class*="product"]')?.textContent
    ].filter(Boolean).join(' ').toLowerCase();

    text.match(/\b\w+\b/g)?.forEach(word => {
        if (word.length > 3) {
            keywords.add(word);
        }
    });

    return Array.from(keywords).slice(0, 5);
}

function extractTopics(element) {
    const topics = new Set();
    const context = element.closest('article, section, [class*="post"], [class*="product"]');
    
    if (context) {
        context.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            topics.add(heading.textContent.trim());
        });

        context.querySelectorAll('[class*="category"], [class*="tag"]').forEach(category => {
            topics.add(category.textContent.trim());
        });
    }

    return Array.from(topics).slice(0, 3);
}

// Function to process each element
function processElement(element) {
    const elementData = serializeElement(element);
    if (elementData) {
        chrome.storage.local.get(['trendsData'], function(result) {
            let trendsData = result.trendsData || [];
            if (!Array.isArray(trendsData)) {
                trendsData = [];
            }
            
            // Add new data
            trendsData.push(elementData);
            
            // Keep only last 1000 items
            if (trendsData.length > 1000) {
                trendsData.shift();
            }
            
            // Store updated data
            chrome.storage.local.set({ trendsData }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving data:', chrome.runtime.lastError);
                } else {
                    console.log('Saved element data, total items:', trendsData.length);
                }
            });
        });
    }
}

// Function to analyze all content on the page
function analyzeAllContent() {
    console.log('Starting content analysis...');
    
    // Clear existing data and initialize with empty array
    chrome.storage.local.set({ trendsData: [] }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error clearing data:', chrome.runtime.lastError);
            return;
        }
        
        console.log('Cleared existing data, starting collection...');
        let processedCount = 0;
        let collectedData = [];

        // Process all images
        document.querySelectorAll('img').forEach(img => {
            if (img.complete) {
                const data = serializeElement(img);
                if (data) {
                    collectedData.push(data);
                    processedCount++;
                }
            } else {
                img.addEventListener('load', () => {
                    const data = serializeElement(img);
                    if (data) {
                        collectedData.push(data);
                        processedCount++;
                        
                        // Store data when all images are processed
                        if (processedCount === document.querySelectorAll('img, video, iframe[src*="youtube"], iframe[src*="vimeo"]').length) {
                            storeCollectedData(collectedData);
                        }
                    }
                });
            }
        });

        // Process all videos and iframes
        document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').forEach(video => {
            const data = serializeElement(video);
            if (data) {
                collectedData.push(data);
                processedCount++;
            }
        });

        // Store collected data
        if (collectedData.length > 0) {
            storeCollectedData(collectedData);
        }
    });
}

function storeCollectedData(collectedData) {
    chrome.storage.local.set({ trendsData: collectedData }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error storing collected data:', chrome.runtime.lastError);
        } else {
            console.log('Successfully stored', collectedData.length, 'items');
        }
    });
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ANALYZE_PAGE') {
        console.log('Received analyze page request');
        analyzeAllContent();
        
        // Verify data after a short delay
        setTimeout(() => {
            chrome.storage.local.get(['trendsData'], function(result) {
                const storedData = result.trendsData || [];
                console.log('Analysis complete. Stored items:', storedData.length);
                sendResponse({ 
                    status: 'Analysis complete',
                    itemsFound: storedData.length
                });
            });
        }, 1500);
    }
    return true; // Keep the message channel open for the async response
}); 