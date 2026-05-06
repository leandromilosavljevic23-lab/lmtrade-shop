// Live-Preise von kostenlosen APIs (CoinGecko + Frankfurter + Yahoo Finance).
// Cached fuer 60s damit wir nicht Rate-Limits treffen.

let CACHE={t:0,data:null};

async function fetchPrices(){
  const out={};

  // ── Crypto: CoinGecko (gratis, kein API-Key)
  try{
    const r=await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",{headers:{Accept:"application/json"}});
    if(r.ok){
      const d=await r.json();
      out.btc={price:d.bitcoin?.usd,ch24:d.bitcoin?.usd_24h_change};
      out.eth={price:d.ethereum?.usd,ch24:d.ethereum?.usd_24h_change};
    }
  }catch(e){}

  // ── EUR/USD: Frankfurter (gratis, ECB-Daten)
  try{
    const r=await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD",{headers:{Accept:"application/json"}});
    if(r.ok){
      const d=await r.json();
      out.eur={price:d.rates?.USD};
    }
  }catch(e){}

  // ── Gold + NAS100 + DXY: Yahoo Finance (inoffiziell, gratis)
  try{
    const symbols=["GC=F","NQ=F","DX-Y.NYB"];
    const r=await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`,{headers:{"User-Agent":"Mozilla/5.0"}});
    if(r.ok){
      const d=await r.json();
      const q=d.quoteResponse?.result||[];
      const map={"GC=F":"xau","NQ=F":"nas","DX-Y.NYB":"dxy"};
      q.forEach(item=>{
        const k=map[item.symbol];
        if(k)out[k]={price:item.regularMarketPrice,ch24:item.regularMarketChangePercent};
      });
    }
  }catch(e){}

  return out;
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Cache-Control","public, max-age=60, stale-while-revalidate=120");

  // Cache: 60s
  const now=Date.now();
  if(CACHE.data&&now-CACHE.t<60_000){
    return res.status(200).json({...CACHE.data,cached:true,age:Math.floor((now-CACHE.t)/1000)});
  }

  const data=await fetchPrices();
  CACHE={t:now,data};
  return res.status(200).json({...data,cached:false});
}
