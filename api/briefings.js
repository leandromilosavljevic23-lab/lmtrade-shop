// GET /api/briefings — gibt aktuelle KI-Briefings aus Upstash Redis zurück.
// Werden täglich via /api/cron/update-briefings.js aktualisiert.

async function kvGet(key){
  const url=process.env.UPSTASH_REDIS_REST_URL;
  const tok=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!tok)return null;
  const r=await fetch(`${url}/get/${encodeURIComponent(key)}`,{headers:{Authorization:`Bearer ${tok}`}});
  if(!r.ok)return null;
  const d=await r.json();
  if(!d.result)return null;
  try{return JSON.parse(d.result);}catch(e){return null;}
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Cache-Control","public, max-age=300, stale-while-revalidate=600");

  const data=await kvGet("briefings:latest");
  if(!data){
    return res.status(404).json({error:"Keine Briefings gefunden. Cron noch nicht gelaufen."});
  }
  return res.status(200).json(data);
}
