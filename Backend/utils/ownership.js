const mongoose=require("mongoose");
function isValidId(id){return mongoose.Types.ObjectId.isValid(id);}
function requireValidId(id){if(!isValidId(id)){const e=new Error("Invalid resource ID.");e.statusCode=400;throw e;}}
module.exports={isValidId,requireValidId};
