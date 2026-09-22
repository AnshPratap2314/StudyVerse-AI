const {getTopics}=require("../services/topicService");
async function list(req,res){try{const topics=await getTopics(req.user.id);res.json({success:true,count:topics.length,data:topics});}catch(e){res.status(500).json({success:false,error:"Failed to calculate topics."});}}
async function weak(req,res){try{const topics=(await getTopics(req.user.id)).filter(t=>t.status==="Weak");res.json({success:true,count:topics.length,data:topics});}catch(e){res.status(500).json({success:false,error:"Failed to fetch weak topics."});}}
async function strong(req,res){try{const topics=(await getTopics(req.user.id)).filter(t=>t.status==="Strong");res.json({success:true,count:topics.length,data:topics});}catch(e){res.status(500).json({success:false,error:"Failed to fetch strong topics."});}}
module.exports={list,weak,strong};
