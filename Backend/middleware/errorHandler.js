function errorHandler(err,req,res,next){
  console.error(`❌ ${req.method} ${req.originalUrl}:`,err.message);
  if(res.headersSent) return next(err);
  const status=err.statusCode||500;
  return res.status(status).json({success:false,error:status===500?"Something went wrong on the server.":err.message});
}
module.exports=errorHandler;
