
import { CONTROLLERS, MODULES } from './catalog.js';

const sumIO = p => (p.di||0)+(p.doRelay||0)+(p.doTriac||0)+(p.aiU||0)+(p.ai_mA||0)+(p.aiRTD||0)+(p.aoU||0)+(p.ao_mA||0)+(p.counters||0);
const clone = p => JSON.parse(JSON.stringify(p));
const ceilDiv = (a,b)=> Math.ceil(a/b);

function busCapsSatisfied(c, comm={}){
  const k=comm.knx||{}, m=comm.modbus||{}, mb=comm.mbus||{}, b=comm.bacnet||{};
  const caps=c.commCaps||{};
  if(k.devices && caps.knx?.maxDevices && k.devices>caps.knx.maxDevices) return false;
  if(m.tcpNetworks && caps.modbus?.maxTcpNetworks && m.tcpNetworks>caps.modbus.maxTcpNetworks) return false;
  if(m.rtuSegments && caps.modbus?.maxRtuSegments && m.rtuSegments>caps.modbus.maxRtuSegments) return false;
  if(mb.devices && caps.mbus?.maxDevicesWithRepeater && mb.devices>caps.mbus.maxDevicesWithRepeater) return false;
  if(b.dp && caps.bacnet?.maxHubDevices && b.dp>caps.bacnet.maxHubDevices) return false;
  return true;
}

function pickBestController(cands){
  return cands.sort((a,b)=>(a.maxIOPoints??999)-(b.maxIOPoints??999) || a.dims.w_mm - b.dims.w_mm)[0];
}

function applyReserveProportionally(points, reservePct){
  const total = sumIO(points);
  if(total===0 || reservePct<=0) return clone(points);
  const target = Math.ceil(total*(1+reservePct));
  const extra = target-total;
  if(extra<=0) return clone(points);
  const keys = ["di","doRelay","doTriac","aiU","ai_mA","aiRTD","aoU","ao_mA"];
  const out = clone(points);
  let distributed=0;
  const weightSum = keys.reduce((s,k)=> s+(points[k]||0),0)||1;
  keys.forEach((k,i)=>{
    const share = Math.floor(extra*((points[k]||0)/weightSum));
    out[k]=(out[k]||0)+share;
    distributed += share;
    if(i===keys.length-1) out[k]+= (extra-distributed);
  });
  return out;
}

function packModules(req){
  const items=[]; const trace=[]; const need=clone(req);
  const modX = MODULES.find(m=>m.id==="TXM1.8X");

  if(need.ao_mA>0){
    const xCount = ceilDiv(need.ao_mA,4);
    items.push({item:modX, qty:xCount, role:"txm"});
    trace.push(`AO 4–20 mA: ${need.ao_mA} ⇒ ${xCount}× TXM1.8X (Kanäle 5–8).`);
    need.ao_mA=0;
  }

  if(need.ai_mA>0){
    const existing = items.find(i=>i.item.id==="TXM1.8X");
    const provided = (existing?existing.qty:0)*8;
    const remain = Math.max(0, need.ai_mA - provided);
    if(remain>0){
      const add = ceilDiv(remain,8);
      items.push({item:modX, qty:add, role:"txm"});
      trace.push(`AI 4–20 mA zusätzlich: ${remain} ⇒ +${add}× TXM1.8X.`);
    }else{
      trace.push(`AI 4–20 mA: durch vorhandene TXM1.8X abgedeckt (${provided}).`);
    }
    need.ai_mA=0;
  }

  if(need.doRelay>0){
    const rel = MODULES.find(m=>m.id==="TXM1.6R");
    const c = ceilDiv(need.doRelay, rel.channels||6);
    items.push({item:rel, qty:c, role:"txm"}); trace.push(`DO Relais: ${need.doRelay} ⇒ ${c}× TXM1.6R.`);
    need.doRelay=0;
  }

  if(need.doTriac>0){
    const m = MODULES.find(m=>m.id==="TXM1.8T");
    const c = ceilDiv(need.doTriac, m.channels||8);
    items.push({item:m, qty:c, role:"txm"}); trace.push(`DO Triac: ${need.doTriac} ⇒ ${c}× TXM1.8T.`);
    need.doTriac=0;
  }

  if(need.aiRTD>0){
    const m = MODULES.find(m=>m.id==="TXM1.8P");
    const c = ceilDiv(need.aiRTD, m.channels||8);
    items.push({item:m, qty:c, role:"txm"}); trace.push(`AI RTD/PT: ${req.aiRTD||0} ⇒ ${c}× TXM1.8P.`);
    need.aiRTD=0;
  }

  const uioNeed = (need.aiU||0)+(need.aoU||0)+(need.di||0);
  if(uioNeed>0){
    const u = MODULES.find(m=>m.id==="TXM1.8U");
    const c = ceilDiv(uioNeed, 8);
    items.push({item:u, qty:c, role:"txm"}); trace.push(`UIO (DI/AI/AO 0–10V): ${uioNeed} ⇒ ${c}× TXM1.8U.`);
    need.aiU=0; need.aoU=0; need.di=0;
  }

  return { items, trace };
}

function computeBusmA(items){
  return items.reduce((s,it)=> s + ((it.item.txmBus_mA||0)*it.qty), 0);
}

function packRows(railWidth_mm, controller, items){
  const all = [{item:controller, qty:1, role:"controller"}, ...items];
  const rows=[]; let cur=[]; let used=0;
  const width = it => (it.item.dims?.w_mm || 64);
  all.forEach(it=>{
    const w = width(it);
    if(used + w > railWidth_mm && cur.length>0){ rows.push(cur); cur=[]; used=0; }
    cur.push(it); used+=w;
  });
  if(cur.length) rows.push(cur);
  return { rows };
}

export function computePlan(input){
  const trace=[];
  const totalIn = sumIO(input.points);
  const target = Math.ceil(totalIn * (1 + (input.dpReservePct||0)));
  trace.push(`I/O gesamt: ${totalIn} | Reserve: ${(input.dpReservePct*100).toFixed(0)}% ⇒ Ziel: ${target}`);

  const cands = CONTROLLERS.filter(c=>{
    const txmLimit = input.constraints?.eventMode ? c.maxTxmModules.event : c.maxTxmModules.polling;
    const okIO = !c.maxIOPoints || c.maxIOPoints >= target;
    const okBus = busCapsSatisfied(c, input.comm);
    return txmLimit>0 && okIO && okBus;
  });
  if(cands.length===0) throw new Error("Kein Controller erfüllt Reserve- und Bus-Caps.");
  const controller = pickBestController(cands);
  trace.push(`Controller: ${controller.label} (max I/O ${controller.maxIOPoints}, Mode ${input.constraints?.eventMode?"Ereignis≤8":"Abfrage≤64"})`);

  const targetIO = applyReserveProportionally(input.points, input.dpReservePct||0);
  const packed = packModules(targetIO);
  trace.push(...packed.trace);

  const sum_mA = computeBusmA(packed.items);
  let txsCount = 0;
  const needExtra = Math.max(0, sum_mA - controller.internalTxmSupply_mA);
  if(needExtra>0){
    txsCount = Math.ceil(needExtra / controller.txsSupplyPerUnit_mA);
    if(controller.txsMaxUnits && txsCount>controller.txsMaxUnits){
      trace.push(`WARNUNG: Benötigte Speisemodule (${txsCount}) > zulässig (${controller.txsMaxUnits}).`);
    }
  }
  trace.push(`TXM-Bus: ${sum_mA} mA (intern ${controller.internalTxmSupply_mA}) ⇒ TXS ${txsCount}`);

  const rowsPacked = packRows(input.cabinet.railWidth_mm, controller, [
    ...(txsCount>0 ? [{ item: MODULES.find(m=>m.id==="TXS1.12F10"), qty: txsCount, role:"supply" }] : []),
    ...packed.items
  ]);
  const mmRows = rowsPacked.rows.length;
  const totalWidth = rowsPacked.rows.flat().reduce((s,it)=> s+(it.item.dims?.w_mm||0),0);
  trace.push(`Baureihen: ${mmRows} bei Breite ${input.cabinet.railWidth_mm} mm → Gesamtbreite ${totalWidth} mm.`);

  const rowsOut = [];
  const pushRow = (mat,text,cat) => rowsOut.push({"Prod Nr.":mat,"M.":"Stk","G.":"","Tr.":"","Kurztext 1":text,"Kürzel":"","Kategorie":cat});
  pushRow(controller.id, controller.label, "Controller");
  if(txsCount>0) pushRow("TXS1.12F10","Speisemodul 1.2A","Zubehör");
  packed.items.forEach(it=> pushRow(it.item.id, it.item.label, it.item.category));

  return {
    controller, rows: rowsOut, trace,
    kpis:{ totalIOInput: totalIn, totalIOWithReserve: target, sumBus_mA: sum_mA, teWidthTotal_mm: totalWidth },
    mmRows, txsCount
  };
}
