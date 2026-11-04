// Test-only HTTPS server: WebKit honors upgrade-insecure-requests on loopback.
// Production continues to use Vercel's managed TLS and standard Next runtime.
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';
import next from 'next';

mkdirSync('.cache/test-tls', {recursive:true});
execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout','.cache/test-tls/key.pem','-out','.cache/test-tls/cert.pem','-days','1','-subj','/CN=localhost'], {stdio:'ignore'});
const app = next({dev:false, hostname:'127.0.0.1', port:3107});
await app.prepare();
const handle = app.getRequestHandler();
createServer({key:readFileSync('.cache/test-tls/key.pem'), cert:readFileSync('.cache/test-tls/cert.pem')}, (req,res) => {
  handle(req,res);
}).listen(3107,'127.0.0.1', () => console.log('Test server ready: https://127.0.0.1:3107'));
