import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import BottomNav from "../components/BottomNav";
import PmBmBadge from "../components/PmBmBadge";
import { supabase } from "../lib/supabase";

// ═══ Supabase row → UI 형식 매퍼 (DCMI 스키마 ↔ 기존 INIT_ASSETS 모양) ═══
// DB에는 line 컬럼이 없어 location 키워드로 추론 (기존 parseCSV와 동일 규칙)
const inferLine = (loc) => {
  const u = (loc || "").toUpperCase();
  if (u.includes("PRESS")) return "PRESS";
  if (u.includes("CCB") || u.includes("QXI") || u.includes("AI3") || u.includes("SU2I") || u.includes("BI3") || u.includes("BN7I")) return "CCB";
  if (u.includes("PROJECTION")) return "PROJECTION";
  if (u.includes("PS7I") || u.includes("FSB") || u.includes("RSB") || u.includes("FRAM")) return "FRAM";
  return "COMMON";
};
const mapSupabaseAsset = (r) => {
  // DB status값(active/idle 등) → UI status값(Active/Idle-NR 등)
  const stMap = { active: "Active", idle: "Idle-NR", idle_r: "Idle-R", idle_nr: "Idle-NR", fixed_sale: "Fixed-Sale" };
  const cat = r.asset_classes?.category_code || r?.extra?.major_code || (r.asset_class_code || "").split(".")[0] || "";
  return {
    id: r.id || "",
    no: r.machine_asset_number || "",
    name: r.name_en || "",
    model: r.model || "",
    make: r.make || "",
    line: inferLine(r.location),
    cat,
    status: stMap[r.status] || (r.status ? r.status[0].toUpperCase() + r.status.slice(1) : "Active"),
    location: r.location || "",
  };
};

// ═══ 다국어 ═══
const T = {
  ko:{ appName:"DSC FMS 포털", appSub:"Daechang Seat · Chennai Plant", welcome:"안녕하세요", role:"생산/기술/보전/생산관리 총괄",
    nav:{overview:"개요",dashboard:"대시보드",asset:"설비",master:"설비 마스터",avail:"가동률 OEE",maint:"보전",bm:"BM 이력",pm:"PM Plan",wo:"작업지시",inv:"재고",parts:"부품/재고",analytics:"분석",kpi:"KPI 리포트",system:"시스템",team:"팀 관리",settings:"설정"},
    status:{done:"완료",sched:"예정",delay:"지연",prog:"진행중"},
    bmUrgent:"BM 긴급",pmToday:"PM 오늘",idleR:"Idle(R)",idleNR:"Idle(NR)",
    settings:{title:"설정",lang:"언어 설정",langSub:"앱 표시 언어를 선택하세요",users:"사용자 목록",addUser:"신규 사용자",name:"이름",email:"이메일",dept:"부서",role:"역할",status:"상태",actions:"액션",active:"활성",pending:"승인대기",edit:"편집",approve:"승인",permissions:"카테고리별 권한",permSub:"신규 사용자 기본 권한",read:"읽기",write:"쓰기",none:"없음",save:"저장",cancel:"취소",saved:"저장됨"},
  },
  en:{ appName:"DSC FMS Portal", appSub:"Daechang Seat · Chennai Plant", welcome:"Hello", role:"Production / Tech / Maintenance GM",
    nav:{overview:"Overview",dashboard:"Dashboard",asset:"Assets",master:"Asset Master",avail:"Availability OEE",maint:"Maintenance",bm:"BM History",pm:"PM Plan",wo:"Work Order",inv:"Inventory",parts:"Parts / Stock",analytics:"Analytics",kpi:"KPI Report",system:"System",team:"Team",settings:"Settings"},
    status:{done:"Done",sched:"Scheduled",delay:"Overdue",prog:"In Progress"},
    bmUrgent:"BM Urgent",pmToday:"PM Today",idleR:"Idle(R)",idleNR:"Idle(NR)",
    settings:{title:"Settings",lang:"Language",langSub:"Select display language",users:"User List",addUser:"Add User",name:"Name",email:"Email",dept:"Dept",role:"Role",status:"Status",actions:"Actions",active:"Active",pending:"Pending",edit:"Edit",approve:"Approve",permissions:"Category Permissions",permSub:"Default permissions for new users",read:"Read",write:"Write",none:"None",save:"Save",cancel:"Cancel",saved:"Saved"},
  },
  hi:{ appName:"DSC FMS पोर्टल", appSub:"Daechang Seat · चेन्नई प्लांट", welcome:"नमस्ते", role:"उत्पादन/तकनीक/रखरखाव प्रमुख",
    nav:{overview:"अवलोकन",dashboard:"डैशबोर्ड",asset:"संपत्ति",master:"एसेट मास्टर",avail:"उपलब्धता OEE",maint:"रखरखाव",bm:"BM इतिहास",pm:"PM योजना",wo:"कार्य आदेश",inv:"इन्वेंटरी",parts:"पुर्जे",analytics:"विश्लेषण",kpi:"KPI रिपोर्ट",system:"सिस्टम",team:"टीम",settings:"सेटिंग्स"},
    status:{done:"पूर्ण",sched:"निर्धारित",delay:"विलंबित",prog:"प्रगति में"},
    bmUrgent:"BM आपातकाल",pmToday:"PM आज",idleR:"Idle(R)",idleNR:"Idle(NR)",
    settings:{title:"सेटिंग्स",lang:"भाषा",langSub:"भाषा चुनें",users:"उपयोगकर्ता",addUser:"नया उपयोगकर्ता",name:"नाम",email:"ईमेल",dept:"विभाग",role:"भूमिका",status:"स्थिति",actions:"कार्रवाई",active:"सक्रिय",pending:"लंबित",edit:"संपादित",approve:"स्वीकृत",permissions:"अनुमतियाँ",permSub:"नए उपयोगकर्ताओं के लिए",read:"पढ़ें",write:"लिखें",none:"कोई नहीं",save:"सहेजें",cancel:"रद्द",saved:"सहेजा गया"},
  },
  ta:{ appName:"DSC FMS போர்டல்", appSub:"Daechang Seat · சென்னை ஆலை", welcome:"வணக்கம்", role:"உற்பத்தி/தொழில்நுட்பம்/பராமரிப்பு தலைவர்",
    nav:{overview:"கண்ணோட்டம்",dashboard:"டாஷ்போர்டு",asset:"சொத்துக்கள்",master:"சொத்து பட்டியல்",avail:"கிடைக்கும் தன்மை OEE",maint:"பராமரிப்பு",bm:"BM வரலாறு",pm:"PM திட்டம்",wo:"பணி உத்தரவு",inv:"சரக்கு",parts:"பாகங்கள்",analytics:"பகுப்பாய்வு",kpi:"KPI அறிக்கை",system:"அமைப்பு",team:"குழு",settings:"அமைப்புகள்"},
    status:{done:"முடிந்தது",sched:"திட்டமிட்டது",delay:"தாமதம்",prog:"நடப்பில்"},
    bmUrgent:"BM அவசரம்",pmToday:"PM இன்று",idleR:"Idle(R)",idleNR:"Idle(NR)",
    settings:{title:"அமைப்புகள்",lang:"மொழி",langSub:"மொழியை தேர்ந்தெடுக்கவும்",users:"பயனர் பட்டியல்",addUser:"புதிய பயனர்",name:"பெயர்",email:"மின்னஞ்சல்",dept:"துறை",role:"பங்கு",status:"நிலை",actions:"செயல்கள்",active:"செயலில்",pending:"நிலுவையில்",edit:"திருத்து",approve:"அனுமதி",permissions:"அனுமதிகள்",permSub:"புதிய பயனர்களுக்கான இயல்புநிலை",read:"படி",write:"எழுது",none:"இல்லை",save:"சேமி",cancel:"ரத்து",saved:"சேமிக்கப்பட்டது"},
  },
};
const LANG_LABELS={ko:"한국어",en:"English",hi:"हिन्दी",ta:"தமிழ்"};
const LANG_FLAGS={ko:"🇰🇷",en:"🇬🇧",hi:"🇮🇳",ta:"🇮🇳"};

// ═══ 실제 설비 데이터 (엑셀 전체 시트 기반) ═══
const INIT_ASSETS = [
  // 01 UTILITY
  {no:"DCMI-UTL-PSF-01",name:"SUB STATION",model:"EB-SUB STATION",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"EB YARD"},
  {no:"DCMI-UTL-PSF-02",name:"VCB-01",model:"EB-VCB",make:"SIEMENS",line:"COMMON",cat:"01",status:"Active",location:"MV PANNEL ROOM"},
  {no:"DCMI-UTL-PSF-03",name:"VCB-02",model:"EB-VCB",make:"SIEMENS",line:"COMMON",cat:"01",status:"Active",location:"MV PANNEL ROOM"},
  {no:"DCMI-UTL-PSF-04",name:"HT POWER TRANSFORMER-01",model:"1000KVA",make:"TRINITY",line:"COMMON",cat:"01",status:"Active",location:"TRANSFORMER YARD"},
  {no:"DCMI-UTL-PSF-05",name:"HT POWER TRANSFORMER-02",model:"1000KVA",make:"TRINITY",line:"COMMON",cat:"01",status:"Active",location:"TRANSFORMER YARD"},
  {no:"DCMI-LTP-MVP-01",name:"MV PANNEL-01 (1000KVA TR1)",model:"15 OUTPUT SWITCH",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"EB PANNEL ROOM"},
  {no:"DCMI-LTP-MVP-02",name:"MV PANNEL-02 (1000KVA TR2)",model:"12 OUTPUT SWITCH",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"EB PANNEL ROOM"},
  {no:"DCMI-LTP-MVP-03",name:"MV PANNEL-03 (300KVA UPS)",model:"10 OUTPUT SWITCH",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"EB PANNEL ROOM"},
  {no:"DCMI-LTP-SSB-01",name:"SSB-01",model:"630A/SW-08",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT-01 COMPRESSOR ROOM"},
  {no:"DCMI-LTP-SSB-02",name:"SSB-02",model:"630A/SW-08",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT-01 SHOP FLOOR"},
  {no:"DCMI-LTP-SSB-03",name:"SSB-03",model:"630A/SW-08",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT-01 SHOP FLOOR"},
  {no:"DCMI-LTP-SSB-04",name:"SSB-04",model:"630A/SW-09",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT-01 SHOP FLOOR"},
  {no:"DCMI-LTP-SSB-05",name:"SSB-05",model:"630A/SW-10",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT-01 SHOP FLOOR"},
  {no:"DCMI-LTP-SSB-15",name:"SSB-15",model:"630A/SW-10",make:"NILL",line:"PRESS",cat:"01",status:"Active",location:"PLANT-02 PRESS SHOP"},
  {no:"DCMI-LTP-SSB-16",name:"SSB-16",model:"630A/SW-12",make:"NILL",line:"PRESS",cat:"01",status:"Active",location:"PLANT-02 PRESS SHOP"},
  {no:"DCMI-LTP-SSB-19",name:"SSB-19",model:"400A/SW-10",make:"NILL",line:"CCB",cat:"01",status:"Active",location:"PLANT-03 SU2I CCB"},
  {no:"DCMI-LTP-SSB-20",name:"SSB-20",model:"630A/SW-14",make:"NILL",line:"CCB",cat:"01",status:"Active",location:"PLANT-04 BN7I LINE"},
  {no:"DCMI-LTP-CBP-01",name:"CAPACITOR BANK PANNEL",model:"200KVAR",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"EB PANNEL ROOM"},
  {no:"DCMI-LTP-RBP-01",name:"REACTOR BANK PANNEL",model:"300KVAR",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"EB PANNEL ROOM"},
  {no:"DCMI-UTL-CMP-01",name:"AIR COMPRESSOR 50HP-01",model:"BSD 72-1034",make:"KAESER",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-01"},
  {no:"DCMI-UTL-CMP-02",name:"AIR COMPRESSOR 50HP-02",model:"BSD 72-2515",make:"KAESER",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-01"},
  {no:"DCMI-UTL-CMP-03",name:"AIR COMPRESSOR 50HP-03",model:"BSD 72-1109",make:"KAESER",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-02"},
  {no:"DCMI-UTL-CMP-04",name:"AIR COMPRESSOR 100HP-04",model:"CSDX 137-1676",make:"KAESER",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-02"},
  {no:"DCMI-UTL-CMP-05",name:"AIR COMPRESSOR 100HP-05",model:"CSDX 140T",make:"KAYSER",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-03"},
  {no:"DCMI-UTL-DIR-01",name:"AIR DRYER-01",model:"ELIX 080 DA",make:"SUMMITS",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-01"},
  {no:"DCMI-UTL-DIR-02",name:"AIR DRYER-02",model:"FDI-1910A",make:"DELAIR",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-02"},
  {no:"DCMI-UTL-RCR-01",name:"AIR RECEIVER TANK-01",model:"2KL",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-01"},
  {no:"DCMI-UTL-RCR-02",name:"AIR RECEIVER TANK-02",model:"5KL",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"COMPRESSOR ROOM-02"},
  {no:"DCMI-UTL-GSF-01",name:"GAS PLANT - CO2",model:"20TON",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"GAS PLANT"},
  {no:"DCMI-UTL-GSF-02",name:"GAS PLANT - ARGON",model:"6KL",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"GAS PLANT"},
  {no:"DCMI-UTL-GSF-03",name:"GAS PLANT - NITROGEN",model:"6KL",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"GAS PLANT"},
  {no:"DCMI-UTL-GSF-04",name:"GAS PLANT - ARGON MIXER",model:"6KL",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"GAS PLANT"},
  {no:"DCMI-UTL-ALF-01",name:"COOLING TOWER-01",model:"100TR",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT TOP SIDE"},
  {no:"DCMI-UTL-ALF-02",name:"COOLING TOWER-02",model:"100TR",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"PLANT TOP SIDE"},
  {no:"DCMI-UTL-DCF-01",name:"STP PLANT",model:"40KL",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"STP PLANT AREA"},
  {no:"DCMI-UTL-MHC-01",name:"EOT CRANE 10TON",model:"EOT CRANE",make:"HINGETECH",line:"PRESS",cat:"01",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-UTL-MHF-01",name:"FORKLIFT 3TON-01",model:"3TON GX300",make:"GODREJ",line:"COMMON",cat:"01",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-UTL-MHF-02",name:"FORKLIFT 3TON-03",model:"3TON GX300D",make:"GODREJ",line:"COMMON",cat:"01",status:"Active",location:"MATERIALS INCOMING"},
  {no:"DCMI-UTL-MHS-01",name:"SCISSOR LIFTER 1",model:"2TON",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"MATERIALS INCOMING"},
  {no:"DCMI-UTL-MHS-02",name:"SCISSOR LIFTER 2",model:"2TON",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"SALES DISPATCH"},
  {no:"DCMI-UTL-MHS-03",name:"SCISSOR LIFTER 3",model:"2TON",make:"NILL",line:"COMMON",cat:"01",status:"Active",location:"CANTEEN AREA"},
  {no:"DCMI-UTL-MHO-01",name:"ELECTRIC STACKER 1500KG",model:"VXHSE-1500",make:"VANJAX",line:"COMMON",cat:"01",status:"Active",location:"SHOP FLOOR"},
  {no:"DCMI-UTL-UPS-01",name:"UPS 150KVA",model:"WPU1503",make:"WORLD POWER",line:"COMMON",cat:"01",status:"Active",location:"UPS ROOM"},
  {no:"DCMI-UTL-UPS-02",name:"UPS 300KVA",model:"KR33300T",make:"UPS",line:"COMMON",cat:"01",status:"Active",location:"UPS ROOM"},
  {no:"DCMI-UTL-UPS-03",name:"UPS 10KVA",model:"9E10KS-IN",make:"EATON",line:"COMMON",cat:"01",status:"Active",location:"UPS ROOM"},
  // 02 PROCESS
  {no:"DCMI-TLS-LTM-01",name:"LATHE MACHINE",model:"HL-460",make:"HWACHON",line:"COMMON",cat:"02",status:"Active",location:"TOOL ROOM"},
  {no:"DCMI-TLS-MLM-01",name:"MILLING MACHINE",model:"HMTH-1100",make:"HWACHON",line:"COMMON",cat:"02",status:"Active",location:"TOOL ROOM"},
  {no:"DCMI-TLS-MLM-02",name:"MILLING MACHINE",model:"4ES",make:"ESTEAM",line:"COMMON",cat:"02",status:"Active",location:"TOOL ROOM"},
  {no:"DCMI-TLS-SGM-01",name:"SURFACE GRINDING MACHINE",model:"PFG-2550AH",make:"PERFECT M/C",line:"COMMON",cat:"02",status:"Active",location:"TOOL ROOM"},
  // 03 PRESS
  {no:"DCMI-PRS-02(A2)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-03(A3)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-04(A4)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-05(A5)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-06(A6)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-07(A7)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-08(A8)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-09(A9)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-10(A10)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-12(A12)",name:"SAMHO 160TON",model:"160TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-13(A13)",name:"SANGYONG 150TON",model:"150TON",make:"SANGYONG",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-15(B2)",name:"SIMPAC 200TON",model:"200TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-16(B3)",name:"SIMPAC 200TON",model:"200TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-17(B4)",name:"SIMPAC 200TON",model:"200TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-18(B5)",name:"SIMPAC 200TON",model:"200TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-19(B6)",name:"SIMPAC 200TON",model:"200TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-20(B7)",name:"SIMPAC 200TON",model:"200TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-21(B8)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-22(B9)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-23(B10)",name:"SAMHO 200TON",model:"200TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-24(B11)",name:"KUKIL 110TON",model:"110TON",make:"KUKIL",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-25(B12)",name:"KUKIL 110TON",model:"110TON",make:"KUKIL",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-26(B13)",name:"KUKIL 110TON",model:"110TON",make:"KUKIL",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-27(C1)",name:"SAMHO 300TON",model:"300TON",make:"SAMHO",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-28(C2)",name:"SIMPAC 250TON",model:"250TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-29(C3)",name:"SIMPAC 250TON",model:"250TON",make:"SIMPAC",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-30(C4)",name:"KUKIL 250TON",model:"250TON",make:"KUKIL",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-31(C5)",name:"KUKIL 250TON",model:"250TON",make:"KUKIL",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCLF-01",name:"NC LEVEL FEEDER-01",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCLF-02",name:"NC LEVEL FEEDER-02",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCLF-03",name:"NC LEVEL FEEDER-03",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCLF-04",name:"NC LEVEL FEEDER-04",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCLF-05",name:"NC LEVEL FEEDER-05",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCCF-01",name:"NC COIL FEEDER-01",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCCF-02",name:"NC COIL FEEDER-02",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCCF-03",name:"NC COIL FEEDER-03",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCCF-04",name:"NC COIL FEEDER-04",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-NCCF-05",name:"NC COIL FEEDER-05",model:"DM-NCLF-800M",make:"KDM",line:"PRESS",cat:"03",status:"Active",location:"PRESS SHOP"},
  {no:"DCMI-PRS-HYD-01",name:"HYDRAULIC PRESS 80TON",model:"DYMSP-80",make:"DAEYANG",line:"PRESS",cat:"03",status:"Active",location:"PS7I"},
  {no:"DCMI-PRS-HYD-02",name:"HYDRAULIC PRESS 80TON",model:"DYMSP-80",make:"DAEYANG",line:"PRESS",cat:"03",status:"Active",location:"PS7I"},
  // 04 ROBOT - FRAM
  {no:"DCMI-FRM-CRT-01",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-02",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SPARE"},
  {no:"DCMI-FRM-CRT-04",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-05",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-06",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-07",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-08",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-09",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HH01L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-10",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-11",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-12",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-13",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-14",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-15",name:"ARC WELD ROBOT-FIXED",model:"HI5-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-16",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-17",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-FRM-CRT-18",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-FRM-CRT-19",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-20",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-21",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-22",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-23",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-24",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-25",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-26",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-27",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-28",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-29",name:"ARC WELD ROBOT-FIXED",model:"HI5a-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-30",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006-04",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-FRM-CRT-31",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006-04",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3/BI3"},
  {no:"DCMI-FRM-CRT-32",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-33",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-34",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-35",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-36",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-37",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-38",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-39",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-40",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-41",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-FRM-CRT-42",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-FRM-CRT-43",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-FRM-CRT-44",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-45",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL/AI3"},
  {no:"DCMI-FRM-CRT-46",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-47",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-48",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-49",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-50",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HH01L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-51",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-52",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-53",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-54",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-55",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-56",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-57",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-96",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-97",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI/AI3 PIPE JOINT"},
  {no:"DCMI-FRM-CRT-98",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-99",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-100",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-120",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-121",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-122",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-GP25/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-123",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-GP25/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-CRT-124",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-125",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-GP25/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CRT-126",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-FRM-CRT-127",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-128",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-129",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-FRM-CRT-132",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-133",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-134",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"PS7I FL"},
  {no:"DCMI-FRM-CRT-135",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"FRAM",cat:"04",status:"Active",location:"SPARE"},
  {no:"DCMI-FRM-CRT-136",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-FRM-CRT-137",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SPARE"},
  {no:"DCMI-FRM-CRT-141",name:"ARC WELD ROBOT-FIXED",model:"HI5s-S30/HH010L",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"SPARE"},
  {no:"DCMI-FRM-CRT-142",name:"ARC WELD ROBOT-FIXED",model:"HI-N39-04/HA006",make:"HYUNDAI",line:"FRAM",cat:"04",status:"Active",location:"QXI/AI3"},
  // 04 ROBOT - CCB
  {no:"DCMI-CCB-CRT-58",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-59",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-60",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-62",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-63",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-64",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-65",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-66",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-67",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-68",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-69",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-70",name:"ARC WELD ROBOT-TURN TABLE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-71",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-72",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-73",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-74",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-75",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-76",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-77",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-78",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-79",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-80",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-81",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-82",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-83",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-84",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-85",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-86",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-87",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-88",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-89",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-CRT-90",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-91",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-92",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-93",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-94",name:"ARC WELD ROBOT-SLIDE",model:"TM-1400WGIII/P350",make:"PANASONIC",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-95",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-CRT-101",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-102",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-103",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-104",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-105",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-106",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-107",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-108",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-109",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-110",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-111",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-112",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-CRT-113",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-114",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-115",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-116",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-117",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-118",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-119",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-130",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-131",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-CRT-138",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-139",name:"ARC WELD ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-CRT-140",name:"ARC WELD ROBOT-FIXED",model:"HI5-N30-04/HA006",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3 PIPE JOINT"},
  {no:"DCMI-CCB-CRT-143",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-CRT-144",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-CRT-145",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-CRT-146",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-CRT-147",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-CRT-148",name:"ARC WELD ROBOT-FIXED",model:"MOTOMAN-AR1440/X350",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-TST-01",name:"TEST ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-TST-02",name:"TEST ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-TST-03",name:"TEST ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-TST-04",name:"TEST ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-TST-05",name:"TEST ROBOT-FIXED",model:"MOTOMAN-AR1440",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-TST-06",name:"TEST ROBOT-FIXED",model:"HI5a-S30/HA006B",make:"HYUNDAI",line:"CCB",cat:"04",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-TST-07",name:"TEST ROBOT-FIXED",model:"MOTOMAN-AR1440",make:"YASKAWA",line:"CCB",cat:"04",status:"Active",location:"AI3"},
  // 05 WELDING
  {no:"DCMI-PWS-01",name:"PROJECTION WELDING",model:"ASR-100",make:"CHOWEL",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-02",name:"PROJECTION WELDING",model:"ASR-100",make:"CHOWEL",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-03",name:"PROJECTION WELDING",model:"ASR-100",make:"CHOWEL",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-04",name:"PROJECTION WELDING",model:"ASR-100",make:"CHOWEL",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-05",name:"PROJECTION WELDING",model:"ASR-100",make:"CHOWEL",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-06",name:"PROJECTION WELDING",model:"ASR-100KVA",make:"AUTOWELD",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-07",name:"PROJECTION WELDING",model:"ASP-75KVA",make:"AUTOWELD",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-08",name:"PROJECTION WELDING",model:"ASP-75KVA",make:"AUTOWELD",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-PWS-09",name:"PROJECTION WELDING",model:"75KVA",make:"PACIFIC",line:"PROJECTION",cat:"05",status:"Active",location:"PROJECTION"},
  {no:"DCMI-FRM-MWS-01",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"PS7I"},
  {no:"DCMI-FRM-MWS-02",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"PS7I"},
  {no:"DCMI-FRM-MWS-03",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"PS7I"},
  {no:"DCMI-FRM-MWS-04",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"PS7I"},
  {no:"DCMI-FRM-MWS-05",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"PS7I"},
  {no:"DCMI-FRM-MWS-14",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-MWS-16",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"FRAM",cat:"05",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-MWS-30",name:"MANUAL WELDING",model:"250A",make:"LOCAL",line:"CCB",cat:"05",status:"Active",location:"QXI"},
  {no:"DCMI-CCB-MWS-37",name:"MANUAL WELDING",model:"YD-250RX1",make:"PANASONIC",line:"CCB",cat:"05",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-MWS-38",name:"MANUAL WELDING M/C",model:"YD-250RX1",make:"PANASONIC",line:"CCB",cat:"05",status:"Active",location:"SU2I"},
  // 06 ASSEMBLY
  {no:"DCMI-FRM-ASSY-01",name:"ASSEMBLY UNIT",model:"NILL",make:"-",line:"FRAM",cat:"06",status:"Active",location:"PS7I"},
  {no:"DCMI-FRM-ASSY-11",name:"ASSEMBLY UNIT",model:"PF4002-C-HW",make:"ATLAS COPCO",line:"FRAM",cat:"06",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-FRM-ASSY-18",name:"ASSEMBLY UNIT",model:"PF4002-C-HW",make:"ATLAS COPCO",line:"FRAM",cat:"06",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-FRM-ASSY-35",name:"ASSEMBLY UNIT",model:"SHD-DT2-2",make:"SANYO",line:"FRAM",cat:"06",status:"Active",location:"AI3"},
  {no:"DCMI-FRM-ASSY-43",name:"ASSEMBLY UNIT",model:"SHD-T1-020A-1",make:"SANYO",line:"FRAM",cat:"06",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-ASSY-46",name:"ASSEMBLY UNIT",model:"SHD-T1-020A-1",make:"SANYO",line:"FRAM",cat:"06",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-ASSY-47",name:"ASSEMBLY UNIT",model:"MII-6CAW-N",make:"MEIHOTECH",line:"FRAM",cat:"06",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-ASSY-67",name:"ASSEMBLY UNIT",model:"BN7I/ASSY-09",make:"SANYO",line:"CCB",cat:"06",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-FRM-01",name:"PIPE FORMING M/C",model:"NILL",make:"ASSY",line:"CCB",cat:"06",status:"Active",location:"QXI"},
  {no:"DCMI-CCB-FRM-02",name:"PIPE FORMING M/C",model:"NILL",make:"ASSY",line:"CCB",cat:"06",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-SWG-01",name:"PIPE SWAGGING M/C",model:"NILL",make:"ASSY",line:"CCB",cat:"06",status:"Active",location:"QXI/AI3/BI3"},
  {no:"DCMI-CCB-SWG-02",name:"PIPE SWAGGING M/C",model:"NILL",make:"ASSY",line:"CCB",cat:"06",status:"Active",location:"QXI/AI3/BI3"},
  {no:"DCMI-RVT-01",name:"RIVITTING MACHINE",model:"HHR-15",make:"HYUNDAE",line:"FRAM",cat:"06",status:"Active",location:"PS7I 2nd RSC"},
  {no:"DCMI-SPT-01",name:"SOUND PROOF TESTING MACHINE",model:"-",make:"SOUND",line:"FRAM",cat:"06",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-PRS-SHR-01",name:"HYDRAULIC SHEARING MACHINE",model:"DYSM-0625",make:"DAEYANG",line:"PRESS",cat:"06",status:"Active",location:"FABRICATION AREA"},
  // 07 ETC
  {no:"DCMI-FRM-CNR-13",name:"PART MOVING CONVEYOR",model:"4500W*675*900",make:"NILL",line:"FRAM",cat:"07",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-FRM-CNR-14",name:"PART MOVING CONVEYOR",model:"3600W*685*900",make:"NILL",line:"FRAM",cat:"07",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-FRM-CNR-15",name:"PART MOVING CONVEYOR",model:"800W*3000*900",make:"GGM",line:"FRAM",cat:"07",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CNR-16",name:"PART MOVING CONVEYOR",model:"800W*3000*900",make:"GGM",line:"FRAM",cat:"07",status:"Active",location:"BN7I"},
  {no:"DCMI-FRM-CNR-19",name:"PART MOVING CONVEYOR",model:"550W*2500*900",make:"GGM",line:"FRAM",cat:"07",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-FRM-CNR-20",name:"PART MOVING CONVEYOR",model:"550W*2500*900",make:"GGM",line:"FRAM",cat:"07",status:"Active",location:"BI3"},
  {no:"DCMI-UTL-CLM-01",name:"SHOP FLOOR CLEANING MACHINE-1",model:"ROOTS SCRUB E4545",make:"ROOTS",line:"COMMON",cat:"07",status:"Active",location:"SHOP FLOOR"},
  {no:"DCMI-UTL-CLM-02",name:"SHOP FLOOR CLEANING MACHINE-2",model:"ROOTS SCRUB E4043",make:"ROOTS",line:"COMMON",cat:"07",status:"Active",location:"SHOP FLOOR"},
  {no:"DCMI-UTL-WBM-01",name:"WEIGH BRIDGE 60MT",model:"APPWE 60TON",make:"APCON",line:"COMMON",cat:"07",status:"Active",location:"EB YARD"},
  {no:"DCMI-UTL-SSR-01",name:"150KVA SERVO STABILIZER",model:"150KVA",make:"RESQ",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION LINE"},
  {no:"DCMI-UTL-CHR-01",name:"CHILLER MACHINE 2TON",model:"ST2TR-70LTRS",make:"AUTOWELD",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION WELDING LINE"},
  {no:"DCMI-UTL-CHR-02",name:"CHILLER MACHINE 2TON",model:"ST2TR-70LTRS",make:"AUTOWELD",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION WELDING LINE"},
  {no:"DCMI-UTL-CHR-03",name:"CHILLER MACHINE 2TON",model:"ST2TR-70LTRS",make:"AUTOWELD",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION WELDING LINE"},
  {no:"DCMI-UTL-CHR-04",name:"CHILLER MACHINE 3TON",model:"ST3TR-120LTRS",make:"AUTOWELD",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION WELDING LINE"},
  {no:"DCMI-EDM-MTF-01",name:"EXHAUST DUCT MOTOR 7.5HP",model:"7.5HP",make:"NILL",line:"FRAM",cat:"07",status:"Active",location:"PS7I IInd ROW BACK"},
  {no:"DCMI-EDM-MTF-06",name:"EXHAUST DUCT MOTOR 5HP",model:"5HP",make:"NILL",line:"CCB",cat:"07",status:"Active",location:"QXI CCB MAIN STAGE"},
  {no:"DCMI-EDM-MTF-07",name:"EXHAUST DUCT MOTOR 5HP",model:"5HP",make:"NILL",line:"CCB",cat:"07",status:"Active",location:"AI3 CCB MAIN STAGE"},
  {no:"DCMI-FAN-HVLS-01",name:"HVLS FAN",model:"1HP(0.75KW)",make:"MARUIT AIR",line:"FRAM",cat:"07",status:"Active",location:"PS7I FSB GANGWAY"},
  {no:"DCMI-FAN-HVLS-02",name:"HVLS FAN",model:"1HP(0.75KW)",make:"MARUIT AIR",line:"FRAM",cat:"07",status:"Active",location:"QXI FSB GANGWAY"},
  {no:"DCMI-FAN-HVLS-03",name:"HVLS FAN",model:"1HP(0.75KW)",make:"MARUIT AIR",line:"FRAM",cat:"07",status:"Active",location:"SU2I FSB GANGWAY"},
  {no:"DCMI-FAN-HVLS-05",name:"HVLS FAN",model:"1HP(0.75KW)",make:"MARUIT AIR",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION GANGWAY"},
  {no:"DCMI-FAN-HVLS-06",name:"HVLS FAN",model:"1HP(0.75KW)",make:"MARUIT AIR",line:"CCB",cat:"07",status:"Active",location:"BN7I CCB GANGWAY"},
  {no:"DCMI-FAN-HVLS-07",name:"HVLS FAN",model:"1HP(0.75KW)",make:"MARUIT AIR",line:"CCB",cat:"07",status:"Active",location:"BN7I CCB SUB GANGWAY"},
  {no:"DCMI-FAN-EHF-01",name:"EXHAUST FAN",model:"900MM 415V",make:"ALMONARD",line:"FRAM",cat:"07",status:"Active",location:"PS7I GANGWAY"},
  {no:"DCMI-SHF-ACU-01",name:"AIR CONDITIONER SPLIT",model:"1TON SPLIT AC",make:"KOREA MAKE",line:"CCB",cat:"07",status:"Active",location:"QXI/AI3 CCB LASER"},
  {no:"DCMI-SHF-ACU-02",name:"AIR CONDITIONER SPLIT",model:"1TON SPLIT AC",make:"KOREA MAKE",line:"CCB",cat:"07",status:"Active",location:"QXI/AI3 CCB LASER"},
  {no:"DCMI-SHF-ACU-05",name:"AIR CONDITIONER SPLIT",model:"1TON SPLIT AC",make:"DAIKIN",line:"CCB",cat:"07",status:"Active",location:"BN7I CCB LASER"},
  {no:"DCMI-SHF-ACU-07",name:"AIR CONDITIONER DUCTABLE",model:"11TON DUCTABLE",make:"HITACHI",line:"COMMON",cat:"07",status:"Active",location:"UPS ROOM"},
  {no:"DCMI-SHF-ACU-08",name:"AIR CONDITIONER DUCTABLE",model:"11TON DUCTABLE",make:"HITACHI",line:"COMMON",cat:"07",status:"Active",location:"UPS ROOM"},
  {no:"DCMI-GRP-BRL-01",name:"BARREL GREASE PUMP 180KG",model:"GPH/3/ST/BSP",make:"GROZ",line:"FRAM",cat:"07",status:"Active",location:"PS7I"},
  {no:"DCMI-GRP-BRL-02",name:"BARREL GREASE PUMP 180KG",model:"GPH/3/ST/BSP",make:"GROZ",line:"FRAM",cat:"07",status:"Active",location:"PS7I"},
  {no:"DCMI-GRP-BRL-04",name:"BARREL GREASE PUMP 180KG",model:"GPH/3/ST/BSP",make:"GROZ",line:"FRAM",cat:"07",status:"Active",location:"AI3"},
  {no:"DCMI-GRP-BRL-06",name:"BARREL GREASE PUMP 180KG",model:"GPH/3/ST/BSP",make:"GROZ",line:"FRAM",cat:"07",status:"Active",location:"SU2I"},
  {no:"DCMI-GRP-PRT-01",name:"PORTABLE GREASE PUMP",model:"BGRP/30",make:"GROZ",line:"COMMON",cat:"07",status:"Active",location:"COMPRESSOR ROOM"},
  {no:"DCMI-JCM-WCU-01",name:"WELD CHECKER UNIT",model:"MM-315B",make:"AMADA",line:"PROJECTION",cat:"07",status:"Active",location:"PROJECTION AREA"},
  {no:"DCMI-TSM-IBM-01",name:"ICE BLASTING MACHINE",model:"BLMD-16B",make:"URMILA",line:"COMMON",cat:"07",status:"Active",location:"JIG CLEANING"},
  {no:"DCMI-TSM-TCV-01",name:"THERMAL CAMERA",model:"FLIR-C5",make:"FLIR",line:"COMMON",cat:"07",status:"Active",location:"SHOP FLOOR"},
  // 08 LASER
  {no:"DCMI-CCB-LCT-01",name:"LASER CUTTING",model:"YLR-450/4500-QCW-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-CCB-LCT-02",name:"LASER CUTTING",model:"YLR-450/4500-QCW-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-CCB-LCT-03",name:"LASER CUTTING",model:"YLR-450/4500-QCW-MM-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-LCT-04",name:"LASER CUTTING",model:"YLR-450/4500-QCW-MM-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-LCT-05",name:"LASER CUTTING",model:"YLR-450/4500-QCW-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-LCT-06",name:"LASER CUTTING",model:"YLR-450/4500-QCW-MM-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"QXI/AI3"},
  {no:"DCMI-CCB-LCT-07",name:"LASER CUTTING",model:"YLR-450/4500-QCW-MM-AC(IPG)",make:"MDI",line:"CCB",cat:"08",status:"Active",location:"SU2I"},
  {no:"DCMI-CCB-HIM-01",name:"HOLE INSPECTION",model:"RHD/LHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"QXI FL"},
  {no:"DCMI-CCB-HIM-02",name:"HOLE INSPECTION",model:"RHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-HIM-03",name:"HOLE INSPECTION",model:"LHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-HIM-04",name:"HOLE INSPECTION",model:"RHD(1)",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-HIM-05",name:"HOLE INSPECTION",model:"RHD(2)",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-HIM-06",name:"HOLE INSPECTION",model:"LHD(1)",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-HIM-07",name:"HOLE INSPECTION",model:"LHD(2)",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"SU2I/PS7I"},
  {no:"DCMI-CCB-HIM-08",name:"HOLE INSPECTION",model:"RHD/LHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"BI3"},
  {no:"DCMI-CCB-HIM-09",name:"HOLE INSPECTION",model:"LHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-HIM-10",name:"HOLE INSPECTION",model:"RHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"BN7I"},
  {no:"DCMI-CCB-HIM-11",name:"HOLE INSPECTION",model:"RHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"AI3"},
  {no:"DCMI-CCB-HIM-12",name:"HOLE INSPECTION",model:"RHD",make:"NILL",line:"CCB",cat:"08",status:"Active",location:"AI3"},
  // 11 IDLE NON-RUNNING
  {no:"DCMI-IDLM-CRT-06",name:"ARC WELD ROBOT(IDLE)",model:"HA006A",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-CRT-07",name:"ARC WELD ROBOT(IDLE)",model:"HA006",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-CRT-08",name:"ARC WELD ROBOT(IDLE)",model:"HA006",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-CRT-09",name:"ARC WELD ROBOT(IDLE)",model:"HH010L",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-CRT-10",name:"ARC WELD ROBOT(IDLE)",model:"HA006",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-CRT-11",name:"ARC WELD ROBOT(IDLE)",model:"HA006A",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-SRT-09",name:"SPOT WELD ROBOT(IDLE)",model:"HI5A-S00",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-HND-09",name:"HANDLING ROBOT(IDLE)",model:"HI5A-S00",make:"HYUNDAI",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-BTH-01",name:"ROBOT BOOTH(IDLE)",model:"CRT 02",make:"-",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-OTH-1",name:"OTHER MACHINE(IDLE)",model:"-",make:"-",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  {no:"DCMI-IDLM-OTH-2",name:"OTHER MACHINE(IDLE)",model:"-",make:"-",line:"COMMON",cat:"11",status:"Idle-NR",location:"STORE ROOM"},
  // 11A IDLE RUNNING
  {no:"DCMI-IDLM-CRT-12",name:"ARC WELD ROBOT(STAND BY)",model:"TM-1400WGIII",make:"PANASONIC",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  {no:"DCMI-IDLM-MWS-01",name:"MANUAL WELDING(STAND BY)",model:"250A",make:"-",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  {no:"DCMI-IDLM-MWS-02",name:"MANUAL WELDING(STAND BY)",model:"250A",make:"-",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  {no:"DCMI-IDLM-MWS-03",name:"MANUAL WELDING(STAND BY)",model:"250A",make:"-",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  {no:"DCMI-IDLM-MWS-04",name:"MANUAL WELDING(STAND BY)",model:"250A",make:"-",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  {no:"DCMI-IDLM-MWS-05",name:"MANUAL WELDING(STAND BY)",model:"250A",make:"-",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  {no:"DCMI-IDLM-MWS-06",name:"MANUAL WELDING(STAND BY)",model:"250A",make:"-",line:"COMMON",cat:"11A",status:"Idle-R",location:"STAND BY"},
  // 12 FIXED ASSET SALE
  {no:"DCMI-FRM-CRT-03",name:"ARC WELD ROBOT(SALE)",model:"HA006",make:"HYUNDAI",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-01",name:"SPOT WELD ROBOT(SALE)",model:"HS220",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-02",name:"SPOT WELD ROBOT(SALE)",model:"HS180",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-03",name:"SPOT WELD ROBOT(SALE)",model:"HS220/HS180",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-04",name:"SPOT WELD ROBOT(SALE)",model:"HS165",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-05",name:"SPOT WELD ROBOT(SALE)",model:"ES165N",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-06",name:"SPOT WELD ROBOT(SALE)",model:"HS220",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-07",name:"SPOT WELD ROBOT(SALE)",model:"HS220",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-SRT-08",name:"SPOT WELD ROBOT(SALE)",model:"HS220",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-PRS-14(B1)",name:"PRESS MACHINE(SALE)",model:"300TON",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-PRS-11(A11)",name:"PRESS MACHINE(SALE)",model:"160TON",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-IDLM-CNR-01",name:"CONVEYOR(SALE)",model:"ANGLE",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-IDLM-CNR-02",name:"CONVEYOR(SALE)",model:"ANGLE",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
  {no:"DCMI-IDLM-CNR-03",name:"CONVEYOR(SALE)",model:"ANGLE",make:"-",line:"COMMON",cat:"12",status:"Fixed-Sale",location:"-"},
];

// ═══ 색상 헬퍼 ═══
const LINE_COLOR={FRAM:"#378ADD",CCB:"#D4537E",PRESS:"#639922",PROJECTION:"#EF9F27",COMMON:"#888780"};
const CAT_COLOR={"01":"#0F6E56","02":"#185FA5","03":"#534AB7","04":"#993C1D","05":"#854F0B","06":"#3B6D11","07":"#5F5E5A","08":"#993556","09":"#185FA5","10":"#534AB7","11":"#A32D2D","11A":"#854F0B","12":"#534AB7","13":"#A32D2D","14":"#185FA5","15":"#0F6E56"};
const CAT_BG={"01":"#E1F5EE","02":"#E6F1FB","03":"#EEEDFE","04":"#FAECE7","05":"#FAEEDA","06":"#EAF3DE","07":"#F1EFE8","08":"#FBEAF0","09":"#E6F1FB","10":"#EEEDFE","11":"#FCEBEB","11A":"#FAEEDA","12":"#EEEDFE","13":"#FCEBEB","14":"#E6F1FB","15":"#E1F5EE"};
const CAT_LABEL={"01":"Utility","02":"Process","03":"Press","04":"Robot","05":"Welding","06":"Assembly","07":"ETC","08":"Laser","09":"Jig","10":"Mould","11":"Idle(NR)","11A":"Idle(R)","12":"Fixed Sale","13":"Disposal","14":"CNC","15":"Pallet"};
const ST_COLOR={"Active":{bg:"#EAF3DE",cl:"#3B6D11"},"Idle-R":{bg:"#FAEEDA",cl:"#854F0B"},"Idle-NR":{bg:"#FCEBEB",cl:"#A32D2D"},"Fixed-Sale":{bg:"#EEEDFE",cl:"#534AB7"}};

const s={
  card:{background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e0e0e0)",borderRadius:10,padding:"12px 14px"},
  pill:(bg,cl)=>({fontSize:9,padding:"2px 7px",borderRadius:999,fontWeight:500,background:bg,color:cl,whiteSpace:"nowrap",display:"inline-block"}),
  th:{textAlign:"left",padding:"6px 8px",fontSize:10,fontWeight:500,color:"var(--color-text-tertiary,#999)",borderBottom:"0.5px solid #e0e0e0",whiteSpace:"nowrap",background:"var(--color-background-secondary,#f5f5f5)"},
  td:{padding:"6px 8px",borderBottom:"0.5px solid #e0e0e0",verticalAlign:"middle",fontSize:11},
  input:{fontSize:11,padding:"5px 9px",border:"0.5px solid #ccc",borderRadius:6,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#1a1a1a)"},
  select:{fontSize:11,padding:"5px 7px",border:"0.5px solid #ccc",borderRadius:6,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#1a1a1a)"},
  btn:(bg,cl)=>({fontSize:11,padding:"5px 12px",borderRadius:6,border:`0.5px solid ${bg}`,background:bg,color:cl,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}),
};

const stPill=(st,t)=>{const m={done:["#EAF3DE","#3B6D11"],sched:["#FAEEDA","#854F0B"],delay:["#FCEBEB","#A32D2D"],prog:["#E6F1FB","#185FA5"]};const[bg,cl]=m[st]||m.sched;return<span style={{fontSize:9,padding:"2px 7px",borderRadius:999,fontWeight:500,background:bg,color:cl,whiteSpace:"nowrap"}}>{t.status[st]}</span>;};

// BM 데이터
const BM_DATA=[
  {sl:1,date:"2026-02-02",assetNo:"DCMI-FRM-CRT-47",line:"FRAM",shift:"I",mainCat:"SENSOR",problem:"SENSOR PROBLEM",reason:"SENSOR FAILURE",action:"SENSOR CHANGED",pageNo:401,team:"HARI TEAM",checker:"HARI",start:"8:00AM",finish:"8:30AM",idle:0.5,type:"Machine"},
  {sl:2,date:"2026-02-02",assetNo:"DCMI-FRM-CRT-120",line:"FRAM",shift:"II",mainCat:"ASSEMBLY",problem:"SENSOR PROBLEM",reason:"SENSOR FAILURE",action:"NEW SENSOR ISSUED",pageNo:402,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"5:30PM",finish:"6:00PM",idle:0.5,type:"Machine"},
  {sl:3,date:"2026-02-03",assetNo:"DCMI-FRM-CRT-47",line:"FRAM",shift:"I",mainCat:"WELD SHOP",problem:"LINER PROBLEM",reason:"LINER PROBLEM",action:"NEW LINER CHANGE WORK",pageNo:407,team:"HARI TEAM",checker:"SABARI",start:"8:20AM",finish:"8:40AM",idle:0.3,type:"Machine"},
  {sl:4,date:"2026-02-03",assetNo:"DCMI-FRM-PRJ-29",line:"PRESS",shift:"I",mainCat:"PRESS SHOP",problem:"COIL FEEDER PROBLEM",reason:"MOTOR COUPLING BROKEN",action:"HYD MOTOR COUPLING CHANGE",pageNo:1557,team:"HARI TEAM",checker:"SABARI",start:"2:10PM",finish:"2:50PM",idle:0.7,type:"Machine"},
  {sl:5,date:"2026-02-04",assetNo:"DCMI-FRM-CRT-128",line:"FRAM",shift:"II",mainCat:"WELD SHOP",problem:"ROBOT COIL FEEDING PROBLEM",reason:"LINER PROBLEM",action:"NEW LINER CHANGE WORK",pageNo:408,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"6:30PM",finish:"9:00PM",idle:2.5,type:"Machine"},
  {sl:6,date:"2026-02-06",assetNo:"DCMI-CCB-CRT-68",line:"CCB",shift:"I",mainCat:"SENSOR",problem:"SENSOR PROBLEM",reason:"SENSOR FAILURE",action:"SENSOR CHANGED",pageNo:445,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"10:40PM",finish:"11:00PM",idle:0.3,type:"Machine"},
  {sl:7,date:"2026-02-11",assetNo:"DCMI-PWS-RSW-05",line:"PROJECTION",shift:"I",mainCat:"OTHERS",problem:"M/C NOT WORKING",reason:"LIMIT SWITCH PROBLEM",action:"LIMIT SWITCH CHANGED",pageNo:1591,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"1:30PM",finish:"2:00PM",idle:0.5,type:"Machine"},
  {sl:8,date:"2026-01-02",assetNo:"DCMI-PT-183",line:"PRESS",shift:"I",mainCat:"MOULD",problem:"MOULD B/D-FORMING UNEVEN",reason:"GAS SPRING BROKEN",action:"2NOS GAS SPRINGS CHANGED",pageNo:1521,team:"PRAVEEN TEAM",checker:"JAYAKUMAR",start:"11:50AM",finish:"1:00PM",idle:1.2,type:"Mould"},
  {sl:9,date:"2026-01-04",assetNo:"DCMI-PT-297",line:"PRESS",shift:"II",mainCat:"MOULD",problem:"MOULD B/D-HOLE BURR",reason:"ONE SIDE DAMAGE PUNCH",action:"NEW PUNCH CHANGED",pageNo:1526,team:"PRABHU TEAM",checker:"KANNAN",start:"7:30PM",finish:"9:30PM",idle:2.0,type:"Mould"},
];

// PM 데이터
const PM_DATA=[
  {id:"PM-001",assetNo:"DCMI-FRM-CRT-01",name:"Arc Welding Robot TR01",cat:"Machine",line:"FRAM",task:"TCP 교정 & 소모품 점검",legend:"PREDICTIVE",freq:"Once A Week",std:1,man:1,planDate:"2026-05-06",status:"prog",person:"이수현"},
  {id:"PM-002",assetNo:"DCMI-FRM-CRT-47",name:"Arc Welding Robot TR47",cat:"Machine",line:"FRAM",task:"Wire Liner 교체 & 토치 점검",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-08",status:"sched",person:"이수현"},
  {id:"PM-003",assetNo:"DCMI-CCB-LCT-01",name:"Laser Cutting MDI-01",cat:"Machine",line:"CCB",task:"렌즈 클리닝 & 레이저 출력 점검",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-10",status:"sched",person:"Aravind"},
  {id:"PM-004",assetNo:"DCMI-PRS-02(A2)",name:"Mech. Press 200TON A2",cat:"Machine",line:"PRESS",task:"오일교환 & 클러치 점검",legend:"PREVENTIVE",freq:"2 Monthly",std:4,man:2,planDate:"2026-05-03",status:"delay",person:"Raj Kumar"},
  {id:"PM-005",assetNo:"DCMI-PWS-01",name:"Projection Welding PWS-01",cat:"Machine",line:"PROJECTION",task:"전극 점검 & 냉각수 교환",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-12",status:"sched",person:"Sabari"},
  {id:"PM-006",assetNo:"DCMI-UTL-CMP-01",name:"Air Compressor 50HP-01",cat:"Machine",line:"COMMON",task:"에어 필터 교체 & 벨트 점검",legend:"PREVENTIVE",freq:"2 Monthly",std:2,man:1,planDate:"2026-05-06",status:"done",person:"Saravanaraj"},
  {id:"PM-M01",assetNo:"DCMI-PT-183",name:"Mould SU2I-LWB Forming-1",cat:"Mould",line:"PRESS",task:"펀치 마모 점검 & 스프링 교체",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-07",status:"done",person:"Praveen"},
  {id:"PM-J01",assetNo:"AI3 CCB/QXI CCB",name:"Jig AI3 CCB/QXI CCB",cat:"Jig",line:"CCB",task:"Sequence Checking (4개월 1회)",legend:"PREVENTIVE",freq:"4 Monthly",std:4,man:1,planDate:"2026-05-01",status:"done",person:"Balaji"},
];

const INIT_USERS=[
  {id:1,name:"나경태",email:"na.kt@dsc.com",dept:"생산관리",role:"GM",status:"active"},
  {id:2,name:"Saravanaraj",email:"sara@dsc.com",dept:"보전",role:"Team Leader",status:"active"},
  {id:3,name:"Praveen",email:"praveen@dsc.com",dept:"금형",role:"Team Leader",status:"active"},
  {id:4,name:"Raj Kumar",email:"raj@dsc.com",dept:"프레스",role:"Engineer",status:"pending"},
  {id:5,name:"Kannan",email:"kannan@dsc.com",dept:"CCB",role:"Technician",status:"pending"},
];
const INIT_PERMS={
  GM:{master:"write",avail:"write",bm:"write",pm:"write",wo:"write",parts:"write",kpi:"write",team:"write",settings:"write"},
  "Team Leader":{master:"write",avail:"read",bm:"write",pm:"write",wo:"write",parts:"read",kpi:"read",team:"read",settings:"none"},
  Engineer:{master:"read",avail:"read",bm:"write",pm:"read",wo:"write",parts:"read",kpi:"none",team:"none",settings:"none"},
  Technician:{master:"read",avail:"none",bm:"write",pm:"read",wo:"write",parts:"none",kpi:"none",team:"none",settings:"none"},
};
const MENU_CATS=[{key:"master",icon:"ti-layout-list"},{key:"avail",icon:"ti-chart-bar"},{key:"bm",icon:"ti-alert-triangle"},{key:"pm",icon:"ti-tool"},{key:"wo",icon:"ti-clipboard-list"},{key:"parts",icon:"ti-package"},{key:"kpi",icon:"ti-chart-line"},{key:"team",icon:"ti-users"},{key:"settings",icon:"ti-settings"}];
const LINES_DATA=[{l:"FRAM",v:87.1,c:"#378ADD",m:48,bm:7,idle:8.5},{l:"CCB",v:85.8,c:"#D4537E",m:62,bm:5,idle:5.2},{l:"PRESS",v:92.3,c:"#639922",m:31,bm:3,idle:2.1},{l:"PROJECTION",v:90.2,c:"#EF9F27",m:27,bm:2,idle:1.3}];

// ═══ 설비 마스터 화면 ═══
function AssetMaster({t,extAssets,extLoading,extError}){
  // 부모(DSCFMSPortal)에서 Supabase fetch 결과를 props로 전달; 비어있으면 로컬 fallback
  const [assets,setAssets]=useState(extAssets&&extAssets.length?extAssets:INIT_ASSETS);
  // 부모 fetch 결과가 도착/변경되면 동기화
  useEffect(()=>{ if(extAssets&&extAssets.length) setAssets(extAssets); },[extAssets]);
  const [q,setQ]=useState("");
  const [fLine,setFLine]=useState("");
  const [fCat,setFCat]=useState("");
  const [fSt,setFSt]=useState("");
  const [subTab,setSubTab]=useState("list");
  const [history,setHistory]=useState([{id:1,date:"2025-09-01",user:"나경태",action:"초기 등록",assetNo:"전체",before:"-",after:`${INIT_ASSETS.length}개 등록`,remark:"Master List REV.01 2025"}]);
  const [form,setForm]=useState({no:"",name:"",model:"",make:"",line:"FRAM",cat:"04",status:"Active",location:""});
  const [editIdx,setEditIdx]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [uploadMsg,setUploadMsg]=useState("");
  const [dragOver,setDragOver]=useState(false);

  const CATS=[...new Set(assets.map(a=>a.cat))].sort();
  const LINES_LIST=[...new Set(assets.map(a=>a.line))].sort();

  const filtered=useMemo(()=>assets.filter(a=>{
    if(q&&![a.no,a.name,a.model,a.make,a.location].some(v=>(v||"").toLowerCase().includes(q.toLowerCase()))) return false;
    if(fLine&&a.line!==fLine) return false;
    if(fCat&&a.cat!==fCat) return false;
    if(fSt&&a.status!==fSt) return false;
    return true;
  }),[assets,q,fLine,fCat,fSt]);

  const handleSave=()=>{
    if(!form.no||!form.name) return;
    const now=new Date().toISOString().slice(0,10);
    if(editIdx!==null){
      const old=assets[editIdx];
      setHistory(h=>[{id:h.length+1,date:now,user:"나경태",action:"수정",assetNo:form.no,before:old.name,after:form.name,remark:"수동 수정"},...h]);
      setAssets(a=>a.map((item,i)=>i===editIdx?{...form}:item));
      setEditIdx(null);
    } else {
      setHistory(h=>[{id:h.length+1,date:now,user:"나경태",action:"신규 등록",assetNo:form.no,before:"-",after:form.name,remark:"수동 입력"},...h]);
      setAssets(a=>[...a,{...form}]);
    }
    setForm({no:"",name:"",model:"",make:"",line:"FRAM",cat:"04",status:"Active",location:""});
    setShowForm(false);setEditIdx(null);setSubTab("list");
  };

  const parseCSV=(text)=>{
    const lines=text.trim().split("\n").filter(l=>l.trim());
    const parsed=[];
    for(const line of lines){
      const c=line.split(",").map(v=>v.trim().replace(/^"|"$/g,""));
      if(c.length>=6&&c[1]&&c[1]!=="자산번호"&&c[1]!=="#N/A"){
        const catMap={"01":"01","02":"02","03":"03","04":"04","05":"05","06":"06","07":"07","08":"08","09":"09","10":"10","11":"11","11A":"11A","12":"12","13":"13"};
        parsed.push({no:c[1],name:c[2]||"-",model:c[3]||"-",make:c[4]||"-",line:c[5]?.includes("PRESS")?"PRESS":c[5]?.includes("CCB")||c[5]?.includes("QXI")||c[5]?.includes("AI3")||c[5]?.includes("SU2I")||c[5]?.includes("BI3")||c[5]?.includes("BN7I")?"CCB":c[5]?.includes("PROJECTION")?"PROJECTION":c[5]?.includes("PS7I")||c[5]?.includes("FSB")||c[5]?.includes("RSB")?"FRAM":"COMMON",cat:catMap[c[0]]||c[0],status:["11","11A"].includes(c[0])?"Idle-NR":c[0]==="12"||c[0]==="13"?"Fixed-Sale":"Active",location:c[5]||"-"});
      }
    }
    return parsed;
  };

  const handlePaste=(e)=>{
    const text=e.clipboardData.getData("text");
    const parsed=parseCSV(text);
    if(parsed.length>0){
      const now=new Date().toISOString().slice(0,10);
      setAssets(parsed);
      setHistory(h=>[{id:h.length+1,date:now,user:"나경태",action:"붙여넣기 업데이트",assetNo:"전체",before:`${assets.length}개`,after:`${parsed.length}개`,remark:"엑셀 CSV 붙여넣기"},...h]);
      setUploadMsg(`✅ ${parsed.length}개 설비 업데이트 완료!`);
    } else setUploadMsg("⚠️ 데이터를 인식하지 못했습니다.");
  };

  const handleFile=(e)=>{
    e.preventDefault();setDragOver(false);
    const file=e.dataTransfer?.files?.[0]||e.target?.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const parsed=parseCSV(ev.target.result);
      if(parsed.length>0){
        const now=new Date().toISOString().slice(0,10);
        setAssets(parsed);
        setHistory(h=>[{id:h.length+1,date:now,user:"나경태",action:"파일 업로드",assetNo:"전체",before:`${assets.length}개`,after:`${parsed.length}개`,remark:file.name},...h]);
        setUploadMsg(`✅ ${file.name} — ${parsed.length}개 업데이트!`);
      } else setUploadMsg("⚠️ CSV 파일만 지원됩니다.");
    };
    reader.readAsText(file);
  };

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["list","ti-list","설비 목록"],["upload","ti-upload","엑셀 업로드"],["manual","ti-pencil","수동 입력"],["history","ti-history","변경 이력"]].map(([v,icon,lbl])=>(
            <button key={v} onClick={()=>setSubTab(v)} style={{...s.btn(subTab===v?"#185FA5":"transparent",subTab===v?"#fff":"#555"),border:`0.5px solid ${subTab===v?"#185FA5":"#ccc"}`,borderRadius:999,fontSize:11}}>
              <i className={`ti ${icon}`} style={{fontSize:12}} aria-hidden="true"/> {lbl}
            </button>
          ))}
        </div>
        <span style={{fontSize:10,color:extError?"#A32D2D":"#999"}} title={extError||""}>
          {extLoading ? "Supabase 로딩 중..." : extError ? `DB 오류 (로컬 데이터 표시 중): ${extError}` : `Supabase · ${assets.length}건 로드됨`}
        </span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:12}}>
        {[
          {lbl:"전체",val:filtered.length,cl:"#185FA5"},
          {lbl:"Active",val:filtered.filter(a=>a.status==="Active").length,cl:"#3B6D11"},
          {lbl:"Idle(R)",val:filtered.filter(a=>a.status==="Idle-R").length,cl:"#854F0B"},
          {lbl:"Idle(NR)",val:filtered.filter(a=>a.status==="Idle-NR").length,cl:"#A32D2D"},
          {lbl:"Fixed Sale",val:filtered.filter(a=>a.status==="Fixed-Sale").length,cl:"#534AB7"},
        ].map((k,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:9,color:"#999"}}>{k.lbl}</div>
            <div style={{fontSize:15,fontWeight:600,color:k.cl}}>{k.val}대</div>
          </div>
        ))}
      </div>

      {subTab==="list"&&(
        <>
          <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
            <input style={{...s.input,width:160}} placeholder="자산번호/설비명/위치 검색..." value={q} onChange={e=>setQ(e.target.value)}/>
            <select style={s.select} value={fLine} onChange={e=>setFLine(e.target.value)}>
              <option value="">전체 라인</option>
              {LINES_LIST.map(l=><option key={l}>{l}</option>)}
            </select>
            <select style={s.select} value={fCat} onChange={e=>setFCat(e.target.value)}>
              <option value="">전체 분류</option>
              {CATS.map(c=><option key={c} value={c}>{c} · {CAT_LABEL[c]||c}</option>)}
            </select>
            <select style={s.select} value={fSt} onChange={e=>setFSt(e.target.value)}>
              <option value="">전체 상태</option>
              {["Active","Idle-R","Idle-NR","Fixed-Sale"].map(s=><option key={s}>{s}</option>)}
            </select>
            <span style={{fontSize:11,color:"#999",display:"flex",alignItems:"center"}}>{filtered.length}개</span>
          </div>
          <div style={{overflowX:"auto",border:"0.5px solid #e0e0e0",borderRadius:10}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr>{["자산번호","설비명","모델","제조사","라인","분류","위치","상태","PM/BM","관리"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((a,i)=>{
                  const st=ST_COLOR[a.status]||{bg:"#eee",cl:"#555"};
                  const lc=LINE_COLOR[a.line]||"#888";
                  return(
                    <tr key={a.no+i} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                      <td style={{...s.td,fontFamily:"monospace",fontSize:10,color:"#185FA5"}}>{a.no}</td>
                      <td style={{...s.td,fontWeight:500}}>{a.name}</td>
                      <td style={{...s.td,fontSize:10,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.model}</td>
                      <td style={s.td}>{a.make}</td>
                      <td style={s.td}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:lc,marginRight:3,verticalAlign:"middle"}}></span>{a.line}</td>
                      <td style={s.td}><span style={s.pill(CAT_BG[a.cat]||"#eee",CAT_COLOR[a.cat]||"#555")}>{a.cat}·{CAT_LABEL[a.cat]||a.cat}</span></td>
                      <td style={{...s.td,fontSize:10,maxWidth:120}}>{a.location}</td>
                      <td style={s.td}><span style={s.pill(st.bg,st.cl)}>{a.status}</span></td>
                      <td style={s.td}><PmBmBadge assetId={a.id} /></td>
                      <td style={s.td}>
                        <button onClick={()=>{setForm({...a});setEditIdx(assets.indexOf(a));setSubTab("manual");setShowForm(true);}}
                          style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"0.5px solid #ccc",background:"transparent",color:"#185FA5",cursor:"pointer"}}>편집</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0&&<tr><td colSpan={10} style={{textAlign:"center",padding:30,color:"#999"}}>검색 결과 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab==="upload"&&(
        <div>
          <div style={{...s.card,marginBottom:12,background:"#EBF3FC",border:"0.5px solid #185FA5"}}>
            <div style={{fontSize:12,fontWeight:500,color:"#185FA5",marginBottom:6}}>📋 엑셀 데이터 업로드 방법</div>
            <div style={{fontSize:11,color:"#333",lineHeight:1.8}}>
              <b>방법 1</b> — 엑셀에서 데이터 선택 → Ctrl+C → 아래 입력창 클릭 → Ctrl+V<br/>
              <b>방법 2</b> — 엑셀을 CSV로 저장 후 아래 영역에 드래그앤드롭<br/>
              <b>컬럼 순서:</b> 시트번호 | 자산번호 | 설비명 | 모델 | 제조사 | 위치
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:500,marginBottom:6}}>방법 1 — 붙여넣기</div>
            <textarea onPaste={handlePaste} placeholder="여기 클릭 후 Ctrl+V..." style={{width:"100%",height:100,fontSize:11,padding:10,borderRadius:8,border:"1.5px dashed #185FA5",background:"#f9fbff",resize:"vertical",color:"#555"}}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:500,marginBottom:6}}>방법 2 — CSV 파일</div>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleFile}
              style={{border:`2px dashed ${dragOver?"#185FA5":"#ccc"}`,borderRadius:10,padding:30,textAlign:"center",background:dragOver?"#EBF3FC":"#f5f5f5",cursor:"pointer"}}>
              <i className="ti ti-upload" style={{fontSize:28,color:dragOver?"#185FA5":"#999",display:"block",marginBottom:8}} aria-hidden="true"/>
              <div style={{fontSize:12,color:"#999"}}>CSV 파일 드래그 또는</div>
              <label style={{cursor:"pointer"}}>
                <span style={{fontSize:11,color:"#185FA5",textDecoration:"underline"}}>파일 선택</span>
                <input type="file" accept=".csv,.txt" onChange={handleFile} style={{display:"none"}}/>
              </label>
            </div>
          </div>
          {uploadMsg&&<div style={{padding:"10px 14px",borderRadius:8,background:uploadMsg.startsWith("✅")?"#EAF3DE":"#FAEEDA",color:uploadMsg.startsWith("✅")?"#3B6D11":"#854F0B",fontSize:11,fontWeight:500}}>{uploadMsg}</div>}
        </div>
      )}

      {subTab==="manual"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:500}}>{editIdx!==null?"설비 정보 편집":"신규 설비 등록"}</div>
            {!showForm&&<button onClick={()=>{setShowForm(true);setEditIdx(null);setForm({no:"",name:"",model:"",make:"",line:"FRAM",cat:"04",status:"Active",location:""}); }} style={s.btn("#185FA5","#fff")}>+ 신규 등록</button>}
          </div>
          {showForm&&(
            <div style={{...s.card,marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                {[["자산번호 (예: DCMI-FRM-CRT-01)","no"],["설비명","name"],["모델","model"],["제조사","make"],["위치","location"]].map(([lbl,key])=>(
                  <div key={key}>
                    <div style={{fontSize:10,color:"#999",marginBottom:3}}>{lbl}</div>
                    <input value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{...s.input,width:"100%"}}/>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:10,color:"#999",marginBottom:3}}>분류 Cat.</div>
                  <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={{...s.select,width:"100%"}}>
                    {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{k}·{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#999",marginBottom:3}}>라인 Line</div>
                  <select value={form.line} onChange={e=>setForm(f=>({...f,line:e.target.value}))} style={{...s.select,width:"100%"}}>
                    {["FRAM","CCB","PRESS","PROJECTION","COMMON"].map(l=><option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#999",marginBottom:3}}>상태 Status</div>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{...s.select,width:"100%"}}>
                    {["Active","Idle-R","Idle-NR","Fixed-Sale"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={handleSave} style={s.btn("#185FA5","#fff")}>💾 저장</button>
                <button onClick={()=>{setShowForm(false);setEditIdx(null);}} style={{...s.btn("transparent","#555"),border:"0.5px solid #ccc"}}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab==="history"&&(
        <div>
          <div style={{fontSize:12,fontWeight:500,marginBottom:10,display:"flex",justifyContent:"space-between"}}>변경 이력 <span style={{fontSize:10,color:"#999"}}>{history.length}건</span></div>
          <div style={{overflowX:"auto",border:"0.5px solid #e0e0e0",borderRadius:10}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr>{["#","날짜","작업자","작업유형","자산번호","변경전","변경후","비고"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {history.map((h,i)=>{
                  const ac={"초기 등록":{bg:"#E6F1FB",cl:"#185FA5"},"수정":{bg:"#FAEEDA",cl:"#854F0B"},"신규 등록":{bg:"#EAF3DE",cl:"#3B6D11"},"붙여넣기 업데이트":{bg:"#EEEDFE",cl:"#534AB7"},"파일 업로드":{bg:"#EEEDFE",cl:"#534AB7"}}[h.action]||{bg:"#f5f5f5",cl:"#555"};
                  return(
                    <tr key={h.id} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                      <td style={{...s.td,color:"#999"}}>{history.length-i}</td>
                      <td style={{...s.td,whiteSpace:"nowrap"}}>{h.date}</td>
                      <td style={s.td}>{h.user}</td>
                      <td style={s.td}><span style={s.pill(ac.bg,ac.cl)}>{h.action}</span></td>
                      <td style={{...s.td,fontFamily:"monospace",fontSize:10,color:"#185FA5"}}>{h.assetNo}</td>
                      <td style={{...s.td,fontSize:10,color:"#999"}}>{h.before}</td>
                      <td style={{...s.td,fontSize:10,fontWeight:500,color:"#3B6D11"}}>{h.after}</td>
                      <td style={{...s.td,fontSize:10}}>{h.remark}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ 가동률 ═══
function Availability({t}){
  const TARGET=90;
  const totalIdle=BM_DATA.filter(r=>r.type==="Machine").reduce((s,r)=>s+r.idle,0);
  const allMachines=Object.values({FRAM:48,CCB:62,PRESS:31,PROJECTION:27}).reduce((a,b)=>a+b,0);
  const days=21;
  const allPlanned=allMachines*days*16;
  const overall=+((allPlanned-totalIdle)/allPlanned*100).toFixed(1);
  return(
    <div>
      <div style={{...s.card,marginBottom:12,padding:"10px 14px"}}>
        <div style={{fontSize:11,fontWeight:500,marginBottom:4}}>가동률 산정 공식</div>
        <div style={{fontSize:11,fontFamily:"monospace",color:"#185FA5"}}>가동률(%) = (계획가동시간 - BM IDLE시간) ÷ 계획가동시간 × 100</div>
        <div style={{fontSize:10,color:"#999",marginTop:4}}>Machine(01~08)만 산정 | Jig/Mould 제외 | 설비대수 × 가동일수 × 16h(2교대)</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
        {[{lbl:"전체 가동률",val:`${overall}%`,cl:overall>=TARGET?"#3B6D11":"#854F0B"},{lbl:"총 BM IDLE",val:`${totalIdle.toFixed(1)}h`,cl:"#A32D2D"},{lbl:"목표 가동률",val:`${TARGET}%`,cl:"#3B6D11"},{lbl:"BM 건수",val:`${BM_DATA.filter(r=>r.type==="Machine").length}건`,cl:"#854F0B"}]
          .map((k,i)=>(<div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:9,color:"#999",marginBottom:2}}>{k.lbl}</div><div style={{fontSize:16,fontWeight:600,color:k.cl}}>{k.val}</div></div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {LINES_DATA.map(({l,v,m,bm,idle})=>(
          <div key={l} style={s.card}>
            <div style={{fontSize:12,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between"}}>{l}<span style={{fontSize:10,color:"#999",fontWeight:400}}>{m}대</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:"#999"}}>BM IDLE</span><span style={{fontWeight:500,color:"#A32D2D"}}>{idle.toFixed(1)}h ({bm}건)</span></div>
            <div style={{marginTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{fontWeight:600,color:v>=TARGET?"#3B6D11":v>=85?"#854F0B":"#A32D2D"}}>{v}%</span><span style={{fontSize:9,color:"#999"}}>목표 {TARGET}%</span></div>
              <div style={{height:10,background:"#f0f0f0",borderRadius:5,overflow:"hidden"}}><div style={{width:`${v}%`,height:"100%",background:v>=TARGET?"#639922":v>=85?"#EF9F27":"#E24B4A",borderRadius:5}}/></div>
              <div style={{fontSize:9,marginTop:3,color:v>=TARGET?"#3B6D11":"#A32D2D"}}>{v>=TARGET?"✅ 목표 달성":`⚠️ 미달 ${(v-TARGET).toFixed(1)}%p`}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ BM 이력 ═══
function BMHistory({t}){
  const [tab,setTab]=useState("Machine");
  const [q,setQ]=useState("");
  const [fShift,setFShift]=useState("");
  const data=useMemo(()=>BM_DATA.filter(r=>{
    if(r.type!==tab) return false;
    if(q&&![r.assetNo,r.problem,r.reason,r.action].some(v=>v.toLowerCase().includes(q.toLowerCase()))) return false;
    if(fShift&&r.shift!==fShift) return false;
    return true;
  }),[tab,q,fShift]);
  const totalIdle=data.reduce((s,r)=>s+r.idle,0);
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {["Machine","Mould","Jig"].map(tb=>(
          <button key={tb} onClick={()=>setTab(tb)} style={{...s.btn(tab===tb?"#185FA5":"transparent",tab===tb?"#fff":"#555"),border:`0.5px solid ${tab===tb?"#185FA5":"#ccc"}`,borderRadius:999}}>
            {tb} BM
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
        {[{lbl:"총 BM 건수",val:`${data.length}건`,cl:"#A32D2D"},{lbl:"총 IDLE 시간",val:`${totalIdle.toFixed(1)}h`,cl:"#854F0B"},{lbl:"건당 평균 IDLE",val:`${data.length?+(totalIdle/data.length).toFixed(2):0}h`,cl:"#185FA5"},{lbl:"최장 IDLE",val:`${data.length?Math.max(...data.map(r=>r.idle)).toFixed(1):0}h`,cl:"#A32D2D"}]
          .map((k,i)=>(<div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"7px 10px"}}><div style={{fontSize:9,color:"#999"}}>{k.lbl}</div><div style={{fontSize:16,fontWeight:600,color:k.cl}}>{k.val}</div></div>))}
      </div>
      <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
        <input style={{...s.input,width:155}} placeholder="검색..." value={q} onChange={e=>setQ(e.target.value)}/>
        <select style={s.select} value={fShift} onChange={e=>setFShift(e.target.value)}>
          <option value="">전체 Shift</option>
          {["I","II","III"].map(sh=><option key={sh} value={sh}>Shift {sh}</option>)}
        </select>
      </div>
      <div style={{overflowX:"auto",border:"0.5px solid #e0e0e0",borderRadius:10}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:800}}>
          <thead><tr>{["SL","날짜","자산번호","Shift","분류","라인","문제","원인","조치","팀","담당","시작","완료","IDLE"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {data.map(r=>(
              <tr key={r.sl} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                <td style={{...s.td,color:"#999"}}>{r.sl}</td>
                <td style={{...s.td,whiteSpace:"nowrap"}}>{r.date}</td>
                <td style={{...s.td,fontFamily:"monospace",fontSize:10,color:"#185FA5"}}>{r.assetNo}</td>
                <td style={s.td}><span style={s.pill(r.shift==="I"?"#E6F1FB":r.shift==="II"?"#FAEEDA":"#FCEBEB",r.shift==="I"?"#185FA5":r.shift==="II"?"#854F0B":"#A32D2D")}>{r.shift}</span></td>
                <td style={s.td}><span style={s.pill("#E6F1FB","#185FA5")}>{r.mainCat}</span></td>
                <td style={s.td}>{r.line}</td>
                <td style={{...s.td,fontSize:10,maxWidth:120}}>{r.problem}</td>
                <td style={{...s.td,fontSize:10,color:"#555",maxWidth:120}}>{r.reason}</td>
                <td style={{...s.td,fontSize:10,color:"#3B6D11",maxWidth:130}}>{r.action}</td>
                <td style={{...s.td,fontSize:10}}>{r.team}</td>
                <td style={{...s.td,fontSize:10}}>{r.checker}</td>
                <td style={{...s.td,fontSize:10,whiteSpace:"nowrap"}}>{r.start||"-"}</td>
                <td style={{...s.td,fontSize:10,whiteSpace:"nowrap"}}>{r.finish||"-"}</td>
                <td style={s.td}>{r.idle>0?<span style={s.pill("#FCEBEB","#A32D2D")}>{r.idle.toFixed(1)}h</span>:<span style={{color:"#ccc"}}>-</span>}</td>
              </tr>
            ))}
            {data.length===0&&<tr><td colSpan={14} style={{textAlign:"center",padding:30,color:"#999"}}>데이터 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ PM Plan ═══
function PMPlan({t}){
  const [tab,setTab]=useState("list");
  const [q,setQ]=useState("");
  const [fSt,setFSt]=useState("");
  const [calMonth,setCalMonth]=useState(4);
  const MONTHS_KO=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const data=useMemo(()=>PM_DATA.filter(r=>{
    if(q&&![r.assetNo,r.name,r.task].some(v=>v.toLowerCase().includes(q.toLowerCase()))) return false;
    if(fSt&&r.status!==fSt) return false;
    return true;
  }),[q,fSt]);
  const done=PM_DATA.filter(r=>r.status==="done").length;
  const rate=Math.round(done/PM_DATA.length*100);
  const evsByDay={};
  PM_DATA.forEach(r=>{const d=new Date(r.planDate);if(d.getMonth()===calMonth){const k=d.getDate();if(!evsByDay[k])evsByDay[k]=[];evsByDay[k].push(r);}});
  const firstDay=new Date(2026,calMonth,1).getDay();
  const dim=new Date(2026,calMonth+1,0).getDate();
  const evC=(r)=>r.status==="done"?{bg:"#F1EFE8",cl:"#5F5E5A"}:r.status==="delay"?{bg:"#FCEBEB",cl:"#A32D2D"}:r.cat==="Mould"?{bg:"#EEEDFE",cl:"#534AB7"}:r.cat==="Jig"?{bg:"#EAF3DE",cl:"#3B6D11"}:{bg:"#E6F1FB",cl:"#185FA5"};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
        {[{lbl:"전체",val:PM_DATA.length,cl:"#185FA5"},{lbl:"완료",val:done,cl:"#3B6D11"},{lbl:"예정",val:PM_DATA.filter(r=>r.status==="sched").length,cl:"#854F0B"},{lbl:"지연",val:PM_DATA.filter(r=>r.status==="delay").length,cl:"#A32D2D"},{lbl:"완료율",val:`${rate}%`,cl:rate>=80?"#3B6D11":"#A32D2D"}]
          .map((k,i)=>(<div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"7px 10px"}}><div style={{fontSize:9,color:"#999"}}>{k.lbl}</div><div style={{fontSize:15,fontWeight:600,color:k.cl}}>{k.val}</div></div>))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[["list","리스트"],["cal","캘린더"]].map(([v,lbl])=>(
          <button key={v} onClick={()=>setTab(v)} style={{...s.btn(tab===v?"#185FA5":"transparent",tab===v?"#fff":"#555"),border:`0.5px solid ${tab===v?"#185FA5":"#ccc"}`,borderRadius:999,fontSize:11}}>{lbl}</button>
        ))}
      </div>
      {tab==="list"&&(
        <>
          <div style={{display:"flex",gap:7,marginBottom:10}}>
            <input style={{...s.input,width:155}} placeholder="검색..." value={q} onChange={e=>setQ(e.target.value)}/>
            <select style={s.select} value={fSt} onChange={e=>setFSt(e.target.value)}>
              <option value="">전체 상태</option>
              {["done","sched","delay","prog"].map(s=><option key={s} value={s}>{t.status[s]}</option>)}
            </select>
          </div>
          <div style={{overflowX:"auto",border:"0.5px solid #e0e0e0",borderRadius:10}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:800}}>
              <thead><tr>{["자산번호","설비명","유형","라인","작업내용","Legend","주기","표준시간","계획일","담당자","상태"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map(r=>{
                  const legC={"PREDICTIVE":{bg:"#E6F1FB",cl:"#185FA5"},"PREVENTIVE":{bg:"#EAF3DE",cl:"#3B6D11"},"INSPECTION":{bg:"#9FE1CB",cl:"#04342C"},"AMC":{bg:"#FAEEDA",cl:"#854F0B"}}[r.legend]||{bg:"#eee",cl:"#555"};
                  return(
                    <tr key={r.id} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                      <td style={{...s.td,fontFamily:"monospace",fontSize:10,color:"#185FA5"}}>{r.assetNo}</td>
                      <td style={{...s.td,fontSize:11}}>{r.name}</td>
                      <td style={s.td}><span style={s.pill("#E6F1FB","#185FA5")}>{r.cat}</span></td>
                      <td style={s.td}>{r.line}</td>
                      <td style={{...s.td,fontSize:10,maxWidth:150}}>{r.task}</td>
                      <td style={s.td}><span style={s.pill(legC.bg,legC.cl)}>{r.legend}</span></td>
                      <td style={{...s.td,fontSize:10}}>{r.freq}</td>
                      <td style={{...s.td,textAlign:"center"}}>{r.std}h×{r.man}명</td>
                      <td style={{...s.td,whiteSpace:"nowrap"}}>{r.planDate}</td>
                      <td style={{...s.td,fontSize:10}}>{r.person}</td>
                      <td style={s.td}>{stPill(r.status,t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab==="cal"&&(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <button onClick={()=>setCalMonth(m=>m>0?m-1:11)} style={{...s.btn("#f5f5f5","#333"),border:"0.5px solid #ccc"}}>‹</button>
            <span style={{fontSize:14,fontWeight:500,minWidth:80,textAlign:"center"}}>2026년 {MONTHS_KO[calMonth]}</span>
            <button onClick={()=>setCalMonth(m=>m<11?m+1:0)} style={{...s.btn("#f5f5f5","#333"),border:"0.5px solid #ccc"}}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {["일","월","화","수","목","금","토"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:"#999",padding:"3px 0"}}>{d}</div>)}
            {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i} style={{minHeight:65,background:"#f9f9f9",borderRadius:6,border:"0.5px solid #e0e0e0",opacity:.4}}/>)}
            {Array(dim).fill(null).map((_,d)=>{
              const day=d+1;const evs=evsByDay[day]||[];
              return(
                <div key={day} style={{minHeight:65,background:"#fff",border:"0.5px solid #e0e0e0",borderRadius:6,padding:"3px 4px"}}>
                  <div style={{fontSize:9,fontWeight:500,color:"#555",marginBottom:2}}>{day}</div>
                  {evs.slice(0,3).map((r,i)=>{const ec=evC(r);return<div key={i} style={{fontSize:8,padding:"1px 3px",borderRadius:2,marginBottom:1,background:ec.bg,color:ec.cl,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.assetNo.split("-").slice(-1)[0]}</div>;})}
                  {evs.length>3&&<div style={{fontSize:8,color:"#999"}}>+{evs.length-3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ 설정 ═══
function Settings({t,lang,setLang}){
  const [users,setUsers]=useState(INIT_USERS);
  const [perms,setPerms]=useState(INIT_PERMS);
  const [saved,setSaved]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",dept:"",role:"Technician"});
  const [showAdd,setShowAdd]=useState(false);
  const [editPerm,setEditPerm]=useState(null);
  const pC=(v)=>({write:["#EAF3DE","#3B6D11"],read:["#E6F1FB","#185FA5"],none:["#F1EFE8","#5F5E5A"]}[v]||["#F1EFE8","#5F5E5A"]);
  return(
    <div>
      <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>{t.settings.title}</div>
      <div style={{...s.card,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:4}}>{t.settings.lang}</div>
        <div style={{fontSize:11,color:"#999",marginBottom:10}}>{t.settings.langSub}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {Object.entries(LANG_LABELS).map(([k,v])=>(
            <div key={k} onClick={()=>setLang(k)} style={{padding:"10px 12px",borderRadius:8,border:`${lang===k?"1.5px solid #185FA5":"0.5px solid #ccc"}`,background:lang===k?"#EBF3FC":"#f5f5f5",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:4}}>{LANG_FLAGS[k]}</div>
              <div style={{fontSize:12,fontWeight:lang===k?500:400,color:lang===k?"#185FA5":"#1a1a1a"}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{...s.card,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {t.settings.users}
          <button onClick={()=>setShowAdd(!showAdd)} style={s.btn("#185FA5","#fff")}>+ {t.settings.addUser}</button>
        </div>
        {showAdd&&(
          <div style={{background:"#f5f5f5",borderRadius:8,padding:10,marginBottom:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:7,alignItems:"center"}}>
            {["name","email","dept"].map(f=>(<input key={f} placeholder={t.settings[f]} value={newUser[f]} onChange={e=>setNewUser({...newUser,[f]:e.target.value})} style={{fontSize:11,padding:"5px 8px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",color:"#1a1a1a"}}/>))}
            <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={{fontSize:11,padding:"5px 8px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",color:"#1a1a1a"}}>
              {Object.keys(INIT_PERMS).map(r=><option key={r}>{r}</option>)}
            </select>
            <button onClick={()=>{if(newUser.name&&newUser.email){setUsers([...users,{id:Date.now(),...newUser,status:"pending"}]);setNewUser({name:"",email:"",dept:"",role:"Technician"});setShowAdd(false);}}} style={s.btn("#185FA5","#fff")}>{t.settings.save}</button>
          </div>
        )}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>{[t.settings.name,t.settings.email,t.settings.dept,t.settings.role,t.settings.status,t.settings.actions].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                  <td style={{...s.td,fontWeight:500}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:22,height:22,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:10,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{u.name[0]}</div>{u.name}</div></td>
                  <td style={{...s.td,fontSize:10,color:"#555"}}>{u.email}</td>
                  <td style={s.td}>{u.dept}</td>
                  <td style={s.td}><span style={s.pill("#E6F1FB","#185FA5")}>{u.role}</span></td>
                  <td style={s.td}><span style={s.pill(u.status==="active"?"#EAF3DE":"#FAEEDA",u.status==="active"?"#3B6D11":"#854F0B")}>{u.status==="active"?t.settings.active:t.settings.pending}</span></td>
                  <td style={s.td}>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>setEditPerm(editPerm===u.role?null:u.role)} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"0.5px solid #ccc",background:"transparent",color:"#185FA5",cursor:"pointer"}}>{t.settings.edit}</button>
                      {u.status==="pending"&&<button onClick={()=>setUsers(users.map(x=>x.id===u.id?{...x,status:"active"}:x))} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"0.5px solid #3B6D11",background:"#EAF3DE",color:"#3B6D11",cursor:"pointer"}}>{t.settings.approve}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={s.card}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:4}}>{t.settings.permissions}</div>
        <div style={{fontSize:11,color:"#999",marginBottom:10}}>{t.settings.permSub}</div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {Object.keys(INIT_PERMS).map(r=>(<button key={r} onClick={()=>setEditPerm(editPerm===r?null:r)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`${editPerm===r?"1.5px solid #185FA5":"0.5px solid #ccc"}`,background:editPerm===r?"#EBF3FC":"#f5f5f5",color:editPerm===r?"#185FA5":"#1a1a1a",cursor:"pointer",fontWeight:editPerm===r?500:400}}>{r}</button>))}
        </div>
        {editPerm&&(
          <div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr><th style={s.th}>{t.settings.role}: {editPerm}</th>{[t.settings.write,t.settings.read,t.settings.none].map(h=><th key={h} style={{...s.th,textAlign:"center"}}>{h}</th>)}</tr></thead>
              <tbody>
                {MENU_CATS.map(({key,icon})=>{
                  const cur=perms[editPerm]?.[key]||"none";const[bg,cl]=pC(cur);
                  return(<tr key={key} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                    <td style={{...s.td,display:"flex",alignItems:"center",gap:7}}><i className={`ti ${icon}`} style={{fontSize:13,color:"#999"}} aria-hidden="true"/><span>{T.ko.nav[key]}</span><span style={s.pill(bg,cl)}>{cur}</span></td>
                    {["write","read","none"].map(v=>(<td key={v} style={{...s.td,textAlign:"center"}}><input type="radio" name={`${editPerm}-${key}`} checked={cur===v} onChange={()=>setPerms(prev=>({...prev,[editPerm]:{...prev[editPerm],[key]:v}}))}/></td>))}
                  </tr>);
                })}
              </tbody>
            </table>
            <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
              <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}} style={s.btn("#185FA5","#fff")}>{t.settings.save}</button>
              <button onClick={()=>setEditPerm(null)} style={{...s.btn("transparent","#555"),border:"0.5px solid #ccc"}}>{t.settings.cancel}</button>
              {saved&&<span style={{fontSize:11,color:"#3B6D11"}}>✓ {t.settings.saved}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ 대시보드 ═══
function Dashboard({t,setPage,assets:dashAssets}){
  // 부모 fetch가 비었으면 로컬 INIT_ASSETS 폴백
  const ASSETS_DASH = (dashAssets&&dashAssets.length)?dashAssets:INIT_ASSETS;
  const BM_ALERTS=[
    {dot:"#E24B4A",title:"FRAM · DCMI-FRM-CRT-128 — 서보 에러",meta:"Robot / 08:42 · 라인정지 · IDLE 2.5h"},
    {dot:"#E24B4A",title:"CCB · DCMI-CCB-CRT-68 — Pendant 불량",meta:"Robot / 10:15 · IDLE 1.5h"},
    {dot:"#E24B4A",title:"PRESS · DCMI-PRS-HYD-01 — 유압 이상",meta:"Press / 11:30 · IDLE 1.3h"},
    {dot:"#EF9F27",title:"PROJECTION · DCMI-PWS-RSW-05 — 냉각수 누수",meta:"Welding / 13:05 · 임시조치 중"},
  ];
  const TODAY_PM=[
    {name:"DCMI-FRM-CRT-01",task:"TCP 교정",line:"FRAM",st:"prog"},
    {name:"DCMI-UTL-CMP-01",task:"에어필터 교체",line:"COMMON",st:"done"},
    {name:"AI3 CCB/QXI CCB",task:"Jig Sequence Check",line:"CCB",st:"done"},
    {name:"DCMI-PT-183",task:"Mould Punch 점검",line:"PRESS",st:"sched"},
    {name:"DCMI-PRS-NCLF-01",task:"NC Feeder 베어링",line:"PRESS",st:"delay"},
  ];
  return(
    <div>
      <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>{t.welcome} 👋 <span style={{color:"#185FA5"}}>나경태</span> — 오늘 현황 (2026.05.06)</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[{lbl:"전체 가동률",val:"87.3%",sub:"목표 90%",cl:"#854F0B"},{lbl:"BM 미완료",val:"11건",sub:"긴급 4 · 일반 7",cl:"#A32D2D"},{lbl:"PM 완료율(5월)",val:"68%",sub:"목표 90%",cl:"#854F0B"},{lbl:"MTTR 평균",val:"2.1h",sub:"목표 ≤3h",cl:"#3B6D11"}]
          .map((k,i)=>(<div key={i} style={s.card}><div style={{fontSize:9,color:"#999",marginBottom:3}}>{k.lbl}</div><div style={{fontSize:20,fontWeight:600,color:k.cl}}>{k.val}</div><div style={{fontSize:9,color:"#999",marginTop:2}}>{k.sub}</div></div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10,marginBottom:10}}>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:10,display:"flex",justifyContent:"space-between"}}>라인별 가동률<span style={{fontSize:10,color:"#185FA5",cursor:"pointer",fontWeight:400}} onClick={()=>setPage("avail")}>상세 →</span></div>
          {LINES_DATA.map(({l,v,m})=>(<div key={l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <div style={{fontSize:10,width:90,flexShrink:0}}>{l} <span style={{fontSize:9,color:"#999"}}>({m}대)</span></div>
            <div style={{flex:1,height:10,background:"#f0f0f0",borderRadius:5,overflow:"hidden"}}><div style={{width:`${v}%`,height:"100%",background:v>=90?"#639922":v>=85?"#EF9F27":"#E24B4A",borderRadius:5}}/></div>
            <div style={{fontSize:10,fontWeight:600,width:36,textAlign:"right",color:v>=90?"#3B6D11":v>=85?"#854F0B":"#A32D2D"}}>{v}%</div>
          </div>))}
        </div>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:10}}>Idle 설비 현황</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[{v:`${ASSETS_DASH.filter(a=>a.status==="Idle-NR").length}`,cl:"#A32D2D",lbl:"Non-running"},{v:`${ASSETS_DASH.filter(a=>a.status==="Idle-R").length}`,cl:"#854F0B",lbl:"Running(대기)"},{v:`${ASSETS_DASH.length}`,cl:"#185FA5",lbl:"전체 등록"},{v:`${ASSETS_DASH.filter(a=>a.status==="Fixed-Sale").length}`,cl:"#534AB7",lbl:"Fixed Sale"}]
              .map((d,i)=>(<div key={i} style={{background:"#f5f5f5",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:17,fontWeight:600,color:d.cl}}>{d.v}대</div><div style={{fontSize:9,color:"#999",marginTop:1}}>{d.lbl}</div></div>))}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between"}}>BM 긴급 알림<span style={{fontSize:10,color:"#185FA5",cursor:"pointer",fontWeight:400}} onClick={()=>setPage("bm")}>전체 →</span></div>
          {BM_ALERTS.map((b,i)=>(<div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0",borderBottom:i<BM_ALERTS.length-1?"0.5px solid #e0e0e0":"none"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:b.dot,marginTop:3,flexShrink:0}}/>
            <div><div style={{fontSize:11,fontWeight:500}}>{b.title}</div><div style={{fontSize:10,color:"#999",marginTop:1}}>{b.meta}</div></div>
          </div>))}
        </div>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between"}}>오늘 PM 일정<span style={{fontSize:10,color:"#185FA5",cursor:"pointer",fontWeight:400}} onClick={()=>setPage("pm")}>전체 →</span></div>
          {TODAY_PM.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<TODAY_PM.length-1?"0.5px solid #e0e0e0":"none"}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div><div style={{fontSize:10,color:"#999"}}>{p.task} · {p.line}</div></div>
            {stPill(p.st,t)}
          </div>))}
        </div>
      </div>
      <div style={{fontSize:11,fontWeight:500,marginBottom:8}}>빠른 이동 Quick Access</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[{icon:"ti-layout-list",lbl:"설비 마스터",pg:"master",sub:`${ASSETS_DASH.length}대 등록`},{icon:"ti-alert-triangle",lbl:"BM 이력",pg:"bm",sub:"긴급 4건"},{icon:"ti-tool",lbl:"PM Plan",pg:"pm",sub:"5월 68%"},{icon:"ti-chart-bar",lbl:"가동률 OEE",pg:"avail",sub:"87.3%"},{icon:"ti-clipboard-list",lbl:"작업지시",pg:"wo",sub:"미완료 3건"},{icon:"ti-package",lbl:"부품/재고",pg:"parts",sub:"준비중"},{icon:"ti-chart-line",lbl:"KPI 리포트",pg:"kpi",sub:"준비중"},{icon:"ti-settings",lbl:"설정",pg:"settings",sub:"언어·권한"}]
          .map(({icon,lbl,pg,sub})=>(<div key={pg} onClick={()=>setPage(pg)} style={{...s.card,textAlign:"center",cursor:"pointer",padding:14}}>
            <i className={`ti ${icon}`} style={{fontSize:20,color:"#185FA5",marginBottom:5,display:"block"}} aria-hidden="true"/>
            <div style={{fontSize:11,fontWeight:500}}>{lbl}</div>
            <div style={{fontSize:9,color:"#999",marginTop:2}}>{sub}</div>
          </div>))}
      </div>
    </div>
  );
}

// ═══ 메인 ═══
export default function DSCFMSPortal(){
  const [lang,setLang]=useState("ko");
  const [page,setPage]=useState("dashboard");
  const t=T[lang];
  const n=t.nav;
  const pageTitle={dashboard:"대시보드",master:"설비 마스터",avail:"가동률 OEE",bm:"BM 이력",pm:"PM Plan",settings:"설정",wo:"작업지시",parts:"부품/재고",kpi:"KPI 리포트",team:"팀 관리"};

  // ── Supabase: assets 테이블 로드 (단일 SSOT) ──
  // anon 권한으로 read. 실패 시 INIT_ASSETS로 폴백 → UX 보존.
  const [dbAssets,setDbAssets]=useState([]);
  const [dbLoading,setDbLoading]=useState(true);
  const [dbError,setDbError]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setDbLoading(true); setDbError(null);
      try{
        // 약 2,235건 — 한 번에 로드. range로 5000까지 (Supabase 기본 1000 cap 회피)
        const { data, error } = await supabase
          .from("assets")
          .select("machine_asset_number,name_en,model,make,location,status,asset_class_code,extra,asset_classes(code,category_code,name_en)")
          .order("machine_asset_number",{ascending:true})
          .range(0,4999);
        if(error) throw error;
        if(!cancelled) setDbAssets((data||[]).map(mapSupabaseAsset));
      }catch(e){
        if(!cancelled) setDbError(e.message||"DB 연결 실패");
      }finally{
        if(!cancelled) setDbLoading(false);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  // 실제 사용할 assets: DB 성공 → DB / 그 외(로딩·에러) → 로컬 폴백
  const effectiveAssets = (dbError||dbAssets.length===0) ? INIT_ASSETS : dbAssets;
  const totalLabel = dbLoading ? "…" : (dbError ? "!" : String(effectiveAssets.length));
  const idleR = effectiveAssets.filter(a=>a.status==="Idle-R").length;
  const idleNR = effectiveAssets.filter(a=>a.status==="Idle-NR").length;

  const NI=({pg,icon,label,badge})=>(
    <div onClick={()=>setPage(pg)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 14px",fontSize:11,color:page===pg?"#185FA5":"var(--color-text-secondary,#555)",cursor:"pointer",background:page===pg?"#EBF3FC":"transparent",borderRight:page===pg?"2px solid #185FA5":"2px solid transparent",fontWeight:page===pg?500:400}}>
      <i className={`ti ${icon}`} style={{fontSize:14,width:16,textAlign:"center"}} aria-hidden="true"/>
      <span style={{flex:1}}>{label}</span>
      {badge&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:999,fontWeight:600,background:badge.bg,color:badge.cl}}>{badge.v}</span>}
    </div>
  );

  return(
    <>
      <Head>
        <title>DSC FMS Portal</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <meta name="theme-color" content="#0f172a"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
        <style>{`
          body{margin:0;background:#0f172a;} *{box-sizing:border-box;}
          @media (max-width: 600px){
            .dsc-sidebar{display:none !important;}
            .dsc-shell{height:auto !important; min-height:100vh; max-width:480px; margin:0 auto;}
            .dsc-main{padding:12px !important;}
            .dsc-topbar{flex-wrap:wrap;}
            .dsc-content-scroll{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px) + 24px) !important;}
            table{font-size:11px !important;}
          }
        `}</style>
      </Head>
      <div className="dsc-shell" style={{display:"flex",height:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:"#1a1a1a",background:"#0f172a"}}>
        <nav className="dsc-sidebar" style={{width:200,background:"var(--color-background-primary,#fff)",borderRight:"0.5px solid #e0e0e0",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"12px 14px",borderBottom:"0.5px solid #e0e0e0"}}>
            <div style={{fontSize:13,fontWeight:500}}>{t.appName}</div>
            <div style={{fontSize:10,color:"#999",marginTop:1}}>{t.appSub}</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
            <div style={{fontSize:9,color:"#999",padding:"6px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.overview}</div>
            <NI pg="dashboard" icon="ti-layout-dashboard" label={n.dashboard}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.asset}</div>
            <NI pg="master" icon="ti-layout-list" label={n.master} badge={{v:totalLabel,bg:dbError?"#FCEBEB":"#E6F1FB",cl:dbError?"#A32D2D":"#185FA5"}}/>
            <NI pg="avail" icon="ti-chart-bar" label={n.avail}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.maint}</div>
            <NI pg="bm" icon="ti-alert-triangle" label={n.bm} badge={{v:"4",bg:"#FCEBEB",cl:"#A32D2D"}}/>
            <NI pg="pm" icon="ti-tool" label={n.pm} badge={{v:"7",bg:"#FAEEDA",cl:"#854F0B"}}/>
            <NI pg="wo" icon="ti-clipboard-list" label={n.wo} badge={{v:"3",bg:"#FCEBEB",cl:"#A32D2D"}}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.inv}</div>
            <NI pg="parts" icon="ti-package" label={n.parts}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.analytics}</div>
            <NI pg="kpi" icon="ti-chart-line" label={n.kpi}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.system}</div>
            <NI pg="team" icon="ti-users" label={n.team}/>
            <NI pg="settings" icon="ti-settings" label={n.settings}/>
          </div>
          <div style={{padding:"10px 14px",borderTop:"0.5px solid #e0e0e0"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>나</div>
              <div><div style={{fontSize:11,fontWeight:500}}>나경태</div><div style={{fontSize:9,color:"#999"}}>{t.role}</div></div>
            </div>
          </div>
        </nav>
        <div className="dsc-main" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff"}}>
          <div className="dsc-topbar" style={{background:"var(--color-background-primary,#fff)",borderBottom:"0.5px solid #e0e0e0",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",flexShrink:0}}>
            <div style={{fontSize:11,color:"#999"}}>{t.appName} › <span style={{color:"#1a1a1a",fontWeight:500}}>{pageTitle[page]||page}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
              {[{v:`${t.bmUrgent} 4`,bg:"#FCEBEB",cl:"#A32D2D"},{v:`${t.pmToday} 7`,bg:"#FAEEDA",cl:"#854F0B"},{v:`${t.idleR} ${idleR}`,bg:"#E6F1FB",cl:"#185FA5"},{v:`${t.idleNR} ${idleNR}`,bg:"#FCEBEB",cl:"#A32D2D"}]
                .map((p,i)=><span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:999,fontWeight:500,background:p.bg,color:p.cl}}>{p.v}</span>)}
              <select value={lang} onChange={e=>setLang(e.target.value)} style={{fontSize:10,padding:"3px 6px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",cursor:"pointer"}}>
                {Object.entries(LANG_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
              <span style={{fontSize:10,color:"#999"}}>2026.05.06</span>
            </div>
          </div>
          <div className="dsc-content-scroll" style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
            {page==="dashboard"&&<Dashboard t={t} setPage={setPage} assets={effectiveAssets}/>}
            {page==="master"&&<AssetMaster t={t} extAssets={effectiveAssets} extLoading={dbLoading} extError={dbError}/>}
            {page==="avail"&&<Availability t={t}/>}
            {page==="bm"&&<BMHistory t={t}/>}
            {page==="pm"&&<PMPlan t={t}/>}
            {page==="settings"&&<Settings t={t} lang={lang} setLang={setLang}/>}
            {["wo","parts","kpi","team"].includes(page)&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:10,color:"#999"}}>
                <i className="ti ti-tools" style={{fontSize:40}} aria-hidden="true"/>
                <div style={{fontSize:14,fontWeight:500,color:"#555"}}>{pageTitle[page]}</div>
                <div style={{fontSize:12,textAlign:"center",maxWidth:280,lineHeight:1.6}}>추후 개발 예정</div>
                <button onClick={()=>setPage("dashboard")} style={{marginTop:8,fontSize:12,padding:"7px 18px",borderRadius:8,background:"#185FA5",color:"#fff",border:"none",cursor:"pointer"}}>← Dashboard</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
