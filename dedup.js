const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));

let totalRemoved = 0;

for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    
    const seen = new Set();
    const unique = [];
    let dupes = 0;
    
    for (const line of lines) {
        if (seen.has(line)) {
            dupes++;
        } else {
            seen.add(line);
            unique.push(line);
        }
    }
    
    console.log(`📄 ${file}`);
    console.log(`   Total: ${lines.length} | Unique: ${unique.length} | Duplikat: ${dupes}`);
    
    if (dupes > 0) {
        // Write back unique numbers
        fs.writeFileSync(filePath, unique.join('\n') + '\n', 'utf-8');
        console.log(`   ✅ File disimpan ulang dengan ${unique.length} nomor (${dupes} duplikat dihapus)`);
        totalRemoved += dupes;
    } else {
        console.log(`   ✅ Tidak ada duplikat`);
    }
    
    console.log('');
}

console.log(`🎯 Total duplikat dihapus: ${totalRemoved}`);
