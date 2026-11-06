export class OrderTemplateParser {
  static parse(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return null;
    if (lines[0].toUpperCase() !== "PEDIDO") return null;
    const errors = [];
    const data = { items: [], entrega: null, direccion: null, nombre: null, telefono: null, observaciones: null };
    const itemLines = [];
    const known = new Set(["producto","variante","cantidad","entrega","direccion","nombre","telefono","observaciones","items"]);
    function nk(k){ return String(k||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
    for (let i=1;i<lines.length;i++){
      const line=lines[i];
      if (line.startsWith("-")){ itemLines.push(line.slice(1).trim()); continue; }
      const m=line.match(/^([^:]+):\s*(.*)$/);
      if(!m){ errors.push(`Linea no reconocida: "${line}"`); continue; }
      const key=nk(m[1]); const value=m[2].trim();
      if (key==="items") continue;
      if (!known.has(key)){ errors.push(`Linea no reconocida: "${line}"`); continue; }
      switch(key){
        case "producto": data.items.push({productoTexto:value,varianteTexto:null,cantidadTexto:null}); break;
        case "variante": if(data.items.length) data.items[data.items.length-1].varianteTexto=value||null; break;
        case "cantidad": if(data.items.length) data.items[data.items.length-1].cantidadTexto=value; break;
        case "entrega": data.entrega=value; break;
        case "direccion": data.direccion=value; break;
        case "nombre": data.nombre=value; break;
        case "telefono": data.telefono=value; break;
        case "observaciones": data.observaciones=value; break;
      }
    }
    if (itemLines.length>0){
      const parsed=[];
      for(const il of itemLines){
        const parts=il.split("|").map(p=>p.trim());
        const item={productoTexto:null,varianteTexto:null,cantidadTexto:null};
        for(const p of parts){
          const mm=p.match(/^([^:]+):\s*(.*)$/);
          if(!mm) continue;
          const k=nk(mm[1]); const v=mm[2].trim();
          if(k==="producto") item.productoTexto=v;
          else if(k==="variante") item.varianteTexto=v||null;
          else if(k==="cantidad") item.cantidadTexto=v;
        }
        parsed.push(item);
      }
      if(parsed.length) data.items=parsed;
    }
    if(!data.nombre) errors.push("Falta el campo Nombre");
    const ok=errors.length===0;
    if(!ok) return {ok:false,errors,data};
    return {ok:true,data,errors:[]};
  }
}
export default OrderTemplateParser;
