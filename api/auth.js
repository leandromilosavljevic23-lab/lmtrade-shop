export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});

  const{username,password}=req.body||{};
  if(!username||!password)return res.status(400).json({error:"Benutzername und Passwort erforderlich"});

  const usersEnv=process.env.USERS_JSON;

  // ── Demo-Modus: keine Benutzer konfiguriert → akzeptiere jede plausible Eingabe
  if(!usersEnv){
    if(username.length<4||password.length<6)return res.status(401).json({error:"Ungültige Zugangsdaten"});
    return res.status(200).json({ok:true,username,demo:true});
  }

  try{
    const users=JSON.parse(usersEnv);
    // Format: [{"u":"username1","p":"password1","exp":"2026-06-01"}, ...]
    const user=users.find(u=>u.u===username&&u.p===password);
    if(!user)return res.status(401).json({error:"Ungültige Zugangsdaten"});
    if(user.exp){
      const today=new Date().toISOString().slice(0,10);
      if(user.exp<today)return res.status(403).json({error:"Zugang abgelaufen am "+user.exp});
    }
    return res.status(200).json({ok:true,username,expiresAt:user.exp||null});
  }catch(e){
    return res.status(500).json({error:"Server-Konfiguration fehlerhaft"});
  }
}
