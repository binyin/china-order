const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'debug.log');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { level, message } = JSON.parse(body);
        const logEntry = `[${level}] ${message} (${new Date().toLocaleTimeString()})\n`;
        fs.appendFileSync(LOG_FILE, logEntry);
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(400);
        res.end('fail');
      }
    });
  }
});

server.listen(3001, '0.0.0.0');
console.log('Logger server running at http://0.0.0.0:3001/');
