
import { computeCandidates, selectVariants } from './logic.js';
import { CONTROLLERS, MODULES, CATALOG } from './catalog.js';

const $ = sel => document.querySelector(sel);
const h = (tag, props={}, ...kids)=>{
  const el=document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{
    if(k==="class") el.className=v;
    else if(k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  kids.flat().forEach(k=> el.append(k instanceof Node?k:document.createTextNode(k)));
  return el;
};

const defaultInputs = {
  projectName:"Projekt",
  points:{ di:0, doRelay:0, doTriac:0, aiU:0, ai_mA:0, aiRTD:0, aoU:0, ao_mA:0, counters:0 },
  dpReservePct:0.20,
  comm:{ knx:{devices:0}, modbus:{tcpNetworks:0, rtuSegments:0, dp:0}, mbus:{devices:0} },
  cabinet:{ railWidth_mm:600, supply24V_A:null },
  constraints:{ eventMode:false },
  controllerFilter:{ compact:true, modular:true },
  featureAllow:{ localOverride:true, lcd:true, ledTriColor:true, ledGreen:true },
  pricing:{ map:{}, has:false, advisorMode:"none", recommendDelta:0.10 }
};

let state = JSON.parse(localStorage.getItem("txio_state_pro_full")||"null") || defaultInputs;
const save = ()=> localStorage.setItem("txio_state_pro_full", JSON.stringify(state));

function numberInput(label, path, attrs={}){
  const inp = h("input",{class:"input", type:"number", min:"0", value:get(path)??0, oninput:e=>{ set(path, e.target.value===""?0:Number(e.target.value)); }});
  Object.entries(attrs).forEach(([k,v])=> inp.setAttribute(k,v));
  return h("div",{}, h("div",{class:"label"},label), inp);
}
function checkbox(label, path){
  const chk = h("input",{type:"checkbox"});
  chk.checked = !!get(path);
  chk.onchange = e=>{ set(path, !!e.target.checked); };
  return h("label",{class:"row", style:"gap:8px"}, chk, h("span",{},label));
}
function get(path){ return path.split(".").reduce((o,k)=> o?.[k], state); }
function set(path,val){
  const keys=path.split("."); let o=state;
  keys.slice(0,-1).forEach(k=> o=o[k]=o[k]??{} );
  o[keys.at(-1)]=val; save();
}

// Price import
function parsePriceFile(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true});
        const map = {};
        rows.forEach((row,idx)=>{
          if(!row || row.length<2) return;
          let pn = String(row[0]||"").trim();
          let priceRaw = String(row[1]??"").trim();
          if(idx===0 && pn.toLowerCase().includes("leistungsnummer")) return;
          if(!pn) return;
          pn = pn.toUpperCase();
          priceRaw = priceRaw.replace(/[^\d,.\-]/g,"");
          if(priceRaw==="") return;
          let price = Number(priceRaw.replace(",", "."));
          if(!isFinite(price)) return;
          map[pn]=price;
        });
        resolve(map);
      }catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

let lastCandidates=null;
let lastSelection=null;

function runCalc(){
  try{
    const cands = computeCandidates(state);
    lastCandidates = cands;
    const priceMap = state.pricing.has ? state.pricing.map : null;
    const sel = selectVariants(cands, priceMap, { mode: state.pricing.advisorMode, recommendDelta: state.pricing.recommendDelta||0.10 });
    lastSelection = sel;
    render();
  }catch(e){
    alert(e.message||String(e));
  }
}

function sapHeaders(){
  const base = ["Leistungsnummer","Menge","Basismengeneinheit","Kurztext","Kurztext 2"];
  const hasPrices = state.pricing.has;
  return hasPrices ? [...base,"Einzelpreis","Zwischensumme"] : base;
}

function enrichRowsForDisplay(sapRows){
  if(!state.pricing.has) return sapRows;
  return sapRows.map(r=>{
    const key = r["Leistungsnummer"].toUpperCase();
    const unit = state.pricing.map[key];
    const sum = (typeof unit==="number") ? unit * (r["Menge"]||0) : null;
    return { ...r, "Einzelpreis": unit!=null?unit:"–", "Zwischensumme": sum!=null?sum:"–" };
  });
}

function tableEl(rows){
  const headers = sapHeaders();
  return h("table",{class:"tbl"},
    h("thead",{}, h("tr",{}, ...headers.map(hd=>h("th",{},hd)))),
    h("tbody",{}, ...rows.map(r=> h("tr",{}, ...headers.map(hd=> h("td",{}, String(r[hd]??"")) )) ))
  );
}

function copyLnMenge(rows){
  const tsv = rows.map(r=> `${r["Leistungsnummer"]}\t${r["Menge"]}`).join("\n");
  navigator.clipboard.writeText(tsv);
  alert("Leistungsnummer + Menge in der Zwischenablage (Excel-kompatibel).");
}

function downloadXlsxFull(named, variantLabel, rows){
  const headers = sapHeaders();
  const data = [headers, ...rows.map(r=> headers.map(hd=> r[hd]??""))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  if(state.pricing.has){
    const lastRow = data.length;
    const sumCol = headers.indexOf("Zwischensumme");
    if(sumCol>=0){
      const colLetter = XLSX.utils.encode_col(sumCol);
      const firstData = 2;
      ws[`A${lastRow+1}`]={t:'s', v:'Gesamtkosten'};
      ws[`${colLetter}${lastRow+1}`]={t:'n', f:`SUM(${colLetter}${firstData}:${colLetter}${lastRow})`};
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, variantLabel);
  const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([wbout], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TXIO_Sizer_${state.projectName}_${variantLabel}.xlsx`;
  a.click();
}

function downloadXlsxLnMenge(named, variantLabel, rows, includeHeader=false){
  const headers = includeHeader? ["Leistungsnummer","Menge"] : [];
  const data = includeHeader? [headers] : [];
  rows.forEach(r=> data.push([r["Leistungsnummer"], r["Menge"]]));
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Positionsliste");
  const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([wbout], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TXIO_Sizer_${state.projectName}_LN_Menge_${variantLabel}.xlsx`;
  a.click();
}

function downloadPdf(variantLabel, rows, badges){
  const doc = new jspdf.jsPDF({orientation:'landscape', unit:'pt', format:'a4'});
  const headers = sapHeaders();
  const body = rows.map(r=> headers.map(hd=> r[hd]??""));
  const title = `TXIO Sizer – ${state.projectName} – ${variantLabel}`;
  doc.setFontSize(14); doc.text(title, 40, 40);
  let y=60; let x=40;
  badges.forEach(b=>{ doc.text(`• ${b}`, x, y); y+=16; if(y>120){ x+=220; y=60; } });
  doc.autoTable({ head:[headers], body, startY: 140, theme:'grid', styles:{fontSize:9, cellPadding:3} });
  doc.save(`TXIO_Sizer_${state.projectName}_${variantLabel}.pdf`);
}

function deviceInfo(){
  const list = [...CONTROLLERS, ...MODULES];
  const stateObj = { q:"", index:0 };
  const box = h("div",{class:"card"},
    h("div",{class:"section-title"}, h("h3",{},"Geräte‑Info")),
    h("div",{class:"row"},
      h("input",{class:"input",placeholder:"Suchen (z.B. TXM1.8X, PXC7)", oninput:e=>{ stateObj.q=e.target.value.toLowerCase(); refresh(); }}),
      h("select",{class:"input",onchange:e=>{ stateObj.index = Number(e.target.value); refresh(); }},
        ...list.map((i,idx)=> h("option",{value:String(idx)}, i.pn))
      )
    ),
    h("div",{id:"device-info-body"})
  );

  function cell(k,v){ return [h("div",{class:"small"},k), h("div",{}, v)]; }

  function refresh(){
    const filtered = list.filter(i=> (i.label||i.pn).toLowerCase().includes(stateObj.q) || i.pn.toLowerCase().includes(stateObj.q));
    const idx = Math.min(stateObj.index, Math.max(filtered.length-1,0));
    const sel = filtered[idx] || filtered[0];
    const body = box.querySelector("#device-info-body");
    body.innerHTML="";
    if(!sel) return;
    const it=sel;
    const grid = h("div",{class:"grid",style:"grid-template-columns:repeat(2,minmax(0,1fr))"});
    grid.append(...cell("Leistungsnummer", it.pn));
    grid.append(...cell("Kategorie", it.category|| (it.type==="modular"||it.type==="compact" ? "Controller" : "Modul")));
    grid.append(...cell("Kurztext", it.texts?.kurz1||""));
    grid.append(...cell("Kurztext 2", it.texts?.kurz2||""));
    grid.append(...cell("Abmessungen (BxHxT)", `${it.dims?.w||"-"}×${it.dims?.h||"-"}×${it.dims?.d||"-"} mm`));
    if(it.current_mA!=null) grid.append(...cell("TXM‑Bus (mA)", String(it.current_mA)));
    if(it.type){
      grid.append(...cell("Typ", it.type));
      grid.append(...cell("Max. I/O gesamt", String(it.limits?.ioOverall||"-")));
      if(it.limits?.txmIoMax) grid.append(...cell("Max. I/O über TXM", String(it.limits.txmIoMax)));
      grid.append(...cell("TXM Modullimit (Polling/Ereignis)", `${it.limits?.txmMode?.polling||"-"} / ${it.limits?.txmMode?.event||"-"}`));
      if(it.limits?.txmHardCap) grid.append(...cell("TXM Hardcap", String(it.limits.txmHardCap)));
      grid.append(...cell("Interne Bus-Speisung", `${it.power?.internalBus_mA||0} mA`));
      grid.append(...cell("Max. Speisemodule TXS1.12…", String(it.power?.txsMaxUnits||0)));
      grid.append(...cell("KNX max. Geräte", String(it.comm?.knxMaxDevices||0)));
      grid.append(...cell("Modbus TCP max. Netze", String(it.comm?.modbusTcpMaxNetworks||0)));
      grid.append(...cell("RS485 Ports", String(it.comm?.rs485Ports||0)));
      grid.append(...cell("M‑Bus Onboard (einfache Lasten)", String(it.comm?.mbusOnboardSimpleLoads||0)));
    }else if(it.features){
      grid.append(...cell("Kanäle / Signal", Object.entries(it.provide||{}).map(([k,v])=>`${k}=${v}`).join(", ")));
      grid.append(...cell("Lokale Übersteuerung", it.features.localOverride?"Ja":"–"));
      grid.append(...cell("LCD", it.features.lcd?"Ja":"–"));
      grid.append(...cell("3‑farbige LED", it.features.ledTriColor?"Ja":"–"));
      grid.append(...cell("Grüne LED", it.features.ledGreen?"Ja":"–"));
    }
    body.append(h("div",{class:"card"}, grid));
  }
  refresh();
  return box;
}

function applyPreset(kind){
  state.projectName = kind==="small"?"Beispiel Klein": kind==="mid"?"Beispiel Mittel":"Beispiel Groß";
  state.points = kind==="small" ? {di:12, doRelay:9, doTriac:0, aiU:6, ai_mA:0, aiRTD:0, aoU:4, ao_mA:0, counters:0}
    : kind==="mid" ? {di:28, doRelay:12, doTriac:0, aiU:12, ai_mA:8, aiRTD:8, aoU:8, ao_mA:4, counters:0}
    : {di:32, doRelay:24, doTriac:0, aiU:16, ai_mA:32, aiRTD:0, aoU:8, ao_mA:16, counters:0};
  state.dpReservePct = 0.2;
  state.cabinet.railWidth_mm = kind==="small"?600: (kind==="mid"?1100:1400);
  save(); render();
}

function panelInputs(){
  const featBox = h("div",{class:"card"},
    h("div",{class:"label"},"Modul‑Features (Zulassen/Verbieten)"),
    h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
      checkbox("Lokale Übersteuerung zulassen","featureAllow.localOverride"),
      checkbox("LCD zulassen","featureAllow.lcd"),
      checkbox("3‑farbige Status‑LED zulassen","featureAllow.ledTriColor"),
      checkbox("Grüne Status‑LED zulassen","featureAllow.ledGreen"),
    ),
    h("div",{class:"small"},"Wenn alle Haken gesetzt sind, darf alles verwendet werden. Haken entfernen = Module mit diesem Merkmal ausschließen.")
  );

  const controllerBox = h("div",{class:"card"},
    h("div",{class:"label"},"Controller‑Typen (Whitelist)"),
    h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
      checkbox("Kompakt (PXC4, PXC5)","controllerFilter.compact"),
      checkbox("Modular (PXC7)","controllerFilter.modular")
    )
  );

  const commBox = h("div",{class:"card"},
    h("div",{class:"label"},"Kommunikation / Integrations‑DP"),
    h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
      numberInput("KNX Geräte","comm.knx.devices"),
      numberInput("Modbus TCP Netze","comm.modbus.tcpNetworks"),
      numberInput("Modbus RTU Segmente","comm.modbus.rtuSegments"),
      numberInput("M‑Bus Geräte (gesamt)","comm.mbus.devices"),
      numberInput("Integrations‑DP (optional, Modbus/M‑Bus)","comm.modbus.dp")
    ),
    h("div",{class:"small"},"KNX zählt nicht zu Integrations‑DP. M‑Bus Onboard: 4 einfache Lasten, mehr via Pegelwandler.")
  );

  const pointsBox = h("div",{class:"card"},
    h("div",{class:"label"},"Datenpunkte"),
    h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
      numberInput("DI","points.di"), numberInput("DO (Relais)","points.doRelay"),
      numberInput("DO (Triac)","points.doTriac"), numberInput("AI 0–10V","points.aiU"),
      numberInput("AI 4–20mA","points.ai_mA"), numberInput("AI RTD/PT","points.aiRTD"),
      numberInput("AO 0–10V","points.aoU"), numberInput("AO 4–20mA","points.ao_mA"),
      numberInput("Zähler","points.counters")
    ),
    h("hr",{class:"sep"}),
    h("div",{class:"row"},
      h("div",{style:"flex:1"}, h("div",{class:"label"},"Reserve [%]"),
        h("input",{class:"input",type:"number",min:"0",max:"100", value:String((state.dpReservePct||0)*100),
          oninput:e=>{ state.dpReservePct=Math.max(0,Math.min(100,Number(e.target.value||0)))/100; save(); }})),
      h("div",{style:"flex:1"}, h("div",{class:"label"},"Modus"),
        h("select",{class:"input",onchange:e=>{ state.constraints.eventMode=(e.target.value==="event"); save(); }},
          h("option",{value:"polling", selected: state.constraints.eventMode?null:"selected"},"Abfrage (≤64 TXM)"),
          h("option",{value:"event", selected: state.constraints.eventMode?"selected":null},"Ereignis (≤8 TXM)")
        ))
    )
  );

  const cabinetBox = h("div",{class:"card"},
    h("div",{class:"label"},"Schaltschrank"),
    h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
      numberInput("Baureihen‑Breite [mm]","cabinet.railWidth_mm"),
      numberInput("24V Versorgung [A] (optional)","cabinet.supply24V_A")
    )
  );

  const pricingBox = h("div",{class:"card"},
    h("div",{class:"label"},"Preise / Optimierung"),
    h("div",{class:"row"},
      h("input",{type:"file", accept:".xlsx,.xls,.csv", onchange:async e=>{
        const f=e.target.files?.[0]; if(!f) return;
        try{
          const map = await parsePriceFile(f);
          state.pricing.map = Object.fromEntries(Object.entries(map).map(([k,v])=>[k.toUpperCase(),v]));
          state.pricing.has = Object.keys(state.pricing.map).length>0;
          save(); alert(`Preisliste geladen: ${Object.keys(state.pricing.map).length} Einträge.`); render();
        }catch(err){ alert("Importfehler: "+err.message); }
      }}),
      state.pricing.has ? h("button",{class:"icon-btn",onclick:()=>{ state.pricing={...defaultInputs.pricing}; save(); render(); }},"Preise entfernen") : null
    ),
    state.pricing.has ? h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
      h("div",{}, h("div",{class:"label"},"Optimierung"),
        h("select",{class:"input",onchange:e=>{ state.pricing.advisorMode=e.target.value; save(); }},
          h("option",{value:"none", selected: state.pricing.advisorMode==="none"},"Keine"),
          h("option",{value:"cheapest", selected: state.pricing.advisorMode==="cheapest"},"Günstigste"),
          h("option",{value:"balanced", selected: state.pricing.advisorMode==="balanced"},"Empfehlung"),
          h("option",{value:"both", selected: state.pricing.advisorMode==="both"},"Beides anzeigen")
        )
      ),
      h("div",{}, h("div",{class:"label"},"Empfehlung: Preis‑Toleranz δ"),
        h("input",{class:"input", type:"number", step:"0.01", min:"0", max:"0.5", value:String(state.pricing.recommendDelta||0.10),
        oninput:e=>{ const x=Number(e.target.value||0.1); state.pricing.recommendDelta=Math.max(0,Math.min(0.5,x)); save(); }})
      )
    ) : h("div",{class:"small"},"Tipp: Preisliste importieren, um Kosten/Optimierung zu aktivieren.")
  );

  const head = h("div",{class:"section-title"}, h("h3",{},"Eingaben"),
    h("div",{class:"row"},
      h("button",{class:"icon-btn",onclick:()=>{ state=JSON.parse(JSON.stringify(defaultInputs)); save(); render(); }},"Zurücksetzen"),
      h("button",{class:"icon-btn",onclick:()=>{ applyPreset("small"); }},"Beispiel: Klein"),
      h("button",{class:"icon-btn",onclick:()=>{ applyPreset("mid"); }},"Mittel"),
      h("button",{class:"icon-btn",onclick:()=>{ applyPreset("large"); }},"Groß"),
      h("button",{class:"btn",onclick:runCalc},"Ausführen")
    )
  );

  return h("div",{}, head, h("div",{class:"grid", style:"grid-template-columns:repeat(2,minmax(0,1fr))"},
    pointsBox, commBox, controllerBox, featBox, cabinetBox, pricingBox
  ));
}

function resultPanel(){
  if(!lastCandidates) return h("div",{});
  const priceMap = state.pricing.has ? state.pricing.map : null;
  let sections = [];
  const mode = state.pricing.advisorMode;

  function variantBlock(label, plan){
    if(!plan) return h("div");
    const displayRows = enrichRowsForDisplay(plan.sapRows);
    const tbl = tableEl(displayRows);
    const badges = [
      `Controller: ${plan.controller.pn}`,
      `Module: ${plan.kpis.moduleCount}`,
      `TXS: ${plan.kpis.txsCount}`,
      `Bus: ${plan.kpis.sumBus_mA} mA`,
      `Reihen: ${plan.kpis.mmRows}`,
      `Breite: ${plan.kpis.totalWidth_mm} mm`
    ];
    const actions = h("div",{class:"row"},
      h("button",{class:"icon-btn",onclick:()=> copyLnMenge(plan.sapRows)},"Kopieren (LN+Menge)"),
      h("button",{class:"icon-btn",onclick:()=> downloadXlsxLnMenge(state.projectName,label,plan.sapRows,false)},"Excel (LN+Menge)"),
      h("button",{class:"icon-btn",onclick:()=> downloadXlsxFull(state.projectName,label,displayRows)},"Excel (voll)"),
      h("button",{class:"icon-btn",onclick:()=> downloadPdf(label, displayRows, badges)},"PDF (Ergebnis)")
    );
    const footer = (priceMap)? h("div",{class:"row", style:"margin-top:8px"},
      h("span",{class:"badge good"}, "Gesamtkosten werden in Excel/PDF automatisch summiert")) : null;

    return h("div",{class:"card"},
      h("div",{class:"section-title"}, h("h3",{},`Ergebnis – ${label}`), h("div",{class:"row"}, ...badges.map(b=>h("span",{class:"badge"},b)), actions)),
      tbl, footer
    );
  }

  if(mode==="both" && lastSelection){
    sections.push(variantBlock("Günstigste", lastSelection.cheapest));
    if(lastSelection.recommended && lastSelection.recommended!==lastSelection.cheapest){
      sections.push(variantBlock("Empfehlung", lastSelection.recommended));
    }else{
      sections.push(h("div",{class:"card"}, h("div",{class:"small"},"Empfehlung entspricht der günstigsten Variante.")));
    }
  }else{
    const label = (mode==="cheapest")?"Günstigste": (mode==="balanced")?"Empfehlung":"Ergebnis";
    const plan = lastSelection?.recommended || lastSelection?.cheapest || lastCandidates[0];
    sections.push(variantBlock(label, plan));
  }
  return h("div",{}, ...sections);
}

function tracePanel(){
  if(!lastCandidates) return h("div",{});
  const plan = lastSelection?.recommended || lastSelection?.cheapest || lastCandidates[0];
  return h("div",{class:"card"},
    h("h3",{},"Rechenweg & Hinweise"),
    h("ul",{}, ...plan.trace.map(t=> h("li",{class:"small"}, t)))
  );
}

function render(){
  const app = $("#app"); app.innerHTML="";
  const header = h("div",{class:"row",style:"gap:12px;margin-bottom:12px;align-items:center"},
    h("img",{src:"./favicon.svg",width:"28",height:"28"}),
    h("h1",{},"TXIO Sizer PRO"),
    h("input",{class:"input", style:"max-width:280px", value: state.projectName, oninput:e=>{ state.projectName=e.target.value; save(); }})
  );
  const layout = h("div",{class:"layout"},
    h("div",{}, panelInputs()),
    h("div",{class:"grid"}, resultPanel(), tracePanel(), deviceInfo())
  );
  app.append(header, layout, h("footer",{}, h("div",{class:"small"},"© "+new Date().getFullYear()+" – TXIO Sizer PRO • Upload‑only Build")));
}

render();
window._txio_run = ()=> runCalc();
