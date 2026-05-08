// Vercel Cron Job — täglich 05:30 UTC.
// Holt Live-Preise, fragt Claude API für jedes Asset, speichert in Upstash Redis.
// Env Vars: ANTHROPIC_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, CRON_SECRET

const ASSETS=[
  {id:'xau',name:'Gold',sym:'XAU/USD',em:'🥇',priceKey:'xau'},
  {id:'nas',name:'NAS100',sym:'NAS100',em:'💹',priceKey:'nas'},
  {id:'eur',name:'EUR/USD',sym:'EUR/USD',em:'🇪🇺',priceKey:'eur'},
  {id:'btc',name:'Bitcoin',sym:'BTC/USD',em:'₿',priceKey:'btc'},
  {id:'eth',name:'Ethereum',sym:'ETH/USD',em:'⟠',priceKey:'eth'},
  {id:'dxy',name:'US Dollar Index',sym:'DXY',em:'💵',priceKey:'dxy'},
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
  const priceStr=p?.price!=null?`${asset.sym} aktuell: ${p.price} (24h: ${p.ch24!=null?(p.ch24>=0?'+':'')+p.ch24.toFixed(2)+'%':'unbekannt'})`:`${asset.sym}: Preis nicht verfügbar`;

  const prompt=`Du bist ein professioneller Trading-Analyst für das AI Trade Board Dashboard (institutionell, sachlich, deutsch).

Asset: ${asset.name} (${asset.sym})
${priceStr}
Heutiges Datum: ${new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}

Erstelle ein tägliches Briefing im exakten JSON-Format:
{
  "score": <0-100, KI-Setup-Qualität>,
  "dir": <"bull"|"bear"|"neut">,
  "conf": <0-100, Konfidenz>,
  "ch": <"z.B. +1.24%">,
  "s1": <Support Level als String>,
  "s2": <Support Level 2>,
  "r1": <Resistance Level>,
  "r2": <Resistance Level 2>,
  "tf": {"h1":"Bullish|Bearish|Neutral","h4":"Bullish|Bearish|Range|...","d":"Bullish|Bearish|Range|..."},
  "text": [
    "<Satz 1: Technische Struktur, 2-3 Sätze>",
    "<Satz 2: Key Katalysatoren heute, 2-3 Sätze>",
    "<Satz 3: Sentiment + Risiken, 2-3 Sätze>"
  ],
  "idea": "<Konkrete Trade-Idee mit Entry/Stop/Target/RR>"
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
        max_tokens:800,
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
  // Sicherheits-Check: nur von Vercel Cron oder mit Secret
  const cronSecret=process.env.CRON_SECRET;
  const authHeader=req.headers.authorization;
  if(cronSecret&&authHeader!==`Bearer ${cronSecret}`){
    return res.status(401).json({error:'Unauthorized'});
  }

  const siteUrl=process.env.SITE_URL||'https://lmtrade-shop.vercel.app';
  console.log('Briefings Cron gestartet',new Date().toISOString());

  // 1) Live-Preise holen
  const prices=await fetchLivePrices(siteUrl);

  // 2) Für jedes Asset ein Briefing generieren
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
      };
    }else{
      errors.push(asset.id);
    }
    // Rate limit: 500ms zwischen Calls
    await new Promise(r=>setTimeout(r,500));
  }

  if(Object.keys(results).length===0){
    return res.status(500).json({error:'Alle Briefings fehlgeschlagen',errors});
  }

  // 3) In Upstash Redis speichern
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
  if(id==='eur')return price.toFixed(4);
  if(id==='dxy')return price.toFixed(2);
  if(price>=1000)return price.toLocaleString('en-US',{maximumFractionDigits:0});
  return price.toFixed(2);
}
