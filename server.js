const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 3003;

// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

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

// Store databases: Map<filename, array_of_numbers>
const databases = new Map();

// Helper to load a single file into memory
function loadDatabaseFile(filePath, dbName) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n').map(line => line.trim()).filter(Boolean);
        databases.set(dbName, lines);
        console.log(`Loaded database "${dbName}" with ${lines.length} numbers.`);
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

// API Endpoint to upload a new database
app.post('/api/upload', upload.single('dbFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const dbName = req.file.originalname.replace('.txt', '');
    loadDatabaseFile(req.file.path, dbName);

    res.json({ success: true, dbName: dbName });
});

// API endpoint to get a random number from a database
app.get('/api/random', (req, res) => {
    const dbName = req.query.db;

    if (!dbName || !databases.has(dbName)) {
        return res.status(404).json({ error: 'Database not found' });
    }

    const targetData = databases.get(dbName);
    if (targetData.length === 0) {
        return res.json({ success: false, error: 'No numbers available' });
    }

    const randomIndex = Math.floor(Math.random() * targetData.length);
    const randomNumber = targetData[randomIndex];

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

    const numbers = databases.get(dbName);
    const index = numbers.indexOf(number);

    if (index === -1) {
        return res.status(404).json({ error: 'Number not found in database' });
    }

    // Remove from memory
    numbers.splice(index, 1);
    databases.set(dbName, numbers);

    // Save to file
    const filePath = path.join(__dirname, 'data', `${dbName}.txt`);
    try {
        fs.writeFileSync(filePath, numbers.join('\n'), 'utf-8');
        console.log(`Deleted number ${number} from ${dbName}. Remaining: ${numbers.length}`);
        res.json({ success: true, remaining: numbers.length });
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

// API endpoint to send restoration email
app.get('/api/send-email', async (req, res) => {
    const numberString = req.query.number;
    if (!numberString) {
        return res.status(400).json({ error: 'Number is required' });
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'support@support.whatsapp.com',
        subject: `Question about WhatsApp: Restore my account ${numberString}`,
        text: `Subject: Deactivation of my account\n\nTo WhatsApp Support,\n\nPlease reactivate my WhatsApp account with the phone number ${numberString}.\n\nMy mobile phone was recently stolen/lost and I am very concerned about the security of my personal data. I have already contacted my service provider to block the SIM card, but I now need to regain access to my account and ensure it is secured.\n\nThis account contains many important business and personal communications that I need for my daily activities. Please assist me in the restoration process as soon as possible.\n\nThank you for your help.\n\nRegards,\nWhatsApp User`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully for ${numberString}`);
        res.json({ success: true });
    } catch (error) {
        console.error(`Failed to send email for ${numberString}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
