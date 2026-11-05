const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const LOCALS=[['Kojo Recoleta','cmvcjbx090001jn074i0eg9zu'],['Kojo La Florida','cmubc0yoq0001jv041si8zicn']]
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function once(){
  for(const url of [process.env.DATABASE_URL, process.env.DIRECT_URL]){
    if(!url) continue
    const p = new PrismaClient({ datasources:{ db:{ url } } })
    try{
      await p.$queryRawUnsafe(`SELECT 1`)              // ping; si falla salta al catch
      const results=[]
      for(const [name,rid] of LOCALS){
        const rows=await p.$queryRawUnsafe(`SELECT type, payload->>'session_id' sid FROM pos_events WHERE restaurant_id=$1 AND type LIKE 'cash_session_%' ORDER BY server_seq ASC`,rid)
        const st=new Map(); for(const r of rows){const id=r.sid;if(!id)continue;if(!st.has(id))st.set(id,'abierta');if(r.type==='cash_session_closed')st.set(id,'cerrada');if(r.type==='cash_session_deleted')st.set(id,'eliminada')}
        if([...st.values()].filter(s=>s==='abierta').length>0){ results.push(`${name}: ya abierta, no abrí`); continue }
        const mx=Number((await p.$queryRawUnsafe(`SELECT MAX(server_seq) mx FROM pos_events`))[0].mx)+1
        const sid=crypto.randomUUID(); const now=new Date().toISOString()
        await p.$executeRawUnsafe(
          `INSERT INTO pos_events (server_seq, event_id, device_id, user_id, restaurant_id, created_at_local, type, payload, created_at)
           VALUES ($1, gen_random_uuid(), 'server-manual', 'system', $2, $3::timestamptz, 'cash_session_opened', $4::jsonb, $5::timestamptz)`,
          mx, rid, now, JSON.stringify({ session_id: sid, initial_amount: 0 }), now)
        results.push(`${name}: ABIERTA ($0) sid ${sid.slice(0,8)}`)
      }
      await p.$disconnect()
      return results
    }catch(e){ await p.$disconnect().catch(()=>{}); /* probar siguiente url / reintento */ }
  }
  return null
}
;(async()=>{
  const deadline=Date.now()+45*60*1000  // hasta 45 min
  let n=0
  while(Date.now()<deadline){
    const r=await once()
    if(r){ console.log('LISTO ('+(++n)+' intento):\n  '+r.join('\n  ')); process.exit(0) }
    await sleep(30000)
  }
  console.log('TIMEOUT: la BD no volvió en 45 min'); process.exit(1)
})()
