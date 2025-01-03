document.addEventListener('DOMContentLoaded', loadSettings);

function loadSettings() {
    chrome.storage.local.get({
        // Default settings
        analyzeColors: true,
        analyzeObjects: false,
        analyzeStyles: false,
        anonymousData: true,
        dataRetention: 30,
        maxImagesPerPage: 100,
        backgroundProcessing: true
    }, function(settings) {
        // Set form values
        document.getElementById('analyzeColors').checked = settings.analyzeColors;
        document.getElementById('analyzeObjects').checked = settings.analyzeObjects;
        document.getElementById('analyzeStyles').checked = settings.analyzeStyles;
        document.getElementById('anonymousData').checked = settings.anonymousData;
        document.getElementById('dataRetention').value = settings.dataRetention;
        document.getElementById('maxImagesPerPage').value = settings.maxImagesPerPage;
        document.getElementById('backgroundProcessing').checked = settings.backgroundProcessing;
    });
}

document.getElementById('saveSettings').addEventListener('click', function() {
    const settings = {
        analyzeColors: document.getElementById('analyzeColors').checked,
        analyzeObjects: document.getElementById('analyzeObjects').checked,
        analyzeStyles: document.getElementById('analyzeStyles').checked,
        anonymousData: document.getElementById('anonymousData').checked,
        dataRetention: parseInt(document.getElementById('dataRetention').value),
        maxImagesPerPage: parseInt(document.getElementById('maxImagesPerPage').value),
        backgroundProcessing: document.getElementById('backgroundProcessing').checked
    };

    chrome.storage.local.set(settings, function() {
        // Show save confirmation
        const button = document.getElementById('saveSettings');
        button.textContent = 'Saved!';
        setTimeout(() => {
            button.textContent = 'Save Settings';
        }, 2000);
    });
}); 