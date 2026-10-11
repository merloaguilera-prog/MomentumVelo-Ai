if (process.env.VERCEL_ENV !== "production") { console.error("Production maintenance only"); process.exit(1); }
(async () => {
 const key = process.env.CLERK_SECRET_KEY;
 if (!key || !key.startsWith("sk_live_")) throw new Error("Expected configured production Clerk instance");
 const headers = {Authorization: "Bearer " + key, "Content-Type":"application/json"};
 const root = "https://api.clerk.com/v1/domains";
 const id = "dmn_3JeLJ3HODc1oOP44h4jLn7UVzda";
 const desired = {name:"momentumvelo.app",proxy_url:"https://momentumvelo.app/__clerk"};
 async function call(url,init={}) {
  const r=await fetch(url,{...init,headers,signal:AbortSignal.timeout(20000)});
  const data=await r.json();
  if(!r.ok) throw new Error("Clerk HTTP "+r.status+": "+(data.errors||[]).map(e=>e.code).join(","));
  return data;
 }
 const list=await call(root);
 const d=list.data.find(x=>x.id===id);
 if(!d||d.is_satellite) throw new Error("Unexpected Clerk primary domain");
 console.log("CLERK_DOMAIN_BEFORE",JSON.stringify({id:d.id,name:d.name,proxy_url:d.proxy_url}));
 if(d.name===desired.name&&d.proxy_url===desired.proxy_url) {console.log("CLERK_DOMAIN_ALREADY_CORRECT");return;}
 if(d.name!=="momentum-velo.vercel.app"||d.proxy_url!=="https://momentum-velo.vercel.app/__clerk") throw new Error("Domain changed since inspection; no update applied");
 const updated=await call(root+"/"+id,{method:"PATCH",body:JSON.stringify(desired)});
 console.log("CLERK_DOMAIN_AFTER",JSON.stringify({id:updated.id,name:updated.name,proxy_url:updated.proxy_url,cname_targets:updated.cname_targets}));
 const check=await fetch("https://momentumvelo.app/__clerk/v1/environment",{signal:AbortSignal.timeout(20000)});
 if(!check.ok) {
  await call(root+"/"+id,{method:"PATCH",body:JSON.stringify({name:d.name,proxy_url:d.proxy_url})});
  throw new Error("Frontend check HTTP "+check.status+"; previous domain restored");
 }
 console.log("CLERK_FRONTEND_ENVIRONMENT_OK",check.status);
})().catch(e=>{console.error(e.message);process.exit(1);});
