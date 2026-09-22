const mongoose=require("mongoose");
const questionSchema=new mongoose.Schema({question:{type:String,required:true},options:{type:[String],validate:v=>v.length===4},correctAnswer:{type:String,required:true},explanation:String,topic:String,difficulty:{type:String,default:"medium"}},{_id:true});
const quizSchema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},sessionId:{type:mongoose.Schema.Types.ObjectId,ref:"StudySession"},documentId:{type:mongoose.Schema.Types.ObjectId,ref:"Document"},title:{type:String,default:"Study Quiz"},topic:String,questions:{type:[questionSchema],default:[]}}, {timestamps:true});
quizSchema.index({userId:1,createdAt:-1}); module.exports=mongoose.model("Quiz",quizSchema);
