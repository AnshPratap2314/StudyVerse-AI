const mongoose = require("mongoose");
const documentSchema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  title:{type:String,required:true,trim:true,maxlength:200},
  originalFileName:{type:String,trim:true}, fileType:{type:String,default:"application/pdf"},
  fileSize:{type:Number,min:0}, pageCount:{type:Number,min:0}, extractedText:{type:String,default:""},
  status:{type:String,enum:["processing","ready","failed"],default:"ready"}, lastAccessedAt:{type:Date}
},{timestamps:true});
documentSchema.index({userId:1,updatedAt:-1});
module.exports=mongoose.model("Document",documentSchema);
