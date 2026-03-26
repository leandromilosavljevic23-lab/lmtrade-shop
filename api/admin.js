export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,X-Admin-Secret");
  if(req.method==="OPTIONS")return res.status(200).end();
  const secret=req.headers["x-admin-secret"]||req.query.secret;
  if(secret!==process.env.ADMIN_SECRET)return res.status(401).json({error:"Unauthorized"});
  const action=req.query.action||req.body?.action;
  if(action==="ping")return res.status(200).json({ok:true});
  if(req.method==="POST"&&(action==="create"||action==="extend")){
    const{email,days=30}=req.body;
    if(!email)return res.status(400).json({error:"Email required"});
    const username=email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,10)+(Math.floor(Math.random()*999)+1);
    const chars="ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789";
    let password="";for(let i=0;i<10;i++)password+=chars[Math.floor(Math.random()*chars.length)];
    const d=new Date();d.setDate(d.getDate()+parseInt(days));
    const expiresAt=d.toISOString().split("T")[0];
    const resendKey=process.env.RESEND_API_KEY;
    const dashUrl=process.env.DASHBOARD_URL||"https://trade-ai-dashboard.vercel.app";
    let emailSent=false;
    if(resendKey){
      const isRenewal=action==="extend";
      const html=`<!DOCTYPE html><html><body style="background:#060a12;color:#e2e8f0;font-family:Arial,sans-serif"><div style="max-width:520px;margin:40px auto;padding:20px"><div style="background:#0f1520;border:1px solid rgba(0,208,132,.2);border-radius:16px;padding:36px"><h2 style="color:#fff">${isRenewal?"Zugang verlaengert!":"Dein Zugang ist aktiv!"}</h2><div style="background:rgba(0,208,132,.05);border:1px solid rgba(0,208,132,.2);border-radius:10px;padding:20px;margin:20px 0"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#64748b">Benutzername</span><span style="color:#00d084;font-family:monospace;font-weight:700">${username}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#64748b">Passwort</span><span style="color:#00d084;font-family:monospace;font-weight:700">${password}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:#64748b">Gueltig bis</span><span style="color:#ffb340;font-weight:600">${expiresAt}</span></div></div><div style="text-align:center"><a href="${dashUrl}" style="background:linear-gradient(135deg,#00d084,#00b8d9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;display:inline-block">Zum Dashboard</a></div></div></div></body></html>`;
      try{
        const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json"},body:JSON.stringify({from:"LM Trade <noreply@lmtrade.io>",to:[email],subject:isRenewal?"LM Trade Zugang verlaengert":"LM Trade Zugang aktiv",html})});
        const rd=await r.json();emailSent=!rd.error;
      }catch(e){}
    }
    return res.status(200).json({success:true,username,password,expiresAt,emailSent,dashboardUrl:dashUrl});
  }
  return res.status(400).json({error:"Unknown action"});
}