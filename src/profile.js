export function profileImage(value) {
  if(value===undefined || value===null || value==='')return null;
  if(typeof value!=='string' || value.length>24000)throw new Error('アイコン画像を小さくして、もう一度選んでね');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match)throw new Error('PNG・JPEG・WebPの画像を選んでね');
  const bytes=Buffer.from(match[2],'base64');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
      bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!valid || bytes.length<32)throw new Error('画像を読み込めませんでした。別の画像を選んでね');
  return value;
}
