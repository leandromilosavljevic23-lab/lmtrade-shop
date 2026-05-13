// Vercel Cron Job — alle 2h.
// Holt Live-Preise, fragt Claude API für jedes Asset, speichert in Upstash Redis.
// Env Vars: ANTHROPIC_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, CRON_SECRET

const ASSETS=[
  {id:'us30',name:'US30',sym:'US30/DOW',em:'🏦',priceKey:'us30'},
  {id:'nas100',name:'NAS100',sym:'NAS100',em:'💹',priceKey:'nas100'},
  {id:'xau',name:'Gold',sym:'XAU/USD',em:'🥇',priceKey:'xau'},
  {id:'xag',name:'Silver',sym:'XAG/USD',em:'🪙',priceKey:'xag'},
  {id:'eurusd',name:'EUR/USD',sym:'EUR/USD',em:'🇪🇺',priceKey:'eurusd'},
  {id:'btc',name:'Bitcoin',sym:'BTC/USD',em:'₿',priceKey:'btc'},
];

async function kvSet(key,value){
  const url=process.env.UPSTASH_REDIS_REST_URL;
  const tok=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!tok)return false;
  const r=await fetch(`${url}/set/${encodeURIComponent(key)}`,{
    method:'POST',
    headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},
    body:JSON.stringify(value),
  });
  return r.ok;
}

async function fetchLivePrices(siteUrl){
  try{
    const r=await fetch(`${siteUrl}/api/prices`,{headers:{Accept:'application/json'}});
    if(r.ok)return await r.json();
  }catch(e){}
  return {};
}

async function generateBriefing(asset,prices){
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey)return null;

  const p=prices[asset.priceKey];
  const priceStr=p?.price!=null
    ?`${asset.sym} aktuell: ${p.price} (24h: ${p.ch24!=null?(p.ch24>=0?'+':'')+p.ch24.toFixed(2)+'%':'unbekannt'})`
    :`${asset.sym}: Preis nicht verfügbar`;

  const prompt=`Du bist ein professioneller Trading-Analyst für das AI Trade Board Dashboard (institutionell, sachlich, deutsch).

Asset: ${asset.name} (${asset.sym})
${priceStr}
Heutiges Datum: ${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}

Erstelle ein Briefing im exakten JSON-Format:
{
  "score": <0-100, KI-Setup-Qualität>,
  "dir": <"bull"|"bear"|"neut">,
  "conf": <0-100, Konfidenz>,
  "ch": <"z.B. +1.24%">,
  "s1": <Support Level als String>,
  "s2": <Support Level 2>,
  "r1": <Resistance Level>,
  "r2": <Resistance Level 2>,
  "tf": {"h4":"Bullish|Bearish|Neutral","d":"Bullish|Bearish|Neutral","w":"Bullish|Bearish|Neutral"},
  "regime": "<Kurzformel Marktregime, max 8 Wörter>",
  "text": [
    "<Satz 1: Technische Struktur, 2-3 Sätze>",
    "<Satz 2: Key Katalysatoren, 2-3 Sätze>",
    "<Satz 3: Sentiment + Risiken, 2-3 Sätze>"
  ]
}

Antworte NUR mit dem JSON, kein Text davor oder danach.`;

  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'x-api-key':apiKey,
        'anthropic-version':'2023-06-01',
        'Content-Type':'application/json',
      },
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:600,
        messages:[{role:'user',content:prompt}],
      }),
    });
    if(!r.ok){console.error(`Claude API Error ${asset.id}:`,r.status);return null;}
    const d=await r.json();
    const text=d.content?.[0]?.text||'';
    const jsonMatch=text.match(/\{[\s\S]*\}/);
    if(!jsonMatch)return null;
    return JSON.parse(jsonMatch[0]);
  }catch(e){
    console.error(`Briefing error ${asset.id}:`,e.message);
    return null;
  }
}

export default async function handler(req,res){
  const cronSecret=process.env.CRON_SECRET;
  const authHeader=req.headers.authorization;
  if(cronSecret&&authHeader!==`Bearer ${cronSecret}`){
    return res.status(401).json({error:'Unauthorized'});
  }

  const siteUrl=process.env.SITE_URL||'https://lmtrade-shop.vercel.app';
  console.log('Briefings Cron gestartet',new Date().toISOString());

  const prices=await fetchLivePrices(siteUrl);

  const results={};
  const errors=[];

  for(const asset of ASSETS){
    const briefing=await generateBriefing(asset,prices);
    if(briefing){
      results[asset.id]={
        ...briefing,
        id:asset.id,
        name:asset.name,
        sym:asset.sym,
        em:asset.em,
        price:prices[asset.priceKey]?.price!=null
          ?formatPrice(asset.id,prices[asset.priceKey].price)
          :null,
        ch24raw:prices[asset.priceKey]?.ch24??null,
      };
    }else{
      errors.push(asset.id);
    }
    await new Promise(r=>setTimeout(r,500));
  }

  if(Object.keys(results).length===0){
    return res.status(500).json({error:'Alle Briefings fehlgeschlagen',errors});
  }

  const payload={
    assets:results,
    updatedAt:new Date().toISOString(),
    date:new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    errors,
  };
  const stored=await kvSet('briefings:latest',payload);

  console.log(`Briefings gespeichert: ${Object.keys(results).length}/6, Errors: ${errors.join(',')}`);
  return res.status(200).json({ok:true,stored,count:Object.keys(results).length,errors,updatedAt:payload.updatedAt});
}

function formatPrice(id,price){
  if(id==='eurusd')return price.toFixed(4);
  if(id==='btc'||price>=10000)return price.toLocaleString('en-US',{maximumFractionDigits:0});
  if(price>=100)return price.toLocaleString('en-US',{maximumFractionDigits:2});
  return price.toFixed(2);
}
