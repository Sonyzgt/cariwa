const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
require('dotenv').config();

const app = express();
const PORT = 3003;


// Setup Storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'data'));
    },
    filename: function (req, file, cb) {
        // keep the original name but ensure it's .txt if not explicitly provided
        let safeName = file.originalname;
        if (!safeName.endsWith('.txt')) {
            safeName += '.txt';
        }
        cb(null, safeName);
    }
});
const upload = multer({ storage: storage });

const regionNames = new Intl.DisplayNames(['id'], { type: 'region' });

function getFlagEmoji(countryCode) {
    if (!countryCode) return '🌍';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

function getPhoneDetails(numberString) {
    const withPlus = numberString.startsWith('+') ? numberString : '+' + numberString;
    const phoneNumber = parsePhoneNumberFromString(withPlus);

    if (phoneNumber && phoneNumber.country) {
        const countryCode = phoneNumber.country;
        let pCountryName = 'Unknown';
        try {
            pCountryName = regionNames.of(countryCode);
        } catch (e) {
        }
        return {
            valid: true,
            original: numberString,
            formatted: phoneNumber.formatInternational(),
            countryCode: countryCode,
            countryName: pCountryName,
            flag: getFlagEmoji(countryCode)
        };
    }

    return {
        valid: false,
        original: numberString,
        formatted: numberString,
        countryCode: null,
        countryName: 'Unknown',
        flag: '🌍'
    };
}

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Store databases: Map<filename, Map<regionCode, array_of_numbers>>
const databases = new Map();
// Store region metadata (name, flag) for quick lookup
const regionMetadataCache = new Map();

// Helper to load a single file into memory and group by region
function loadDatabaseFile(filePath, dbName) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n').map(line => line.trim()).filter(Boolean);
        
        const regionalGroups = new Map();
        
        for (const number of lines) {
            const details = getPhoneDetails(number);
            const rCode = details.countryCode || 'Unknown';
            
            if (!regionalGroups.has(rCode)) {
                regionalGroups.set(rCode, []);
                // Save metadata if not already cached
                if (rCode !== 'Unknown' && !regionMetadataCache.has(rCode)) {
                    regionMetadataCache.set(rCode, {
                        name: details.countryName,
                        flag: details.flag
                    });
                }
            }
            regionalGroups.get(rCode).push(number);
        }
        
        databases.set(dbName, regionalGroups);
        console.log(`Loaded database "${dbName}" with numbers from ${regionalGroups.size} regions.`);
    } catch (e) {
        console.error(`Error loading database file ${dbName}:`, e);
    }
}

// Load data into memory on startup
try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
    const files = fs.readdirSync(dataDir);
    let countTotalFiles = 0;

    for (const file of files) {
        if (file.endsWith('.txt')) {
            const dbName = file.replace('.txt', '');
            const filePath = path.join(dataDir, file);
            loadDatabaseFile(filePath, dbName);
            countTotalFiles++;
        }
    }
    console.log(`Successfully loaded ${countTotalFiles} databases.`);
} catch (error) {
    console.error('Failed to load databases', error);
}

// API endpoint to list databases
app.get('/api/databases', (req, res) => {
    const dbs = Array.from(databases.keys());
    res.json(dbs);
});

// API endpoint to get unique regions for a database
app.get('/api/regions', (req, res) => {
    const dbName = req.query.db;
    if (!dbName || !databases.has(dbName)) {
        return res.status(404).json({ error: 'Database not found' });
    }
    
    const regionalGroups = databases.get(dbName);
    const regions = [];
    
    for (const [code, numbers] of regionalGroups.entries()) {
        const meta = regionMetadataCache.get(code) || { name: 'Unknown', flag: '🌍' };
        regions.push({
            code,
            name: meta.name,
            flag: meta.flag,
            count: numbers.length
        });
    }
    
    // Sort by count descending
    regions.sort((a, b) => b.count - a.count);
    res.json(regions);
});

// API Endpoint to upload a new database
app.post('/api/upload', upload.single('dbFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const dbName = req.file.originalname.replace('.txt', '');
    loadDatabaseFile(req.file.path, dbName);

    res.json({ success: true, dbName: dbName });
});

// API Endpoint to delete a database file entirely
app.post('/api/delete-db', (req, res) => {
    const { dbName } = req.body;
    
    if (!dbName || !databases.has(dbName)) {
        return res.status(404).json({ error: 'Database not found' });
    }

    const filePath = path.join(__dirname, 'data', `${dbName}.txt`);
    
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        databases.delete(dbName);
        console.log(`Deleted database file: ${dbName}.txt`);
        res.json({ success: true });
    } catch (error) {
        console.error(`Failed to delete database file ${dbName}:`, error);
        res.status(500).json({ error: 'Failed to delete database file' });
    }
});

// API endpoint to get a random number from a database
app.get('/api/random', (req, res) => {
    const dbName = req.query.db;
    const regionCode = req.query.region;

    if (!dbName || !databases.has(dbName)) {
        return res.status(404).json({ error: 'Database not found' });
    }

    const regionalGroups = databases.get(dbName);
    let targetNumbers = [];

    if (regionCode && regionalGroups.has(regionCode)) {
        targetNumbers = regionalGroups.get(regionCode);
    } else {
        // Fallback to all numbers if no region specified or not found
        for (const numbers of regionalGroups.values()) {
            targetNumbers = targetNumbers.concat(numbers);
        }
    }

    if (targetNumbers.length === 0) {
        return res.json({ success: false, error: 'No numbers available' });
    }

    const randomIndex = Math.floor(Math.random() * targetNumbers.length);
    const randomNumber = targetNumbers[randomIndex];

    res.json({
        success: true,
        data: getPhoneDetails(randomNumber)
    });
});

// API endpoint to delete a number from a database
app.post('/api/delete', (req, res) => {
    const { db: dbName, number } = req.body;

    if (!dbName || !databases.has(dbName)) {
        return res.status(404).json({ error: 'Database not found' });
    }

    const regionalGroups = databases.get(dbName);
    const details = getPhoneDetails(number);
    const rCode = details.countryCode || 'Unknown';

    if (!regionalGroups.has(rCode)) {
        return res.status(404).json({ error: 'Region not found' });
    }

    const numbers = regionalGroups.get(rCode);
    const index = numbers.indexOf(number);

    if (index === -1) {
        return res.status(404).json({ error: 'Number not found in database' });
    }

    // Remove from memory
    numbers.splice(index, 1);
    if (numbers.length === 0) {
        regionalGroups.delete(rCode);
    } else {
        regionalGroups.set(rCode, numbers);
    }

    // Save to file (requires merging all groups back)
    const filePath = path.join(__dirname, 'data', `${dbName}.txt`);
    try {
        const allNumbers = [];
        for (const group of regionalGroups.values()) {
            allNumbers.push(...group);
        }
        
        fs.writeFileSync(filePath, allNumbers.join('\n'), 'utf-8');
        console.log(`Deleted number ${number} from ${dbName} (${rCode}). Remaining: ${allNumbers.length}`);
        res.json({ success: true, remaining: allNumbers.length });
    } catch (error) {
        console.error(`Failed to save database file ${dbName} after deletion:`, error);
        res.status(500).json({ error: 'Failed to update database file' });
    }
});

// API endpoint to search
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    const dbName = req.query.db;

    let targetData = [];
    if (dbName && databases.has(dbName)) {
        targetData = databases.get(dbName);
    } else if (!dbName && databases.size > 0) {
        // Fallback to first if not specified
        const firstKey = databases.keys().next().value;
        targetData = databases.get(firstKey);
    }

    if (!query) {
        return res.json({ matches: [], totalNumber: targetData.length, totalMatches: 0 });
    }

    const matches = [];
    let totalMatches = 0;
    const maxResults = 100;

    for (let i = 0; i < targetData.length; i++) {
        if (targetData[i].endsWith(query)) {
            totalMatches++;
            if (matches.length < maxResults) {
                matches.push(getPhoneDetails(targetData[i]));
            }
        }
    }

    res.json({
        matches,
        totalNumber: targetData.length,
        totalMatches
    });
});


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
