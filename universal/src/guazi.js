function admGuaziValidateAES(aes,crypto){
 if(!aes||typeof aes.key!=='string'||typeof aes.iv!=='string')throw Error('Invalid Guazi AES parameters');
 var size=crypto.enc.Utf8.parse(aes.key).sigBytes;
 if([16,24,32].indexOf(size)<0||crypto.enc.Utf8.parse(aes.iv).sigBytes!==16)throw Error('Invalid Guazi AES sizes');
 return aes;
}
var admGuaziLibrary;
function admGetGuaziLibrary(){
 if(admGuaziLibrary)return admGuaziLibrary;
 admGuaziLibrary=(function(){
  /* GUAZI_CRYPTO_SOURCE */
  return {CryptoJS:this.CryptoJS,JSEncrypt:window.JSEncrypt};
 }).call({});
 return admGuaziLibrary;
}
// Guazi adapter: original RSA/AES and all six transformations are bundled by the builder.
// Scope upstream Quantumult globals locally; only admRun calls the real $done.
function cleanGuazi(ctx) {
 var original=ctx.body,result=original;
 try {
  var envelope=JSON.parse(original);
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||!envelope.data||typeof envelope.data!=='object'||typeof envelope.data.keys!=='string'||!envelope.data.keys)return original;
  if(Number(envelope.code)>=400)return original;
  if(/\/App\/(?:Resource\/(?:Config\/getNav|Vod\/(?:showOne|vurlDetail)))(?:\?|$)/.test(ctx.path)&&typeof envelope.data.response_key!=='string')return original;
  var $request={url:ctx.url},$response={body:original};
  function $done(value){if(value&&typeof value.body==='string')result=value.body;}
  var library=admGetGuaziLibrary(),CryptoJS=library.CryptoJS,window={JSEncrypt:library.JSEncrypt};
  /* GUAZI_LOGIC_SOURCE */
 }catch(_){return original;}
 return result;
}
