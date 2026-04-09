import { useState, createContext, useContext, useCallback, useEffect } from "react";
import { supabase } from "./supabase.js";

async function dbGet(table, order="id") { const {data}=await supabase.from(table).select("*").order(order); return data||[]; }
async function dbInsert(table, row) { const {data}=await supabase.from(table).insert(row).select(); return data?.[0]||null; }
async function dbUpdate(table, id, row, idCol="id") { await supabase.from(table).update(row).eq(idCol,id); }
async function dbDelete(table, id, idCol="id") { await supabase.from(table).delete().eq(idCol,id); }

// ============================================================
// CONSTANTS
// ============================================================
const CK = ["molde","corte","tecido","costura","estampas","transporte","insumo"];
const CL = {molde:"Molde",corte:"Corte",tecido:"Tecido",costura:"Costura",estampas:"Estampas",transporte:"Transporte",insumo:"Insumo"};
// FIXOS = valor total da produção (sistema divide por peça): molde, insumo, transporte
// VARIÁVEIS = por peça: corte, costura, estampas
// TECIDO = fórmula especial: (consumo_m × preco_metro × qty × fator_perda) + custo_extra
const FIXOS = ["molde","insumo","transporte"];
const VARIAVEIS = ["corte","costura","estampas"];
const DC = {molde:80,corte:3,tecido:0,costura:15,estampas:10,transporte:200,insumo:300};
const DC_TECIDO = {consumo:0.75,precoMetro:53,perdaPct:15,custoExtra:500,unit:"kg",disabled:{}};
const SF = ["Orçamento","Aprovado","Em Produção","Finalizado","Entregue"];
const SC = {"Orçamento":{bg:"rgba(76,126,201,0.12)",c:"#4c7ec9",b:"rgba(76,126,201,0.25)"},"Aprovado":{bg:"rgba(160,120,200,0.12)",c:"#a078c8",b:"rgba(160,120,200,0.25)"},"Em Produção":{bg:"rgba(224,145,69,0.12)",c:"#e09145",b:"rgba(224,145,69,0.25)"},"Finalizado":{bg:"rgba(76,201,138,0.12)",c:"#4cc98a",b:"rgba(76,201,138,0.25)"},"Entregue":{bg:"rgba(201,168,76,0.12)",c:"#c9a84c",b:"rgba(201,168,76,0.25)"}};
const SS = ["pendente","andamento","concluído"];
const SCC = {pendente:{bg:"rgba(127,125,122,0.1)",c:"#7f7d7a"},andamento:{bg:"rgba(224,145,69,0.12)",c:"#e09145"},"concluído":{bg:"rgba(76,201,138,0.12)",c:"#4cc98a"}};
const $ = {bg:"#0c0c0f",sf:"#14141a",s2:"#1a1a22",s3:"#22222c",bd:"rgba(255,255,255,0.06)",bh:"rgba(255,255,255,0.12)",tx:"#e8e6e3",mu:"#7f7d7a",dm:"#555",gd:"#c9a84c",gdd:"rgba(201,168,76,0.12)",bl:"#4c7ec9",bld:"rgba(76,126,201,0.12)",gn:"#4cc98a",gnd:"rgba(76,201,138,0.10)",or:"#e09145",ord:"rgba(224,145,69,0.12)",rd:"#c94c4c",rdd:"rgba(201,76,76,0.12)"};

// ============================================================
// CONTEXT
// ============================================================
const Ctx = createContext(null);

function mapOrder(x){return{...x,productId:x.product_id,product:x.product_name,custoReal:x.custo_real,lucroP:x.lucro_p,impostoP:x.imposto_p,mockImage:x.mock_image,costs:x.costs||DC,costsDetail:x.costs_detail||null,skus:x.skus||null,nomePedido:x.nome_pedido||null,parcela1:x.parcela1||{valor:0,data:"",pago:false},parcela2:x.parcela2||{valor:0,data:"",pago:false}};}
function mapPO(x){return{...x,pedidoId:x.pedido_id,custosReais:x.custos_reais||DC,ficha:x.ficha||{},enfesto:x.enfesto||"",totalCortado:x.total_cortado||"",totalSilkado:x.total_silkado||"",totalCosturado:x.total_costurado||""};}
function mapLead(x){return{...x,ultimoContato:x.ultimo_contato,fup:x.fup||"",temperatura:x.temperatura||"frio"};}

function Provider({children}) {
  const [products,setProducts]=useState([]);const [orders,setOrders]=useState([]);const [pos,setPOs]=useState([]);const [leads,setLeads]=useState([]);const [activities,setActivities]=useState([]);const [toasts,setToasts]=useState([]);const [loading,setLoading]=useState(true);
  const toast=useCallback((m)=>{const id=Date.now();setToasts(t=>[...t,{id,msg:m}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3000);},[]);

  useEffect(()=>{(async()=>{
    const[p,o,po,l,a]=await Promise.all([dbGet("products"),dbGet("orders","id"),dbGet("production_orders"),dbGet("leads"),dbGet("activities","date")]);
    setProducts(p.map(x=>({...x,costs:x.costs||DC})));setOrders(o.map(mapOrder));setPOs(po.map(mapPO));setLeads(l.map(mapLead));setActivities(a);setLoading(false);
  })();},[]);

  const addProduct=useCallback(async(p)=>{const r=await dbInsert("products",{name:p.name,price:p.price||0,category:p.category,emoji:p.emoji,costs:p.costs,tecido:p.tecido||null});if(r){setProducts(pr=>[...pr,{...r,costs:r.costs||DC,tecido:r.tecido||null}]);toast(`"${p.name}" cadastrado!`);return r.id;}},[toast]);
  const updateProduct=useCallback(async(id,u)=>{const b={...u};if(b.tecido!==undefined)b.tecido=b.tecido;await dbUpdate("products",id,b);setProducts(pr=>pr.map(p=>p.id===id?{...p,...u}:p));},[]);
  const deleteProduct=useCallback(async(id)=>{await dbDelete("products",id);setProducts(pr=>pr.filter(p=>p.id!==id));toast("Removido");},[toast]);

  const addOrder=useCallback(async(o)=>{const body={client:o.client,product_id:o.productId,product_name:o.product,qty:o.qty,total:o.total,status:o.status,date:o.date,prazo:o.prazo||null,costs:o.costs,costs_detail:o.costsDetail||null,lucro_p:o.lucroP,imposto_p:o.impostoP,mock_image:o.mockImage,parcela1:o.parcela1,parcela2:o.parcela2,skus:o.costsDetail?.skus||null,nome_pedido:o.costsDetail?.nomePedido||null};const r=await dbInsert("orders",body);if(r){setOrders(os=>[mapOrder(r),...os]);toast(`#${r.id} criado!`);return r.id;}},[toast]);
  const updateOrder=useCallback(async(id,u)=>{const b={};if(u.client!==undefined)b.client=u.client;if(u.product!==undefined)b.product_name=u.product;if(u.qty!==undefined)b.qty=u.qty;if(u.total!==undefined)b.total=u.total;if(u.status!==undefined)b.status=u.status;if(u.prazo!==undefined)b.prazo=u.prazo||null;if(u.custoReal!==undefined)b.custo_real=u.custoReal;if(u.mockImage!==undefined)b.mock_image=u.mockImage;if(u.parcela1!==undefined)b.parcela1=u.parcela1;if(u.parcela2!==undefined)b.parcela2=u.parcela2;if(u.costs!==undefined)b.costs=u.costs;if(u.costsDetail!==undefined)b.costs_detail=u.costsDetail;await dbUpdate("orders",id,b);setOrders(os=>os.map(o=>o.id===id?{...o,...u}:o));},[]);
  const deleteOrder=useCallback(async(id)=>{await dbDelete("production_orders",id,"pedido_id");await dbDelete("orders",id);setOrders(os=>os.filter(o=>o.id!==id));setPOs(p=>p.filter(x=>x.pedidoId!==id));toast(`#${id} deletado`);},[toast]);

  const advanceStatus=useCallback(async(orderId)=>{const o=orders.find(x=>x.id===orderId);if(!o)return;const idx=SF.indexOf(o.status);if(idx>=SF.length-1)return;const ns=SF[idx+1];await dbUpdate("orders",orderId,{status:ns});
    if(ns==="Em Produção"){const poId=`OP-${String(pos.length+1).padStart(3,"0")}`;const body={id:poId,pedido_id:o.id,client:o.client,product:o.product,qty:o.qty,sectors:{corte:"pendente",estamparia:"pendente",costura:"pendente",acabamento:"pendente"},custos_reais:{molde:0,corte:0,tecido:0,costura:0,estampas:0,transporte:0,insumo:0},ficha:{grade:{P:0,M:0,G:0,GG:0,X1:0,X2:0},descricao:o.product,valorCostura:o.costs?.costura||0,etiqueta:"Padrão",instrucoes:"",mockFrente:o.mockImage||"",impressao:{frentePosicao:"Centro",costasPosicao:"N/A",mangaPosicao:"N/A",coresPantone:"",medidas:""},tipoMolde:"Regular",materiaPrima:[],aviamentos:[]}};const r=await dbInsert("production_orders",body);if(r)setPOs(p=>[...p,mapPO(r)]);toast(`OP ${poId}`);}
    setOrders(os=>os.map(x=>x.id===orderId?{...x,status:ns}:x));toast(`#${orderId} → ${ns}`);
  },[orders,pos.length,toast]);

  const updatePO=useCallback(async(id,u)=>{const b={};if(u.sectors!==undefined)b.sectors=u.sectors;if(u.custosReais!==undefined)b.custos_reais=u.custosReais;if(u.ficha!==undefined)b.ficha=u.ficha;if(u.enfesto!==undefined)b.enfesto=u.enfesto;if(u.totalCortado!==undefined)b.total_cortado=u.totalCortado;if(u.totalSilkado!==undefined)b.total_silkado=u.totalSilkado;if(u.totalCosturado!==undefined)b.total_costurado=u.totalCosturado;await dbUpdate("production_orders",id,b);setPOs(p=>p.map(x=>x.id===id?{...x,...u}:x));},[]);
  const updatePOSector=useCallback(async(id,sec,st)=>{const po=pos.find(x=>x.id===id);if(!po)return;const ns={...po.sectors,[sec]:st};await dbUpdate("production_orders",id,{sectors:ns});setPOs(p=>p.map(x=>x.id===id?{...x,sectors:ns}:x));toast(`${sec} → ${st}`);},[pos,toast]);
  const updatePOCustoReal=useCallback(async(poId,key,val)=>{const po=pos.find(x=>x.id===poId);if(!po)return;const nc={...po.custosReais,[key]:val};await dbUpdate("production_orders",poId,{custos_reais:nc});setPOs(p=>p.map(x=>x.id===poId?{...x,custosReais:nc}:x));},[pos]);

  const addLead=useCallback(async(l)=>{const r=await dbInsert("leads",{nome:l.nome,empresa:l.empresa,contexto:l.contexto,ultimo_contato:l.ultimoContato||null,fup:l.fup,temperatura:l.temperatura||"frio"});if(r)setLeads(ls=>[...ls,{...mapLead(r),temperatura:r.temperatura||"frio"}]);toast("Lead!");},[toast]);
  const updateLead=useCallback(async(id,u)=>{const b={};if(u.nome!==undefined)b.nome=u.nome;if(u.empresa!==undefined)b.empresa=u.empresa;if(u.contexto!==undefined)b.contexto=u.contexto;if(u.ultimoContato!==undefined)b.ultimo_contato=u.ultimoContato;if(u.fup!==undefined)b.fup=u.fup;if(u.temperatura!==undefined)b.temperatura=u.temperatura;await dbUpdate("leads",id,b);setLeads(ls=>ls.map(l=>l.id===id?{...l,...u}:l));},[]);
  const deleteLead=useCallback(async(id)=>{await dbDelete("leads",id);setLeads(ls=>ls.filter(l=>l.id!==id));toast("Removido");},[toast]);

  const addActivity=useCallback(async(a)=>{const r=await dbInsert("activities",{date:a.date,title:a.title});if(r)setActivities(as=>[...as,r]);toast("Atividade!");},[toast]);
  const deleteActivity=useCallback(async(id)=>{await dbDelete("activities",id);setActivities(as=>as.filter(a=>a.id!==id));},[]);

  if(loading)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:$.bg,color:$.tx,fontFamily:"sans-serif",fontSize:18}}>Carregando SALIBA ERP...</div>;

  return <Ctx.Provider value={{products,orders,pos,leads,activities,addProduct,updateProduct,deleteProduct,addOrder,updateOrder,deleteOrder,advanceStatus,updatePO,updatePOSector,updatePOCustoReal,addLead,updateLead,deleteLead,addActivity,deleteActivity,toasts,toast}}>{children}</Ctx.Provider>;
}

function useApp(){return useContext(Ctx);}

// ============================================================
// UTILS & COMPONENTS
// ============================================================
const fmt=(v)=>(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
// Calcula custo total do tecido respeitando campos desabilitados
function calcTecido(t, qty) {
  if(!t) return 0;
  const off = t.disabled || {};
  const consumo = off.consumo ? 0 : (t.consumo||0);
  const preco = off.preco ? 0 : (t.precoMetro||0);
  const perda = off.perda ? 0 : (t.perdaPct||0);
  const extra = off.extra ? 0 : (t.custoExtra||0);
  return (consumo * preco * (qty||0) * (1 + perda/100)) + extra;
}
// Calcula custo TOTAL da produção (não por peça) dado costs, tecidoParams e qty
function calcCustoTotal(costs, tecido, qty) {
  let total = 0;
  // Fixos (valor total já): molde, insumo, transporte
  FIXOS.forEach(k => total += (costs?.[k]||0));
  // Variáveis (por peça × qty): corte, costura, estampas
  VARIAVEIS.forEach(k => total += (costs?.[k]||0) * qty);
  // Tecido (fórmula)
  total += calcTecido(tecido, qty);
  return total;
}
// Custo por peça
function custoPorPeca(costs, tecido, qty) {
  if(!qty || qty <= 0) return 0;
  return calcCustoTotal(costs, tecido, qty) / qty;
}
// Legacy sum for orders que já tem custos salvos no formato antigo (por peça)
const sum=(c)=>CK.reduce((s,k)=>s+((c&&c[k])||0),0);
const fD=(d)=>{if(!d)return"—";const s=String(d).split("T")[0].split("-");return`${s[2]}/${s[1]}/${s[0]}`;};
const inp={width:"100%",background:$.s2,border:`1px solid ${$.bd}`,borderRadius:8,padding:"10px 14px",color:$.tx,fontFamily:"inherit",fontSize:14,outline:"none",marginBottom:14};

function Bd({status}){const c=SC[status]||{};return <span style={{background:c.bg,color:c.c,border:`1px solid ${c.b}`,padding:"3px 10px",borderRadius:100,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{status}</span>;}
function SB({status}){const c=SCC[status]||SCC.pendente;return <span style={{background:c.bg,color:c.c,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{status}</span>;}
function Cd({children,style,onClick,hover}){const[h,setH]=useState(false);return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:$.sf,border:`1px solid ${h&&hover?$.bh:$.bd}`,borderRadius:12,padding:20,transition:"all 0.2s",cursor:onClick?"pointer":"default",transform:h&&hover?"translateY(-2px)":"none",...style}}>{children}</div>;}
function KPI({label,value,sub,color}){return <Cd><div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:$.mu,marginBottom:8}}>{label}</div><div style={{fontSize:24,fontWeight:700,color:color||$.tx}}>{value}</div>{sub&&<div style={{fontSize:12,color:$.mu,marginTop:4}}>{sub}</div>}</Cd>;}
function Bt({children,onClick,v="gold",style:st}){const cs={gold:{bg:$.gdd,b:"rgba(201,168,76,0.25)",c:$.gd},blue:{bg:$.bld,b:"rgba(76,126,201,0.25)",c:$.bl},green:{bg:$.gnd,b:"rgba(76,201,138,0.25)",c:$.gn},muted:{bg:$.s2,b:$.bd,c:$.mu},red:{bg:$.rdd,b:"rgba(201,76,76,0.25)",c:$.rd}};const c=cs[v]||cs.gold;return <button onClick={onClick} style={{background:c.bg,border:`1px solid ${c.b}`,color:c.c,padding:"8px 16px",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,...st}}>{children}</button>;}
function TB({tabs,active,onChange}){return <div style={{display:"flex",gap:4,background:$.sf,borderRadius:10,padding:4,border:`1px solid ${$.bd}`,marginBottom:20,flexWrap:"wrap"}}>{tabs.map(t=><button key={t} onClick={()=>onChange(t)} style={{padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:active===t?600:400,cursor:"pointer",color:active===t?$.tx:$.mu,background:active===t?$.s3:"transparent",border:"none",fontFamily:"inherit"}}>{t}</button>)}</div>;}
function ImgUp({image,onChange,label="Mock-up"}){const hf=(e)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>onChange(ev.target.result);r.readAsDataURL(f);};return <div style={{marginTop:12}}><div style={{fontSize:12,color:$.mu,marginBottom:8}}>{label}</div>{image?<div style={{position:"relative",display:"inline-block"}}><img src={image} alt="M" style={{maxWidth:"100%",maxHeight:180,borderRadius:10,border:`1px solid ${$.bd}`,objectFit:"contain",background:$.s2}}/><button onClick={()=>onChange(null)} style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:6,background:"rgba(201,76,76,0.8)",border:"none",color:"#fff",fontSize:13,cursor:"pointer"}}>×</button></div>:<label style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"20px",border:`2px dashed ${$.bd}`,borderRadius:10,cursor:"pointer",background:$.s2,gap:6}}><span style={{fontSize:22}}>📷</span><span style={{fontSize:12,color:$.mu}}>Adicionar foto</span><input type="file" accept="image/*" onChange={hf} style={{display:"none"}}/></label>}</div>;}
function CE({costs,onChange,qty,tecido,onTecidoChange,showT=true}){
  const ni={width:65,background:$.s2,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 8px",color:$.tx,fontFamily:"monospace",fontSize:13,textAlign:"right",outline:"none"};
  const tecTotal=calcTecido(tecido,qty);
  const lb=(t)=><div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:$.bl,fontWeight:600,marginTop:12,marginBottom:6,paddingTop:8,borderTop:`1px solid ${$.bd}`}}>{t}</div>;
  const unit=tecido?.unit||"kg";
  const tog=(field)=>{const cur=tecido?.disabled||{};onTecidoChange({...tecido,disabled:{...cur,[field]:!cur[field]}});};
  const isOff=(field)=>tecido?.disabled?.[field];
  const chk=(field,label,children)=><div style={{opacity:isOff(field)?0.35:1,marginBottom:8}}>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
      <input type="checkbox" checked={!isOff(field)} onChange={()=>tog(field)} style={{accentColor:$.bl,cursor:"pointer"}}/>
      <label style={{fontSize:10,color:$.mu,cursor:"pointer"}} onClick={()=>tog(field)}>{label}</label>
    </div>
    {!isOff(field)&&children}
  </div>;

  return <div>
    {lb("🧵 Tecido (fórmula)")}
    <div style={{padding:10,background:$.s2,borderRadius:8,marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:11,color:$.mu}}>Unidade:</span>
        <button onClick={()=>onTecidoChange({...tecido,unit:"kg"})} style={{padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${unit==="kg"?$.bl:$.bd}`,background:unit==="kg"?$.bld:"transparent",color:unit==="kg"?$.bl:$.dm,fontFamily:"inherit"}}>kg</button>
        <button onClick={()=>onTecidoChange({...tecido,unit:"m"})} style={{padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${unit==="m"?$.bl:$.bd}`,background:unit==="m"?$.bld:"transparent",color:unit==="m"?$.bl:$.dm,fontFamily:"inherit"}}>metro</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {chk("preco",`Preço/${unit} (R$)`,<input type="number" step="0.01" value={tecido?.precoMetro||0} onChange={e=>onTecidoChange({...tecido,precoMetro:Number(e.target.value)})} style={{...ni,width:"100%"}}/>)}
        {chk("consumo",`Consumo/peça (${unit})`,<input type="number" step="0.01" value={tecido?.consumo||0} onChange={e=>onTecidoChange({...tecido,consumo:Number(e.target.value)})} style={{...ni,width:"100%"}}/>)}
        {chk("perda","Perda/desperdício (%)",<input type="number" value={tecido?.perdaPct||0} onChange={e=>onTecidoChange({...tecido,perdaPct:Number(e.target.value)})} style={{...ni,width:"100%"}}/>)}
        {chk("extra","Extra fixo (ribana, etc)",<input type="number" value={tecido?.custoExtra||0} onChange={e=>onTecidoChange({...tecido,custoExtra:Number(e.target.value)})} style={{...ni,width:"100%"}}/>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 8px",background:$.sf,borderRadius:6,marginTop:8}}>
        <span style={{color:$.mu}}>Tecido Total</span>
        <span style={{fontFamily:"monospace",fontWeight:600,color:$.gd}}>{fmt(tecTotal)}</span>
      </div>
      {qty>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:4}}>
        <span style={{color:$.dm}}>= ({!isOff("consumo")?(tecido?.consumo||0):0}{unit} × R${!isOff("preco")?(tecido?.precoMetro||0):0} × {qty}{!isOff("perda")?` × ${(1+(tecido?.perdaPct||0)/100).toFixed(2)}`:""}) {!isOff("extra")?`+ R$${tecido?.custoExtra||0}`:""}</span>
        <span style={{fontFamily:"monospace",color:$.dm}}>{fmt(tecTotal/qty)}/pç</span>
      </div>}
    </div>

    {lb("Custos Variáveis (por peça)")}
    {VARIAVEIS.map(k=><div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
      <span style={{fontSize:13,color:$.mu,minWidth:85}}>{CL[k]}</span>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10,color:$.dm}}>R$/pç</span>
        <input type="number" value={(costs&&costs[k])||0} onChange={e=>onChange({...costs,[k]:Number(e.target.value)})} style={ni}/>
        {showT&&qty>0&&<span style={{fontFamily:"monospace",fontSize:11,color:$.dm,width:85,textAlign:"right"}}>{fmt(((costs&&costs[k])||0)*qty)}</span>}
      </div>
    </div>)}

    {lb("Custos Fixos (total da produção)")}
    {FIXOS.map(k=><div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
      <span style={{fontSize:13,color:$.mu,minWidth:85}}>{CL[k]}</span>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10,color:$.dm}}>R$ total</span>
        <input type="number" value={(costs&&costs[k])||0} onChange={e=>onChange({...costs,[k]:Number(e.target.value)})} style={ni}/>
        {showT&&qty>0&&<span style={{fontFamily:"monospace",fontSize:11,color:$.dm,width:85,textAlign:"right"}}>{fmt(((costs&&costs[k])||0)/qty)}/pç</span>}
      </div>
    </div>)}
  </div>;
}
function Toasts(){const{toasts}=useApp();return <div style={{position:"fixed",bottom:20,right:20,zIndex:999,display:"flex",flexDirection:"column",gap:8}}>{toasts.map(t=><div key={t.id} style={{background:$.s2,border:`1px solid ${$.bd}`,borderRadius:10,padding:"12px 20px",fontSize:13,color:$.tx,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>{t.msg}</div>)}</div>;}

// ============================================================
// ORÇAMENTO
// ============================================================
function Orcamento({nav}){
  const{products,addProduct,addOrder}=useApp();
  const[nomePedido,setNomePedido]=useState("");const[cl,setCl]=useState("");const[prazo,setPrazo]=useState("");
  const emptySku=()=>({id:Date.now(),pid:products[0]?.id||1,qty:100,costs:{molde:80,corte:3,costura:15,estampas:10,transporte:200,insumo:300},tecido:{...DC_TECIDO},lP:25,iP:8,ppOv:null,desc:"",img:null});
  const[skus,setSkus]=useState([emptySku()]);
  const[activeSku,setActiveSku]=useState(0);

  const updSku=(i,u)=>setSkus(s=>s.map((sk,j)=>j===i?{...sk,...u}:sk));
  const addSku=()=>{setSkus(s=>[...s,emptySku()]);setActiveSku(skus.length);};
  const rmSku=(i)=>{if(skus.length<=1)return;const ns=skus.filter((_,j)=>j!==i);setSkus(ns);if(activeSku>=ns.length)setActiveSku(ns.length-1);};

  const calcSku=(sk)=>{
    const prod=products.find(p=>p.id===sk.pid);
    const ct=calcCustoTotal(sk.costs,sk.tecido,sk.qty);const cu=sk.qty>0?ct/sk.qty:0;
    let pp,pf,lucBruto,imposto,lucLiq,fLP=sk.lP;
    if(sk.ppOv!==null){
      pp=sk.ppOv;pf=pp*sk.qty;lucBruto=pf-ct;imposto=pf*(sk.iP/100);lucLiq=lucBruto-imposto;fLP=ct>0?(lucLiq/ct)*100:0;
    } else {
      // lucro% = lucro líquido desejado sobre o custo
      // lucLiq = ct * lP/100
      // imposto = pf * iP/100
      // pf = ct + lucBruto, lucBruto = lucLiq + imposto
      // pf = ct + lucLiq + imposto = ct + lucLiq + pf*iP/100
      // pf(1 - iP/100) = ct + lucLiq
      // pf = (ct + lucLiq) / (1 - iP/100)
      lucLiq=ct*(sk.lP/100);
      pf=(ct+lucLiq)/(1-sk.iP/100);
      imposto=pf*(sk.iP/100);
      lucBruto=pf-ct;
      pp=pf/(sk.qty||1);
    }
    return{prod,ct,cu,fLP,pf,pp,lucBruto,imposto,lucLiq};
  };

  const skuCalcs=skus.map(calcSku);
  const totalGeral=skuCalcs.reduce((s,c)=>s+c.pf,0);
  const totalCusto=skuCalcs.reduce((s,c)=>s+c.ct,0);
  const totalLucLiq=skuCalcs.reduce((s,c)=>s+c.lucLiq,0);
  const totalQty=skus.reduce((s,sk)=>s+sk.qty,0);

  const hSelProd=(i,id)=>{const p=products.find(x=>x.id===id);updSku(i,{pid:id,costs:p?.costs?{...p.costs}:{molde:80,corte:3,costura:15,estampas:10,transporte:200,insumo:300},tecido:p?.tecido?{...p.tecido}:{...DC_TECIDO},ppOv:null});};

  const hCreate=async()=>{
    if(!cl.trim())return;
    const skusData=skus.map((sk,i)=>{const c=skuCalcs[i];const costsPerPc={};FIXOS.forEach(k=>costsPerPc[k]=sk.qty>0?(sk.costs[k]||0)/sk.qty:0);VARIAVEIS.forEach(k=>costsPerPc[k]=sk.costs[k]||0);costsPerPc.tecido=sk.qty>0?calcTecido(sk.tecido,sk.qty)/sk.qty:0;
      return{product:c.prod?.name||"Produto",desc:sk.desc,qty:sk.qty,costs:costsPerPc,tecido:sk.tecido,costsTotais:{molde:sk.costs.molde,corte:sk.costs.corte*sk.qty,tecido:calcTecido(sk.tecido,sk.qty),costura:sk.costs.costura*sk.qty,estampas:sk.costs.estampas*sk.qty,transporte:sk.costs.transporte,insumo:sk.costs.insumo},custoTotal:c.ct,lucroP:Math.round(c.fLP*100)/100,impostoP:sk.iP,total:Math.round(c.pf*100)/100,pp:Math.round(c.pp*100)/100,lucBruto:c.lucBruto,imposto:c.imposto,lucLiq:c.lucLiq};
    });
    const mainSku=skusData[0];const total=Math.round(totalGeral*100)/100;const half=Math.round(total/2*100)/100;
    const result=await addOrder({client:cl,productId:skus[0].pid,product:nomePedido||skusData.map(s=>s.product).join(" + "),qty:totalQty,total,status:"Orçamento",date:new Date().toISOString().split("T")[0],prazo:prazo||null,costs:mainSku.costs,costsDetail:{skus:skusData,nomePedido:nomePedido||cl},custoReal:null,lucroP:mainSku.lucroP,impostoP:mainSku.impostoP,mockImage:skus[0].img,parcela1:{valor:half,data:"",pago:false},parcela2:{valor:Math.round((total-half)*100)/100,data:"",pago:false}});
    if(result)nav("pedidos");
  };

  const sk=skus[activeSku];const c=skuCalcs[activeSku];if(!sk||!c)return null;

  return <div><h2 style={{fontSize:20,fontWeight:700,marginBottom:20}}>Novo Orçamento</h2>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
      <div><label style={{fontSize:12,color:$.mu}}>Nome do Pedido</label><input value={nomePedido} onChange={e=>setNomePedido(e.target.value)} placeholder="Ex: Neon — Kit Moletom + Corta-vento" style={inp}/></div>
      <div><label style={{fontSize:12,color:$.mu}}>Cliente</label><input value={cl} onChange={e=>setCl(e.target.value)} placeholder="Nome do cliente" style={inp}/></div>
    </div>

    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      {skus.map((s,i)=>{const p=products.find(x=>x.id===s.pid);return <button key={s.id} onClick={()=>setActiveSku(i)} style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:activeSku===i?700:400,cursor:"pointer",border:`1px solid ${activeSku===i?$.bl:$.bd}`,background:activeSku===i?$.bld:$.sf,color:activeSku===i?$.bl:$.mu,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>SKU {i+1}: {p?.name||"?"} ×{s.qty}{skus.length>1&&<span onClick={e=>{e.stopPropagation();rmSku(i);}} style={{marginLeft:4,color:$.rd,fontWeight:700,cursor:"pointer"}}>×</span>}</button>;})}
      <Bt v="blue" onClick={addSku} style={{fontSize:11,padding:"6px 12px"}}>+ Adicionar SKU</Bt>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
      <Cd>
        <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>SKU {activeSku+1}</div>
        <label style={{fontSize:12,color:$.mu}}>Produto</label><select value={sk.pid} onChange={e=>hSelProd(activeSku,Number(e.target.value))} style={inp}>{products.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}</select>
        <label style={{fontSize:12,color:$.mu}}>Descrição/Obs</label><input value={sk.desc} onChange={e=>updSku(activeSku,{desc:e.target.value})} placeholder="Ex: com cordão, arte A..." style={inp}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={{fontSize:12,color:$.mu}}>Quantidade</label><input type="number" value={sk.qty} onChange={e=>updSku(activeSku,{qty:Number(e.target.value),ppOv:null})} style={inp}/></div><div><label style={{fontSize:12,color:$.mu}}>📅 Prazo</label><input type="date" value={prazo} onChange={e=>setPrazo(e.target.value)} style={inp}/></div></div>
        <ImgUp image={sk.img} onChange={img=>updSku(activeSku,{img})} label="Mock-up (opcional)"/>
        <div style={{borderTop:`1px solid ${$.bd}`,marginTop:16,paddingTop:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Custos da Produção</div><div style={{fontSize:11,color:$.dm,marginBottom:8}}>Fixos = total | Variáveis = por peça | Tecido = fórmula</div><CE costs={sk.costs} onChange={cs=>updSku(activeSku,{costs:cs,ppOv:null})} qty={sk.qty} tecido={sk.tecido} onTecidoChange={t=>updSku(activeSku,{tecido:t,ppOv:null})}/></div>
        <div style={{borderTop:`1px solid ${$.bd}`,marginTop:12,paddingTop:12,display:"flex",gap:12}}>
          <div style={{flex:1}}><label style={{fontSize:11,color:$.mu}}>Lucro Líquido %</label><input type="number" value={Math.round(c.fLP*100)/100} onChange={e=>updSku(activeSku,{lP:Number(e.target.value),ppOv:null})} style={{...inp,fontFamily:"monospace",marginTop:4}}/></div>
          <div style={{flex:1}}><label style={{fontSize:11,color:$.mu}}>Imposto %</label><input type="number" value={sk.iP} onChange={e=>updSku(activeSku,{iP:Number(e.target.value),ppOv:null})} style={{...inp,fontFamily:"monospace",marginTop:4}}/></div>
        </div>
      </Cd>
      <div>
        <Cd style={{marginBottom:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Resumo SKU {activeSku+1} — {c.prod?.name}</div>
          {[["Qtd",`${sk.qty} pç`],["Custo/Pç",fmt(c.cu)],["Custo Prod.",fmt(c.ct)],["Lucro Bruto",fmt(c.lucBruto)],[`Imposto ${sk.iP}%`,fmt(c.imposto)]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:$.mu}}>{l}</span><span style={{fontFamily:"monospace"}}>{v}</span></div>)}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6,padding:"6px 10px",background:"rgba(76,201,138,0.06)",borderRadius:6}}><span style={{color:$.gn,fontWeight:600}}>Lucro Líquido ({c.fLP.toFixed(1)}%)</span><span style={{fontFamily:"monospace",color:$.gn,fontWeight:700}}>{fmt(c.lucLiq)}</span></div>
          <div style={{borderTop:`1px solid ${$.bd}`,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>Total SKU</span><span style={{fontWeight:700,fontSize:16,color:$.gd,fontFamily:"monospace"}}>{fmt(c.pf)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,marginTop:8,padding:"8px 12px",background:$.s2,borderRadius:8,border:`1px solid ${$.bd}`}}>
            <span style={{color:$.gn,fontWeight:600}}>Preço/Peça</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,color:$.dm}}>R$</span><input type="number" step="0.01" value={sk.ppOv!==null?sk.ppOv:Math.round(c.pp*100)/100} onChange={e=>updSku(activeSku,{ppOv:Number(e.target.value)})} style={{width:95,background:$.s3,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 8px",color:$.gn,fontFamily:"monospace",fontSize:15,fontWeight:700,textAlign:"right",outline:"none"}}/></div>
          </div>
        </Cd>

        {skus.length>1&&<Cd style={{marginBottom:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>Resumo Total ({skus.length} SKUs)</div>
          {skuCalcs.map((sc,i)=>{const s=skus[i];const p=products.find(x=>x.id===s.pid);return <div key={s.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5,padding:"5px 8px",background:$.s2,borderRadius:6}}><span style={{color:$.mu}}>{p?.name} ×{s.qty}</span><span style={{fontFamily:"monospace",color:$.gd}}>{fmt(sc.pf)}</span></div>;})}
          <div style={{borderTop:`1px solid ${$.bd}`,marginTop:8,paddingTop:8}}>
            {[["Total Peças",`${totalQty} pç`],["Custo Total",fmt(totalCusto)],["Lucro Líquido Total",fmt(totalLucLiq)]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:$.mu}}>{l}</span><span style={{fontFamily:"monospace"}}>{v}</span></div>)}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{fontWeight:700,fontSize:15}}>TOTAL GERAL</span><span style={{fontWeight:700,fontSize:18,color:$.gd,fontFamily:"monospace"}}>{fmt(totalGeral)}</span></div>
          </div>
        </Cd>}

        <Bt onClick={hCreate} style={{width:"100%",justifyContent:"center",padding:"12px 20px",fontSize:14}}>Gerar Orçamento & Criar Pedido</Bt>
      </div>
    </div>
  </div>;
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard(){
  const{orders,pos}=useApp();const[exp,setExp]=useState(null);
  const fat=orders.reduce((s,o)=>s+o.total,0);const atv=orders.filter(o=>!["Entregue","Orçamento"].includes(o.status)).length;const ep=orders.filter(o=>o.status==="Em Produção").length;
  const ent=orders.filter(o=>o.status==="Entregue");const lr=ent.reduce((s,o)=>s+o.total-(o.custoReal?sum(o.custoReal)*o.qty:sum(o.costs)*o.qty),0);
  const pipe=SF.map(st=>{const f=orders.filter(o=>o.status===st);return{s:st,n:f.length,v:f.reduce((s,o)=>s+o.total,0)};});
  const rec=[...orders].sort((a,b)=>b.id-a.id).slice(0,8);
  return <div><h2 style={{fontSize:20,fontWeight:700,marginBottom:20}}>Dashboard</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}><KPI label="Faturamento" value={fmt(fat)} color={$.gd}/><KPI label="Ativos" value={atv}/><KPI label="Lucro Real" value={fmt(lr)} color={$.gn}/><KPI label="Produção" value={ep} color={$.or}/></div>
    <Cd style={{marginBottom:24}}><div style={{fontSize:14,fontWeight:700,marginBottom:16}}>Pipeline</div><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>{pipe.map((p,i)=><div key={p.s} style={{textAlign:"center"}}><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>{i>0&&<span style={{color:$.dm}}>→</span>}<Bd status={p.s}/></div><div style={{fontSize:20,fontWeight:700}}>{p.n}</div><div style={{fontSize:12,color:$.mu,fontFamily:"monospace"}}>{fmt(p.v)}</div></div>)}</div></Cd>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Cd><div style={{fontSize:14,fontWeight:700,marginBottom:16}}>Pedidos <span style={{fontSize:11,color:$.dm}}>clique p/ detalhes</span></div>
        {rec.map(o=>{const isE=exp===o.id;const po=pos.find(p=>p.pedidoId===o.id);
          return <div key={o.id}><div onClick={()=>setExp(isE?null:o.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${$.bd}`,cursor:"pointer"}}><div><span style={{fontWeight:700}}>#{o.id}</span><span style={{fontSize:13,marginLeft:8,fontWeight:600}}>{o.client}</span><span style={{color:$.dm,fontSize:12,marginLeft:6}}>{o.product}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}>{o.prazo&&<span style={{fontSize:10,color:$.or}}>📅{fD(o.prazo)}</span>}<span style={{fontFamily:"monospace",fontSize:12,color:$.gd}}>{fmt(o.total)}</span><Bd status={o.status}/></div></div>
            {isE&&<div style={{padding:10,background:$.s2,borderRadius:8,marginBottom:6,marginTop:4}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginBottom:8}}>{[["Qtd",`${o.qty}`],["Custo/Pç",fmt(sum(o.costs))],["Lucro",`${o.lucroP}%`],["Pç/Un",fmt(o.total/o.qty)],["Prazo",o.prazo?fD(o.prazo):"—"]].map(([l,v])=><div key={l} style={{padding:"5px 6px",background:$.sf,borderRadius:6}}><div style={{fontSize:9,color:$.mu,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"monospace",fontSize:12,fontWeight:600}}>{v}</div></div>)}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><div style={{padding:"5px 8px",background:$.sf,borderRadius:6,fontSize:11}}><span style={{color:$.mu}}>1ª </span><span style={{fontFamily:"monospace"}}>{fmt(o.parcela1?.valor)}</span> {o.parcela1?.pago?<span style={{color:$.gn}}>✓</span>:<span style={{color:$.rd}}>pend</span>}</div><div style={{padding:"5px 8px",background:$.sf,borderRadius:6,fontSize:11}}><span style={{color:$.mu}}>2ª </span><span style={{fontFamily:"monospace"}}>{fmt(o.parcela2?.valor)}</span> {o.parcela2?.pago?<span style={{color:$.gn}}>✓</span>:<span style={{color:$.rd}}>pend</span>}</div></div>
              {o.status==="Entregue"&&o.custoReal&&<div style={{fontSize:12,fontWeight:600,color:$.gn}}>Lucro: {fmt(o.total-sum(o.custoReal)*o.qty)}</div>}
              {po&&<div style={{fontSize:11,color:$.mu,marginTop:4}}>OP: <span style={{color:$.bl}}>{po.id}</span></div>}
            </div>}
          </div>;})}
      </Cd>
      <CalMonth/>
    </div>
  </div>;
}

// ============================================================
// CALENDÁRIO MENSAL
// ============================================================
function CalMonth(){
  const{orders,activities,addActivity,deleteActivity}=useApp();
  const[cm,setCm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const[sel,setSel]=useState(null);const[showA,setShowA]=useState(false);const[na,setNa]=useState("");
  const DN=["D","S","T","Q","Q","S","S"];const MN=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const evts=[...orders.filter(o=>o.status!=="Orçamento"&&o.prazo).map(o=>({t:"p",date:String(o.prazo).split("T")[0],label:`#${o.id} ${o.client}`,sub:o.product,status:o.status,id:`o${o.id}`})),...activities.map(a=>({t:"a",date:String(a.date).split("T")[0],label:a.title,id:`a${a.id}`,aid:a.id}))];
  const{y,m}=cm;const fd=new Date(y,m,1).getDay();const dim=new Date(y,m+1,0).getDate();
  const td=new Date();const ts=`${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,"0")}-${String(td.getDate()).padStart(2,"0")}`;
  const ds=(d)=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const ge=(d)=>evts.filter(e=>e.date===ds(d));
  const sds=sel?ds(sel):null;const se=sel?evts.filter(e=>e.date===sds):[];
  const ha=async()=>{if(!na.trim()||!sds)return;await addActivity({date:sds,title:na});setNa("");setShowA(false);};
  const cells=[];for(let i=0;i<fd;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);

  return <Cd>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <button onClick={()=>setCm(c=>c.m===0?{y:c.y-1,m:11}:{...c,m:c.m-1})} style={{background:"none",border:"none",color:$.tx,fontSize:20,cursor:"pointer",padding:"4px 12px"}}>‹</button>
      <div style={{fontSize:15,fontWeight:700}}>{MN[m]} {y}</div>
      <button onClick={()=>setCm(c=>c.m===11?{y:c.y+1,m:0}:{...c,m:c.m+1})} style={{background:"none",border:"none",color:$.tx,fontSize:20,cursor:"pointer",padding:"4px 12px"}}>›</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DN.map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:$.mu,fontWeight:600,padding:"4px 0"}}>{d}</div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{cells.map((day,i)=>{
      if(!day)return <div key={`e${i}`}/>;
      const dstr=ds(day);const ev=ge(day);const isT=dstr===ts;const isS=sel===day;const hp=ev.some(e=>e.t==="p");const ha2=ev.some(e=>e.t==="a");
      return <div key={day} onClick={()=>setSel(isS?null:day)} style={{textAlign:"center",padding:"7px 2px",borderRadius:10,cursor:"pointer",minHeight:40,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:isS?$.s3:isT?"rgba(76,126,201,0.15)":"transparent",border:isT?`1px solid ${$.bl}`:"1px solid transparent",transition:"all 0.15s"}}>
        <div style={{fontSize:13,fontWeight:isT||isS?700:400,color:isS?$.tx:isT?$.bl:$.tx}}>{day}</div>
        {(hp||ha2)&&<div style={{display:"flex",gap:2,marginTop:2}}>{hp&&<div style={{width:5,height:5,borderRadius:"50%",background:$.gd}}/>}{ha2&&<div style={{width:5,height:5,borderRadius:"50%",background:$.bl}}/>}</div>}
      </div>;
    })}</div>
    {sel&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${$.bd}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:13,fontWeight:700}}>{sel} de {MN[m]}</div><Bt v="blue" onClick={()=>setShowA(!showA)} style={{fontSize:10,padding:"3px 8px"}}>+ Atividade</Bt></div>
      {showA&&<div style={{display:"flex",gap:6,marginBottom:10}}><input value={na} onChange={e=>setNa(e.target.value)} placeholder="Nova atividade..." style={{flex:1,background:$.s2,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 8px",color:$.tx,fontFamily:"inherit",fontSize:12,outline:"none"}}/><Bt v="green" onClick={ha} style={{fontSize:10,padding:"3px 8px"}}>✓</Bt></div>}
      {se.length===0?<div style={{color:$.dm,fontSize:12}}>Sem eventos</div>:se.map(ev=><div key={ev.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",background:$.s2,borderRadius:6,marginBottom:4,borderLeft:`3px solid ${ev.t==="p"?$.gd:$.bl}`}}><div style={{fontSize:12}}>{ev.label}{ev.sub&&<span style={{color:$.dm,marginLeft:6}}>{ev.sub}</span>}</div><div style={{display:"flex",alignItems:"center",gap:4}}>{ev.t==="p"?<Bd status={ev.status}/>:<span style={{fontSize:9,background:$.bld,color:$.bl,padding:"1px 6px",borderRadius:4}}>Ativ.</span>}{ev.t==="a"&&<button onClick={()=>deleteActivity(ev.aid)} style={{background:"none",border:"none",color:$.dm,cursor:"pointer",fontSize:13}}>×</button>}</div></div>)}
    </div>}
    <div style={{display:"flex",gap:12,marginTop:10,paddingTop:8,borderTop:`1px solid ${$.bd}`}}><div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:$.mu}}><div style={{width:6,height:6,borderRadius:"50%",background:$.gd}}/>Prazos</div><div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:$.mu}}><div style={{width:6,height:6,borderRadius:"50%",background:$.bl}}/>Atividades</div></div>
  </Cd>;
}

// ============================================================
// PEDIDOS
// ============================================================
function genPDF(o){
  const skus=o.skus||[{product:o.product,qty:o.qty,pp:o.total/o.qty,total:o.total,desc:""}];
  const MN=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const d=new Date(o.date||Date.now());const dataStr=`São Paulo, ${d.getDate()} de ${MN[d.getMonth()]} de ${d.getFullYear()}`;
  let html=`<html><head><style>body{font-family:Arial,sans-serif;padding:40px;color:#222;max-width:800px;margin:auto}h1{font-size:14px;margin:0}h2{font-size:18px;text-align:center;margin:30px 0 5px}.sub{text-align:center;font-size:13px;color:#555;margin-bottom:20px}.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #222;padding-bottom:15px;margin-bottom:20px}.tag{background:#222;color:#fff;padding:4px 12px;font-size:11px;letter-spacing:2px}.info{font-size:11px;color:#555;line-height:1.6}table{width:100%;border-collapse:collapse;margin:15px 0}th{background:#f5f5f5;text-align:left;padding:8px 10px;font-size:11px;border:1px solid #ddd}td{padding:8px 10px;font-size:12px;border:1px solid #ddd}.ftr{margin-top:40px;padding-top:15px;border-top:1px solid #ddd;font-size:10px;color:#777;text-align:center;line-height:1.8}.cond{background:#f9f9f9;padding:15px;border-radius:6px;margin-top:25px;font-size:11px;line-height:1.8}.tot{font-weight:bold;background:#f0f0f0}@media print{body{padding:20px}}</style></head><body>`;
  html+=`<div class="hdr"><div><h1>SAGI COMÉRCIO E CONFECÇÃO DE VESTUÁRIO LTDA - ME</h1><div class="info">CNPJ: 62.581.777/0001-44</div></div><span class="tag">ORÇAMENTO</span></div>`;
  html+=`<h2>ORÇAMENTO COMERCIAL — TABELA DE PREÇOS</h2><div class="sub">CLIENTE: ${o.client}</div><div class="sub">${dataStr}</div>`;
  skus.forEach((s,i)=>{html+=`<h3 style="margin-top:25px;font-size:14px">${i+1}. ${s.product}</h3>`;if(s.desc)html+=`<div style="font-size:11px;color:#666;margin-bottom:8px">${s.desc}</div>`;html+=`<table><tr><th>Item</th><th>Quantidade</th><th>Preço Unitário</th><th>Total</th></tr><tr><td>${s.product}${s.desc?" - "+s.desc:""}</td><td>${s.qty} unidades</td><td>R$ ${(s.pp||0).toFixed(2)}</td><td>R$ ${(s.total||0).toFixed(2)}</td></tr></table>`;});
  if(skus.length>1){html+=`<table style="margin-top:20px"><tr><th>Resumo</th><th>Qtd Total</th><th></th><th>Total Geral</th></tr><tr class="tot"><td>${skus.length} itens</td><td>${skus.reduce((s,x)=>s+x.qty,0)} un</td><td></td><td>R$ ${(o.total||0).toFixed(2)}</td></tr></table>`;}
  html+=`<div class="cond"><strong>Condições Comerciais:</strong><br>• Prazo de entrega: ${o.prazo?fD(o.prazo):"A combinar"}<br>• Forma de pagamento: 50% no ato e 50% na entrega<br>• Validade do orçamento: 10 dias</div>`;
  html+=`<div class="ftr">SAGI COMÉRCIO E CONFECÇÃO DE VESTUÁRIO LTDA - ME<br>CNPJ: 62.581.777/0001-44<br>(11) 99578-8668</div></body></html>`;
  const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);
}

function Pedidos({nav}){
  const{orders,advanceStatus,updateOrder,deleteOrder,updatePO,pos}=useApp();const[fl,setFl]=useState("Todos");const[exp,setExp]=useState(null);const[edId,setEdId]=useState(null);
  const flt=fl==="Todos"?orders:orders.filter(o=>o.status===fl);const srt=[...flt].sort((a,b)=>b.id-a.id);
  return <div><h2 style={{fontSize:20,fontWeight:700,marginBottom:20}}>Pedidos</h2><TB tabs={["Todos",...SF]} active={fl} onChange={setFl}/>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>{srt.map(o=>{const isE=exp===o.id;const isEd=edId===o.id;const cu=sum(o.costs);const ct=cu*o.qty;const ca=SF.indexOf(o.status)<SF.length-1;const po=pos.find(p=>p.pedidoId===o.id);const hasSkus=o.skus&&o.skus.length>0;
      return <Cd key={o.id} hover onClick={()=>{if(!isEd)setExp(isE?null:o.id);}} style={{cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontWeight:700,fontSize:16}}>#{o.id}</span><div><div style={{fontWeight:700,fontSize:15}}>{o.nomePedido||o.client}</div><div style={{fontSize:12,color:$.mu}}>{hasSkus?`${o.skus.length} SKUs · ${o.qty} pç`:`${o.product} · ${o.qty} pç`}{o.prazo&&<span style={{marginLeft:6,color:$.or}}>📅 {fD(o.prazo)}</span>}</div></div></div><div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontFamily:"monospace",fontSize:15,color:$.gd,fontWeight:600}}>{fmt(o.total)}</span><Bd status={o.status}/><span style={{color:$.dm}}>{isE?"▲":"▼"}</span></div></div>
        {isE&&<div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${$.bd}`}} onClick={e=>e.stopPropagation()}>
          {isEd?<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
            <div><label style={{fontSize:11,color:$.mu}}>Cliente</label><input value={o.client} onChange={e=>updateOrder(o.id,{client:e.target.value})} style={{...inp,marginBottom:0,marginTop:4}}/></div>
            <div><label style={{fontSize:11,color:$.mu}}>Produto</label><input value={o.product} onChange={e=>updateOrder(o.id,{product:e.target.value})} style={{...inp,marginBottom:0,marginTop:4}}/></div>
            <div><label style={{fontSize:11,color:$.mu}}>Qtd</label><input type="number" value={o.qty} onChange={e=>updateOrder(o.id,{qty:Number(e.target.value)})} style={{...inp,marginBottom:0,marginTop:4}}/></div>
            <div><label style={{fontSize:11,color:$.mu}}>Prazo</label><input type="date" value={o.prazo?String(o.prazo).split("T")[0]:""} onChange={e=>updateOrder(o.id,{prazo:e.target.value})} style={{...inp,marginBottom:0,marginTop:4}}/></div>
          </div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Custos por Peça</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>{CK.map(k=><div key={k} style={{padding:"6px 8px",background:$.s2,borderRadius:6}}>
            <div style={{fontSize:10,color:$.mu,marginBottom:4}}>{CL[k]}</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:10,color:$.dm}}>R$</span><input type="number" step="0.01" value={o.costs?.[k]||0} onChange={e=>{const nc={...o.costs,[k]:Number(e.target.value)};updateOrder(o.id,{costs:nc});}} style={{width:"100%",background:$.s3,border:`1px solid ${$.bd}`,borderRadius:4,padding:"4px 6px",color:$.tx,fontFamily:"monospace",fontSize:12,textAlign:"right",outline:"none"}}/></div>
          </div>)}</div>
          <Bt v="green" onClick={()=>setEdId(null)} style={{fontSize:12}}>✓ Salvar</Bt><Bt v="muted" onClick={()=>setEdId(null)} style={{fontSize:12,marginLeft:8}}>Fechar</Bt></div>
          :<>
            {hasSkus&&<div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,marginBottom:8}}>SKUs do Pedido</div>
              {o.skus.map((s,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,padding:"8px 10px",background:$.s2,borderRadius:8,marginBottom:4,fontSize:12}}>
                <div><div style={{fontWeight:600}}>{s.product}</div>{s.desc&&<div style={{fontSize:10,color:$.dm}}>{s.desc}</div>}</div>
                <div style={{color:$.mu}}>{s.qty} pç</div>
                <div style={{fontFamily:"monospace"}}>{fmt(s.pp||0)}/pç</div>
                <div style={{fontFamily:"monospace",color:$.gd,fontWeight:600}}>{fmt(s.total||0)}</div>
              </div>)}
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:$.s3,borderRadius:8,marginTop:4,fontSize:13,fontWeight:700}}><span>Total ({o.skus.length} SKUs)</span><span style={{color:$.gd,fontFamily:"monospace"}}>{fmt(o.total)}</span></div>
            </div>}
            {!hasSkus&&<><div style={{fontSize:12,fontWeight:700,marginBottom:6}}>Custos por Categoria</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>{CK.map(k=>{const perPc=o.costs?.[k]||0;const total=perPc*o.qty;const detTotal=o.costsDetail?.[k];return <div key={k} style={{padding:"5px 8px",background:$.s2,borderRadius:6,fontSize:11}}>
              <div style={{color:$.mu,marginBottom:2}}>{CL[k]}</div>
              <div style={{fontFamily:"monospace",fontWeight:600}}>{fmt(perPc)}/pç</div>
              <div style={{fontFamily:"monospace",color:$.dm,fontSize:10}}>{fmt(detTotal||total)} total</div>
            </div>})}</div></>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>{[["Custo",fmt(ct)],[`Lucro ${o.lucroP}%`,fmt(ct*o.lucroP/100)],["Pç/Un",fmt(o.total/o.qty)],["Total",fmt(o.total)]].map(([l,v])=><div key={l} style={{padding:"6px 8px",background:$.s2,borderRadius:6}}><div style={{fontSize:10,color:$.mu,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600}}>{v}</div></div>)}</div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Pagamentos</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              <div style={{padding:10,background:$.s2,borderRadius:8}}><div style={{fontSize:11,color:$.mu,marginBottom:5}}>1ª Parcela</div><div style={{display:"flex",gap:6,marginBottom:5}}><span style={{fontSize:11,color:$.dm,marginTop:5}}>R$</span><input type="number" value={o.parcela1?.valor||0} onChange={e=>updateOrder(o.id,{parcela1:{...o.parcela1,valor:Number(e.target.value)}})} style={{flex:1,background:$.s3,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 7px",color:$.tx,fontFamily:"monospace",fontSize:13,outline:"none"}}/></div><input type="date" value={o.parcela1?.data||""} onChange={e=>updateOrder(o.id,{parcela1:{...o.parcela1,data:e.target.value}})} style={{width:"100%",background:$.s3,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 7px",color:$.tx,fontSize:12,outline:"none",marginBottom:5}}/><label style={{fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><input type="checkbox" checked={o.parcela1?.pago||false} onChange={e=>updateOrder(o.id,{parcela1:{...o.parcela1,pago:e.target.checked}})}/><span style={{color:o.parcela1?.pago?$.gn:$.rd,fontWeight:600}}>{o.parcela1?.pago?"✓ Pago":"Pendente"}</span></label></div>
              <div style={{padding:10,background:$.s2,borderRadius:8}}><div style={{fontSize:11,color:$.mu,marginBottom:5}}>2ª Parcela</div><div style={{display:"flex",gap:6,marginBottom:5}}><span style={{fontSize:11,color:$.dm,marginTop:5}}>R$</span><input type="number" value={o.parcela2?.valor||0} onChange={e=>updateOrder(o.id,{parcela2:{...o.parcela2,valor:Number(e.target.value)}})} style={{flex:1,background:$.s3,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 7px",color:$.tx,fontFamily:"monospace",fontSize:13,outline:"none"}}/></div><input type="date" value={o.parcela2?.data||""} onChange={e=>updateOrder(o.id,{parcela2:{...o.parcela2,data:e.target.value}})} style={{width:"100%",background:$.s3,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 7px",color:$.tx,fontSize:12,outline:"none",marginBottom:5}}/><label style={{fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><input type="checkbox" checked={o.parcela2?.pago||false} onChange={e=>updateOrder(o.id,{parcela2:{...o.parcela2,pago:e.target.checked}})}/><span style={{color:o.parcela2?.pago?$.gn:$.rd,fontWeight:600}}>{o.parcela2?.pago?"✓ Pago":"Pendente"}</span></label></div>
            </div>
            {o.status==="Entregue"&&o.custoReal&&<div style={{padding:8,background:$.s2,borderRadius:8,marginBottom:10,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>{CK.map(k=>{const d=(o.costs?.[k]||0)-(o.custoReal?.[k]||0);return <div key={k} style={{fontSize:10,padding:"3px 5px",background:$.sf,borderRadius:4}}><div style={{color:$.mu}}>{CL[k]}</div><div style={{fontFamily:"monospace",color:d>=0?$.gn:$.rd}}>{d>=0?"+":""}{fmt(d)}</div></div>;})}</div>}
            <ImgUp image={o.mockImage} onChange={(img)=>{updateOrder(o.id,{mockImage:img});if(po)updatePO(po.id,{ficha:{...po.ficha,mockFrente:img||""}});}} label={o.mockImage?"Alterar":"📷 Mock-up"}/>
            <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}><Bt v="gold" onClick={()=>genPDF(o)}>📄 Gerar PDF</Bt>{ca&&<Bt v="green" onClick={()=>advanceStatus(o.id)}>→ {SF[SF.indexOf(o.status)+1]}</Bt>}{po&&<Bt v="blue" onClick={()=>nav("po",po.id)}>{po.id}</Bt>}<Bt v="muted" onClick={()=>setEdId(o.id)}>✏️</Bt><Bt v="red" onClick={()=>{if(confirm(`Deletar #${o.id}?`))deleteOrder(o.id);}}>🗑</Bt></div>
          </>}
        </div>}
      </Cd>;})}</div>
  </div>;
}

// ============================================================
// PRODUÇÃO
// ============================================================
function Producao({nav}){const{pos}=useApp();return <div><h2 style={{fontSize:20,fontWeight:700,marginBottom:20}}>Produção</h2>{pos.map(po=><Cd key={po.id} hover onClick={()=>nav("po",po.id)} style={{cursor:"pointer",marginBottom:12}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontWeight:700,color:$.bl}}>{po.id}</span><div><div style={{fontWeight:600}}>{po.client}</div><div style={{fontSize:12,color:$.mu}}>{po.product} · {po.qty} pç</div></div></div><span style={{color:$.dm}}>→</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>{Object.entries(po.sectors||{}).map(([s,st])=><div key={s} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:$.s2,borderRadius:8}}><span style={{fontSize:12,fontWeight:600,textTransform:"capitalize"}}>{s}</span><SB status={st}/></div>)}</div></Cd>)}</div>;}

function PODetail({poId,nav}){
  const{pos,orders,updatePO,updatePOSector,updatePOCustoReal,updateOrder}=useApp();const po=pos.find(p=>p.id===poId);const[tab,setTab]=useState("Ficha");
  if(!po)return <div><Bt v="muted" onClick={()=>nav("producao")}>← Voltar</Bt> OP não encontrada.</div>;
  const f=po.ficha||{};const lo=orders.find(o=>o.id===po.pedidoId);const mi=f.mockFrente||lo?.mockImage||null;
  const is={width:"100%",background:$.s2,border:`1px solid ${$.bd}`,borderRadius:8,padding:"10px 14px",color:$.tx,fontFamily:"inherit",fontSize:14,marginTop:4,outline:"none"};
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><Bt v="muted" onClick={()=>nav("producao")}>←</Bt><h2 style={{fontSize:18,fontWeight:700}}>{po.id} — {po.product}</h2><span style={{fontSize:13,color:$.mu}}>{po.client} · {po.qty} pç</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:20}}>{Object.entries(po.sectors||{}).map(([s,st])=><Cd key={s} style={{padding:10,textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,textTransform:"capitalize",marginBottom:6}}>{s}</div><SB status={st}/><div style={{marginTop:6,display:"flex",gap:3,justifyContent:"center"}}>{SS.map(x=><button key={x} onClick={()=>updatePOSector(poId,s,x)} style={{fontSize:8,padding:"2px 5px",borderRadius:3,border:`1px solid ${$.bd}`,background:st===x?$.s3:"transparent",color:st===x?$.tx:$.dm,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize"}}>{x}</button>)}</div></Cd>)}</div>
    <TB tabs={["Ficha","Custos Reais","Corte","Estampa","Costura"]} active={tab} onChange={setTab}/>
    {tab==="Ficha"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Cd>{f.grade&&<><div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Grade</div><div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>{Object.entries(f.grade).map(([s,q])=><div key={s} style={{textAlign:"center",padding:8,background:$.s2,borderRadius:8}}><div style={{fontSize:10,color:$.mu}}>{s}</div><div style={{fontSize:15,fontWeight:700}}>{q}</div></div>)}</div></>}<div style={{marginTop:12,fontSize:13}}>{f.descricao}</div></Cd><div>{mi?<Cd style={{marginBottom:16,textAlign:"center"}}><img src={mi} alt="M" style={{maxWidth:"100%",maxHeight:220,borderRadius:10,border:`1px solid ${$.bd}`,objectFit:"contain",background:$.s2}}/></Cd>:<Cd style={{marginBottom:16}}><div style={{padding:16,border:`2px dashed ${$.bd}`,borderRadius:10,textAlign:"center",color:$.dm,fontSize:12}}>Sem mock-up</div></Cd>}{f.impressao&&<Cd>{[["Frente",f.impressao.frentePosicao],["Costas",f.impressao.costasPosicao],["Manga",f.impressao.mangaPosicao]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span style={{color:$.mu}}>{l}</span><span>{v}</span></div>)}</Cd>}</div></div>}
    {tab==="Custos Reais"&&<Cd><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><div>{CK.map(k=><div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:13,color:$.mu,minWidth:85}}>{CL[k]}</span><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,color:$.dm}}>R$</span><input type="number" value={po.custosReais?.[k]||0} onChange={e=>updatePOCustoReal(poId,k,Number(e.target.value))} style={{width:65,background:$.s2,border:`1px solid ${$.bd}`,borderRadius:6,padding:"5px 8px",color:$.tx,fontFamily:"monospace",fontSize:13,textAlign:"right",outline:"none"}}/></div></div>)}<Bt v="green" onClick={()=>{if(lo)updateOrder(lo.id,{custoReal:{...po.custosReais}});}} style={{marginTop:12,width:"100%"}}>💾 Salvar</Bt></div><div><div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Previsto vs Real</div>{lo&&CK.map(k=>{const p=lo.costs?.[k]||0;const r=po.custosReais?.[k]||0;const d=p-r;return <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5,padding:"5px 8px",background:$.s2,borderRadius:6,fontSize:12}}><span style={{color:$.mu}}>{CL[k]}</span><span style={{fontFamily:"monospace"}}>{fmt(p)}→{fmt(r)}</span><span style={{fontFamily:"monospace",color:d>=0?$.gn:$.rd}}>{d>=0?"+":""}{fmt(d)}</span></div>;})}</div></div></Cd>}
    {tab==="Corte"&&<Cd><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={{fontSize:12,color:$.mu}}>Enfesto</label><input value={po.enfesto||""} onChange={e=>updatePO(poId,{enfesto:e.target.value})} style={is}/></div><div><label style={{fontSize:12,color:$.mu}}>Total Cortado</label><input value={po.totalCortado||""} onChange={e=>updatePO(poId,{totalCortado:e.target.value})} style={is}/></div></div></Cd>}
    {tab==="Estampa"&&<Cd>{mi&&<div style={{marginBottom:14,textAlign:"center"}}><img src={mi} alt="M" style={{maxWidth:"100%",maxHeight:180,borderRadius:10,border:`1px solid ${$.bd}`,objectFit:"contain",background:$.s2}}/></div>}<label style={{fontSize:12,color:$.mu}}>Total Silkado</label><input value={po.totalSilkado||""} onChange={e=>updatePO(poId,{totalSilkado:e.target.value})} style={is}/></Cd>}
    {tab==="Costura"&&<Cd><div style={{padding:10,background:$.s2,borderRadius:8,marginBottom:12}}><div style={{fontSize:12,color:$.mu}}>Valor/Pç</div><div style={{fontFamily:"monospace",fontSize:18,fontWeight:700,color:$.gd}}>{fmt(f.valorCostura||0)}</div></div><label style={{fontSize:12,color:$.mu}}>Total Costurado</label><input value={po.totalCosturado||""} onChange={e=>updatePO(poId,{totalCosturado:e.target.value})} style={is}/></Cd>}
  </div>;
}

// ============================================================
// FINANCEIRO
// ============================================================
function Financeiro(){
  const{orders}=useApp();const ent=orders.filter(o=>o.status==="Entregue");const fat=orders.reduce((s,o)=>s+o.total,0);
  const cr=[];const cp=[];
  orders.filter(o=>o.status!=="Orçamento").forEach(o=>{[o.parcela1,o.parcela2].forEach((p,i)=>{if(!p)return;const it={oid:o.id,cl:o.client,n:i+1,v:p.valor,d:p.data,pg:p.pago};if(p.pago)cp.push(it);else cr.push(it);});});
  const tr=cr.reduce((s,c)=>s+c.v,0);const tc=cp.reduce((s,c)=>s+c.v,0);
  const lr=ent.reduce((s,o)=>s+o.total-(o.custoReal?sum(o.custoReal)*o.qty:sum(o.costs)*o.qty),0);
  return <div><h2 style={{fontSize:20,fontWeight:700,marginBottom:20}}>Financeiro</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}><KPI label="Faturamento" value={fmt(fat)} color={$.gd}/><KPI label="Recebido" value={fmt(tc)} color={$.gn} sub="pago"/><KPI label="A Receber" value={fmt(tr)} color={$.or} sub="pendente"/><KPI label="Lucro Real" value={fmt(lr)} color={$.gn}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
      <Cd><div style={{fontSize:14,fontWeight:700,marginBottom:14,color:$.or}}>💰 A Receber</div>{cr.length===0?<div style={{color:$.dm,fontSize:13}}>Tudo recebido!</div>:cr.map((c,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 8px",background:$.s2,borderRadius:8,marginBottom:5}}><div><span style={{fontWeight:600,fontSize:13}}>#{c.oid}</span><span style={{color:$.mu,fontSize:12,marginLeft:6}}>{c.cl}</span><span style={{color:$.dm,fontSize:11,marginLeft:4}}>{c.n}ª</span></div><div style={{textAlign:"right"}}><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:$.or}}>{fmt(c.v)}</div>{c.d&&<div style={{fontSize:10,color:$.dm}}>{fD(c.d)}</div>}</div></div>)}</Cd>
      <Cd><div style={{fontSize:14,fontWeight:700,marginBottom:14,color:$.gn}}>✓ Recebido</div>{cp.length===0?<div style={{color:$.dm,fontSize:13}}>—</div>:cp.map((c,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 8px",background:$.s2,borderRadius:8,marginBottom:5}}><div><span style={{fontWeight:600,fontSize:13}}>#{c.oid}</span><span style={{color:$.mu,fontSize:12,marginLeft:6}}>{c.cl}</span><span style={{color:$.dm,fontSize:11,marginLeft:4}}>{c.n}ª</span></div><div style={{fontFamily:"monospace",fontSize:13,fontWeight:600,color:$.gn}}>{fmt(c.v)}</div></div>)}</Cd>
    </div>
    <Cd><div style={{fontSize:14,fontWeight:700,marginBottom:14}}>Entregues</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,fontSize:12}}><thead><tr>{["#","Cliente","Qtd","Venda","Saldo","Lucro"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 6px",fontSize:10,color:$.mu,borderBottom:`1px solid ${$.bd}`,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{ent.map(o=>{const pt=sum(o.costs)*o.qty;const rt=o.custoReal?sum(o.custoReal)*o.qty:0;const sd=pt-rt;const lc=o.total-(o.custoReal?rt:pt);return <tr key={o.id}><td style={{padding:"8px 6px",borderBottom:`1px solid ${$.bd}`,fontWeight:700}}>#{o.id}</td><td style={{padding:"8px 6px",borderBottom:`1px solid ${$.bd}`}}>{o.client}</td><td style={{padding:"8px 6px",borderBottom:`1px solid ${$.bd}`}}>{o.qty}</td><td style={{padding:"8px 6px",borderBottom:`1px solid ${$.bd}`,fontFamily:"monospace",color:$.gd}}>{fmt(o.total)}</td><td style={{padding:"8px 6px",borderBottom:`1px solid ${$.bd}`,fontFamily:"monospace",color:sd>=0?$.gn:$.rd}}>{o.custoReal?`${sd>=0?"+":""}${fmt(sd)}`:"—"}</td><td style={{padding:"8px 6px",borderBottom:`1px solid ${$.bd}`,fontFamily:"monospace",color:$.gn,fontWeight:600}}>{fmt(lc)}</td></tr>;})}</tbody></table></div></Cd>
  </div>;
}

// ============================================================
// PRODUTOS
// ============================================================
function ProdutosPage(){
  const{products,updateProduct,addProduct,deleteProduct}=useApp();const[ed,setEd]=useState(null);const[sn,setSn]=useState(false);const[nn,setNn]=useState("");const[nc,setNc]=useState("Camiseta");
  const[ncs,setNcs]=useState({molde:80,corte:3,costura:15,estampas:10,transporte:200,insumo:300});
  const[ntec,setNtec]=useState({...DC_TECIDO});
  const hAdd=async()=>{if(!nn.trim())return;await addProduct({name:nn,price:0,category:nc,emoji:"👕",costs:{...ncs},tecido:{...ntec}});setSn(false);setNn("");};
  return <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><h2 style={{fontSize:20,fontWeight:700}}>Produtos</h2><Bt onClick={()=>setSn(!sn)}>+ Novo</Bt></div>
    {sn&&<Cd style={{marginBottom:20}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><div><label style={{fontSize:12,color:$.mu}}>Nome</label><input value={nn} onChange={e=>setNn(e.target.value)} style={{...inp,marginTop:4}}/><label style={{fontSize:12,color:$.mu}}>Categoria</label><select value={nc} onChange={e=>setNc(e.target.value)} style={{...inp,marginTop:4}}>{["Camiseta","Moletom","Jaqueta","Acessório","Outro"].map(c=><option key={c}>{c}</option>)}</select></div><div><div style={{fontSize:12,color:$.mu,marginBottom:8}}>Custos Base</div><CE costs={ncs} onChange={setNcs} qty={0} tecido={ntec} onTecidoChange={setNtec} showT={false}/></div></div><Bt v="green" onClick={hAdd} style={{marginTop:12}}>Cadastrar</Bt></Cd>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{products.map(p=>{const isEd=ed===p.id;return <Cd key={p.id} hover onClick={()=>!isEd&&setEd(p.id)} style={{cursor:"pointer"}}><div style={{fontSize:32,marginBottom:10}}>{p.emoji}</div>{isEd?<div onClick={e=>e.stopPropagation()}><input value={p.name} onChange={e=>updateProduct(p.id,{name:e.target.value})} style={{width:"100%",background:$.s2,border:`1px solid ${$.bd}`,borderRadius:6,padding:"7px 8px",color:$.tx,fontFamily:"inherit",fontSize:14,fontWeight:700,outline:"none",marginBottom:8}}/>
      <CE costs={p.costs||{molde:80,corte:3,costura:15,estampas:10,transporte:200,insumo:300}} onChange={c=>updateProduct(p.id,{costs:c})} qty={0} tecido={p.tecido||DC_TECIDO} onTecidoChange={t=>updateProduct(p.id,{tecido:t})} showT={false}/>
      <div style={{marginTop:8,display:"flex",gap:6}}><Bt v="green" onClick={()=>setEd(null)} style={{fontSize:12}}>✓</Bt><Bt v="red" onClick={async()=>{if(confirm(`Remover "${p.name}"?`)){await deleteProduct(p.id);setEd(null);}}} style={{fontSize:12}}>🗑</Bt></div></div>:<><div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{p.name}</div><div style={{fontSize:12,color:$.mu,marginBottom:8}}>{p.category}</div><div style={{fontSize:11,color:$.dm,marginTop:6}}>Clique p/ editar custos</div></>}</Cd>;})}</div>
  </div>;
}

// ============================================================
// LEADS
// ============================================================
function LeadsPage(){
  const{leads,addLead,updateLead,deleteLead}=useApp();const[sn,setSn]=useState(false);const[ed,setEd]=useState(null);const[n,setN]=useState({nome:"",empresa:"",contexto:"",ultimoContato:"",fup:"",temperatura:"frio"});
  const hAdd=async()=>{if(!n.nome.trim())return;await addLead(n);setN({nome:"",empresa:"",contexto:"",ultimoContato:"",fup:"",temperatura:"frio"});setSn(false);};
  const is2={width:"100%",background:$.s2,border:`1px solid ${$.bd}`,borderRadius:8,padding:"10px 14px",color:$.tx,fontFamily:"inherit",fontSize:14,outline:"none",marginTop:4,marginBottom:10};
  const TempToggle=({temp,onChange})=><div style={{display:"flex",gap:4}}>
    <button onClick={()=>onChange("quente")} style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${temp==="quente"?"rgba(201,76,76,0.4)":$.bd}`,background:temp==="quente"?$.rdd:"transparent",color:temp==="quente"?$.rd:$.dm,fontFamily:"inherit"}}>🔥 Quente</button>
    <button onClick={()=>onChange("frio")} style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${temp==="frio"?"rgba(76,126,201,0.4)":$.bd}`,background:temp==="frio"?$.bld:"transparent",color:temp==="frio"?$.bl:$.dm,fontFamily:"inherit"}}>❄️ Frio</button>
  </div>;
  const TempBadge=({temp})=><span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:temp==="quente"?$.rdd:$.bld,color:temp==="quente"?$.rd:$.bl,border:`1px solid ${temp==="quente"?"rgba(201,76,76,0.3)":"rgba(76,126,201,0.3)"}`}}>{temp==="quente"?"🔥 Quente":"❄️ Frio"}</span>;
  return <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><h2 style={{fontSize:20,fontWeight:700}}>Leads</h2><Bt onClick={()=>setSn(!sn)}>+ Novo Lead</Bt></div>
    {sn&&<Cd style={{marginBottom:20}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><div><label style={{fontSize:12,color:$.mu}}>Nome</label><input value={n.nome} onChange={e=>setN({...n,nome:e.target.value})} style={is2}/><label style={{fontSize:12,color:$.mu}}>Empresa</label><input value={n.empresa} onChange={e=>setN({...n,empresa:e.target.value})} style={is2}/><label style={{fontSize:12,color:$.mu}}>Contexto</label><input value={n.contexto} onChange={e=>setN({...n,contexto:e.target.value})} style={is2}/></div><div><label style={{fontSize:12,color:$.mu}}>Último Contato</label><input type="date" value={n.ultimoContato} onChange={e=>setN({...n,ultimoContato:e.target.value})} style={is2}/><label style={{fontSize:12,color:$.mu}}>FUP</label><input value={n.fup} onChange={e=>setN({...n,fup:e.target.value})} placeholder="Próximo passo..." style={is2}/><label style={{fontSize:12,color:$.mu,display:"block",marginBottom:4}}>Temperatura</label><TempToggle temp={n.temperatura} onChange={t=>setN({...n,temperatura:t})}/></div></div><Bt v="green" onClick={hAdd} style={{marginTop:12}}>Adicionar</Bt></Cd>}
    <div style={{display:"flex",flexDirection:"column",gap:10}}>{leads.map(l=>{const isEd=ed===l.id;return <Cd key={l.id} hover>{isEd?<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}><div><label style={{fontSize:11,color:$.mu}}>Nome</label><input value={l.nome} onChange={e=>updateLead(l.id,{nome:e.target.value})} style={{...is2,marginBottom:0}}/></div><div><label style={{fontSize:11,color:$.mu}}>Empresa</label><input value={l.empresa} onChange={e=>updateLead(l.id,{empresa:e.target.value})} style={{...is2,marginBottom:0}}/></div><div><label style={{fontSize:11,color:$.mu}}>Contexto</label><input value={l.contexto} onChange={e=>updateLead(l.id,{contexto:e.target.value})} style={{...is2,marginBottom:0}}/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}><div><label style={{fontSize:11,color:$.mu}}>Contato</label><input type="date" value={l.ultimoContato?String(l.ultimoContato).split("T")[0]:""} onChange={e=>updateLead(l.id,{ultimoContato:e.target.value})} style={{...is2,marginBottom:0}}/></div><div><label style={{fontSize:11,color:$.mu}}>FUP</label><input value={l.fup} onChange={e=>updateLead(l.id,{fup:e.target.value})} style={{...is2,marginBottom:0}}/></div><div><label style={{fontSize:11,color:$.mu}}>Temperatura</label><div style={{marginTop:4}}><TempToggle temp={l.temperatura||"frio"} onChange={t=>updateLead(l.id,{temperatura:t})}/></div></div></div><div style={{display:"flex",gap:6}}><Bt v="green" onClick={()=>setEd(null)} style={{fontSize:12}}>✓</Bt><Bt v="red" onClick={async()=>{await deleteLead(l.id);setEd(null);}} style={{fontSize:12}}>🗑</Bt></div></div>
      :<div onClick={()=>setEd(l.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:38,height:38,borderRadius:10,background:l.temperatura==="quente"?$.rdd:$.bld,color:l.temperatura==="quente"?$.rd:$.bl,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14}}>{(l.nome||"?").charAt(0)}</div><div><div style={{fontWeight:700,fontSize:14}}>{l.nome}</div><div style={{fontSize:12,color:$.mu}}>{l.empresa}</div></div></div><div style={{display:"flex",alignItems:"center",gap:12}}><TempBadge temp={l.temperatura||"frio"}/><div style={{textAlign:"right"}}><div style={{fontSize:12,color:$.mu}}>{l.contexto}</div><div style={{fontSize:11,color:$.dm}}>{l.ultimoContato?fD(l.ultimoContato):""}</div></div><div style={{padding:"5px 10px",background:$.ord,borderRadius:8,fontSize:12,color:$.or,fontWeight:600}}>{l.fup||"—"}</div></div></div>}</Cd>;})}</div>
  </div>;
}

// ============================================================
// MAIN
// ============================================================
const NAV=[{id:"orcamento",label:"Orçamento",icon:"🧮"},{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"pedidos",label:"Pedidos",icon:"📦"},{id:"producao",label:"Produção",icon:"🏭"},{id:"financeiro",label:"Financeiro",icon:"💰"},{id:"produtos",label:"Produtos",icon:"👕"},{id:"leads",label:"Leads",icon:"🎯"}];

function AppContent(){
  const[page,setPage]=useState("orcamento");const[poId,setPoId]=useState(null);
  const nav=(p,id)=>{if(p==="po"){setPage("po");setPoId(id);}else{setPage(p);if(id)setPoId(id);}};
  // Render all persistent pages but hide inactive ones to preserve state
  return <div style={{display:"flex",minHeight:"100vh",background:$.bg,color:$.tx,fontFamily:"'DM Sans',sans-serif"}}>
    <div style={{width:200,background:$.sf,borderRight:`1px solid ${$.bd}`,padding:"24px 10px",position:"fixed",top:0,bottom:0,overflowY:"auto",zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 6px",marginBottom:28}}><div style={{width:32,height:32,borderRadius:8,background:$.gdd,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👕</div><div><div style={{fontWeight:900,fontSize:16}}>SALIBA</div><div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:$.mu}}>ERP</div></div></div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>{NAV.map(i=>{const a=page===i.id||(page==="po"&&i.id==="producao");return <button key={i.id} onClick={()=>nav(i.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:8,background:a?$.s3:"transparent",color:a?$.tx:$.mu,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:a?600:400,cursor:"pointer",textAlign:"left",width:"100%"}}><span style={{fontSize:14}}>{i.icon}</span>{i.label}</button>;})}</div>
    </div>
    <div style={{marginLeft:200,flex:1,padding:24,minHeight:"100vh"}}>
      <div style={{display:page==="orcamento"?"block":"none"}}><Orcamento nav={nav}/></div>
      <div style={{display:page==="dashboard"?"block":"none"}}><Dashboard/></div>
      <div style={{display:page==="pedidos"?"block":"none"}}><Pedidos nav={nav}/></div>
      <div style={{display:page==="producao"?"block":"none"}}><Producao nav={nav}/></div>
      <div style={{display:page==="financeiro"?"block":"none"}}><Financeiro/></div>
      <div style={{display:page==="produtos"?"block":"none"}}><ProdutosPage/></div>
      <div style={{display:page==="leads"?"block":"none"}}><LeadsPage/></div>
      {page==="po"&&<PODetail poId={poId} nav={nav}/>}
    </div>
    <Toasts/>
  </div>;
}

export default function App(){return <Provider><AppContent/></Provider>;}
