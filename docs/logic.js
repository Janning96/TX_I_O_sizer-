
import { CONTROLLERS, MODULES, CATALOG } from './catalog.js';

const sum = a => a.reduce((s,x)=>s+x,0);
const ceilDiv = (a,b)=> Math.ceil(a/b);
const clone = x => JSON.parse(JSON.stringify(x));
const sumIO = p => (p.di||0)+(p.doRelay||0)+(p.doTriac||0)+(p.aiU||0)+(p.ai_mA||0)+(p.aiRTD||0)+(p.aoU||0)+(p.ao_mA||0)+(p.counters||0);

function applyReserve(points, reservePct){
  const total=sumIO(points);
  if(total===0||reservePct<=0) return clone(points);
  const target=Math.ceil(total*(1+reservePct));
  const extra = target-total;
  if(extra<=0) return clone(points);
  const keys=["di","doRelay","doTriac","aiU","ai_mA","aiRTD","aoU","ao_mA"];
  const out=clone(points);
  const weightSum = keys.reduce((s,k)=> s+(points[k]||0),0)||1;
  let distributed=0;
  keys.forEach((k,i)=>{
    const share = Math.floor(extra*((points[k]||0)/weightSum));
    out[k]=(out[k]||0)+share; distributed+=share;
    if(i===keys.length-1) out[k]+= (extra-distributed);
  });
  return out;
}

function controllerCandidates(all, input){
  const list = all.filter(c=>{
    if(input.controllerFilter.compact===false && c.type==="compact") return false;
    if(input.controllerFilter.modular===false && c.type==="modular") return false;
    if(input.comm.knx.devices > (c.comm.knxMaxDevices||0)) return false;
    if(input.comm.modbus.tcpNetworks > (c.comm.modbusTcpMaxNetworks||0)) return false;
    if((input.comm.modbus.rtuSegments||0)>0 && (c.comm.rs485Ports||0)===0) return false;
    return true;
  });
  return list;
}

function moduleAllowedByFeatureList(m, allowed){
  const f = m.features||{};
  if(allowed.localOverride===false && f.localOverride) return false;
  if(allowed.lcd===false && f.lcd) return false;
  if(allowed.ledTriColor===false && f.ledTriColor) return false;
  if(allowed.ledGreen===false && f.ledGreen) return false;
  return true;
}

function packModules(targetIO, featureAllowed){
  const items=[]; const trace=[];
  const need=clone(targetIO);

  const m8X = MODULES.find(m=>m.pn==="TXM1.8X");
  if(need.ao_mA>0){
    const count = ceilDiv(need.ao_mA, 4);
    if(!moduleAllowedByFeatureList(m8X,featureAllowed)) throw new Error("AO 4–20 mA gefordert, aber 8X durch Feature-Filter ausgeschlossen.");
    items.push({pn:m8X.pn, qty:count});
    trace.push(`AO 4–20 mA: ${need.ao_mA} ⇒ ${count}× TXM1.8X (AO 5–8).`);
    need.ao_mA = 0;
  }
  if(need.ai_mA>0){
    const existing = items.find(it=>it.pn==="TXM1.8X");
    const provided = (existing?existing.qty:0)*8;
    const remain = Math.max(0, need.ai_mA - provided);
    if(remain>0){
      if(!moduleAllowedByFeatureList(m8X,featureAllowed)) throw new Error("AI 4–20 mA gefordert, aber 8X durch Feature-Filter ausgeschlossen.");
      const add = ceilDiv(remain,8);
      items.push({pn:m8X.pn, qty:add});
      trace.push(`AI 4–20 mA zusätzlich: ${remain} ⇒ +${add}× TXM1.8X.`);
    }else{
      trace.push(`AI 4–20 mA: durch vorhandene TXM1.8X abgedeckt (${provided}).`);
    }
    need.ai_mA=0;
  }

  if(need.doRelay>0){
    const m6R = MODULES.find(m=>m.pn==="TXM1.6R");
    const m6RM = MODULES.find(m=>m.pn==="TXM1.6R-M");
    let choice = moduleAllowedByFeatureList(m6R,featureAllowed) ? m6R :
                 (moduleAllowedByFeatureList(m6RM,featureAllowed) ? m6RM : null);
    if(!choice) throw new Error("DO Relais gefordert, aber 6R/6R-M durch Feature-Filter ausgeschlossen.");
    const c = ceilDiv(need.doRelay, choice.provide.doRelay);
    items.push({pn:choice.pn, qty:c}); trace.push(`DO Relais: ${need.doRelay} ⇒ ${c}× ${choice.pn}.`);
    need.doRelay=0;
  }

  if(need.doTriac>0){
    const m = MODULES.find(m=>m.pn==="TXM1.8T");
    if(!moduleAllowedByFeatureList(m,featureAllowed)) throw new Error("DO Triac gefordert, aber 8T durch Feature-Filter ausgeschlossen.");
    const c = ceilDiv(need.doTriac, m.provide.doTriac);
    items.push({pn:m.pn, qty:c}); trace.push(`DO Triac: ${need.doTriac} ⇒ ${c}× ${m.pn}.`);
    need.doTriac=0;
  }

  if(need.aiRTD>0){
    const m = MODULES.find(m=>m.pn==="TXM1.8P");
    if(!moduleAllowedByFeatureList(m,featureAllowed)) throw new Error("AI RTD/PT gefordert, aber 8P durch Feature-Filter ausgeschlossen.");
    const c = ceilDiv(need.aiRTD, m.provide.aiU);
    items.push({pn:m.pn, qty:c}); trace.push(`AI RTD/PT: ${need.aiRTD} ⇒ ${c}× ${m.pn}.`);
    need.aiRTD=0;
  }

  const uioNeed = (need.aiU||0)+(need.aoU||0)+(need.di||0);
  if(uioNeed>0){
    const m8U = MODULES.find(m=>m.pn==="TXM1.8U");
    const m4D3R = MODULES.find(m=>m.pn==="TXM1.4D3R");
    if(moduleAllowedByFeatureList(m8U,featureAllowed)){
      const c = ceilDiv(uioNeed, 8);
      items.push({pn:m8U.pn, qty:c}); trace.push(`UIO (DI/AI/AO 0–10V): ${uioNeed} ⇒ ${c}× ${m8U.pn}.`);
    }else if(moduleAllowedByFeatureList(m4D3R,featureAllowed)){
      const c = ceilDiv(uioNeed, 7);
      items.push({pn:m4D3R.pn, qty:c}); trace.push(`UIO Ersatz (4DI+3DO): ${uioNeed} ⇒ ${c}× ${m4D3R.pn}.`);
    }else{
      throw new Error("UIO-Anteile gefordert, aber 8U/4D3R durch Feature-Filter ausgeschlossen.");
    }
  }

  return { items, trace };
}

function sumBus_mA(items){
  return items.reduce((s,it)=>{
    const m = CATALOG[it.pn].item;
    return s + (m.current_mA||0)*it.qty;
  },0);
}

function packRows(railWidth, controller, bom){
  const all = [{pn:controller.pn, qty:1}, ...bom];
  const width = (pn)=> (CATALOG[pn].item.dims?.w || 64);
  const rows=[]; let cur=[]; let used=0;
  all.forEach(it=>{
    const w = width(it.pn);
    if(used + w > railWidth && cur.length>0){ rows.push(cur); cur=[]; used=0; }
    cur.push(it); used+=w;
  });
  if(cur.length) rows.push(cur);
  const totalWidth = all.reduce((s,it)=> s+width(it.pn),0);
  return { rows, totalWidth };
}

function priceOf(pn, priceMap){
  if(!priceMap) return null;
  const key = pn.trim().toUpperCase();
  const val = priceMap[key];
  return (typeof val==="number" && isFinite(val)) ? val : null;
}

function bomToSapRows(controller, bom, includeSupplyCount){
  const rows = [];
  rows.push({ pn:controller.pn, qty:1 });
  if(includeSupplyCount>0){
    rows.push({ pn:"TXS1.12F10", qty:includeSupplyCount });
  }
  bom.forEach(it=> rows.push({ pn:it.pn, qty:it.qty }));
  return rows.map(r=>{
    const cat = CATALOG[r.pn].item;
    return {
      "Leistungsnummer": r.pn,
      "Menge": r.qty,
      "Basismengeneinheit": cat.base || "ST",
      "Kurztext": cat.texts?.kurz1 || "",
      "Kurztext 2": cat.texts?.kurz2 || ""
    };
  });
}

function costRows(sapRows, priceMap){
  const lines = sapRows.map(r=>{
    const pn = r["Leistungsnummer"];
    const unit = priceOf(pn, priceMap);
    const sum = (unit!=null) ? unit * (r["Menge"]||0) : null;
    return { ...r, "_unit": unit, "_sum": sum };
  });
  const total = lines.every(l=> l._sum!=null) ? lines.reduce((s,l)=> s+l._sum,0) : null;
  return { lines, total };
}

export function computePlanForController(input, controller){
  const trace=[];
  const totalIn = sumIO(input.points);
  const targetTotal = Math.ceil(totalIn*(1+(input.dpReservePct||0)));
  trace.push(`I/O gesamt: ${totalIn} | Reserve ${(input.dpReservePct*100).toFixed(0)}% ⇒ Ziel ${targetTotal}`);

  if(targetTotal > controller.limits.ioOverall){
    throw new Error(`${controller.pn}: DP-Ziel ${targetTotal} > Gesamtlimit ${controller.limits.ioOverall}`);
  }
  const integrCount = (input.comm.mbus.devices||0) + (input.comm.modbus.dp||0);
  if(integrCount > controller.limits.integrDpMax){
    throw new Error(`${controller.pn}: Integrations-DP ${integrCount} > Limit ${controller.limits.integrDpMax}`);
  }
  if(input.comm.knx.devices > controller.comm.knxMaxDevices){
    throw new Error(`${controller.pn}: KNX Geräte ${input.comm.knx.devices} > Limit ${controller.comm.knxMaxDevices}`);
  }

  const targetIO = applyReserve(input.points, input.dpReservePct||0);
  const packed = packModules(targetIO, input.featureAllow);
  trace.push(...packed.trace);

  const busmA = sumBus_mA(packed.items);
  const internal = controller.power.internalBus_mA||0;
  let txsCount = 0;
  if(busmA>internal){
    const need = busmA - internal;
    txsCount = ceilDiv(need, controller.power.txsPerUnit_mA||1200);
    if(controller.power.txsMaxUnits!=null && txsCount>controller.power.txsMaxUnits){
      throw new Error(`${controller.pn}: Erforderliche Speisemodule ${txsCount} > max ${controller.power.txsMaxUnits}`);
    }
  }
  trace.push(`TXM-Bus: ${busmA} mA (intern ${internal}) ⇒ TXS ×${txsCount}`);

  const moduleCount = packed.items.reduce((s,it)=> s+it.qty,0);
  const modeMax = input.constraints?.eventMode ? controller.limits.txmMode.event : controller.limits.txmMode.polling;
  if(moduleCount > modeMax) throw new Error(`${controller.pn}: TXM-Module ${moduleCount} > Modus-Limit ${modeMax}`);
  if(controller.limits.txmHardCap && moduleCount > controller.limits.txmHardCap) throw new Error(`${controller.pn}: TXM-Module ${moduleCount} > Hardcap ${controller.limits.txmHardCap}`);

  const rowsPacked = packRows(input.cabinet.railWidth_mm, controller, [
    ...(txsCount>0 ? [{ pn:"TXS1.12F10", qty:txsCount }] : []),
    ...packed.items
  ]);
  const mmRows = rowsPacked.rows.length;
  const totalWidth = rowsPacked.totalWidth;
  trace.push(`Baureihen: ${mmRows} bei Breite ${input.cabinet.railWidth_mm} mm → Gesamtbreite ${totalWidth} mm.`);

  const sapRows = bomToSapRows(controller, packed.items, txsCount);

  return {
    ok:true, controller, sapRows, trace,
    kpis:{ totalIOInput: totalIn, totalIOWithReserve: targetTotal, sumBus_mA: busmA, totalWidth_mm: totalWidth, moduleCount, txsCount, mmRows }
  };
}

export function computeCandidates(input){
  const cands = controllerCandidates(CONTROLLERS, input);
  const out = [];
  cands.forEach(c=>{
    try{
      out.push(computePlanForController(input,c));
    }catch(e){
      // ignore failed; could collect reasons
    }
  });
  return out;
}

export function selectVariants(candidates, priceMap, opts={mode:"none", recommendDelta:0.10}){
  if(candidates.length===0) return { cheapest:null, recommended:null };

  const enriched = candidates.map(plan=>{
    const cost = costRows(plan.sapRows, priceMap);
    return { plan, cost };
  });

  const onlyPriced = enriched.filter(e=> e.cost.total!=null);
  if(onlyPriced.length===0){
    const first = candidates.sort((a,b)=> a.controller.limits.ioOverall - b.controller.limits.ioOverall)[0];
    return { cheapest:first, recommended:first, priced:false };
  }

  const cheapest = onlyPriced.sort((a,b)=> a.cost.total - b.cost.total
    || a.plan.kpis.moduleCount - b.plan.kpis.moduleCount
    || a.plan.kpis.sumBus_mA - b.plan.kpis.sumBus_mA
    || a.plan.kpis.totalWidth_mm - b.plan.kpis.totalWidth_mm
  )[0].plan;

  if(opts.mode==="cheapest") return { cheapest, recommended:cheapest, priced:true };

  const comp = onlyPriced.filter(e=> e.plan.controller.type==="compact")
                         .sort((a,b)=> a.cost.total-b.cost.total)[0];
  const mod  = onlyPriced.filter(e=> e.plan.controller.type==="modular")
                         .sort((a,b)=> a.cost.total-b.cost.total)[0];

  let recommended = cheapest;
  if(comp && mod){
    if(comp.cost.total <= mod.cost.total * (1+opts.recommendDelta)){
      recommended = comp.plan;
    }else{
      recommended = mod.plan;
    }
  }else if(comp){
    recommended = comp.plan;
  }else if(mod){
    recommended = mod.plan;
  }

  return { cheapest, recommended, priced:true };
}
