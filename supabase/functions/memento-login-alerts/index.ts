// Memento unfamiliar-login email alerts.
// Run from a server-side Supabase Cron job, NEVER directly from the mobile app.
// Requires memento_security_login_alerts_20261115.sql and verified Resend sender.
import {createClient} from 'npm:@supabase/supabase-js@2';

type LoginAlert = {
  session_id: string;
  user_id: string;
  destination_email: string;
  ip_address: string;
  event_time: string;
};

const escapeHtml=(text: string)=>String(text).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]||ch));
const isPublicIp=(ip:string)=>{
  if(!ip || ip==='unknown')return false;
  if(ip==='::1'||ip.startsWith('fc')||ip.startsWith('fd')||ip.startsWith('fe80'))return false;
  const parts=ip.split('.').map(Number);
  if(parts.length===4&&parts.every(x=>Number.isInteger(x)&&x>=0&&x<=255)){
    return !(parts[0]===10||parts[0]===127||parts[0]===0||
      parts[0]===192&&parts[1]===168||
      parts[0]===172&&parts[1]>=16&&parts[1]<=31||
      parts[0]===169&&parts[1]===254);
  }
  return true;
};
async function approximateLocation(ip:string):Promise<string|null>{
  // IP addresses are shared with this third-party only if explicitly enabled.
  if(Deno.env.get('MEMENTO_ENABLE_IP_GEOLOCATION')!=='true'||!isPublicIp(ip))return null;
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3500);
    try{
      const response=await fetch('https://ipwho.is/'+encodeURIComponent(ip),{signal:controller.signal});
      if(!response.ok)return null;
      const data=await response.json();
      if(data.success!==true)return null;
      return [data.city,data.region,data.country].filter(Boolean).join(', ')||null;
    }finally{clearTimeout(timer);}
  }catch{return null;}
}

Deno.serve(async req=>{
  const token=Deno.env.get('MEMENTO_LOGIN_ALERT_CRON_SECRET');
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  if(!token||req.headers.get('x-cron-secret')!==token)return new Response('Unauthorized',{status:401});
  const url=Deno.env.get('SUPABASE_URL');
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resend=Deno.env.get('RESEND_API_KEY');
  const from=Deno.env.get('MEMENTO_SECURITY_FROM_EMAIL');
  if(!url||!secret||!resend||!from)return new Response('Missing server configuration',{status:503});

  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.rpc('memento_pending_security_alerts');
  if(error){
    console.error('Login alert database read failed:',error.message);
    return new Response('Security alert lookup failed',{status:500});
  }

  let sent=0, failed=0;
  for(const alert of (data||[]) as LoginAlert[]){
    const location=await approximateLocation(alert.ip_address);
    const when=new Date(alert.event_time).toUTCString();
    const details=`IP address: ${alert.ip_address}\n${location?`Approximate location: ${location}\n`:''}Time: ${when} UTC`;
    const body=`A sign-in to your Memento account was detected from an IP address we haven't seen on your account before.\n\n${details}\n\nIf this wasn't you, open Memento > Settings > Security and change your password immediately. Turn on two-factor authentication.\n\nIP locations can be approximate, and a VPN or mobile network can trigger this alert. Memento staff will never ask you for a verification code.`;
    const html=`<div style="font-family:system-ui,sans-serif;background:#fff;color:#1b1e26;padding:30px;max-width:600px;margin:auto"><h1 style="font-size:26px">New sign-in to Memento</h1><p>We noticed a successful sign-in from an IP address that hasn't appeared on your account before.</p><p><b>IP:</b> ${escapeHtml(alert.ip_address)}<br>${location?`<b>Approximate location:</b> ${escapeHtml(location)}<br>`:''}<b>Time:</b> ${escapeHtml(when)} UTC</p><h2 style="font-size:18px">Wasn't you?</h2><p>Open Memento → Settings → Security and change your password immediately. Enable two-factor authentication.</p><p style="color:#535B69;font-size:12px">A VPN, travel or cellular network can change your IP. We never ask for verification codes over messages.</p></div>`;
    try{
      const res=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json'},
        body:JSON.stringify({from,to:[alert.destination_email],subject:'Memento security alert: new sign-in detected',text:body,html}),
      });
      if(!res.ok){
        console.error('Login security email failed, status:',res.status);
        failed++;continue;
      }
      const marked=await admin.rpc('memento_security_mark_sent',{p_session_id:alert.session_id});
      if(marked.error){
        console.error('Login security alert acknowledgment failed:',marked.error.message);
        failed++;continue;
      }
      sent++;
    }catch(e){
      console.error('Security alert delivery error',e instanceof Error?e.message:String(e));
      failed++;
    }
  }
  return Response.json({processed:(data||[]).length,sent,failed},{status:failed?207:200});
});
