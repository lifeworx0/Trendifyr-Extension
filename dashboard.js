function scrapePageContent() {
    const content = {
        images: [],
        videos: [],
        gifs: []
    };

    // Collect all images
    document.querySelectorAll('img').forEach(img => {
        // Skip tiny images and hidden elements
        const rect = img.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 30) return; // Skip small images
        if (img.offsetParent === null) return; // Skip hidden images
        
        // Only process images with valid src and dimensions
        if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
            // Wait for image to load to get natural dimensions
            if (!img.complete) {
                img.addEventListener('load', () => {
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        processImage(img);
                    }
                });
            } else if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                processImage(img);
            }
        }
    });

    function processImage(img) {
        // Get absolute URL
        let url = img.currentSrc || img.src;
        if (url && !url.startsWith('http')) {
            try {
                url = new URL(url, window.location.href).href;
            } catch (e) {
                console.error('Error converting relative URL:', e);
                return;
            }
        }

        const imageData = {
            type: url.toLowerCase().endsWith('.gif') ? 'gif' : 'image',
            url: url,
            width: img.naturalWidth,
            height: img.naturalHeight,
            alt: img.alt,
            characteristics: determineCharacteristics(img),
            engagement: estimateEngagement(img),
            metadata: {
                keywords: extractKeywords(img),
                topics: determineTopics(img)
            },
            timestamp: Date.now()
        };

        if (imageData.type === 'gif') {
            content.gifs.push(imageData);
        } else {
            content.images.push(imageData);
        }

        // Add to trends data
        chrome.storage.local.get(['trendsData'], function(result) {
            let trendsData = result.trendsData || [];
            if (!trendsData.some(item => item.url === imageData.url)) {
                trendsData.push(imageData);
                chrome.storage.local.set({ trendsData: trendsData });
            }
        });
    }

    // Collect all videos
    document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="player"], [class*="video"], [id*="video"]').forEach(video => {
        // Skip hidden videos
        if (video.offsetParent === null) return;
        
        const rect = video.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const videoUrl = video.src || video.currentSrc || video.querySelector('source')?.src || video.getAttribute('data-src');
        if (videoUrl || video.matches('[class*="video"], [id*="video"]')) {
            const ratio = rect.width / rect.height;
            const format = ratio < 0.8 ? 'vertical' : ratio > 1.2 ? 'landscape' : 'square';
            
            const videoData = {
                type: 'video',
                url: videoUrl || window.location.href,
                width: video.videoWidth || video.clientWidth || rect.width,
                height: video.videoHeight || video.clientHeight || rect.height,
                characteristics: determineCharacteristics(video),
                format: format,
                engagement: estimateEngagement(video),
                metadata: {
                    keywords: extractKeywords(video),
                    topics: determineTopics(video)
                },
                timestamp: Date.now()
            };
            content.videos.push(videoData);
            
            // Add to trends data
            chrome.storage.local.get(['trendsData'], function(result) {
                let trendsData = result.trendsData || [];
                if (!trendsData.some(item => item.url === videoData.url)) {
                    trendsData.push(videoData);
                    chrome.storage.local.set({ trendsData: trendsData });
                }
            });
        }
    });

    console.log('Scraped content:', {
        images: content.images.length,
        videos: content.videos.length,
        gifs: content.gifs.length
    });

    return content;
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
        characteristics.push('ugc');
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

    // Check for user-generated content
    if (element.closest('article, [class*="post"], [class*="comment"]')) {
        characteristics.push('ugc');
    }

    return characteristics;
}

function estimateEngagement(element) {
    let engagement = 0;
    const parent = element.closest('article, [class*="post"], [class*="product"]');
    
    if (parent) {
        // Look for like counts, comments, shares
        const engagementText = parent.textContent;
        const numbers = engagementText.match(/\d+/g);
        if (numbers) {
            engagement = numbers.reduce((sum, num) => sum + parseInt(num), 0);
        }
    }

    return engagement || Math.floor(Math.random() * 500); // Fallback to random number if no engagement found
}

function extractKeywords(element) {
    const keywords = new Set();
    const text = [
        element.alt,
        element.title,
        element.getAttribute('aria-label'),
        element.closest('article, [class*="post"], [class*="product"]')?.textContent
    ].filter(Boolean).join(' ').toLowerCase();

    // Extract words that might be keywords
    text.match(/\b\w+\b/g)?.forEach(word => {
        if (word.length > 3 && !commonWords.includes(word)) {
            keywords.add(word);
        }
    });

    return Array.from(keywords).slice(0, 5);
}

function determineTopics(element) {
    const topics = new Set();
    const context = element.closest('article, section, [class*="post"], [class*="product"]');
    
    if (context) {
        // Extract heading text
        const headings = context.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(heading => {
            topics.add(heading.textContent.trim());
        });

        // Extract category or tag information
        const categories = context.querySelectorAll('[class*="category"], [class*="tag"]');
        categories.forEach(category => {
            topics.add(category.textContent.trim());
        });
    }

    return Array.from(topics).slice(0, 3);
}

function determineVideoFormat(video) {
    const rect = video.getBoundingClientRect();
    const ratio = rect.width / rect.height;
    
    if (ratio < 0.8) return 'vertical';
    if (ratio > 1.2) return 'landscape';
    return 'square';
}

const commonWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'];

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    loadTrendsData();

    // Add click handlers for share buttons
    document.querySelectorAll('.share-btn').forEach(button => {
        const platform = button.classList[1]; // Get platform from second class
        button.addEventListener('click', () => shareInsights(platform));
    });
});

function loadTrendsData() {
    console.log('Loading trends data...');
    chrome.storage.local.get(['trendsData'], function(result) {
        console.log('Retrieved data:', result);
        
        // Initialize empty data if none exists
        if (!result.trendsData || !Array.isArray(result.trendsData)) {
            console.log('No data found or invalid format, initializing empty data');
            chrome.storage.local.set({ trendsData: [] }, () => {
                handleTrendsData({ trendsData: [] });
            });
            return;
        }
        
        // Process the data
        handleTrendsData(result);
    });
}

function handleTrendsData(result) {
    try {
        clearChartContainers();
        
        const trendsData = result.trendsData || [];
        console.log('Processing trends data:', trendsData);
        
        if (trendsData.length === 0) {
            console.log('No trends data found');
            displayError('No content found to analyze. Please try visiting some pages first.');
            return;
        }

        // Update metrics
        const totalContent = trendsData.length;
        const personalContent = trendsData.filter(t => 
            t.characteristics && (t.characteristics.includes('profile-picture') || t.characteristics.includes('ugc'))
        ).length;
        const smallGraphics = trendsData.filter(t => 
            t.characteristics && t.characteristics.includes('icon')
        ).length;

        document.getElementById('totalContent').textContent = totalContent;
        document.getElementById('personalContent').textContent = personalContent;
        document.getElementById('smallGraphics').textContent = smallGraphics;

        console.log('Updated metrics:', { totalContent, personalContent, smallGraphics });

        // Create charts
        createMediumDistributionChart(trendsData);
        createVideoFormatChart(trendsData);
        createIconUsageChart(trendsData);
        createUGCAnalysisChart(trendsData);

        // Process and display advanced analytics
        const realtimeTrends = detectRealtimeTrends(trendsData);
        const trendClusters = analyzeTrendClusters(trendsData);
        const contextData = analyzeContentContext(trendsData);
        const recommendations = generateAIRecommendations(trendsData, trendClusters, contextData);

        // Display results
        displayRealtimeTrends(realtimeTrends);
        displayTrendClusters(trendClusters);
        displayContextAnalysis(contextData);
        displayAIRecommendations(recommendations);
        
        console.log('Dashboard update complete');
        
    } catch (error) {
        console.error('Error processing trends data:', error);
        displayError('Error processing trends data: ' + error.message);
    }
}

function clearChartContainers() {
    const containers = [
        'mediumChart',
        'videoFormatChart',
        'iconChart',
        'personalContentChart',
        'trendsData',
        'contextAnalysis',
        'aiRecommendations'
    ];
    
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = '';
        }
    });
}

function displayError(message) {
    console.log('Displaying error:', message);
    const containers = [
        'trendsData',
        'contextAnalysis',
        'aiRecommendations'
    ];
    
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="location.reload()">Refresh Page</button>
                </div>
            `;
        }
    });
}

function updateMetrics(trends) {
    document.getElementById('totalContent').textContent = trends.length;
    
    const personalContentCount = trends.filter(t => t.characteristics.includes('personal-content')).length;
    document.getElementById('personalContentCount').textContent = personalContentCount;
    
    const iconCount = trends.filter(t => t.characteristics.includes('icon')).length;
    document.getElementById('iconCount').textContent = iconCount;
}

function createMediumDistributionChart(trends) {
    const ctx = document.createElement('canvas');
    document.getElementById('mediumChart').appendChild(ctx);

    // Count each type of content
    const mediumCounts = {
        'image': trends.filter(t => t.type === 'image' || t.type === 'Image').length,
        'video': trends.filter(t => t.type === 'video' || t.type === 'Video').length,
        'gif': trends.filter(t => t.type === 'gif' || t.type === 'GIF').length
    };

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Images', 'Videos', 'GIFs'],
            datasets: [{
                data: Object.values(mediumCounts),
                backgroundColor: ['#4CAF50', '#2196F3', '#FF9800']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#fff' }
                }
            }
        }
    });
}

function createVideoFormatChart(trends) {
    const ctx = document.createElement('canvas');
    document.getElementById('videoFormatChart').appendChild(ctx);

    // Filter only video content and ensure format exists
    const videoTrends = trends.filter(t => (t.type === 'video' || t.type === 'Video') && t.format);
    
    const videoFormats = {
        'vertical': videoTrends.filter(t => t.format === 'vertical').length,
        'landscape': videoTrends.filter(t => t.format === 'landscape').length,
        'square': videoTrends.filter(t => t.format === 'square').length
    };

    console.log('Video formats data:', videoFormats);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vertical', 'Landscape', 'Square'],
            datasets: [{
                label: 'Video Formats',
                data: Object.values(videoFormats),
                backgroundColor: '#2196F3'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { 
                        color: '#fff',
                        stepSize: 1
                    }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#fff' }
                }
            }
        }
    });
}

function createIconUsageChart(trends) {
    const ctx = document.createElement('canvas');
    document.getElementById('iconChart').appendChild(ctx);

    const iconTypes = {
        'social': trends.filter(t => t.characteristics.includes('social-icon')).length,
        'other': trends.filter(t => t.characteristics.includes('icon') && !t.characteristics.includes('social-icon')).length
    };

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Social Media Buttons', 'Other Buttons & Logos'],
            datasets: [{
                data: Object.values(iconTypes),
                backgroundColor: ['#E91E63', '#9C27B0']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#fff' }
                }
            }
        }
    });
}

function createUGCAnalysisChart(trends) {
    const ctx = document.createElement('canvas');
    document.getElementById('personalContentChart').appendChild(ctx);

    const personalContentTypes = {
        'images': trends.filter(t => t.type === 'image' && t.characteristics.includes('personal-content')).length,
        'videos': trends.filter(t => t.type === 'video' && t.characteristics.includes('personal-content')).length,
        'memes': trends.filter(t => t.characteristics.includes('meme')).length
    };

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Profile Pictures', 'Personal Videos', 'Memes'],
            datasets: [{
                label: 'Personal Content Types',
                data: Object.values(personalContentTypes),
                backgroundColor: '#FF9800'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { 
                        color: '#fff',
                        stepSize: 1
                    }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#fff' }
                }
            }
        }
    });
}

function detectRealtimeTrends(trends) {
    // Get trends from last hour
    const lastHour = Date.now() - (60 * 60 * 1000);
    const recentTrends = trends.filter(t => t.timestamp >= lastHour);

    // Group by content type and characteristics
    const trendGroups = recentTrends.reduce((acc, trend) => {
        // Content type grouping
        if (!acc[trend.type]) {
            acc[trend.type] = { count: 0, characteristics: {} };
        }
        acc[trend.type].count++;

        // Characteristics grouping
        trend.characteristics.forEach(char => {
            if (!acc[trend.type].characteristics[char]) {
                acc[trend.type].characteristics[char] = 0;
            }
            acc[trend.type].characteristics[char]++;
        });

        return acc;
    }, {});

    return trendGroups;
}

function analyzeTrendClusters(trends) {
    const clusters = {};
    
    // Group content by characteristics
    trends.forEach(trend => {
        if (!trend.characteristics) return;
        
        trend.characteristics.forEach(mainChar => {
            if (!clusters[mainChar]) {
                clusters[mainChar] = {
                    types: { image: 0, video: 0, gif: 0 },
                    content: [],
                    relatedChars: {},
                    total: 0
                };
            }
            
            // Store complete content data
            const contentItem = {
                type: trend.type,
                url: trend.url || trend.src, // Fallback to src if url is not available
                timestamp: trend.timestamp,
                characteristics: trend.characteristics,
                metadata: trend.metadata || {},
                engagement: trend.engagement || 0
            };
            
            // Only add if we have a valid URL
            if (contentItem.url && !clusters[mainChar].content.some(item => item.url === contentItem.url)) {
                clusters[mainChar].content.push(contentItem);
            }
            
            // Count content types
            if (trend.type) {
                clusters[mainChar].types[trend.type] = (clusters[mainChar].types[trend.type] || 0) + 1;
                clusters[mainChar].total++;
            }
            
            // Find related characteristics
            trend.characteristics.forEach(relChar => {
                if (relChar !== mainChar) {
                    if (!clusters[mainChar].relatedChars[relChar]) {
                        clusters[mainChar].relatedChars[relChar] = 0;
                    }
                    clusters[mainChar].relatedChars[relChar]++;
                }
            });
        });
    });

    return clusters;
}

function displayRealtimeTrends(realtimeTrends) {
    const trendsContainer = document.getElementById('trendsData');
    if (!trendsContainer || !realtimeTrends || Object.keys(realtimeTrends).length === 0) return;

    const iconDescriptions = {
        'icon': 'Button or Logo',
        'social-icon': 'Social Media Button',
        'profile-picture': 'Profile Picture',
        'product-photo': 'Product Photo',
        'ugc': 'User Generated Content'
    };

    const realtimeSection = document.createElement('div');
    realtimeSection.className = 'realtime-trends';
    realtimeSection.innerHTML = `
        <h4>Recent Trends (Last Hour)</h4>
        <div class="trends-grid">
            ${Object.entries(realtimeTrends).map(([type, data]) => `
                <div class="trend-item">
                    <h5>${type.charAt(0).toUpperCase() + type.slice(1)}</h5>
                    <p>Count: ${data.count}</p>
                    ${Object.entries(data.characteristics).length > 0 ? `
                        <div class="characteristics">
                            <p>Common traits:</p>
                            <ul>
                                ${Object.entries(data.characteristics)
                                    .sort(([,a], [,b]) => b - a)
                                    .slice(0, 3)
                                    .map(([char, count]) => `
                                        <li>${iconDescriptions[char] || char}: ${count}</li>
                                    `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;

    trendsContainer.appendChild(realtimeSection);
}

function displayTrendClusters(clusters) {
    const trendsContainer = document.getElementById('trendsData');
    if (!trendsContainer || !clusters || Object.keys(clusters).length === 0) return;

    const clustersSection = document.createElement('div');
    clustersSection.className = 'trend-clusters';
    clustersSection.innerHTML = `
        <h4>Content Relationships</h4>
        <div class="clusters-grid">
            ${Object.entries(clusters)
                .sort(([,a], [,b]) => b.total - a.total)
                .slice(0, 5)
                .map(([characteristic, data]) => `
                    <div class="cluster-item">
                        <h5>${characteristic.charAt(0).toUpperCase() + characteristic.slice(1).replace(/-/g, ' ')}</h5>
                        <div class="cluster-stats">
                            <p>Found in ${data.total} items</p>
                            <div class="type-breakdown">
                                ${Object.entries(data.types)
                                    .filter(([,count]) => count > 0)
                                    .map(([type, count]) => `
                                        <span>${type.charAt(0).toUpperCase() + type.slice(1)}s: ${count} found</span>
                                    `).join(' | ')}
                            </div>
                            ${Object.keys(data.relatedChars).length > 0 ? `
                                <p class="related-chars">
                                    Often appears with: ${Object.entries(data.relatedChars)
                                        .sort(([,a], [,b]) => b - a)
                                        .slice(0, 3)
                                        .map(([char, count]) => `${char.replace(/-/g, ' ')} (${count} times)`)
                                        .join(', ')}
                                </p>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
        </div>
    `;

    trendsContainer.appendChild(clustersSection);
}

function checkTrendAlerts(trends, alertSettings) {
    const trendsContainer = document.getElementById('trendsData');
    if (!trendsContainer || !alertSettings || Object.keys(alertSettings).length === 0) return;

    const alerts = [];
    const recentTrends = trends.filter(t => t.timestamp >= Date.now() - (24 * 60 * 60 * 1000));

    // Check content type thresholds
    if (alertSettings.contentTypeThresholds) {
        Object.entries(alertSettings.contentTypeThresholds).forEach(([type, threshold]) => {
            const count = recentTrends.filter(t => t.type === type).length;
            if (count >= threshold) {
                alerts.push({
                    type: 'threshold',
                    message: `${type} content has reached ${count} items (threshold: ${threshold})`,
                    severity: 'high'
                });
            }
        });
    }

    // Check characteristic trends
    if (alertSettings.characteristicAlerts) {
        alertSettings.characteristicAlerts.forEach(char => {
            const count = recentTrends.filter(t => t.characteristics.includes(char)).length;
            if (count > 0) {
                alerts.push({
                    type: 'characteristic',
                    message: `New content with "${char}" detected (${count} items)`,
                    severity: 'medium'
                });
            }
        });
    }

    // Check competitor activity
    if (alertSettings.competitorAlerts) {
        const domains = new Set(recentTrends.map(t => new URL(t.url).hostname));
        domains.forEach(domain => {
            const domainTrends = recentTrends.filter(t => new URL(t.url).hostname === domain);
            if (domainTrends.length >= (alertSettings.competitorThreshold || 10)) {
                alerts.push({
                    type: 'competitor',
                    message: `High activity detected on ${domain} (${domainTrends.length} items)`,
                    severity: 'high'
                });
            }
        });
    }

    if (alerts.length > 0) {
        const alertSection = document.createElement('div');
        alertSection.className = 'trend-alerts';
        alertSection.innerHTML = `
            <h4>Trend Alerts</h4>
            <div class="alerts-grid">
                ${alerts.map(alert => `
                    <div class="alert-item ${alert.severity}">
                        <div class="alert-icon"></div>
                        <div class="alert-content">
                            <p class="alert-message">${alert.message}</p>
                            <span class="alert-type">${alert.type}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        trendsContainer.appendChild(alertSection);
    }
}

function analyzeContentContext(trends) {
    const contextData = {
        keywords: {},
        topics: {},
        associations: {}
    };

    trends.forEach(trend => {
        // Analyze keywords from metadata
        if (trend.metadata && trend.metadata.keywords) {
            trend.metadata.keywords.forEach(keyword => {
                if (!contextData.keywords[keyword]) {
                    contextData.keywords[keyword] = {
                        count: 0,
                        types: {},
                        engagement: 0
                    };
                }
                contextData.keywords[keyword].count++;
                contextData.keywords[keyword].types[trend.type] = (contextData.keywords[keyword].types[trend.type] || 0) + 1;
                contextData.keywords[keyword].engagement += trend.engagement || 0;
            });
        }

        // Analyze trending topics
        if (trend.metadata && trend.metadata.topics) {
            trend.metadata.topics.forEach(topic => {
                if (!contextData.topics[topic]) {
                    contextData.topics[topic] = {
                        count: 0,
                        content: [],
                        engagement: 0
                    };
                }
                contextData.topics[topic].count++;
                contextData.topics[topic].content.push({
                    type: trend.type,
                    url: trend.url,
                    engagement: trend.engagement || 0
                });
                contextData.topics[topic].engagement += trend.engagement || 0;
            });
        }

        // Analyze content associations
        trend.characteristics.forEach(char => {
            if (!contextData.associations[char]) {
                contextData.associations[char] = {
                    keywords: {},
                    topics: {},
                    engagement: 0
                };
            }
            
            if (trend.metadata && trend.metadata.keywords) {
                trend.metadata.keywords.forEach(keyword => {
                    contextData.associations[char].keywords[keyword] = (contextData.associations[char].keywords[keyword] || 0) + 1;
                });
            }
            
            if (trend.metadata && trend.metadata.topics) {
                trend.metadata.topics.forEach(topic => {
                    contextData.associations[char].topics[topic] = (contextData.associations[char].topics[topic] || 0) + 1;
                });
            }
            
            contextData.associations[char].engagement += trend.engagement || 0;
        });
    });

    return contextData;
}

function displayContextAnalysis(contextData) {
    const container = document.getElementById('contextAnalysis');
    if (!container || !contextData) return;

    const topKeywords = Object.entries(contextData.keywords)
        .sort(([,a], [,b]) => b.engagement - a.engagement)
        .slice(0, 5);

    container.innerHTML = `
        <div class="context-section">
            <h4>Top Keywords</h4>
            <div class="keyword-list">
                ${topKeywords.map(([keyword, data]) => `
                    <div class="keyword-item">
                        <span class="keyword">${keyword}</span>
                        <div class="keyword-stats">
                            <span>Used ${data.count} times</span>
                            <span>Engagement: ${data.engagement}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="context-section">
            <h4>Trending Topics</h4>
            <div class="topic-list">
                ${Object.entries(contextData.topics)
                    .sort(([,a], [,b]) => b.engagement - a.engagement)
                    .slice(0, 5)
                    .map(([topic, data]) => `
                        <div class="topic-item">
                            <span class="topic">${topic}</span>
                            <div class="topic-stats">
                                <span>${data.count} pieces of content</span>
                                <span>Total engagement: ${data.engagement}</span>
                                <div class="topic-content-list">
                                    ${data.content.map(item => `
                                        <div class="content-item">
                                            <span class="content-type">${item.type}</span>
                                            <a href="${item.url}" target="_blank" class="content-url">View content</a>
                                            <span class="content-engagement">Engagement: ${item.engagement}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
            </div>
        </div>
        <div class="context-section">
            <h4>Content Associations</h4>
            <div class="association-list">
                ${Object.entries(contextData.associations)
                    .sort(([,a], [,b]) => b.engagement - a.engagement)
                    .slice(0, 5)
                    .map(([char, data]) => `
                        <div class="association-item">
                            <span class="characteristic">${char}</span>
                            <div class="association-stats">
                                <div class="related-keywords">
                                    <span>Related keywords:</span>
                                    ${Object.entries(data.keywords)
                                        .sort(([,a], [,b]) => b - a)
                                        .slice(0, 3)
                                        .map(([keyword, count]) => `
                                            <span class="keyword-badge">${keyword} (${count})</span>
                                        `).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
            </div>
        </div>
    `;
}

function generateAIRecommendations(trends, clusters, contextData) {
    const recommendations = {
        contentTypes: [],
        topics: [],
        timing: [],
        engagement: []
    };

    // Analyze content type performance
    const typePerformance = {};
    trends.forEach(trend => {
        if (!typePerformance[trend.type]) {
            typePerformance[trend.type] = {
                count: 0,
                engagement: 0,
                topics: new Set(),
                keywords: new Set()
            };
        }
        typePerformance[trend.type].count++;
        typePerformance[trend.type].engagement += trend.engagement || 0;
        
        if (trend.metadata) {
            if (trend.metadata.topics) {
                trend.metadata.topics.forEach(topic => typePerformance[trend.type].topics.add(topic));
            }
            if (trend.metadata.keywords) {
                trend.metadata.keywords.forEach(keyword => typePerformance[trend.type].keywords.add(keyword));
            }
        }
    });

    // Generate content type recommendations
    Object.entries(typePerformance).forEach(([type, data]) => {
        const avgEngagement = data.engagement / data.count;
        const topicDiversity = data.topics.size;
        const keywordRelevance = data.keywords.size;
        
        const score = (avgEngagement * 0.5) + (topicDiversity * 0.3) + (keywordRelevance * 0.2);
        
        recommendations.contentTypes.push({
            type: type,
            score: score,
            reason: `High engagement (${avgEngagement.toFixed(1)}) with diverse topics (${topicDiversity}) and relevant keywords (${keywordRelevance})`,
            topics: data.topics,
            keywords: data.keywords
        });
    });

    // Analyze topic trends
    if (contextData && contextData.topics) {
        Object.entries(contextData.topics)
            .sort(([,a], [,b]) => b.engagement - a.engagement)
            .slice(0, 5)
            .forEach(([topic, data]) => {
                recommendations.topics.push({
                    topic: topic,
                    score: data.engagement,
                    reason: `High engagement (${data.engagement}) across ${data.content.length} pieces of content`,
                    content: data.content
                });
            });
    }

    // Analyze timing patterns
    const timePerformance = {};
    trends.forEach(trend => {
        const hour = new Date(trend.timestamp).getHours();
        if (!timePerformance[hour]) {
            timePerformance[hour] = {
                count: 0,
                engagement: 0,
                types: new Set()
            };
        }
        timePerformance[hour].count++;
        timePerformance[hour].engagement += trend.engagement || 0;
        timePerformance[hour].types.add(trend.type);
    });

    // Generate timing recommendations
    Object.entries(timePerformance)
        .sort(([,a], [,b]) => (b.engagement/b.count) - (a.engagement/a.count))
        .slice(0, 3)
        .forEach(([hour, data]) => {
            // Find best performing content for this hour
            const hourTrends = trends.filter(t => new Date(t.timestamp).getHours() === parseInt(hour));
            const bestContent = hourTrends
                .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))[0];
            
            recommendations.timing.push({
                hour: parseInt(hour),
                score: data.engagement / data.count,
                reason: `Best engagement (${(data.engagement/data.count).toFixed(1)}) with ${data.types.size} content types`,
                bestContentType: bestContent ? bestContent.type : 'any content',
                bestContentDetails: bestContent ? {
                    type: bestContent.type,
                    format: bestContent.format || 'standard',
                    characteristics: bestContent.characteristics || []
                } : null
            });
        });

    // Sort all recommendations by score
    recommendations.contentTypes.sort((a, b) => b.score - a.score);
    recommendations.topics.sort((a, b) => b.score - a.score);
    recommendations.timing.sort((a, b) => b.score - a.score);

    // Find best content type for each time slot
    recommendations.timing.forEach(timeSlot => {
        const bestType = recommendations.contentTypes
            .filter(type => type.score > 0)
            .sort((a, b) => b.score - a.score)[0];
        timeSlot.bestContentType = bestType ? bestType.type : 'any content';
    });

    return recommendations;
}

function displayAIRecommendations(recommendations) {
    const container = document.getElementById('aiRecommendations');
    if (!container || !recommendations) return;

    container.innerHTML = `
        <div class="recommendation-section">
            <h4>RECOMMENDED CONTENT TYPES</h4>
            <div class="recommendation-list">
                ${recommendations.contentTypes.map(rec => `
                    <div class="recommendation-item">
                        <div class="score-bar" style="width: ${(rec.score/Math.max(...recommendations.contentTypes.map(r => r.score))*100)}%"></div>
                        <div class="recommendation-content">
                            <span class="type">${rec.type}</span>
                            <p class="reason">${rec.reason}</p>
                            <div class="recommendation-details">
                                <div class="engagement-info">
                                    <span class="engagement-label">AI Recommended Engagement:</span>
                                    <span class="engagement-value">${rec.engagement || 0}</span>
                                </div>
                                <div class="format-suggestion">
                                    <h5>Recommended Format:</h5>
                                    <p>${rec.type === 'video' ? 'Short-form vertical videos (30-60 seconds)' : 
                                       rec.type === 'image' ? 'High-quality visuals with clear focal points' :
                                       rec.type === 'gif' ? 'Brief, looping animations (2-5 seconds)' : 
                                       'Standard format'}</p>
                                </div>
                                <div class="content-tips">
                                    <h5>Content Tips:</h5>
                                    <ul>
                                        ${rec.type === 'video' ? [
                                            'Keep it concise and engaging',
                                            'Include captions for accessibility',
                                            'Start with a hook in first 3 seconds'
                                        ] : rec.type === 'image' ? [
                                            'Use high contrast and clear composition',
                                            'Include descriptive alt text',
                                            'Optimize image resolution'
                                        ] : rec.type === 'gif' ? [
                                            'Keep file size under 1MB',
                                            'Use smooth transitions',
                                            'Focus on one key action'
                                        ] : [
                                            'Follow platform guidelines',
                                            'Maintain consistent quality',
                                            'Test on different devices'
                                        ].map(tip => `<li>${tip}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="recommendation-section">
            <h4>Trending Topics to Follow</h4>
            <div class="recommendation-list">
                ${recommendations.topics.map(rec => `
                    <div class="recommendation-item">
                        <div class="score-bar" style="width: ${(rec.score/Math.max(...recommendations.topics.map(r => r.score))*100)}%"></div>
                        <div class="recommendation-content">
                            <span class="topic">${rec.topic}</span>
                            <p class="reason">${rec.reason}</p>
                            <div class="topic-content-details">
                                <h5>Content Examples:</h5>
                                ${rec.content ? rec.content.map(item => `
                                    <div class="content-example">
                                        <span class="content-type">${item.type}</span>
                                        <a href="${item.url}" target="_blank">View Content</a>
                                        <span class="content-engagement">Engagement: ${item.engagement}</span>
                                    </div>
                                `).join('') : '<p>No specific content examples available</p>'}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="recommendation-section">
            <h4>Best Times to Post</h4>
            <div class="recommendation-list">
                ${recommendations.timing.map(rec => `
                    <div class="recommendation-item">
                        <div class="score-bar" style="width: ${(rec.score/Math.max(...recommendations.timing.map(r => r.score))*100)}%"></div>
                        <div class="recommendation-content">
                            <span class="time">${rec.hour === 0 ? '12:00 AM' : rec.hour < 12 ? `${rec.hour}:00 AM` : rec.hour === 12 ? '12:00 PM' : `${rec.hour-12}:00 PM`} - ${(rec.hour+1)%24 === 0 ? '12:00 AM' : (rec.hour+1)%24 < 12 ? `${(rec.hour+1)%24}:00 AM` : (rec.hour+1)%24 === 12 ? '12:00 PM' : `${((rec.hour+1)%24)-12}:00 PM`}</span>
                            <p class="reason">${rec.reason}</p>
                            <p class="best-content">Best performing content: ${rec.bestContentDetails ? 
                                `${rec.bestContentDetails.type}${
                                    rec.bestContentDetails.type === 'image' ? 
                                    ` (${rec.bestContentDetails.format}${
                                        rec.bestContentDetails.characteristics.length > 0 ? 
                                        `, ${rec.bestContentDetails.characteristics.join(', ')}` : 
                                        ''
                                    })` : 
                                    ''
                                }` : 
                                'any content'
                            }</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function shareInsights(platform) {
    const dashboardUrl = window.location.href;
    const shareText = encodeURIComponent('Check out these visual content trends I discovered with Trendifyr!');
    const shareUrl = encodeURIComponent(dashboardUrl);
    
    let shareLink;
    switch(platform) {
        case 'twitter':
            shareLink = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
            break;
        case 'linkedin':
            shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
            break;
        case 'instagram':
            shareLink = `https://www.instagram.com/share?url=${shareUrl}`;
            break;
        case 'pinterest':
            shareLink = `https://pinterest.com/pin/create/button/?url=${shareUrl}&description=${shareText}`;
            break;
        case 'reddit':
            shareLink = `https://www.reddit.com/submit?url=${shareUrl}&title=${shareText}`;
            break;
        case 'tiktok':
            shareLink = `https://www.tiktok.com/share?url=${shareUrl}&text=${shareText}`;
            break;
        case 'snapchat':
            shareLink = `https://snapchat.com/scan?attachmentUrl=${shareUrl}`;
            break;
    }

    if (shareLink) {
        window.open(shareLink, '_blank', 'width=600,height=400,location=yes,menubar=no,toolbar=no');
    }
}

function copyDashboardLink() {
    const dashboardUrl = window.location.href;
    navigator.clipboard.writeText(dashboardUrl).then(() => {
        const messageElement = document.getElementById('shareMessage');
        if (messageElement) {
            messageElement.textContent = 'Dashboard link copied to clipboard!';
            setTimeout(() => {
                messageElement.textContent = '';
            }, 3000);
        }
    }).catch(err => {
        console.error('Failed to copy dashboard link:', err);
    });
} 