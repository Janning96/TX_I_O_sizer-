
export const CONTROLLERS = [
  { id:"PXC4-2", label:"PXC4-2", maxIOPoints:80, maxTxmModules:{polling:64,event:8},
    internalTxmSupply_mA:300, txsSupplyPerUnit_mA:1200, txsMaxUnits:1,
    commCaps:{knx:{maxDevices:64},modbus:{maxTcpNetworks:3},mbus:{ports:1,simpleLoadsPerPort:4,maxDevicesWithRepeater:250}},
    dims:{w_mm:198,h_mm:124,d_mm:70} },
  { id:"PXC5.E24", label:"PXC5.E24", maxIOPoints:100, maxTxmModules:{polling:64,event:8},
    internalTxmSupply_mA:300, txsSupplyPerUnit_mA:1200,
    commCaps:{knx:{maxDevices:64},modbus:{maxTcpNetworks:10},mbus:{ports:1,simpleLoadsPerPort:4,maxDevicesWithRepeater:250}},
    dims:{w_mm:270,h_mm:124,d_mm:70} },
  { id:"PXC7.E400", label:"PXC7.E400", maxIOPoints:400, maxTxmModules:{polling:64,event:8},
    internalTxmSupply_mA:300, txsSupplyPerUnit_mA:1200, txsMaxUnits:4,
    commCaps:{knx:{maxDevices:64},modbus:{maxTcpNetworks:10},mbus:{ports:1,simpleLoadsPerPort:4,maxDevicesWithRepeater:250}},
    dims:{w_mm:198,h_mm:124,d_mm:70} }
];

export const MODULES = [
  { id:"TXM1.8D", label:"TXM1.8D (8×DI)", category:"TXM", channels:8, provide:{di:8}, txmBus_mA:53, dims:{w_mm:64,h_mm:98,d_mm:70} },
  { id:"TXM1.16D", label:"TXM1.16D (16×DI)", category:"TXM", channels:16, provide:{di:16}, txmBus_mA:65, dims:{w_mm:64,h_mm:98,d_mm:70}, special:{counter_di_range:[1,8]} },
  { id:"TXM1.8U", label:"TXM1.8U (8×UIO)", category:"TXM", channels:8, provide:{di:8, aiU:8, aoU:8}, txmBus_mA:59, dims:{w_mm:64,h_mm:98,d_mm:70} },
  { id:"TXM1.8X", label:"TXM1.8X (8×XIO)", category:"TXM", channels:8, provide:{di:8, aiU:8, ai_mA:8, aoU:8, ao_mA:4}, special:{ao_mA_channels:[5,6,7,8]}, txmBus_mA:230, dims:{w_mm:64,h_mm:98,d_mm:70} },
  { id:"TXM1.6R", label:"TXM1.6R (6×Relais)", category:"TXM", channels:6, provide:{doRelay:6}, txmBus_mA:68, dims:{w_mm:64,h_mm:98,d_mm:70} },
  { id:"TXM1.8T", label:"TXM1.8T (8×Triac)", category:"TXM", channels:8, provide:{doTriac:8}, txmBus_mA:42, dims:{w_mm:64,h_mm:98,d_mm:70}, special:{triac_module_total_mA:1000} },
  { id:"TXM1.8P", label:"TXM1.8P (8×PT/Widerstand)", category:"TXM", channels:8, provide:{aiRTD:8}, txmBus_mA:43, dims:{w_mm:64,h_mm:98,d_mm:70} },
  { id:"TXM1.4D3R", label:"TXM1.4D3R (4×DI + 3×Relais)", category:"TXM", channels:7, provide:{di:4, doRelay:3}, txmBus_mA:42, dims:{w_mm:64,h_mm:98,d_mm:70} },
  { id:"TXS1.12F10", label:"TXS1.12F10 (Speisemodul 1.2 A)", category:"Zubehör", dims:{w_mm:96,h_mm:98,d_mm:70} },
  { id:"TXS1.EF10", label:"TXS1.EF10 (Busverbinder)", category:"Zubehör", dims:{w_mm:32,h_mm:98,d_mm:70} }
];
