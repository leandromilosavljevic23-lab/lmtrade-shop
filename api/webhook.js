import crypto from "crypto";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end();
  const webhookSecret=process.env.COINBASE_WEBHOOK_SECRET;
  const sig=req.headers["x-cc-webhook-signature"];
  if(webhookSecret&&sig){
    const expected=crypto.createHmac("sha256",webhookSecret).update(JSON.stringify(req.body)).digest("hex");
    if(sig!==expected)return res.status(401).json({error:"Invalid signature"});
  }
  const eventType=req.body?.event?.type;
  if(eventType!=="charge:confirmed"&&eventType!=="charge:resolved")return res.status(200).json({received:true,action:"ignored"});
  const charge=req.body.event.data;
  const email=charge.metadata?.customer_email;
  if(!email)return res.status(200).json({received:true,action:"no_email"});
  const username=email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,10)+(Math.floor(Math.random()*999)+1);
  const chars="ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789";
  let password="";for(let i=0;i<10;i++)password+=chars[Math.floor(Math.random()*chars.length)];
  const d=new Date();d.setDate(d.getDate()+30);
  const expiresAt=d.toISOString().split("T")[0];
  const resendKey=process.env.RESEND_API_KEY;
  const dashUrl=process.env.DASHBOARD_URL||"https://trade-ai-dashboard.vercel.app";
  if(resendKey){
    const html=`<!DOCTYPE html><html><body style="background:#060a12;color:#e2e8f0;font-family:Arial,sans-serif"><div style="max-width:520px;margin:40px auto;padding:20px"><div style="background:#0f1520;border:1px solid rgba(0,208,132,.2);border-radius:16px;padding:36px"><h2 style="color:#fff;margin:0 0 8px">Dein LM Trade Zugang ist aktiv!</h2><p style="color:#64748b;margin:0 0 24px">Zahlung bestaetigt. Deine Zugangsdaten:</p><div style="background:rgba(0,208,132,.05);border:1px solid rgba(0,208,132,.2);border-radius:10px;padding:20px"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#64748b">Benutzername</span><span style="color:#00d084;font-family:monospace;font-weight:700">${username}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#64748b">Passwort</span><span style="color:#00d084;font-family:monospace;font-weight:700">${password}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:#64748b">Gueltig bis</span><span style="color:#ffb340;font-weight:600">${expiresAt}</span></div></div><div style="text-align:center;margin-top:24px"><a href="${dashUrl}" style="background:linear-gradient(135deg,#00d084,#00b8d9);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700">Zum Dashboard</a></div></div></div></body></html>`;
    await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resendKey,"Content-Type":"application/json"},body:JSON.stringify({from:"LM Trade <noreply@lmtrade.io>",to:[email],subject:"Dein LM Trade Zugang ist aktiv!",html})});
  }
  console.log("New subscriber:",{email,username,password,expiresAt});
  return res.status(200).json({received:true,action:"access_created",email,username});
}