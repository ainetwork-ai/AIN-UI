import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A2aChatAccumulator, ainuiFolderChat, readChatStream } from '../src/chat.js';

test('A2A artifact deltas, replacement, task snapshot and failures', () => {
  const a = new A2aChatAccumulator();
  a.push({kind:'status-update', contextId:'c', status:{state:'working', message:{parts:[{kind:'text',text:'Working'}]}}});
  a.push({kind:'artifact-update', artifact:{artifactId:'a',parts:[{kind:'text',text:'Hel'}]}});
  assert.equal(a.push({kind:'artifact-update',append:true,artifact:{artifactId:'a',parts:[{kind:'text',text:'lo'}]}}).text,'Hello');
  assert.equal(a.push({kind:'task',contextId:'c',status:{state:'completed',message:{parts:[{kind:'text',text:'Hello'}]}},artifacts:[{artifactId:'a',parts:[{kind:'text',text:'Hello'}]}]}).text,'Hello');
  assert.throws(()=>a.push({kind:'status-update',status:{state:'failed'}}));
});
test('folder chat is an A2UI catalog component with scoped actions',()=>{
  const m=ainuiFolderChat({driveId:'d',path:'folder',agents:[],agentId:'',messages:[],busy:false});
  assert.equal(m[1].updateComponents?.components[0].component,'FolderChat');
});
const response=(data:string)=>new Response(new ReadableStream({start(c){for(const b of new TextEncoder().encode(data))c.enqueue(new Uint8Array([b]));c.close();}}),{headers:{'content-type':'text/event-stream'}});
test('stream handles split UTF8/CRLF, snapshots and completion',async()=>{
  const r=await readChatStream(response('data: {"type":"CUSTOM","name":"ainui.chat.snapshot","value":{"text":"日本語","contextId":"ctx"}}\r\n\r\ndata: {"type":"RUN_FINISHED"}\r\n\r\n'),()=>{});
  assert.equal(r.text,'日本語');assert.equal(r.contextId,'ctx');
});
test('disconnect is an error; errors and aborts never look complete',async()=>{
  await assert.rejects(readChatStream(response('data: {"type":"TEXT_MESSAGE_CONTENT","delta":"partial"}\n\n'),()=>{}),/before completion/);
  await assert.rejects(readChatStream(response('data: {"type":"RUN_ERROR","message":"failed"}\n\n'),()=>{}),/failed/);
  const c=new AbortController();c.abort();await assert.rejects(readChatStream(response(''),()=>{},c.signal));
});

test('recursive inventory includes nested files and reports depth/errors/escape attempts', async () => {
  const { listFolderTree } = await import('../src/chat.js');
  const folders: Record<string, any[]> = {
    root: [{name:'sub',path:'root/sub',isDir:true}],
    'root/sub': [{name:'report.pdf',path:'root/sub/report.pdf',isDir:false}],
  };
  const result = await listFolderTree(async p => folders[p], 'root');
  assert.deepEqual(result.entries.map(e=>e.path),['root/sub','root/sub/report.pdf']);
  assert.equal(result.truncated,false);
  assert.equal((await listFolderTree(async p=>folders[p], 'root',{maxDepth:0})).truncated,true);
  const partial=await listFolderTree(async p=>{if(p==='root/sub')throw Error('offline');return folders[p];},'root');
  assert.deepEqual(partial.errors,['root/sub']);assert.equal(partial.truncated,true);
  const bad=await listFolderTree(async()=>[{name:'secret',path:'root/../secret',isDir:false}],'root');
  assert.equal(bad.entries.length,0);assert.equal(bad.truncated,true);
});
