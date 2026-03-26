export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Not allowed"});
  const{email,crypto}=req.body||{};
  if(!email)return res.status(400).json({error:"Email required"});
  const apiKey=process.env.COINBASE_COMMERCE_API_KEY;
  if(!apiKey)return res.status(500).json({error:"Payment not configured. Set COINBASE_COMMERCE_API_KEY"});
  try{
    const r=await fetch("https://api.commerce.coinbase.com/charges",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-CC-Api-Key":apiKey,"X-CC-Version":"2018-03-22"},
      body:JSON.stringify({
        name:"LM Trade - 1 Monat Zugang",
        description:"Monatlicher Zugang zum LM Trade AI Dashboard - 6 Assets, KI-Briefings",
        pricing_type:"fixed_price",
        local_price:{amount:"19.00",currency:"USD"},
        metadata:{customer_email:email,crypto_preference:crypto||"USDT"},
        redirect_url:(process.env.SITE_URL||"https://lmtrade-shop.vercel.app")+"/success?email="+encodeURIComponent(email),
        cancel_url:(process.env.SITE_URL||"https://lmtrade-shop.vercel.app")+"/#pricing"
      })
    });
    if(!r.ok){const e=await r.text();return res.status(500).json({error:"Coinbase: "+e.slice(0,200)});}
    const d=await r.json();
    return res.status(200).json({chargeUrl:d.data.hosted_url,chargeId:d.data.id});
  }catch(e){return res.status(500).json({error:e.message});}
}