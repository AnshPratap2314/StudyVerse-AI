const Document = require("../models/Document");
const { requireValidId } = require("../utils/ownership");

async function createDocument(req,res){
 try{
  if(!req.body.title||!String(req.body.title).trim()) return res.status(400).json({success:false,error:"Title is required."});
  const d=await Document.create({userId:req.user.id,title:String(req.body.title).trim(),originalFileName:req.body.originalFileName,fileType:req.body.fileType||"application/pdf",fileSize:Number(req.body.fileSize||0),pageCount:Number(req.body.pageCount||0),extractedText:String(req.body.extractedText||""),status:["processing","ready","failed"].includes(req.body.status)?req.body.status:"ready",lastAccessedAt:new Date()});
  res.status(201).json({success:true,data:d});
 }catch(e){res.status(500).json({success:false,error:"Failed to save document."});}
}
async function listDocuments(req,res){try{const docs=await Document.find({userId:req.user.id}).select("-extractedText").sort({updatedAt:-1}).limit(Math.min(Number(req.query.limit)||50,100));res.json({success:true,count:docs.length,data:docs});}catch(e){res.status(500).json({success:false,error:"Failed to fetch documents."});}}
async function getDocument(req,res){try{requireValidId(req.params.id);const d=await Document.findOne({_id:req.params.id,userId:req.user.id});if(!d)return res.status(404).json({success:false,error:"Document not found."});d.lastAccessedAt=new Date();await d.save();res.json({success:true,data:d});}catch(e){res.status(e.statusCode||500).json({success:false,error:e.statusCode?e.message:"Failed to fetch document."});}}
async function updateDocument(req,res){try{requireValidId(req.params.id);const d=await Document.findOne({_id:req.params.id,userId:req.user.id});if(!d)return res.status(404).json({success:false,error:"Document not found."});for(const k of ["title","originalFileName","fileType","status"]){if(req.body[k]!==undefined)d[k]=String(req.body[k]).trim();}for(const k of ["fileSize","pageCount"]){if(req.body[k]!==undefined){const n=Number(req.body[k]);if(!Number.isFinite(n)||n<0)return res.status(400).json({success:false,error:`${k} must be a non-negative number.`});d[k]=n;}}if(req.body.extractedText!==undefined)d.extractedText=String(req.body.extractedText);await d.save();res.json({success:true,data:d});}catch(e){res.status(e.statusCode||500).json({success:false,error:e.statusCode?e.message:"Failed to update document."});}}
async function deleteDocument(req,res){try{requireValidId(req.params.id);const d=await Document.findOneAndDelete({_id:req.params.id,userId:req.user.id});if(!d)return res.status(404).json({success:false,error:"Document not found."});res.json({success:true,message:"Document deleted."});}catch(e){res.status(e.statusCode||500).json({success:false,error:e.statusCode?e.message:"Failed to delete document."});}}
module.exports={createDocument,listDocuments,getDocument,updateDocument,deleteDocument};
