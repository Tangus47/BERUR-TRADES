import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(here,"..","cloudflare-worker","src","index.js"),"utf8");
const previewOrigin="https://adaptive-preview.berur-trades-adaptive-preview.pages.dev";
const productionOrigin="https://tangus47.github.io";

function makeWorker(fetchImpl=async()=>new Response("{}",{status:200})){
 const sandbox={
  crypto:webcrypto,URL,URLSearchParams,Request,Response,TextEncoder,
  Uint8Array,Date,Math,JSON,String,Number,Array,Map,Set,RegExp,
  btoa:value=>Buffer.from(value,"binary").toString("base64"),
  fetch:fetchImpl
 };
 vm.runInNewContext(source.replace("export default {","globalThis.__worker = {")+";}",sandbox);
 return sandbox.__worker;
}
function makeKv(){
 const values=new Map();
 return {
  values,
  async put(key,value){values.set(key,value);},
  async get(key,type){const value=values.get(key);return value===undefined?null:type==="json"?JSON.parse(value):value;},
  async delete(key){values.delete(key);}
 };
}

test("preview Pages origin receives exact-origin CORS headers",async()=>{
 const worker=makeWorker(),kv=makeKv();
 const response=await worker.fetch(new Request("https://worker.example/api/subscription/request",{
  method:"OPTIONS",headers:{Origin:previewOrigin}
 }),{BERUR_SESSIONS:kv});
 assert.equal(response.status,204);
 assert.equal(response.headers.get("Access-Control-Allow-Origin"),previewOrigin);
});

test("production Pages origin remains allowed",async()=>{
 const worker=makeWorker(),kv=makeKv();
 const response=await worker.fetch(new Request("https://worker.example/api/subscription/request",{
  method:"OPTIONS",headers:{Origin:productionOrigin}
 }),{BERUR_SESSIONS:kv});
 assert.equal(response.status,204);
 assert.equal(response.headers.get("Access-Control-Allow-Origin"),productionOrigin);
});

test("unlisted website origin is rejected",async()=>{
 const worker=makeWorker(),kv=makeKv();
 const response=await worker.fetch(new Request("https://worker.example/api/subscription/request",{
  method:"POST",headers:{Origin:"https://attacker.example","Content-Type":"application/json"},
  body:JSON.stringify({email:"test@example.com",plan:"weekly",mpesa_reference:"ABC123456"})
 }),{BERUR_SESSIONS:kv});
 assert.equal(response.status,403);
});

test("OAuth started from preview returns authorization errors to preview",async()=>{
 const worker=makeWorker(),kv=makeKv();
 const start=await worker.fetch(new Request("https://worker.example/oauth/start",{
  headers:{Referer:previewOrigin+"/"}
 }),{DERIV_CLIENT_ID:"test-client",BERUR_SESSIONS:kv});
 assert.equal(start.status,302);
 const auth=new URL(start.headers.get("Location"));
 const state=auth.searchParams.get("state");
 const saved=JSON.parse(kv.values.get("oauth:"+state));
 assert.equal(saved.returnOrigin,previewOrigin);
 const callback=await worker.fetch(new Request("https://worker.example/oauth/callback?error=access_denied&state="+state),{
  DERIV_CLIENT_ID:"test-client",BERUR_SESSIONS:kv
 });
 assert.equal(callback.status,302);
 const destination=new URL(callback.headers.get("Location"));
 assert.equal(destination.origin,previewOrigin);
 assert.equal(destination.searchParams.get("oauth_error"),"authorization_denied");
});

test("successful preview OAuth callback returns one-use ticket to preview",async()=>{
 const worker=makeWorker(async()=>new Response(JSON.stringify({access_token:"test-access-token",expires_in:3600,token_type:"Bearer"}),{
  status:200,headers:{"Content-Type":"application/json"}
 }));
 const kv=makeKv();
 const start=await worker.fetch(new Request("https://worker.example/oauth/start",{
  headers:{Referer:previewOrigin+"/"}
 }),{DERIV_CLIENT_ID:"test-client",BERUR_SESSIONS:kv});
 const auth=new URL(start.headers.get("Location"));
 const state=auth.searchParams.get("state");
 const callback=await worker.fetch(new Request("https://worker.example/oauth/callback?code=test-code&state="+state),{
  DERIV_CLIENT_ID:"test-client",BERUR_SESSIONS:kv
 });
 assert.equal(callback.status,302);
 const destination=new URL(callback.headers.get("Location"));
 assert.equal(destination.origin,previewOrigin);
 assert.ok(new URLSearchParams(destination.hash.slice(1)).get("oauth_ticket"));
});
