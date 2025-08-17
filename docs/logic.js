
import { CONTROLLERS, MODULES, CATALOG } from './catalog.js';

const sum = a => a.reduce((s,x)=>s+x,0);
const ceilDiv = (a,b)=> Math.ceil(a/b);
const clone = x => JSON.parse(JSON.stringify(x));
const sumIO = p => (p.di||0)+(p.doRelay||0)+(p.doTriac||0)+(p.aiU||0)+(p.ai_mA||0)+(p.aiRTD||0)+(p.aoU||0)+(p.ao_mA||0)+(p.counters||0);

function applyReserveToIO(points, reservePct){
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

function intDpWithReserve(input){
  const base = (input.comm?.modbus?.dp||0) + (input.comm?.mbus?.devices||0);
  const r = input.dpReservePct||0;
  return Math.ceil(base*(1+r));
}

function moduleAllowedByFeatureList(m, allowed){
  const f = m.features||{};
  if(allowed?.localOverride===false && f.localOverride) return false;
  if(allowed?.lcd===false && f.lcd) return false;
  if(allowed?.ledTriColor===false && f.ledTriColor) return false;
  if(allowed?.ledGreen===false && f.ledGreen) return false;
  return true;
}

// ---------- Onboard-Allocation (Kompakt-Controller) ----------
function allocateOnboard(controller, need){
  const out = clone(need);
  const t = []; // trace
  const ob = controller.onboard||{};

  // PXC7: keine Onboard-IO
  if(controller.type==="modular" || (ob.total||0)===0){
    return { remaining: out, trace: t };
  }

  // DO Relais zuerst
  if(ob.do){
    const take = Math.min(out.doRelay||0, ob.do);
    if(take>0){ out.doRelay -= take; t.push(`Onboard DO: ${take}/${ob.do} verwendet`); }
  }

  // PXC5: XIO zuerst für mA-Tasks
  if(ob.xio && ob.xio>0){
    let xioFree = ob.xio;
    const aoSlots = ob.xioAo_mA_slots||0;

    // AO 4–20 mA (max Slots und Kanäle)
    if(aoSlots>0 && (out.ao_mA||0)>0){
      const use = Math.min(out.ao_mA, aoSlots, xioFree);
      if(use>0){
        out.ao_mA -= use; xioFree -= use;
        t.push(`Onboard XIO AO_mA: ${use}/${aoSlots} belegt (XIO Rest ${xioFree})`);
      }
    }
    // AI 4–20 mA
    if((out.ai_mA||0)>0 && xioFree>0){
      const use = Math.min(out.ai_mA, xioFree);
      out.ai_mA -= use; xioFree -= use;
      t.push(`Onboard XIO AI_mA: ${use} belegt (XIO Rest ${xioFree})`);
    }
    // Restliche Signale könnten theoretisch auch über XIO laufen – wir lassen UIO davor den Vorzug
  }

  // UIO decken allgemeine Signale (ggf. auch AI_mA bei PXC4)
  if(ob.uio && ob.uio>0){
    let uioFree = ob.uio;

    // Für PXC4: AI_mA kann UIO belegen (Datenblatt erlaubt 0/4–20 mA). Für PXC5 nutzen wir XIO bereits vorher.
    if(controller.pn.startsWith("PXC4") && (out.ai_mA||0)>0){
      const use = Math.min(out.ai_mA, uioFree);
      out.ai_mA -= use; uioFree -= use;
      t.push(`Onboard UIO AI_mA (PXC4): ${use} (UIO Rest ${uioFree})`);
    }

    // DI -> AI_U -> AO_U in dieser Reihenfolge
    const order = ["di","aiU","aoU"];
    for(const k of order){
      if(uioFree<=0) break;
      const needK = out[k]||0;
      if(needK>0){
        const use = Math.min(needK, uioFree);
        out[k] -= use; uioFree -= use;
        t.push(`Onboard UIO ${k}: ${use} (UIO Rest ${uioFree})`);
      }
    }
  }

  return { remaining: out, trace: t };
}

// ---------- TXM Packing ----------
function packModules(targetIO, featureAllowed){
  const items=[]; const trace=[];
  const need=clone(targetIO);

  const find = pn => MODULES.find(m=>m.pn===pn);

  // AO 4–20 mA -> 8X / 8X-ML
  if(need.ao_mA>0){
    const m = moduleAllowedByFeatureList(find("TXM1.8X"),featureAllowed) ? find("TXM1.8X") : find("TXM1.8X-ML");
    if(!m) throw new Error("AO 4–20 mA gefordert, aber 8X/8X-ML ausgeschlossen.");
    const c = ceilDiv(need.ao_mA, 4);
    items.push({pn:m.pn, qty:c}); trace.push(`AO 4–20 mA: ${need.ao_mA} ⇒ ${c}× ${m.pn}`);
    need.ao_mA = 0;
  }
  // AI 4–20 mA -> 8X / 8X-ML
  if(need.ai_mA>0){
    const m = moduleAllowedByFeatureList(find("TXM1.8X"),featureAllowed) ? find("TXM1.8X") : find("TXM1.8X-ML");
    if(!m) throw new Error("AI 4–20 mA gefordert, aber 8X/8X-ML ausgeschlossen.");
    const c = ceilDiv(need.ai_mA, 8);
    items.push({pn:m.pn, qty:c}); trace.push(`AI 4–20 mA: ${need.ai_mA} ⇒ ${c}× ${m.pn}`);
    need.ai_mA=0;
  }
  // DO Relais -> 6R / 6R-M / 6RL
  if(need.doRelay>0){
    const cand = ["TXM1.6R","TXM1.6R-M","TXM1.6RL"].map(find).filter(Boolean).find(m=> moduleAllowedByFeatureList(m,featureAllowed));
    if(!cand) throw new Error("DO Relais gefordert, aber 6R/6R-M/6RL ausgeschlossen.");
    const c = ceilDiv(need.doRelay, cand.provide.doRelay);
    items.push({pn:cand.pn, qty:c}); trace.push(`DO Relais: ⇒ ${c}× ${cand.pn}`);
    need.doRelay=0;
  }
  // DO Triac -> 8T
  if(need.doTriac>0){
    const m = find("TXM1.8T");
    if(!moduleAllowedByFeatureList(m,featureAllowed)) throw new Error("DO Triac gefordert, aber 8T ausgeschlossen.");
    const c = ceilDiv(need.doTriac, m.provide.doTriac);
    items.push({pn:m.pn, qty:c}); trace.push(`DO Triac: ⇒ ${c}× ${m.pn}`);
    need.doTriac=0;
  }
  // AI RTD -> 8P
  if(need.aiRTD>0){
    const m = find("TXM1.8P");
    if(!moduleAllowedByFeatureList(m,featureAllowed)) throw new Error("AI RTD/PT gefordert, aber 8P ausgeschlossen.");
    const c = ceilDiv(need.aiRTD, m.provide.aiU);
    items.push({pn:m.pn, qty:c}); trace.push(`AI RTD/PT: ⇒ ${c}× ${m.pn}`);
    need.aiRTD=0;
  }
  // Rest (DI, AI_U, AO_U) -> 8U (oder 4D3R fallback)
  const rest = (need.aiU||0)+(need.aoU||0)+(need.di||0);
  if(rest>0){
    const m8U = find("TXM1.8U"); const m4D3R = find("TXM1.4D3R");
    if(m8U && moduleAllowedByFeatureList(m8U,featureAllowed)){
      const c = ceilDiv(rest, 8);
      items.push({pn:m8U.pn, qty:c}); trace.push(`UIO Rest: ${rest} ⇒ ${c}× ${m8U.pn}`);
    }else if(m4D3R && moduleAllowedByFeatureList(m4D3R,featureAllowed)){
      const c = ceilDiv(rest, 7);
      items.push({pn:m4D3R.pn, qty:c}); trace.push(`UIO Ersatz (4DI+3DO): ${rest} ⇒ ${c}× ${m4D3R.pn}`);
    }else{
      throw new Error("UIO-Anteile gefordert, aber 8U/4D3R ausgeschlossen.");
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
  if(includeSupplyCount>0){ rows.push({ pn:"TXS1.12F10", qty:includeSupplyCount }); }
  bom.forEach(it=> rows.push({ pn:it.pn, qty:it.qty }));
  return rows.map(r=>{
    const cat = CATALOG[r.pn].item;
    return {
      "Leistungsnummer": r.pn,
      "Menge": r.qty,
      "Basismengeneinheit": "ST",
      "Kurztext": cat.texts?.kurz1 || "",
      "Kurztext 2": cat.texts?.kurz2 || ""
    };
  });
}

// -------------- Main Planner --------------
export function computePlanForController(input, controller){
  const trace=[];

  // Reserve getrennt: HW-I/O vs Integrations-DP
  const ioWithReserve = applyReserveToIO(input.points, input.dpReservePct||0);
  const HW_req = sumIO(ioWithReserve);
  const INT_req = intDpWithReserve(input);

  const lim = controller.limits||{};
  const hwMax = lim.hwMax ?? lim.ioOverall ?? Infinity;
  const intMax = lim.intMax ?? lim.integrDpMax ?? Infinity;
  const combined = lim.totalCombinedMax ?? null;

  trace.push(`DP inkl. Reserve: HW=${HW_req}, INT=${INT_req}${combined?`, SUM=${HW_req+INT_req}`:""}`);

  if(HW_req>hwMax) throw new Error(`${controller.pn}: HW-DP ${HW_req} > Limit ${hwMax}`);
  if(INT_req>intMax) throw new Error(`${controller.pn}: Integrations-DP ${INT_req} > Limit ${intMax}`);
  if(combined!=null && (HW_req+INT_req)>combined) throw new Error(`${controller.pn}: Summe HW+INT ${HW_req+INT_req} > Gesamtlimit ${combined}`);

  // Onboard-Deckung (nur für Kompakt-Controller)
  const onboard = allocateOnboard(controller, ioWithReserve);
  trace.push(...onboard.trace.map(s=>"Onboard: "+s));

  // TXM-Pack für die Restbedarfe
  const packed = packModules(onboard.remaining, input.featureAllow||{});
  trace.push(...packed.trace);

  // mA-Bilanz
  const mA = sumBus_mA(packed.items);
  const internal = controller.power?.internalBus_mA||0;
  let txsCount = 0;
  if(mA>internal){
    const need = mA - internal;
    txsCount = Math.ceil(need / (controller.power?.txsPerUnit_mA||1200));
    if(controller.power?.txsMaxUnits!=null && txsCount>controller.power.txsMaxUnits){
      throw new Error(`${controller.pn}: Speisemodule benötigt ${txsCount} > max ${controller.power.txsMaxUnits}`);
    }
  }
  trace.push(`TXM-Bus: ${mA} mA (intern ${internal}) ⇒ TXS ×${txsCount}`);

  // Moduslimit anhand TXM-Anzahl
  const txmCount = packed.items.reduce((s,it)=> s+it.qty,0);
  const modeMax = (input.constraints?.eventMode ? lim.txmMode?.event : lim.txmMode?.polling) ?? 64;
  if(txmCount > modeMax) throw new Error(`${controller.pn}: TXM-Module ${txmCount} > Modus-Limit ${modeMax}`);
  if(lim.txmHardCap && txmCount > lim.txmHardCap) throw new Error(`${controller.pn}: TXM-Module ${txmCount} > Hardcap ${lim.txmHardCap}`);

  // Mechanik
  const rowsPacked = packRows(input.cabinet?.railWidth_mm||600, controller, [
    ...(txsCount>0 ? [{ pn:"TXS1.12F10", qty:txsCount }] : []),
    ...packed.items
  ]);
  const mmRows = rowsPacked.rows.length;
  const totalWidth = rowsPacked.totalWidth;
  trace.push(`Baureihen: ${mmRows} bei Breite ${input.cabinet?.railWidth_mm||600} mm → Gesamtbreite ${totalWidth} mm.`);

  const sapRows = bomToSapRows(controller, packed.items, txsCount);

  return {
    ok:true, controller, sapRows, trace,
    kpis:{ HW_req, INT_req, sumBus_mA:mA, txsCount, txmCount, totalWidth_mm: totalWidth, mmRows }
  };
}

export function computeCandidates(input){
  const list = CONTROLLERS.filter(c=>{
    if(input.controllerFilter?.compact===false && c.type==="compact") return false;
    if(input.controllerFilter?.modular===false && c.type==="modular") return false;
    if((input.comm?.knx?.devices||0) > (c.comm?.knxMaxDevices||0)) return false;
    if((input.comm?.modbus?.rtuSegments||0)>0 && (c.comm?.rs485Ports||0)===0) return false;
    return true;
  });

  const out = [];
  list.forEach(c=>{
    try{ out.push(computePlanForController(input,c)); }catch(e){ /* ignore */ }
  });
  return out;
}

// ---------------- Pricing & Selection ----------------
function costRows(sapRows, priceMap){
  const lines = sapRows.map(r=>{
    const pn = r["Leistungsnummer"].toUpperCase();
    const unit = priceMap ? priceMap[pn] : null;
    const sum = (unit!=null) ? unit * (r["Menge"]||0) : null;
    return { ...r, "_unit": unit, "_sum": sum };
  });
  const total = lines.every(l=> l._sum!=null) ? lines.reduce((s,l)=> s+l._sum,0) : null;
  return { lines, total };
}

export function selectVariants(candidates, priceMap, opts={mode:"none", recommendDelta:0.10}){
  if(candidates.length===0) return { cheapest:null, recommended:null };

  const enriched = candidates.map(plan=>{
    const cost = costRows(plan.sapRows, priceMap);
    return { plan, cost };
  });

  const onlyPriced = enriched.filter(e=> e.cost.total!=null);
  if(onlyPriced.length===0){
    const first = candidates.sort((a,b)=> a.controller.limits.hwMax - b.controller.limits.hwMax)[0];
    return { cheapest:first, recommended:first, priced:false };
  }

  const cheapest = onlyPriced.sort((a,b)=> a.cost.total - b.cost.total
    || a.plan.kpis.txmCount - b.plan.kpis.txmCount
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
