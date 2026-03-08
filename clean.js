const fs = require('fs');
const files = ['app.js', 'calculator.js', 'admin.js', 'ui.js', 'transactions.js', 'tracking.js', 'api.js', 'beneficiaries.js'];

files.forEach(f => {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        // Delete lines that contain console.log
        content = content.replace(/^.*console\.log.*$/gm, '');
        // Delete block comment in calculator
        content = content.replace(/\/\/ Admin rejection functions were moved to admin\.js\r?\n\/\/ Rates editor logic was moved to admin\.js\r?\n\r?\n\/\/ compressImage was moved to admin\.js\r?\n\r?\n/g, '');
        // Clean multiple empty lines
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        fs.writeFileSync(f, content);
    }
});
console.log('Cleanup finished');
