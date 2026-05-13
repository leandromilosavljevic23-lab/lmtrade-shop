// Login-Endpoint. Validiert User gegen Upstash Redis (skalierbar, gratis).
// Fallback: USERS_JSON env var. Demo: jede plausible Eingabe (wenn weder Upstash noch USERS_JSON gesetzt).

async function kvGet(key){
  const url=process.env.UPSTASH_REDIS_REST_URL;
  const tok=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!tok)return null;
  const r=await fetch(`${url}/get/${encodeURIComponent(key)}`,{headers:{Authorization:`Bearer ${tok}`}});
  if(!r.ok)return null;
  const d=await r.json();
  if(!d.result)return null;
  try{return JSON.parse(d.result);}catch(e){return d.result;}
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});

  const{username,password}=req.body||{};
  if(!username||!password)return res.status(400).json({error:"Benutzername und Passwort erforderlich"});

  const today=new Date().toISOString().slice(0,10);

  // 1) Upstash Redis (Production)
  if(process.env.UPSTASH_REDIS_REST_URL){
    try{
      const user=await kvGet(`user:${username.toLowerCase()}`);
      if(!user||user.p!==password)return res.status(401).json({error:"Ungültige Zugangsdaten"});
      if(user.exp&&user.exp<today)return res.status(403).json({error:"Zugang abgelaufen am "+user.exp});
      return res.status(200).json({ok:true,username,role:user.role||'user',expiresAt:user.exp||null});
    }catch(e){
      return res.status(500).json({error:"Auth-Service nicht erreichbar"});
    }
  }

  // 2) USERS_JSON env var (kleine Liste, manuell)
  if(process.env.USERS_JSON){
    try{
      const users=JSON.parse(process.env.USERS_JSON);
      const user=users.find(u=>u.u===username&&u.p===password);
      if(!user)return res.status(401).json({error:"Ungültige Zugangsdaten"});
      if(user.exp&&user.exp<today)return res.status(403).json({error:"Zugang abgelaufen am "+user.exp});
      return res.status(200).json({ok:true,username,expiresAt:user.exp||null});
    }catch(e){
      return res.status(500).json({error:"USERS_JSON-Konfiguration fehlerhaft"});
    }
  }

  // 3) Demo-Modus (keine Auth-Quelle konfiguriert)
  if(username.length<4||password.length<6)return res.status(401).json({error:"Demo: User ≥ 4, Passwort ≥ 6 Zeichen"});
  return res.status(200).json({ok:true,username,demo:true});
}
