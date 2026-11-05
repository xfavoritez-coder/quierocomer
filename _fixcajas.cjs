const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const url = process.env.DIRECT_URL || process.env.DATABASE_URL
const toPM=r=>{const m=(r||'').toLowerCase();if(m.includes('efect')||m.includes('cash'))return'efectivo';if(m.includes('debit'))return'debito';if(m.includes('cred'))return'credito';if(m.includes('transf'))return'transferencia';if(m.includes('webpay'))return'webpay';return'app_pago'}
const plat=v=>{v=(v||'').toLowerCase().replace(/[^a-z]/g,'');if(!v)return null;if(v.includes('ubereats')||v==='uber')return'Uber Eats';if(v.includes('pedidosya')||v.includes('peya'))return'PedidosYa';return null}
const dayCL=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'America/Santiago'})
const STD=['efectivo','debito','credito','transferencia','app_pago','webpay']
const LOCALS=[['Kojo Recoleta','cmvcjbx090001jn074i0eg9zu'],['Kojo La Florida','cmubc0yoq0001jv041si8zicn']]
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

async function attempt(){
  const p=new PrismaClient({datasources:{db:{url}}})
  try{
    const log=[]
    const ops=[]  // {seq,type,rid,payload,localIso}
    let seq=Number((await p.$queryRawUnsafe(`SELECT MAX(server_seq) mx FROM pos_events`))[0].mx)+1
    const now=new Date().toISOString()
    for(const [name,rid] of LOCALS){
      // estado actual de cajas
      const evs=await p.$queryRawUnsafe(`SELECT type,created_at_local,payload->>'session_id' sid FROM pos_events WHERE restaurant_id=$1 AND type LIKE 'cash_session_%' ORDER BY server_seq ASC`,rid)
      const sess=new Map()
      for(const e of evs){const id=e.sid;if(!id)continue;if(!sess.has(id))sess.set(id,{open:null,closed:false,deleted:false});const s=sess.get(id);if(e.type==='cash_session_opened')s.open=e.created_at_local;if(e.type==='cash_session_closed')s.closed=true;if(e.type==='cash_session_deleted')s.deleted=true}
      // a eliminar: abiertas, o con apertura en 04/05 nov (limpiamos esos 2 días + cualquier abierta)
      const toDel=[]
      for(const [id,s] of sess){ if(s.deleted) continue
        const openDay=s.open?dayCL(s.open):null
        if(!s.closed || openDay==='2026-11-04' || openDay==='2026-11-05') toDel.push(id)
      }
      for(const id of toDel){ ops.push({seq:seq++,type:'cash_session_deleted',rid,payload:{reason:'fix cajas 04/05-nov',session_id:id},localIso:now}) }
      // ventas 04 y 05 por fecha de pedido
      const orders=await p.posOrder.findMany({ where:{restaurantId:rid,posStatus:{not:'canceled'},createdAt:{gte:new Date('2026-11-04T00:00:00-03:00')}}, select:{totalAmount:true,paidAmount:true,tipAmount:true,vendorName:true,rawPayload:true,createdAt:true} })
      const days={}
      for(const o of orders){const t=Number(o.totalAmount)||0;if(t<=0||(Number(o.paidAmount)||0)<t)continue;const d=dayCL(o.createdAt);days[d]=days[d]||{total:0,tips:0,count:0,byM:{},first:o.createdAt,last:o.createdAt};const rp=(o.rawPayload&&typeof o.rawPayload==='object'&&!Array.isArray(o.rawPayload))?o.rawPayload:{};const pp=rp.posPayment||{},wp=rp.webPayment||{};const m=plat(o.vendorName)??toPM(pp.method||wp.method);days[d].byM[m]=(days[d].byM[m]||0)+t;days[d].total+=t;days[d].tips+=Number(o.tipAmount)||0;days[d].count++;if(o.createdAt<days[d].first)days[d].first=o.createdAt;if(o.createdAt>days[d].last)days[d].last=o.createdAt}
      // CAJA 04 CERRADA (si hay ventas)
      const d4=days['2026-11-04']
      if(d4){ const sid=crypto.randomUUID(); const amounts={}; STD.forEach(m=>amounts[m]=0); Object.entries(d4.byM).forEach(([m,a])=>amounts[m]=a)
        ops.push({seq:seq++,type:'cash_session_opened',rid,payload:{session_id:sid,initial_amount:0},localIso:new Date(d4.first).toISOString()})
        ops.push({seq:seq++,type:'cash_session_closed',rid,payload:{session_id:sid,initial_amount:0,total_sales:d4.total,total_tips:d4.tips,closed_accounts:d4.count,difference:0,counted_amounts:amounts,expected_amounts:amounts},localIso:new Date(d4.last).toISOString()})
        log.push(`${name}: caja 04-nov CERRADA $${d4.total.toLocaleString('es-CL')}`)
      } else log.push(`${name}: 04-nov sin ventas (no creo caja)`)
      // CAJA 05 ABIERTA (operando hoy; el arqueo en vivo cuenta el día)
      const sid5=crypto.randomUUID()
      ops.push({seq:seq++,type:'cash_session_opened',rid,payload:{session_id:sid5,initial_amount:0},localIso:now})
      const d5=days['2026-11-05']
      log.push(`${name}: caja 05-nov ABIERTA ($0) — ventas del día ${d5?('$'+d5.total.toLocaleString('es-CL')+' se verán en vivo'):'(aún sin ventas)'}`)
      log.push(`   (${toDel.length} cajas viejas de 04/05/abiertas eliminadas)`)
    }
    // ejecutar en transacción
    await p.$transaction(ops.map(o=>p.$executeRawUnsafe(
      `INSERT INTO pos_events (server_seq,event_id,device_id,user_id,restaurant_id,created_at_local,type,payload,created_at)
       VALUES ($1,gen_random_uuid(),'server-fixcajas','system',$2,$3::timestamptz,$4,$5::jsonb,$6::timestamptz)`,
      o.seq,o.rid,o.localIso,o.type,JSON.stringify(o.payload),now)))
    await p.$disconnect()
    return log
  }catch(e){ await p.$disconnect().catch(()=>{}); throw e }
}
;(async()=>{
  const deadline=Date.now()+40*60*1000
  while(Date.now()<deadline){
    try{ const log=await attempt(); console.log('LISTO:\n  '+log.join('\n  ')); process.exit(0) }
    catch(e){ await sleep(5000) }
  }
  console.log('TIMEOUT: la BD no se estabilizó'); process.exit(1)
})()
