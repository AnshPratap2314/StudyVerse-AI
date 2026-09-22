const mongoose=require("mongoose");
const messageSchema=new mongoose.Schema({role:{type:String,enum:["user","ai"],required:true},text:{type:String,required:true,maxlength:20000},createdAt:{type:Date,default:Date.now}},{_id:true});
const chatSchema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},sessionId:{type:mongoose.Schema.Types.ObjectId,ref:"StudySession"},title:{type:String,default:"New Chat",trim:true},messages:[messageSchema]}, {timestamps:true});
chatSchema.index({userId:1,updatedAt:-1}); module.exports=mongoose.model("Chat",chatSchema);
