import { Buffer } from "node:buffer";

// Small self-contained XLSX writer for campaign summary tables; avoids a new runtime dependency.
// ZIP STORE (method 0) with deterministic CRC32, no formulas or macros.
const ZIP_VERSION = 20;
const crcTable = Array.from({length:256},(_,i)=>{
  let x=i;
  for(let k=0;k<8;k++) x=(x&1)?(0xedb88320^(x>>>1)):(x>>>1);
  return x>>>0;
});
function crc32(buffer){
  let c=0xffffffff;
  for(const x of buffer) c=crcTable[(c^x)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function zip(files){
  const parts=[], directory=[];
  let offset=0;
  for(const [name,text] of files){
    const filename=Buffer.from(name), body=Buffer.from(text);
    const checksum=crc32(body);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(ZIP_VERSION,4);
    local.writeUInt16LE(0,6); // no data descriptor
    local.writeUInt16LE(0,8); // STORE method
    local.writeUInt32LE(checksum,14);
    local.writeUInt32LE(body.length,18);
    local.writeUInt32LE(body.length,22);
    local.writeUInt16LE(filename.length,26);
    parts.push(local,filename,body);
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);
    central.writeUInt16LE(ZIP_VERSION,4);
    central.writeUInt16LE(ZIP_VERSION,6);
    central.writeUInt32LE(checksum,16);
    central.writeUInt32LE(body.length,20);
    central.writeUInt32LE(body.length,24);
    central.writeUInt16LE(filename.length,28);
    central.writeUInt32LE(offset,42);
    directory.push(central,filename);
    offset+=local.length+filename.length+body.length;
  }
  const dir=Buffer.concat(directory);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(dir.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,dir,end]);
}
function xml(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
}
function safe(value) {
  const s=String(value ?? "").slice(0,32767);
  return /^[=+@\t\r]/.test(s) || /^-(?!\d)/.test(s) ? "'"+s : s;
}
function col(index) {
  let s="";
  for(let x=index;x>0;x=Math.floor((x-1)/26)) s=String.fromCharCode(65+(x-1)%26)+s;
  return s;
}
function cell(value,row,column,style=0){
  const addr=col(column)+row;
  if(typeof value==="number" && Number.isFinite(value))
    return '<c r="'+addr+'" s="'+style+'"><v>'+value+'</v></c>';
  return '<c r="'+addr+'" s="'+style+'" t="inlineStr"><is><t>'+xml(safe(value))+'</t></is></c>';
}
function sheet(rows,merges=[]){
  const data=rows.map((r,i)=>{
    const attrs=r.map((entry,j)=>{
      const value=entry && typeof entry==="object" && "value" in entry ? entry.value : entry;
      const style=entry && typeof entry==="object" && "style" in entry ? entry.style : 0;
      return value===null || value===undefined ? "" : cell(value,i+1,j+1,style);
    }).join("");
    return '<row r="'+(i+1)+'">'+attrs+'</row>';
  }).join("");
  const merged=merges.length?'<mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join("")+'</mergeCells>':"";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="17"/><cols><col min="1" max="1" width="17" customWidth="1"/>'+
    '<col min="2" max="100" width="21" customWidth="1"/></cols>'+
    '<sheetData>'+data+'</sheetData>'+merged+'</worksheet>';
}
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
'<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>'+
'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
'<fill><patternFill patternType="solid"><fgColor rgb="FF163C72"/><bgColor indexed="64"/></patternFill></fill></fills>'+
'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'+
'</styleSheet>';
const mark=(value,style=0)=>({value,style});
const reportFilters = report => {
  const filters=report.filters??{};
  return [
    ["Product", filters.product??"All"],["Platform",filters.platform??"All"],
    ["Plan ID",filters.plan??"All"],["Parameter / UTM",filters.parameter??"All"],
    ["Landing Page",filters.landing??"All"],["Referral",filters.referral??"All"],
    ["Campaign",filters.campaign??"All"],
  ];
};

export function generateCampaignXlsx(report) {
  const dates=[...report.dateWise];
  const dims=["platform","plan","parameter"];
  const names=dims.map(d=>report.dimensions[d].map(x=>x.label));
  const selectedFilters=reportFilters(report);
  const filterRows=selectedFilters.map(([key,value])=>["Filter: "+key,value]);
  const rows=[
    [mark("CAMPAIGN TRACKING & ANALYTICS",1)],
    ["Product: "+(report.filters.product??"All"),"Date range: "+(report.filters.start??"")+" to "+(report.filters.end??""),"Timezone: Asia/Karachi"],
    ...filterRows,
    [],
  ];
  const group=[mark("Date",1),mark("Total Subs",1)];
  const headers=[mark("Date",1),mark("Subs",1)];
  const merges=[];
  const headingRow=rows.length+1;
  let column=3;
  for(let i=0;i<3;i++){
    const category=i===0?"Platform":i===1?"Plan IDs":"Parameter / UTM";
    const count=Math.max(1,names[i].length);
    group.push(mark(category,1));
    for(let j=1;j<count;j++) group.push(null);
    if(count>1) merges.push(col(column)+headingRow+":"+col(column+count-1)+headingRow);
    for(const n of names[i].length?names[i]:["—"]) headers.push(mark(n,1));
    column+=count;
  }
  rows.push(group,headers);
  for(const row of dates){
    const r=[row.date,row.subs];
    for(let i=0;i<3;i++) for(const n of (names[i].length?names[i]:["—"]))
      r.push(n==="—"?"":(row[dims[i]][n]??0));
    rows.push(r);
  }
  const total=[mark("TOTAL",1),mark(report.totals.subs,1)];
  for(let i=0;i<3;i++) for(const n of (names[i].length?names[i]:["—"])){
    const v=report.dimensions[dims[i]].find(x=>x.label===n)?.subs??0;
    total.push(mark(v,1));
  }
  rows.push(total);
  rows.push(["Verified Gross (minor units)",report.totals.revenueMinor]);
  merges.push("A1:"+col(Math.max(3,column-1))+"1");

  const breakdown=[
    [mark("CAMPAIGN TRACKING & ANALYTICS · BASIC / DETAILED",1)],
    ["Same verified subscriptions grouped three different ways. Never sum across dimensions."],
    ["Period",String(report.filters.start??"")+" to "+String(report.filters.end??""),"Total Subs",report.totals.subs],
    ["Verified Gross (minor units)",report.totals.revenueMinor,"Timezone","Asia/Karachi"],
    ...filterRows,
    [],
  ];
  for(let i=0;i<3;i++){
    const label=i===0?"Platform-wise Subs":i===1?"Plan ID-wise Subs":"Parameter/UTM-wise Subs";
    breakdown.push([mark(label,1)]);
    breakdown.push([mark("Dimension",1),mark("Subs",1)]);
    for(const item of report.dimensions[dims[i]]) breakdown.push([item.label,item.subs]);
    breakdown.push([mark("Total",1),mark(report.totals.subs,1)]);
    breakdown.push([]);
  }

  const files=[
    ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Date-wise Subs" sheetId="1" r:id="rId1"/><sheet name="Basic and Detailed" sheetId="2" r:id="rId2"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml",styles],
    ["xl/worksheets/sheet1.xml",sheet(rows,merges)],
    ["xl/worksheets/sheet2.xml",sheet(breakdown,["A1:D1"])],
  ];
  return zip(files);
}
