const http = require('http');
const https = require('https');
const url = require('url');

const PROXY_PORT = 11436;
const OLLAMA_URL = 'http://localhost:11434';

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(`${OLLAMA_URL}${req.url}`, true);

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: req.method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const proxyReq = (parsedUrl.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
        console.error('Proxy error:', error);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to connect to Ollama' }));
    });

    req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
    console.log(`CORS Proxy running at http://localhost:${PROXY_PORT}`);
    console.log(`Forwarding to ${OLLAMA_URL}`);
});
