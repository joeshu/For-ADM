export function buildGuaziSource(adapter,upstream,aes){
 const boundary=upstream.lastIndexOf('(function () {');
 const cryptoStart=upstream.indexOf('!function(t,e){"object"==typeof exports?module.exports=exports=e():');
 if(boundary<0||cryptoStart<0||cryptoStart>=boundary)throw Error('Unknown Guazi upstream structure');
 let logic=upstream.slice(boundary);
 const guards=[['return parseJSON(dec);','return admGuaziValidateAES(parseJSON(dec),CryptoJS);'],['var arr0 = dec0.plain;','var arr0 = dec0.plain; if(!Array.isArray(arr0))return $done({body:body});'],['var obj1 = dec1.plain;','var obj1 = dec1.plain; if(!obj1||typeof obj1!=="object"||Array.isArray(obj1))return $done({body:body});'],['var list = dec2.plain;','var list = dec2.plain; if(!Array.isArray(list))return $done({body:body});']];
 for(const [from,to]of guards){if(logic.split(from).length!==2)throw Error('Unknown Guazi transformation structure');logic=logic.replace(from,to);}
 return adapter.replace('/* GUAZI_CRYPTO_SOURCE */',()=>upstream.slice(0,cryptoStart)+'\n'+aes).replace('/* GUAZI_LOGIC_SOURCE */',()=>logic);
}
