const fs = require("fs");
const path = require("path");

class VectorStore {
  constructor(filePath) { this.filePath=filePath; this.chunks=[]; this.load(); }
  load() { try { if(fs.existsSync(this.filePath)) this.chunks=JSON.parse(fs.readFileSync(this.filePath,"utf8")); } catch { this.chunks=[]; } }
  save() { fs.mkdirSync(path.dirname(this.filePath),{recursive:true}); const tmp=`${this.filePath}.tmp`; fs.writeFileSync(tmp,JSON.stringify(this.chunks),"utf8"); fs.renameSync(tmp,this.filePath); }
  removeDocument(documentId) { this.chunks=this.chunks.filter(x=>x.documentId!==documentId); this.save(); }
  addMany(items) { this.chunks.push(...items); this.save(); }
  listDocuments(ownerId) { const map=new Map(); for(const x of this.chunks.filter(item => !ownerId || item.ownerId === ownerId)){ if(!map.has(x.documentId)) map.set(x.documentId,{id:x.documentId,name:x.documentName,type:x.documentType,createdAt:x.createdAt,chunks:0}); map.get(x.documentId).chunks++; } return [...map.values()].sort((a,b)=>b.createdAt-a.createdAt); }
  search(queryVector,{topK=6,documentId,documentIds,ownerId}={}) { const ids = Array.isArray(documentIds) && documentIds.length ? new Set(documentIds.map(String)) : null; const c=this.chunks.filter(x=>(!ownerId || x.ownerId===ownerId) && (!documentId || x.documentId===documentId) && (!ids || ids.has(String(x.documentId)))); return c.map(x=>({...x,score:cosineSimilarity(queryVector,x.embedding)})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(Number(topK)||6,50))); }
  stats(){return {backend:"local-json",documents:this.listDocuments().length,chunks:this.chunks.length};}
}

class QdrantVectorStore {
  constructor(localStore,{url,apiKey,collection="smart_study_knowledge"}={}) { this.local=localStore; this.url=String(url||"").replace(/\/$/,""); this.apiKey=apiKey||""; this.collection=collection; this.chunks=localStore.chunks; this.remoteAvailable=Boolean(this.url); }
  headers(){return {"Content-Type":"application/json",...(this.apiKey?{"api-key":this.apiKey}:{})};}
  async request(pathname,options={}){const r=await fetch(`${this.url}${pathname}`,{...options,headers:{...this.headers(),...(options.headers||{})}});const text=await r.text();let data={};try{data=JSON.parse(text);}catch{}if(!r.ok)throw new Error(data?.status?.error||data?.result?.error||text||`Qdrant request failed (${r.status})`);return data;}
  async ensureCollection(dimension){
    if(!this.remoteAvailable) return false;
    const collectionPath=`/collections/${encodeURIComponent(this.collection)}`;
    try{
      try{
        await this.request(collectionPath);
      }catch(error){
        await this.request(collectionPath,{method:"PUT",body:JSON.stringify({vectors:{size:dimension,distance:"Cosine"}})});
      }
      await this.ensurePayloadIndex("documentId");
      await this.ensurePayloadIndex("ownerId");
      return true;
    }catch(error){
      this.remoteAvailable=false;
      console.warn(`[Qdrant] Remote vector store unavailable. Using local JSON vector store instead: ${error.message}`);
      return false;
    }
  }
  async ensurePayloadIndex(fieldName){
    if(!this.url)return;
    const indexPath=`/collections/${encodeURIComponent(this.collection)}/index?wait=true`;
    try{
      await this.request(indexPath,{method:"PUT",body:JSON.stringify({field_name:fieldName,field_schema:"keyword"})});
    }catch(error){
      const message=String(error?.message||error);
      if(!/already exists|field already exists|conflict/i.test(message)){
        throw new Error(`Qdrant payload index '${fieldName}' could not be created: ${message}`);
      }
    }
  }
  async removeDocument(documentId){
    this.local.removeDocument(documentId);
    if(!this.remoteAvailable) return;
    try{
      if(!await this.ensureCollection(Number(process.env.GEMINI_EMBEDDING_DIMENSIONS||768))) return;
      await this.request(`/collections/${encodeURIComponent(this.collection)}/points/delete`,{method:"POST",body:JSON.stringify({filter:{must:[{key:"documentId",match:{value:documentId}}]}})});
    }catch(e){
      this.remoteAvailable=false;
      console.warn("[Qdrant] remove failed; local store remains authoritative fallback:",e.message);
    }
  }
  async addMany(items){
    this.local.addMany(items);
    if(!this.remoteAvailable||!items.length)return;
    try{
      if(!await this.ensureCollection(items[0].embedding.length)) return;
      await this.request(`/collections/${encodeURIComponent(this.collection)}/points?wait=true`,{method:"PUT",body:JSON.stringify({points:items.map(x=>({id:x.id,vector:x.embedding,payload:{...x,embedding:undefined}}))})});
    }catch(error){
      this.remoteAvailable=false;
      console.warn(`[Qdrant] Upload to remote vector store failed. Local JSON vector store remains active: ${error.message}`);
    }
  }
  async search(queryVector,{topK=6,documentId,documentIds,ownerId}={}){
    if(!this.remoteAvailable)return this.local.search(queryVector,{topK,documentId,documentIds,ownerId});
    const must=[];
    const should=[];
    if(documentId)must.push({key:"documentId",match:{value:documentId}});
    else if(Array.isArray(documentIds) && documentIds.length) should.push(...documentIds.map(id=>({key:"documentId",match:{value:id}})));
    if(ownerId)must.push({key:"ownerId",match:{value:ownerId}});
    const filter=(must.length || should.length) ? { ...(must.length ? {must} : {}), ...(should.length ? {should} : {}) } : undefined;
    try{
      const data=await this.request(`/collections/${encodeURIComponent(this.collection)}/points/search`,{method:"POST",body:JSON.stringify({vector:queryVector,limit:Math.max(1,Math.min(Number(topK)||6,50)),with_payload:true,filter})});
      return(data.result||[]).map(x=>({...x.payload,score:x.score}));
    }catch(error){
      const message=String(error?.message||error);
      this.remoteAvailable=false;
      console.warn("[Qdrant] Search failed; falling back to owner-scoped local vector search:",message);
      return this.local.search(queryVector,{topK,documentId,documentIds,ownerId});
    }
  }
  listDocuments(ownerId){return this.local.listDocuments(ownerId);}
  stats(){return {backend:this.remoteAvailable?"qdrant+local-metadata":"local-json-fallback",remoteAvailable:this.remoteAvailable,collection:this.collection,documents:this.listDocuments().length,chunks:this.local.chunks.length};}
}

function cosineSimilarity(a,b){if(!a?.length||!b?.length||a.length!==b.length)return 0;let dot=0,ma=0,mb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];ma+=a[i]*a[i];mb+=b[i]*b[i];}return !ma||!mb?0:dot/(Math.sqrt(ma)*Math.sqrt(mb));}
module.exports={VectorStore,QdrantVectorStore,cosineSimilarity};
