// Test-only HTTPS server. Trust only its generated local certificate in the child
// process so locale rewrites can use loopback HTTPS without disabling validation.
import {createServer} from 'node:https';
import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

if (process.env.THRIFTLY_TEST_CERT_READY !== '1') {
  mkdirSync('.cache/test-tls',{recursive:true});
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout','.cache/test-tls/key.pem','-out','.cache/test-tls/cert.pem','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url)],{stdio:'inherit',env:{...process.env,THRIFTLY_TEST_CERT_READY:'1',NODE_EXTRA_CA_CERTS:resolve('.cache/test-tls/cert.pem')}});
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
  child.on('exit',code=>process.exit(code??0));
} else {
  const {default:next}=await import('next');
  const app=next({dev:false,hostname:'localhost',port:3107});
  await app.prepare();
  const handle=app.getRequestHandler();
  createServer({key:readFileSync('.cache/test-tls/key.pem'),cert:readFileSync('.cache/test-tls/cert.pem')},(req,res)=>{
    req.headers['x-forwarded-proto']='https';handle(req,res);
  }).listen(3107,'127.0.0.1',()=>console.log('Test server ready: https://127.0.0.1:3107'));
}
