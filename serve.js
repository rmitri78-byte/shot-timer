#!/usr/bin/env node
// Serves this folder over HTTPS on the local network, so a phone on the same Wi-Fi can open the
// timer and use its microphone (browsers only allow the mic on HTTPS or localhost).
//
//   node serve.js            → https://<this Mac's Wi-Fi IP>:8443
//   node serve.js 9443       → another port
//
// A self-signed certificate is created once in certs/ (never commit that folder). The phone shows a
// warning the first time: Show Details → "visit this website" → the mic prompt then works normally.
'use strict';
const fs = require('fs'), path = require('path'), https = require('https'), http = require('http'), net = require('net'), os = require('os');
const { execFileSync } = require('child_process');

const root = __dirname;
const port = Number(process.argv[2]) || 8443;
const certDir = path.join(root, 'certs'), keyFile = path.join(certDir, 'key.pem'), certFile = path.join(certDir, 'cert.pem');
const lanIps = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  fs.mkdirSync(certDir, { recursive: true });
  // A config file instead of -addext, so it works with macOS's LibreSSL as well as OpenSSL.
  const cfg = path.join(certDir, 'openssl.cnf');
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...lanIps.map(ip => 'IP:' + ip)].join(',');
  fs.writeFileSync(cfg, `[req]\ndistinguished_name = dn\nx509_extensions = v3\nprompt = no\n[dn]\nCN = Shot Timer\n[v3]\nsubjectAltName = ${san}\nbasicConstraints = CA:FALSE\n`);
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
    '-keyout', keyFile, '-out', certFile, '-config', cfg], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('Created a self-signed certificate in certs/ (the phone will warn once; that is expected).');
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json' };

const tls = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'https://local').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root + path.sep) || file.startsWith(certDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
// Typing the address without "https://" sends plain HTTP to the same port; answer that with a redirect instead of a dead connection.
const plain = http.createServer((req, res) => { res.writeHead(301, { Location: 'https://' + (req.headers.host || 'localhost') + req.url }); res.end(); });

// Both real servers listen on loopback only; the public port peeks the first byte of each connection
// (0x16 = TLS handshake, anything else = plain HTTP) and proxies it to the right one.
const front = net.createServer(sock => {
  sock.on('error', () => {});
  sock.once('data', first => {
    sock.pause();
    const target = first[0] === 0x16 ? tls : plain;
    const up = net.connect(target.address().port, '127.0.0.1', () => { up.write(first); sock.pipe(up).pipe(sock); });
    up.on('error', () => sock.destroy());
    sock.on('close', () => up.destroy());
  });
});
tls.listen(0, '127.0.0.1', () => plain.listen(0, '127.0.0.1', () => front.listen(port, announce)));
function announce() {
  console.log('Shot Timer is up. On the phone (same Wi-Fi as this Mac), open:');
  for (const ip of lanIps) console.log(`  https://${ip}:${port}`);
  console.log(`  https://localhost:${port}   (on this Mac)`);
  console.log('First time: accept the certificate warning (Show Details → visit this website), then allow the microphone.');
  console.log('If macOS asks whether "node" may accept incoming connections, click Allow. Ctrl+C stops the server.');
}
