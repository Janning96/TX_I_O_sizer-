
// Gerätekatalog inkl. Onboard-Fähigkeiten und Limits (kombinierte Gesamtlimits für PXC7)

export const CONTROLLERS = [
  // --- Kompakt ---
  { pn:"PXC4.E16-2", type:"compact",
    texts:{ kurz1:"Automationsstation bis 40 DP BACnet", kurz2:"BACnet/SC o. /IP Rev. 1.20 B-BC, Modbus" },
    onboard:{ uio:12, xio:0, do:4, total:16, xioAo_mA_slots:0 },
    limits:{ hwMax:40, intMax:40, totalCombinedMax:80, txmMode:{polling:64,event:8}, txmHardCap:8 },
    power:{ internalBus_mA:300, txsMaxUnits:1, txsPerUnit_mA:1200 },
    comm:{ knxMaxDevices:64, rs485Ports:1 },
    dims:{ w:198,h:124,d:70 }
  },
  { pn:"PXC4.E16S-2", type:"compact",
    texts:{ kurz1:"Automationsstation bis 40 DP BACnet", kurz2:"BACnet/SC o. /IP Rev. 1.20 B-BC" },
    onboard:{ uio:12, xio:0, do:4, total:16, xioAo_mA_slots:0 },
    limits:{ hwMax:40, intMax:0, totalCombinedMax:40, txmMode:{polling:64,event:8}, txmHardCap:8 },
    power:{ internalBus_mA:300, txsMaxUnits:1, txsPerUnit_mA:1200 },
    comm:{ knxMaxDevices:0, rs485Ports:0 },
    dims:{ w:198,h:124,d:70 }
  },
  { pn:"PXC5.E24", type:"compact",
    texts:{ kurz1:"Automationsstation bis 80 DP BACnet", kurz2:"BACnet/SC o. /IP Rev. 1.20 B-BC" },
    onboard:{ uio:8, xio:8, do:8, total:24, xioAo_mA_slots:4 },
    limits:{ hwMax:80, intMax:40, totalCombinedMax:120, txmMode:{polling:64,event:8}, txmHardCap:8 },
    power:{ internalBus_mA:300, txsMaxUnits:2, txsPerUnit_mA:1200 },
    comm:{ knxMaxDevices:64, rs485Ports:2 },
    dims:{ w:270,h:124,d:70 }
  },

  // --- Modular (PXC7) ---
  { pn:"PXC7.E400S", type:"modular",
    texts:{ kurz1:"Automationsstation bis 100 DP BACnet", kurz2:"BACnet/SC o. /IP Rev. 1.20 B-BC" },
    onboard:{ uio:0, xio:0, do:0, total:0, xioAo_mA_slots:0 },
    limits:{ hwMax:100, intMax:100, totalCombinedMax:100, txmMode:{polling:64,event:8} },
    power:{ internalBus_mA:300, txsMaxUnits:4, txsPerUnit_mA:1200 },
    comm:{ knxMaxDevices:64, rs485Ports:1 },
    dims:{ w:198,h:124,d:70 }
  },
  { pn:"PXC7.E400M", type:"modular",
    texts:{ kurz1:"Automationsstation bis 200 DP BACnet/SC", kurz2:"BACnet/SC o. /IP Rev. 1.20 B-BC" },
    onboard:{ uio:0, xio:0, do:0, total:0, xioAo_mA_slots:0 },
    limits:{ hwMax:200, intMax:250, totalCombinedMax:250, txmMode:{polling:64,event:8} },
    power:{ internalBus_mA:300, txsMaxUnits:4, txsPerUnit_mA:1200 },
    comm:{ knxMaxDevices:64, rs485Ports:2 },
    dims:{ w:198,h:124,d:70 }
  },
  { pn:"PXC7.E400L", type:"modular",
    texts:{ kurz1:"Automationsstation bis 400 DP BACnet", kurz2:"BACnet/SC o. /IP Rev. 1.20 B-BC" },
    onboard:{ uio:0, xio:0, do:0, total:0, xioAo_mA_slots:0 },
    limits:{ hwMax:400, intMax:600, totalCombinedMax:600, txmMode:{polling:64,event:8} },
    power:{ internalBus_mA:300, txsMaxUnits:4, txsPerUnit_mA:1200 },
    comm:{ knxMaxDevices:64, rs485Ports:4 },
    dims:{ w:198,h:124,d:70 }
  },
];

export const MODULES = [
  { pn:"TXM1.8D", texts:{ kurz1:"Eingangsmodul Digital 8-Kanal", kurz2:"für DE, ZE mit LED-Anzeige" },
    provide:{ di:8 }, current_mA:53, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:true, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.16D", texts:{ kurz1:"Eingangsmodul Digital 16-Kanal", kurz2:"für DE, ZE mit Status-LED" },
    provide:{ di:16 }, current_mA:65, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.8U", texts:{ kurz1:"Universalmodul 8-Kanal", kurz2:"DE, ZE, AE, AA, LED-Anzeige" },
    provide:{ di:8, aiU:8, aoU:8 }, current_mA:59, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.8U-ML", texts:{ kurz1:"Universalmodul 8-Kanal, Hand und LCD", kurz2:"DE, ZE, AE, AA, LED-Anzeige" },
    provide:{ di:8, aiU:8, aoU:8 }, current_mA:84, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:true, lcd:true, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.8X", texts:{ kurz1:"Universalmodul 8-Kanal", kurz2:"DE, ZE, AE, AA, zusätzl. 0...20 mA, LED" },
    provide:{ di:8, aiU:8, ai_mA:8, aoU:8, ao_mA:4 }, current_mA:230, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:true, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.8X-ML", texts:{ kurz1:"Universalmodul 8-Kanal, Hand und LCD", kurz2:"DE, ZE, AE, AA, zusätzl. 0...20 mA, LED" },
    provide:{ di:8, aiU:8, ai_mA:8, aoU:8, ao_mA:4 }, current_mA:235, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:true, lcd:true, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.6R", texts:{ kurz1:"Ausgangsmodul Digital 6-Kanal", kurz2:"Relaisausgänge, LED-Anzeige" },
    provide:{ doRelay:6 }, current_mA:68, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.6R-M", texts:{ kurz1:"Ausgangsmodul Digital 6-Kanal, Hand", kurz2:"Relaisausgänge, LED-Anzeige" },
    provide:{ doRelay:6 }, current_mA:78, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:true, lcd:false, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.6RL", texts:{ kurz1:"Ausgangsmodul Digital 6-Kanal, bistabil", kurz2:"zur Lichtsteuerung , LED-Anzeige" },
    provide:{ doRelay:6 }, current_mA:97, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.8P", texts:{ kurz1:"Eingangsmodul Analog 8-Kanal", kurz2:"für AE, 4-Leiter, mit LED-Anzeige" },
    provide:{ aiU:8 }, current_mA:43, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:false, ledGreen:true }, category:"TXM" },
  { pn:"TXM1.8T", texts:{ kurz1:"Ausgangsmodul Triac 8-Kanal", kurz2:"Thermische und motorische Antriebe, LED" },
    provide:{ doTriac:8 }, current_mA:42, dims:{ w:64,h:98,d:70 },
    features:{ localOverride:false, lcd:false, ledTriColor:false, ledGreen:false }, category:"TXM" },

  { pn:"TXS1.12F10", texts:{ kurz1:"Zusatz-Speisungsmodul", kurz2:"der E/A-Module und Feldgeräte" },
    provide:{}, current_mA:0, dims:{ w:96,h:98,d:70 }, category:"Zubehör", role:"supply" },
  { pn:"TXS1.EF10", texts:{ kurz1:"TXS1.EF10", kurz2:"Durchleitung von Speisung und E/A-Bus" },
    provide:{}, current_mA:0, dims:{ w:32,h:98,d:70 }, category:"Zubehör", role:"bus" },
];

export const CATALOG = Object.fromEntries([
  ...CONTROLLERS.map(c=>[c.pn,{type:"controller", item:c}]),
  ...MODULES.map(m=>[m.pn,{type:"module", item:m}]),
]);
