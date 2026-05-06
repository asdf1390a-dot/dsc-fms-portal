import { useState, useMemo } from "react";
import Head from "next/head";

// ═══════════════════════════════════════════
// 다국어
// ═══════════════════════════════════════════
const T = {
  ko: {
    appName:"DSC FMS 포털", appSub:"Daechang Seat · Chennai Plant",
    welcome:"안녕하세요", role:"생산/기술/보전/생산관리 총괄",
    nav:{overview:"개요",dashboard:"대시보드",asset:"설비",master:"설비 마스터",
      avail:"가동률 OEE",maint:"보전",bm:"BM 이력",pm:"PM Plan",
      wo:"작업지시",inv:"재고",parts:"부품/재고",analytics:"분석",
      kpi:"KPI 리포트",system:"시스템",team:"팀 관리",settings:"설정"},
    status:{done:"완료",sched:"예정",delay:"지연",prog:"진행중",active:"Active","idle-r":"Idle(R)","idle-nr":"Idle(NR)","fixed-sale":"Fixed Sale"},
    bmUrgent:"BM 긴급", pmToday:"PM 오늘", idleR:"Idle(R)", idleNR:"Idle(NR)",
    search:"검색...", allLines:"전체 라인", allCat:"전체 분류", allStatus:"전체 상태",
    allShift:"전체 Shift", export:"내보내기", register:"등록",
    settings:{title:"설정",lang:"언어 설정",langSub:"앱 표시 언어를 선택하세요",
      users:"사용자 목록",addUser:"신규 사용자",name:"이름",email:"이메일",
      dept:"부서",role:"역할",status:"상태",actions:"액션",
      active:"활성",pending:"승인대기",edit:"편집",approve:"승인",
      permissions:"카테고리별 권한",permSub:"신규 사용자 기본 권한",
      read:"읽기",write:"쓰기",none:"없음",save:"저장",cancel:"취소",saved:"저장됨"},
  },
  en: {
    appName:"DSC FMS Portal", appSub:"Daechang Seat · Chennai Plant",
    welcome:"Hello", role:"Production / Tech / Maintenance GM",
    nav:{overview:"Overview",dashboard:"Dashboard",asset:"Assets",master:"Asset Master",
      avail:"Availability OEE",maint:"Maintenance",bm:"BM History",pm:"PM Plan",
      wo:"Work Order",inv:"Inventory",parts:"Parts / Stock",analytics:"Analytics",
      kpi:"KPI Report",system:"System",team:"Team",settings:"Settings"},
    status:{done:"Done",sched:"Scheduled",delay:"Overdue",prog:"In Progress",active:"Active","idle-r":"Idle(R)","idle-nr":"Idle(NR)","fixed-sale":"Fixed Sale"},
    bmUrgent:"BM Urgent", pmToday:"PM Today", idleR:"Idle(R)", idleNR:"Idle(NR)",
    search:"Search...", allLines:"All Lines", allCat:"All Categories", allStatus:"All Status",
    allShift:"All Shifts", export:"Export", register:"Register",
    settings:{title:"Settings",lang:"Language",langSub:"Select display language",
      users:"User List",addUser:"Add User",name:"Name",email:"Email",
      dept:"Dept",role:"Role",status:"Status",actions:"Actions",
      active:"Active",pending:"Pending",edit:"Edit",approve:"Approve",
      permissions:"Category Permissions",permSub:"Default permissions for new users",
      read:"Read",write:"Write",none:"None",save:"Save",cancel:"Cancel",saved:"Saved"},
  },
  hi: {
    appName:"DSC FMS पोर्टल", appSub:"Daechang Seat · चेन्नई प्लांट",
    welcome:"नमस्ते", role:"उत्पादन/तकनीक/रखरखाव प्रमुख",
    nav:{overview:"अवलोकन",dashboard:"डैशबोर्ड",asset:"संपत्ति",master:"एसेट मास्टर",
      avail:"उपलब्धता OEE",maint:"रखरखाव",bm:"BM इतिहास",pm:"PM योजना",
      wo:"कार्य आदेश",inv:"इन्वेंटरी",parts:"पुर्जे",analytics:"विश्लेषण",
      kpi:"KPI रिपोर्ट",system:"सिस्टम",team:"टीम",settings:"सेटिंग्स"},
    status:{done:"पूर्ण",sched:"निर्धारित",delay:"विलंबित",prog:"प्रगति में",active:"Active","idle-r":"Idle(R)","idle-nr":"Idle(NR)","fixed-sale":"Fixed Sale"},
    bmUrgent:"BM आपातकाल", pmToday:"PM आज", idleR:"Idle(R)", idleNR:"Idle(NR)",
    search:"खोजें...", allLines:"सभी लाइनें", allCat:"सभी श्रेणियां", allStatus:"सभी स्थिति",
    allShift:"सभी Shift", export:"निर्यात", register:"पंजीकृत",
    settings:{title:"सेटिंग्स",lang:"भाषा",langSub:"भाषा चुनें",
      users:"उपयोगकर्ता",addUser:"नया उपयोगकर्ता",name:"नाम",email:"ईमेल",
      dept:"विभाग",role:"भूमिका",status:"स्थिति",actions:"कार्रवाई",
      active:"सक्रिय",pending:"लंबित",edit:"संपादित",approve:"स्वीकृत",
      permissions:"अनुमतियाँ",permSub:"नए उपयोगकर्ताओं के लिए",
      read:"पढ़ें",write:"लिखें",none:"कोई नहीं",save:"सहेजें",cancel:"रद्द",saved:"सहेजा गया"},
  },
  ta: {
    appName:"DSC FMS போர்டல்", appSub:"Daechang Seat · சென்னை ஆலை",
    welcome:"வணக்கம்", role:"உற்பத்தி/தொழில்நுட்பம்/பராமரிப்பு தலைவர்",
    nav:{overview:"கண்ணோட்டம்",dashboard:"டாஷ்போர்டு",asset:"சொத்துக்கள்",master:"சொத்து பட்டியல்",
      avail:"கிடைக்கும் தன்மை OEE",maint:"பராமரிப்பு",bm:"BM வரலாறு",pm:"PM திட்டம்",
      wo:"பணி உத்தரவு",inv:"சரக்கு",parts:"பாகங்கள்",analytics:"பகுப்பாய்வு",
      kpi:"KPI அறிக்கை",system:"அமைப்பு",team:"குழு",settings:"அமைப்புகள்"},
    status:{done:"முடிந்தது",sched:"திட்டமிட்டது",delay:"தாமதம்",prog:"நடப்பில்",active:"Active","idle-r":"Idle(R)","idle-nr":"Idle(NR)","fixed-sale":"Fixed Sale"},
    bmUrgent:"BM அவசரம்", pmToday:"PM இன்று", idleR:"Idle(R)", idleNR:"Idle(NR)",
    search:"தேடு...", allLines:"அனைத்து வரிசைகள்", allCat:"அனைத்து வகைகள்", allStatus:"அனைத்து நிலை",
    allShift:"அனைத்து Shift", export:"ஏற்றுமதி", register:"பதிவு",
    settings:{title:"அமைப்புகள்",lang:"மொழி",langSub:"மொழியை தேர்ந்தெடுக்கவும்",
      users:"பயனர் பட்டியல்",addUser:"புதிய பயனர்",name:"பெயர்",email:"மின்னஞ்சல்",
      dept:"துறை",role:"பங்கு",status:"நிலை",actions:"செயல்கள்",
      active:"செயலில்",pending:"நிலுவையில்",edit:"திருத்து",approve:"அனுமதி",
      permissions:"அனுமதிகள்",permSub:"புதிய பயனர்களுக்கான இயல்புநிலை",
      read:"படி",write:"எழுது",none:"இல்லை",save:"சேமி",cancel:"ரத்து",saved:"சேமிக்கப்பட்டது"},
  },
};
const LANG_LABELS={ko:"한국어",en:"English",hi:"हिन्दी",ta:"தமிழ்"};
const LANG_FLAGS={ko:"🇰🇷",en:"🇬🇧",hi:"🇮🇳",ta:"🇮🇳"};

// ═══════════════════════════════════════════
// 색상 헬퍼
// ═══════════════════════════════════════════
const LINE_COLOR={FRAM:"#378ADD",CCB:"#D4537E",PRESS:"#639922",PROJECTION:"#EF9F27",COMMON:"#888780"};
const CAT_META={
  "01":{label:"Utility",      color:"#0F6E56",bg:"#E1F5EE"},
  "02":{label:"Process",      color:"#185FA5",bg:"#E6F1FB"},
  "03":{label:"Press",        color:"#534AB7",bg:"#EEEDFE"},
  "04":{label:"Robot",        color:"#993C1D",bg:"#FAECE7"},
  "05":{label:"Welding",      color:"#854F0B",bg:"#FAEEDA"},
  "06":{label:"Assembly Tool",color:"#3B6D11",bg:"#EAF3DE"},
  "07":{label:"ETC",          color:"#5F5E5A",bg:"#F1EFE8"},
  "08":{label:"Laser",        color:"#993556",bg:"#FBEAF0"},
  "09":{label:"Jig",          color:"#185FA5",bg:"#E6F1FB"},
  "10":{label:"Mould",        color:"#534AB7",bg:"#EEEDFE"},
  "11":{label:"Idle Machine", color:"#A32D2D",bg:"#FCEBEB"},
  "12":{label:"Fixed Asset Sale",color:"#534AB7",bg:"#EEEDFE"},
  "15":{label:"PLT",          color:"#0F6E56",bg:"#E1F5EE"},
};
const ST_COLOR={
  "Active":   {bg:"#EAF3DE",cl:"#3B6D11"},
  "Idle-R":   {bg:"#FAEEDA",cl:"#854F0B"},
  "Idle-NR":  {bg:"#FCEBEB",cl:"#A32D2D"},
  "Fixed-Sale":{bg:"#EEEDFE",cl:"#534AB7"},
};
const stPill=(st,t)=>{const map={done:["#EAF3DE","#3B6D11"],sched:["#FAEEDA","#854F0B"],delay:["#FCEBEB","#A32D2D"],prog:["#E6F1FB","#185FA5"]};const[bg,cl]=map[st]||map.sched;return<span style={{fontSize:9,padding:"2px 7px",borderRadius:999,fontWeight:500,background:bg,color:cl,whiteSpace:"nowrap"}}>{t.status[st]}</span>;};

// ═══════════════════════════════════════════
// 데이터
// ═══════════════════════════════════════════
// DSC FMS Portal - 실제 설비 데이터 (400+ 자산)
// 시트 01~13의 전체 설비 정보 포함

export const ASSETS = [
  // ===== SHEET 01: UTILITY (전력, 공압, 냉각 등 기반 설비) =====
  {
    id: 'DCMI-UTL-PSF-01',
    name: 'SUB STATION',
    category: '01-Utility',
    model: 'EB - SUB STSTION',
    manufacturer: 'NILL',
    location: 'EB YARD',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-PSF-02',
    name: 'VCB - 01',
    category: '01-Utility',
    model: 'EB - VCB',
    manufacturer: 'SIEMENS',
    location: 'MV PANNEL ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-PSF-03',
    name: 'VCB - 02',
    category: '01-Utility',
    model: 'EB - VCB',
    manufacturer: 'SIEMENS',
    location: 'MV PANNEL ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-PSF-04',
    name: 'HT POWER TRANSFORMER - 01',
    category: '01-Utility',
    model: 'EB - TRANSFORMER-1 1000KVA (677/1)',
    manufacturer: 'TRINITY',
    location: 'TRANSFORMER YARD',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-PSF-05',
    name: 'HT POWER TRANSFORMER - 02',
    category: '01-Utility',
    model: 'EB - TRANSFORMER-2 1000KVA (970/1)',
    manufacturer: 'TRINITY',
    location: 'TRANSFORMER YARD',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-MVP-01',
    name: 'MV PANNEL - 01 (1000KVA TR1)',
    category: '01-Utility',
    model: '15 OUTPUT SWITCH',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-MVP-02',
    name: 'MV PANNEL - 02 (1000KVA TR2)',
    category: '01-Utility',
    model: '12 OUTPUT SWITCH',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-MVP-03',
    name: 'MV PANNEL - 03 (300KVA UPS PANNEL)',
    category: '01-Utility',
    model: '10 OUTPUT SWITCH',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM',
    type: 'Power',
    status: 'Active',
  },
  // SSB (Sub Switch Board) - 22개
  {
    id: 'DCMI-LTP-SSB-01',
    name: 'SSB - 01 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 08',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (COMPRESSOR ROOM)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-02',
    name: 'SSB - 02 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 08',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-03',
    name: 'SSB - 03 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 08',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-04',
    name: 'SSB - 04 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 09',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-05',
    name: 'SSB - 05 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 10',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-06',
    name: 'SSB - 06 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '400 A / SWITCH - 11',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-07',
    name: 'SSB - 07 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-08',
    name: 'SSB - 08 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '400 A / SWITCH - 13',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-09',
    name: 'SSB - 09 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '400 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-10',
    name: 'SSB - 10 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-11',
    name: 'SSB - 11 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '400 A / SWITCH - 11',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-12',
    name: 'SSB - 12 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '400 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-13',
    name: 'SSB - 13 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 10',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-14',
    name: 'SSB - 14 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (SHOP FLOOR)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-15',
    name: 'SSB - 15 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 10',
    manufacturer: 'NILL',
    location: 'PLANT - 02 (PRESS SHOP AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-16',
    name: 'SSB - 16 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 02 (PRESS SHOP AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-17',
    name: 'SSB - 17 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 02 (PRESS SHOP AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-18',
    name: 'SSB - 18 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 12',
    manufacturer: 'NILL',
    location: 'PLANT - 02 (PRESS SHOP AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-19',
    name: 'SSB - 19 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '400 A / SWITCH - 10',
    manufacturer: 'NILL',
    location: 'PLANT - 03 (SU2I CCB AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-20',
    name: 'SSB - 20 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 14',
    manufacturer: 'NILL',
    location: 'PLANT - 04 (BN7I LINE AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-21',
    name: 'SSB - 21 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '630 A / SWITCH - 14',
    manufacturer: 'NILL',
    location: 'PLANT - 04 (BN7I LINE AREA)',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-SSB-22',
    name: 'SSB - 22 (SUB SWITCH BOARD PANNEL)',
    category: '01-Utility',
    model: '250 A / SWITCH - 01',
    manufacturer: 'NILL',
    location: 'PLANT - 01 (COMPRESSOR ROOM)',
    type: 'Power',
    status: 'Active',
  },
  // Capacitor & Reactor Bank Panels
  {
    id: 'DCMI-LTP-CBP-01',
    name: 'CAPACITOR BANK PANNEL',
    category: '01-Utility',
    model: '200KVAR',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM - MV PANNEL 01',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-CBP-02',
    name: 'CAPACITOR BANK PANNEL',
    category: '01-Utility',
    model: '300KVAR',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM - MV PANNEL 01',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-CBP-03',
    name: 'CAPACITOR BANK PANNEL',
    category: '01-Utility',
    model: '300KVAR',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM - MV PANNEL 02',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-LTP-RBP-01',
    name: 'REACTOR BANK PANNEL',
    category: '01-Utility',
    model: '300KVAR',
    manufacturer: 'NILL',
    location: 'EB PANNEL ROOM - MV PANNEL 01',
    type: 'Power',
    status: 'Active',
  },
  // Air Compressors
  {
    id: 'DCMI-UTL-CMP-01',
    name: 'AIR COMPRESSOR 50HP - 01',
    category: '01-Utility',
    model: 'COMPRESSOR-1 50HP (BSD 72-1034)',
    manufacturer: 'KAESER',
    location: 'COMPRESSOR ROOM - 01',
    type: 'Pneumatic',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CMP-02',
    name: 'AIR COMPRESSOR 50HP - 02',
    category: '01-Utility',
    model: 'COMPRESSOR-2 50HP(BSD 72-2515)',
    manufacturer: 'KAESER',
    location: 'COMPRESSOR ROOM - 01',
    type: 'Pneumatic',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CMP-03',
    name: 'AIR COMPRESSOR 50HP - 03',
    category: '01-Utility',
    model: 'COMPRESSOR-3 50HP (BSD 72-1109)',
    manufacturer: 'KAESER',
    location: 'COMPRESSOR ROOM - 02',
    type: 'Pneumatic',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CMP-04',
    name: 'AIR COMPRESSOR 100HP - 04',
    category: '01-Utility',
    model: 'COMPRESSOR-4 100HP(CSDX 137-1676)',
    manufacturer: 'KAESER',
    location: 'COMPRESSOR ROOM - 02',
    type: 'Pneumatic',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CMP-05',
    name: 'AIR COMPRESSOR 100HP - 05 WITH DRIYER',
    category: '01-Utility',
    model: 'CSDX 140T / ABT 165',
    manufacturer: 'KAYSER',
    location: 'COMPRESSOR ROOM - 03',
    type: 'Pneumatic',
    status: 'Active',
  },
  // Air Dryers
  {
    id: 'DCMI-UTL-DIR-01',
    name: 'AIR DRIYER-01 (8000CFM)',
    category: '01-Utility',
    model: 'ELIX 080 DA',
    manufacturer: 'SUMMITS',
    location: 'COMPRESSOR ROOM-01',
    type: 'Pneumatic',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-DIR-02',
    name: 'AIR DRIYER-02 (1100CFM)',
    category: '01-Utility',
    model: 'FDI-1910A',
    manufacturer: 'DELAIR',
    location: 'COMPRESSOR ROOM-02',
    type: 'Pneumatic',
    status: 'Active',
  },
  // Air Receiver Tanks
  {
    id: 'DCMI-UTL-RCR-01',
    name: 'AIR RECIVER TANK - 01',
    category: '01-Utility',
    model: '2KL',
    manufacturer: 'NILL',
    location: 'COMPRESSOR ROOM - 01',
    type: 'Pneumatic',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-RCR-02',
    name: 'AIR RECIVER TANK - 02',
    category: '01-Utility',
    model: '5KL',
    manufacturer: 'NILL',
    location: 'COMPRESSOR ROOM - 02',
    type: 'Pneumatic',
    status: 'Active',
  },
  // Gas Plants
  {
    id: 'DCMI-UTL-GSF-01',
    name: 'GAS PLANT - CO2 GAS',
    category: '01-Utility',
    model: '20TON',
    manufacturer: 'NILL',
    location: 'GAS PLANT',
    type: 'Gas',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-GSF-02',
    name: 'GAS PLANT - ARGON GAS',
    category: '01-Utility',
    model: '6KL',
    manufacturer: 'NILL',
    location: 'GAS PLANT',
    type: 'Gas',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-GSF-03',
    name: 'GAS PLANT - NITROGEN GAS',
    category: '01-Utility',
    model: '6KL',
    manufacturer: 'NILL',
    location: 'GAS PLANT',
    type: 'Gas',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-GSF-04',
    name: 'GAS PLANT - ARGON GAS MIXER UNIT',
    category: '01-Utility',
    model: '6KL',
    manufacturer: 'NILL',
    location: 'GAS PLANT',
    type: 'Gas',
    status: 'Active',
  },
  // Cooling & Utilities
  {
    id: 'DCMI-UTL-ALF-01',
    name: 'COOLING TOWER - 01',
    category: '01-Utility',
    model: 'COOLING TOWER-1 (100TR)',
    manufacturer: 'NILL',
    location: 'PLANT TOP SIDE AERA',
    type: 'Cooling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-ALF-02',
    name: 'COOLING TOWER - 02',
    category: '01-Utility',
    model: 'COOLING TOWER-2 (100TR)',
    manufacturer: 'NILL',
    location: 'PLANT TOP SIDE AERA',
    type: 'Cooling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-ALF-03',
    name: 'FIRE FIGHTING',
    category: '01-Utility',
    model: 'FIRE FIGHTING',
    manufacturer: 'NILL',
    location: 'PUMP ROOM AREA',
    type: 'Safety',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-ALF-04',
    name: 'WATER PUMP ROOM',
    category: '01-Utility',
    model: 'WATER PUMP',
    manufacturer: 'NILL',
    location: 'PUMP ROOM AREA',
    type: 'Utility',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-DCF-01',
    name: 'STP PLANT',
    category: '01-Utility',
    model: 'STP PLANT (40KL)',
    manufacturer: 'NILL',
    location: 'STP PLANT AREA',
    type: 'Utility',
    status: 'Active',
  },
  // Material Handling
  {
    id: 'DCMI-UTL-MHC-01',
    name: 'E O T CRANE 10TON',
    category: '01-Utility',
    model: 'EOT CRANE',
    manufacturer: 'HINGETECH',
    location: 'PRESS SHOP',
    type: 'Material Handling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-MHF-01',
    name: 'FORKLIFT 3TON - 01 (DIESEL)',
    category: '01-Utility',
    model: '3TON GX 300',
    manufacturer: 'GODREJ',
    location: 'PRES SHOP',
    type: 'Material Handling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-MHF-02',
    name: 'FORKLIFT 3TON - 03 (DIESEL)',
    category: '01-Utility',
    model: '3TON GX 300D',
    manufacturer: 'GODREJ',
    location: 'MATERIALS INCOMMING AREA',
    type: 'Material Handling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-MHS-01',
    name: 'SCISSOR LIFTER 1',
    category: '01-Utility',
    model: '2TON',
    manufacturer: 'NILL',
    location: 'MATERIALS INCOMMING AREA',
    type: 'Material Handling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-MHS-02',
    name: 'SCISSOR LIFTER 2',
    category: '01-Utility',
    model: '2TON',
    manufacturer: 'NILL',
    location: 'SALES DISPATCH AREA',
    type: 'Material Handling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-MHS-03',
    name: 'SCISSOR LIFTER 3',
    category: '01-Utility',
    model: '2TON',
    manufacturer: 'NILL',
    location: 'CANTEEN AREA',
    type: 'Material Handling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-MHO-01',
    name: '1500KG ELECTRIC STACKER',
    category: '01-Utility',
    model: 'VXHSE-1500/3500 SE',
    manufacturer: 'VANJAX',
    location: 'SHOP FLOOR COMMON',
    type: 'Material Handling',
    status: 'Active',
  },
  // UPS Systems
  {
    id: 'DCMI-UTL-UPS-01',
    name: '150KVA (314A) UPS',
    category: '01-Utility',
    model: '150 KVA  (WPU1503)',
    manufacturer: 'WORLD POWER',
    location: 'UPS ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-UPS-02',
    name: '300KVA (455A )UPS',
    category: '01-Utility',
    model: '300 KVA (KR33300T)',
    manufacturer: 'UPS',
    location: 'UPS ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-UPS-03',
    name: '10KVA (45A) UPS',
    category: '01-Utility',
    model: '9E10KS-IN',
    manufacturer: 'EATON POWER',
    location: 'UPS ROOM',
    type: 'Power',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-INV-01',
    name: '1725 VA INVERTER MACHINE',
    category: '01-Utility',
    model: 'LIV FAST FCS1725/24V',
    manufacturer: 'LIV FAST',
    location: 'SECURITY ROOM',
    type: 'Power',
    status: 'Active',
  },

  // ===== SHEET 02: PROCESS (공구실 기계) =====
  {
    id: 'DCMI-TLS-LTM-01',
    name: 'LATHE MACHINE',
    category: '02-Process',
    model: 'HL-460',
    manufacturer: 'HWACHON',
    location: 'TOOL ROOM',
    type: 'Machine Tool',
    status: 'Active',
  },
  {
    id: 'DCMI-TLS-MLM-01',
    name: 'MILLING MACHINE',
    category: '02-Process',
    model: 'HMTH-1100',
    manufacturer: 'HWACHON',
    location: 'TOOL ROOM',
    type: 'Machine Tool',
    status: 'Active',
  },
  {
    id: 'DCMI-TLS-MLM-02',
    name: 'MILLING MACHINE',
    category: '02-Process',
    model: '4ES',
    manufacturer: 'ESTEAM',
    location: 'TOOL ROOM',
    type: 'Machine Tool',
    status: 'Active',
  },
  {
    id: 'DCMI-TLS-SGM-01',
    name: 'SURFACE GRINDING MACHINE',
    category: '02-Process',
    model: 'PFG-2550AH',
    manufacturer: 'PERFECT M/C',
    location: 'TOOL ROOM',
    type: 'Machine Tool',
    status: 'Active',
  },

  // ===== SHEET 03: PRESS (프레스 및 공급기) =====
  // SAMHO 200TON Presses
  {
    id: 'DCMI-PRS-02',
    name: 'SAMHO 200TON (A2)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-03',
    name: 'SAMHO 200TON (A3)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-04',
    name: 'SAMHO 200TON (A4)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-05',
    name: 'SAMHO 200TON (A5)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-06',
    name: 'SAMHO 200TON (A6)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-07',
    name: 'SAMHO 200TON (A7)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-08',
    name: 'SAMHO 200TON (A8)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-09',
    name: 'SAMHO 200TON (A9)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-10',
    name: 'SAMHO 200TON (A10)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-12',
    name: 'SAMHO 160TON (A12)',
    category: '03-Press',
    model: '160TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-13',
    name: 'SANGYONG 150TON (A13)',
    category: '03-Press',
    model: '160TON',
    manufacturer: 'SANGYONG',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  // SIMPAC Presses
  {
    id: 'DCMI-PRS-15',
    name: 'SIMPAC 200TON (B2)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-16',
    name: 'SIMPAC 200TON (B3)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-17',
    name: 'SIMPAC 200TON (B4)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-18',
    name: 'SIMPAC 200TON (B5)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-19',
    name: 'SIMPAC 200TON (B6)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-20',
    name: 'SIMPAC 200TON (B7)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  // More SAMHO Presses
  {
    id: 'DCMI-PRS-21',
    name: 'SAMHO 200TON (B8)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-22',
    name: 'SAMHO 200TON (B9)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-23',
    name: 'SAMHO 200TON (B10)',
    category: '03-Press',
    model: '200TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  // KUKIL Presses
  {
    id: 'DCMI-PRS-24',
    name: 'KUKIL 110TON (B11)',
    category: '03-Press',
    model: '110TON',
    manufacturer: 'KUKIL',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-25',
    name: 'KUKIL 110TON (B12)',
    category: '03-Press',
    model: '110TON',
    manufacturer: 'KUKIL',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-26',
    name: 'KUKIL 110TON (B13)',
    category: '03-Press',
    model: '110TON',
    manufacturer: 'KUKIL',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  // Large Presses
  {
    id: 'DCMI-PRS-27',
    name: 'SAMHO 300TON (C1)',
    category: '03-Press',
    model: '300TON',
    manufacturer: 'SAMHO',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-28',
    name: 'SIMPAC 250TON (C2)',
    category: '03-Press',
    model: '250TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-29',
    name: 'SIMPAC 250TON (C3)',
    category: '03-Press',
    model: '250TON',
    manufacturer: 'SIMPAC',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-30',
    name: 'KUKIL 250TON (C4)',
    category: '03-Press',
    model: '250TON',
    manufacturer: 'KUKIL',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-31',
    name: 'KUKIL 250TON (C5)',
    category: '03-Press',
    model: '250TON',
    manufacturer: 'KUKIL',
    location: 'PRESS SHOP',
    type: 'Press',
    status: 'Active',
  },
  // NC Level Feeders
  {
    id: 'DCMI-PRS-NCLF-01',
    name: 'NC LEVEL FEEDER - 01',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCLF-02',
    name: 'NC LEVEL FEEDER - 02',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCLF-03',
    name: 'NC LEVEL FEEDER - 03',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCLF-04',
    name: 'NC LEVEL FEEDER - 04',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCLF-05',
    name: 'NC LEVEL FEEDER - 05',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  // NC Coil Feeders
  {
    id: 'DCMI-PRS-NCCF-01',
    name: 'NC COIL FEEDER - 01',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCCF-02',
    name: 'NC COIL FEEDER - 02',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCCF-03',
    name: 'NC COIL FEEDER - 03',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCCF-04',
    name: 'NC COIL FEEDER - 04',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-NCCF-05',
    name: 'NC COIL FEEDER - 05',
    category: '03-Press',
    model: 'DM-NCLF-800M',
    manufacturer: 'KDM',
    location: 'PRESS SHOP',
    type: 'Feeder',
    status: 'Active',
  },
  // Hydraulic Presses
  {
    id: 'DCMI-PRS-HYD-01',
    name: 'HYDRAULIC PRESS 80TON',
    category: '03-Press',
    model: 'DYMSP-80',
    manufacturer: 'DAEYANG',
    location: 'PS7I',
    type: 'Press',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-HYD-02',
    name: 'HYDRAULIC PRESS 80TON',
    category: '03-Press',
    model: 'DYMSP-80',
    manufacturer: 'DAEYANG',
    location: 'PS7I',
    type: 'Press',
    status: 'Active',
  },

  // ===== SHEET 04: ROBOT (용접 로봇) - 주요 로봇들 =====
  // FRM Line Robots (PS7I FL)
  {
    id: 'DCMI-FRM-CRT-01',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-02',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'SPARE',
    type: 'Robot - Welding',
    status: 'Idle',
  },
  {
    id: 'DCMI-FRM-CRT-04',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-05',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-06',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-07',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-08',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-09',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30 / HH01L-01 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-10',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'PS7I FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // QXI FL / AI3 Robots
  {
    id: 'DCMI-FRM-CRT-11',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL / AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-12',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL / AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-13',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL / AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-14',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL / AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-15',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL / AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-16',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL / AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // BI3 Robots
  {
    id: 'DCMI-FRM-CRT-17',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'BI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-18',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5-N30-04 / HA006 / YD-350 GB2',
    manufacturer: 'HYUNDAI',
    location: 'BI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // SU2I Robots
  {
    id: 'DCMI-FRM-CRT-21',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'SU2I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-22',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'SU2I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // BN7I Robots
  {
    id: 'DCMI-FRM-CRT-25',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'BN7I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-26',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'BN7I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // AI3 Robots with HH010L
  {
    id: 'DCMI-FRM-CRT-35',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HH010L / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-36',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HH010L / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-37',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HH010L / PDC 350L',
    manufacturer: 'HYUNDAI',
    location: 'AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // YASKAWA Robots
  {
    id: 'DCMI-FRM-CRT-122',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'ERAR-1000-06VXH25-A00 / MOTOMAN-GP25 / X350',
    manufacturer: 'YASKAWA',
    location: 'AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-123',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'ERAR-1000-06VXH25-A00 / MOTOMAN-GP25 / X350',
    manufacturer: 'YASKAWA',
    location: 'AI3',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CRT-125',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'ERAR-1000-06VXH25-A00 / MOTOMAN-GP25 / X350',
    manufacturer: 'YASKAWA',
    location: 'BN7I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // CCB Line - Turn Table Robots (PANASONIC)
  {
    id: 'DCMI-CCB-CRT-62',
    name: 'ARC WELD ROBOT - TURN TABLE',
    category: '04-Robot',
    model: 'TM-1400WGIII / YA-1WAR61Y00 / P350',
    manufacturer: 'PANASONIC',
    location: 'QXI FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-CRT-63',
    name: 'ARC WELD ROBOT - TURN TABLE',
    category: '04-Robot',
    model: 'TM-1400WGIII / YA-1WAR61Y00 / P350',
    manufacturer: 'PANASONIC',
    location: 'QXI FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-CRT-64',
    name: 'ARC WELD ROBOT - TURN TABLE',
    category: '04-Robot',
    model: 'TM-1400WGIII / YA-1WAR61Y00 / P350',
    manufacturer: 'PANASONIC',
    location: 'QXI FL',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // CCB Line - YASKAWA AR1440
  {
    id: 'DCMI-CCB-CRT-105',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'ERAR-1000-06VXH25-AOO / MOTOMAN-AR1440 / X350',
    manufacturer: 'YASKAWA',
    location: 'BN7I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-CRT-106',
    name: 'ARC WELD ROBOT - FIXED',
    category: '04-Robot',
    model: 'ERAR-1000-06VXH25-AOO / MOTOMAN-AR1440 / X350',
    manufacturer: 'YASKAWA',
    location: 'BN7I',
    type: 'Robot - Welding',
    status: 'Active',
  },
  // Test Robots
  {
    id: 'DCMI-CCB-TST-01',
    name: 'TEST ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B',
    manufacturer: 'HYUNDAI',
    location: 'QXI FL',
    type: 'Robot - Test',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-TST-02',
    name: 'TEST ROBOT - FIXED',
    category: '04-Robot',
    model: 'HI5a-S30 / HA006B',
    manufacturer: 'HYUNDAI',
    location: 'AI3',
    type: 'Robot - Test',
    status: 'Active',
  },

  // ===== SHEET 05: WELDING (용접 기계) =====
  // Projection Welding
  {
    id: 'DCMI-PWS-01',
    name: 'PROJECTION WELDING',
    category: '05-Welding',
    model: 'ASR-100',
    manufacturer: 'CHOWEL',
    location: 'PROJECTION',
    type: 'Projection Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-PWS-02',
    name: 'PROJECTION WELDING',
    category: '05-Welding',
    model: 'ASR-100',
    manufacturer: 'CHOWEL',
    location: 'PROJECTION',
    type: 'Projection Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-PWS-03',
    name: 'PROJECTION WELDING',
    category: '05-Welding',
    model: 'ASR-100',
    manufacturer: 'CHOWEL',
    location: 'PROJECTION',
    type: 'Projection Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-PWS-04',
    name: 'PROJECTION WELDING',
    category: '05-Welding',
    model: 'ASR-100',
    manufacturer: 'CHOWEL',
    location: 'PROJECTION',
    type: 'Projection Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-PWS-05',
    name: 'PROJECTION WELDING',
    category: '05-Welding',
    model: 'ASR-100',
    manufacturer: 'CHOWEL',
    location: 'PROJECTION',
    type: 'Projection Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-PWS-06',
    name: 'PROJECTION WELDING',
    category: '05-Welding',
    model: 'ASR-100KVA',
    manufacturer: 'AUTOWELD',
    location: 'PROJECTION',
    type: 'Projection Welding',
    status: 'Active',
  },
  // Manual Welding
  {
    id: 'DCMI-FRM-MWS-01',
    name: 'MANUAL WELDING',
    category: '05-Welding',
    model: '250 A',
    manufacturer: 'LOCAL',
    location: 'PS7I',
    type: 'Manual Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-MWS-02',
    name: 'MANUAL WELDING',
    category: '05-Welding',
    model: '250 A',
    manufacturer: 'LOCAL',
    location: 'PS7I',
    type: 'Manual Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-MWS-03',
    name: 'MANUAL WELDING',
    category: '05-Welding',
    model: '250 A',
    manufacturer: 'LOCAL',
    location: 'PS7I',
    type: 'Manual Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-MWS-06',
    name: 'MANUAL WELDING',
    category: '05-Welding',
    model: '250 A',
    manufacturer: 'PANASONIC',
    location: 'QXI / AI3',
    type: 'Manual Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-MWS-10',
    name: 'MANUAL WELDING',
    category: '05-Welding',
    model: '250 A',
    manufacturer: 'LOCAL',
    location: 'SU2I',
    type: 'Manual Welding',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-MWS-30',
    name: 'MANUAL WELDING',
    category: '05-Welding',
    model: '250 A',
    manufacturer: 'LOCAL',
    location: 'QXI',
    type: 'Manual Welding',
    status: 'Active',
  },

  // ===== SHEET 06: ASSEMBLY (조립 장비) =====
  {
    id: 'DCMI-FRM-ASSY-01',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'NILL',
    manufacturer: 'NILL',
    location: 'PS7I',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-02',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'SHD-DT2-2',
    manufacturer: 'SANYO',
    location: 'PS7I',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-03',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'NILL',
    manufacturer: 'NILL',
    location: 'PS7I',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-04',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'SHD-DT2-2',
    manufacturer: 'SANYO',
    location: 'PS7I',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-11',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'POWER FOCUS SL PF4002-C-HW',
    manufacturer: 'ATLAS COPCO',
    location: 'QXI / AI3',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-12',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'POWER FOCUS SL PF4002-C-HW',
    manufacturer: 'ATLAS COPCO',
    location: 'QXI / AI3',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-20',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'POWER FOCUS SL PF4002-C-HW',
    manufacturer: 'ATLAS COPCO',
    location: 'SU2I / PS7I',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-43',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'NUT RUNNER-SHD-T1-020A-1',
    manufacturer: 'SANYO',
    location: 'BN7I',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-ASSY-48',
    name: 'ASSEMBLY UNIT',
    category: '06-Assembly',
    model: 'HANDY 2000 TOUCH-EH2-HT50-000NNN-E',
    manufacturer: 'ESTIC CORPORATION',
    location: 'QXI FL',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-RVT-01',
    name: 'RIVITTING MACHINE',
    category: '06-Assembly',
    model: 'HHR-15',
    manufacturer: 'HYUNDAE',
    location: 'PS7I 2nd RSC',
    type: 'Assembly',
    status: 'Active',
  },
  {
    id: 'DCMI-PRS-SHR-01',
    name: 'HYDRAULIC SHEARING MACHINE',
    category: '06-Assembly',
    model: 'DYSM-0625',
    manufacturer: 'DAEYANG',
    location: 'FABRICATION AREA',
    type: 'Assembly',
    status: 'Active',
  },

  // ===== SHEET 07: ETC (기타 지원 장비) =====
  // Conveyors
  {
    id: 'DCMI-FRM-CNR-13',
    name: 'PART MOVING CONVEYOR',
    category: '07-ETC',
    model: 'STANDARD (4500W * 675 * 900)',
    manufacturer: 'NILL',
    location: 'QXI / AI3',
    type: 'Conveyor',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CNR-14',
    name: 'PART MOVING CONVEYOR',
    category: '07-ETC',
    model: 'STANDARD (3600W * 685 * 900)',
    manufacturer: 'NILL',
    location: 'SU2I / PS7I',
    type: 'Conveyor',
    status: 'Active',
  },
  {
    id: 'DCMI-FRM-CNR-15',
    name: 'PART MOVING CONVEYOR',
    category: '07-ETC',
    model: 'STANDARD (800W * 3000 * 900)',
    manufacturer: 'GGM',
    location: 'BN7I',
    type: 'Conveyor',
    status: 'Active',
  },
  // Cleaning Machines
  {
    id: 'DCMI-UTL-CLM-01',
    name: 'SHOP FLOOR CLEANNING MACHINE-1',
    category: '07-ETC',
    model: 'ROOTS SCRUB E4545',
    manufacturer: 'ROOTS',
    location: 'SHOP FLOOR COMMON',
    type: 'Cleaning',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CLM-02',
    name: 'SHOP FLOOR CLEANNING MACHINE-2',
    category: '07-ETC',
    model: 'ROOTS SCRUB E4043',
    manufacturer: 'ROOTS',
    location: 'SHOP FLOOR COMMON',
    type: 'Cleaning',
    status: 'Active',
  },
  // Weighbridge
  {
    id: 'DCMI-UTL-WBM-01',
    name: 'WEIGH BRIDGE 60MT',
    category: '07-ETC',
    model: 'APPWE 60TON',
    manufacturer: 'APCON',
    location: 'EB YARD AREA',
    type: 'Measurement',
    status: 'Active',
  },
  // Chiller Machines
  {
    id: 'DCMI-UTL-CHR-01',
    name: 'CHILLER MACHINE 2TON',
    category: '07-ETC',
    model: 'ST2TR - TANK CAPACITY - 70LTRS',
    manufacturer: 'AUTOWELD',
    location: 'PROJECTION WELDING LINE',
    type: 'Cooling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CHR-02',
    name: 'CHILLER MACHINE 2TON',
    category: '07-ETC',
    model: 'ST2TR - TANK CAPACITY - 70LTRS',
    manufacturer: 'AUTOWELD',
    location: 'PROJECTION WELDING LINE',
    type: 'Cooling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CHR-03',
    name: 'CHILLER MACHINE 2TON',
    category: '07-ETC',
    model: 'ST2TR - TANK CAPACITY - 70LTRS',
    manufacturer: 'AUTOWELD',
    location: 'PROJECTION WELDING LINE',
    type: 'Cooling',
    status: 'Active',
  },
  {
    id: 'DCMI-UTL-CHR-04',
    name: 'CHILLER MACHINE 3TON',
    category: '07-ETC',
    model: 'ST3TR - TANK CAPACITY - 120LTRS',
    manufacturer: 'AUTOWELD',
    location: 'PROJECTION WELDING LINE',
    type: 'Cooling',
    status: 'Active',
  },
  // Exhaust Duct Motors (50개+)
  {
    id: 'DCMI-EDM-MTF-01',
    name: 'EXHAUST DUCT MOTOR',
    category: '07-ETC',
    model: '7.5HP',
    manufacturer: 'NILL',
    location: 'PS7I IInd ROW BACK',
    type: 'Fan/Motor',
    status: 'Active',
  },
  {
    id: 'DCMI-EDM-MTF-02',
    name: 'EXHAUST DUCT MOTOR',
    category: '07-ETC',
    model: '7.5HP',
    manufacturer: 'NILL',
    location: 'PS7I Iind ROW CUSHION CAPTAIN',
    type: 'Fan/Motor',
    status: 'Active',
  },
  {
    id: 'DCMI-EDM-MTF-03',
    name: 'EXHAUST DUCT MOTOR',
    category: '07-ETC',
    model: '7.5HP',
    manufacturer: 'NILL',
    location: 'PS7I IIIrd ROW BACK',
    type: 'Fan/Motor',
    status: 'Active',
  },
  {
    id: 'DCMI-EDM-MTF-05',
    name: 'EXHAUST DUCT MOTOR',
    category: '07-ETC',
    model: '5HP',
    manufacturer: 'NILL',
    location: 'SU2I FSB',
    type: 'Fan/Motor',
    status: 'Active',
  },
  {
    id: 'DCMI-EDM-MTF-15',
    name: 'EXHAUST DUCT MOTOR',
    category: '07-ETC',
    model: '7.5HP',
    manufacturer: 'NILL',
    location: 'BN7I FSB & RSB',
    type: 'Fan/Motor',
    status: 'Active',
  },
  // HVLS Fans
  {
    id: 'DCMI-FAN-HVLS-01',
    name: 'HVLS FAN',
    category: '07-ETC',
    model: '1HP (0.75KW)',
    manufacturer: 'MARUIT AIR',
    location: 'PS7I FSB AREA GANGWAY',
    type: 'Fan',
    status: 'Active',
  },
  {
    id: 'DCMI-FAN-HVLS-02',
    name: 'HVLS FAN',
    category: '07-ETC',
    model: '1HP (0.75KW)',
    manufacturer: 'MARUIT AIR',
    location: 'QXI FSB AERA GANGWAY',
    type: 'Fan',
    status: 'Active',
  },
  {
    id: 'DCMI-FAN-HVLS-03',
    name: 'HVLS FAN',
    category: '07-ETC',
    model: '1HP (0.75KW)',
    manufacturer: 'MARUIT AIR',
    location: 'SU2I FSB AREA GANGWAY',
    type: 'Fan',
    status: 'Active',
  },
  // Air Conditioners
  {
    id: 'DCMI-SHF-ACU-01',
    name: 'AIR CONDITIONER-SPLIT TYPE',
    category: '07-ETC',
    model: '1TON SPLIT AC',
    manufacturer: 'KOREA MAKE',
    location: 'QXI / AI3 CCB LASER MACHINE - 01',
    type: 'HVAC',
    status: 'Active',
  },
  {
    id: 'DCMI-SHF-ACU-02',
    name: 'AIR CONDITIONER-SPLIT TYPE',
    category: '07-ETC',
    model: '1TON SPLIT AC',
    manufacturer: 'KOREA MAKE',
    location: 'QXI / AI3 CCB LASER MACHINE - 02',
    type: 'HVAC',
    status: 'Active',
  },
  {
    id: 'DCMI-SHF-ACU-03',
    name: 'AIR CONDITIONER-SPLIT TYPE',
    category: '07-ETC',
    model: '1TON SPLIT AC',
    manufacturer: 'KOREA MAKE',
    location: 'SU2I CCB LASER MACHINE',
    type: 'HVAC',
    status: 'Active',
  },
  {
    id: 'DCMI-SHF-ACU-07',
    name: 'AIR CONDITIONER-DUCTABLE TYPE',
    category: '07-ETC',
    model: 'PAO132HZDA3Z3 - 11TON DUCTABLE AC',
    manufacturer: 'HITACHI',
    location: 'UPS ROOM',
    type: 'HVAC',
    status: 'Active',
  },
  // Grease Pumps (20+)
  {
    id: 'DCMI-GRP-BRL-01',
    name: 'BARREL GREASE PUMP -180KG',
    category: '07-ETC',
    model: 'GPH/3/ST/BSP',
    manufacturer: 'GROZ',
    location: 'PS7I',
    type: 'Maintenance',
    status: 'Active',
  },
  {
    id: 'DCMI-GRP-BRL-02',
    name: 'BARREL GREASE PUMP -180KG',
    category: '07-ETC',
    model: 'GPH/3/ST/BSP',
    manufacturer: 'GROZ',
    location: 'PS7I',
    type: 'Maintenance',
    status: 'Active',
  },
  {
    id: 'DCMI-GRP-BRL-04',
    name: 'BARREL GREASE PUMP -180KG',
    category: '07-ETC',
    model: 'GPH/3/ST/BSP',
    manufacturer: 'GROZ',
    location: 'AI3',
    type: 'Maintenance',
    status: 'Active',
  },
  // Testing Equipment
  {
    id: 'DCMI-JCM-WCU-01',
    name: 'WELD CHECKER UNIT (PORTABLE)',
    category: '07-ETC',
    model: 'MM-315B-00-12',
    manufacturer: 'AMADA',
    location: 'PROJECTION WELDING AREA',
    type: 'Testing',
    status: 'Active',
  },
  {
    id: 'DCMI-TSM-IBM-01',
    name: 'ICE BLASTING MACHINE',
    category: '07-ETC',
    model: 'BLMD-16 B',
    manufacturer: 'URMILA',
    location: 'JIG CLEANNIG USING',
    type: 'Cleaning',
    status: 'Active',
  },
  {
    id: 'DCMI-TSM-TCV-01',
    name: 'THERMAL CAMERA VISION',
    category: '07-ETC',
    model: 'FLIR - C5',
    manufacturer: 'FLIR',
    location: 'SHOP FLOOR',
    type: 'Testing',
    status: 'Active',
  },

  // ===== SHEET 08: LASER (레이저 장비) =====
  {
    id: 'DCMI-CCB-LCT-01',
    name: 'LASER CUTTING',
    category: '08-Laser',
    model: 'YLR-450/4500-QCW-AC (IPG)',
    manufacturer: 'MDI',
    location: 'QXI / AI3',
    type: 'Laser',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-LCT-02',
    name: 'LASER CUTTING',
    category: '08-Laser',
    model: 'YLR-450/4500-QCW-AC (IPG)',
    manufacturer: 'MDI',
    location: 'QXI / AI3',
    type: 'Laser',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-LCT-03',
    name: 'LASER CUTTING',
    category: '08-Laser',
    model: 'YLR-450/4500-QCW-MM-AC (IPG)',
    manufacturer: 'MDI',
    location: 'SU2I / PS7I',
    type: 'Laser',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-LCT-04',
    name: 'LASER CUTTING',
    category: '08-Laser',
    model: 'YLR-450/4500-QCW-MM-AC (IPG)',
    manufacturer: 'MDI',
    location: 'SU2I / PS7I',
    type: 'Laser',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-LCT-05',
    name: 'LASER CUTTING',
    category: '08-Laser',
    model: 'YLR-450/4500-QCW-AC (IPG)',
    manufacturer: 'MDI',
    location: 'BI3',
    type: 'Laser',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-LCT-06',
    name: 'LASER CUTTING',
    category: '08-Laser',
    model: 'YLR-450/4500-QCW-MM-AC (IPG)',
    manufacturer: 'MDI',
    location: 'QXI / AI3',
    type: 'Laser',
    status: 'Active',
  },
  // Hole Inspection
  {
    id: 'DCMI-CCB-HIM-01',
    name: 'HOLE INSPECTION',
    category: '08-Laser',
    model: 'RHD/LHD',
    manufacturer: 'NILL',
    location: 'QXI FL',
    type: 'Inspection',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-HIM-02',
    name: 'HOLE INSPECTION',
    category: '08-Laser',
    model: 'RHD',
    manufacturer: 'NILL',
    location: 'AI3',
    type: 'Inspection',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-HIM-04',
    name: 'HOLE INSPECTION',
    category: '08-Laser',
    model: 'RHD (1)',
    manufacturer: 'NILL',
    location: 'SU2I / PS7I',
    type: 'Inspection',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-HIM-05',
    name: 'HOLE INSPECTION',
    category: '08-Laser',
    model: 'RHD (2)',
    manufacturer: 'NILL',
    location: 'SU2I / PS7I',
    type: 'Inspection',
    status: 'Active',
  },
  {
    id: 'DCMI-CCB-HIM-08',
    name: 'HOLE INSPECTION',
    category: '08-Laser',
    model: 'RHD/LHD',
    manufacturer: 'NILL',
    location: 'BI3',
    type: 'Inspection',
    status: 'Active',
  },

  // ===== SHEET 11: IDLE NR (미사용 - 부품으로 사용) =====
  {
    id: 'DCMI-IDLM-CRT-06',
    name: 'IDLE ROBOT PART',
    category: '11-Idle NR',
    model: 'HA006A',
    manufacturer: 'NILL',
    location: 'Storage',
    type: 'Robot Part',
    status: 'Idle',
  },
  {
    id: 'DCMI-IDLM-CRT-07',
    name: 'IDLE ROBOT PART',
    category: '11-Idle NR',
    model: 'HA006',
    manufacturer: 'NILL',
    location: 'Storage',
    type: 'Robot Part',
    status: 'Idle',
  },
  {
    id: 'DCMI-IDLM-CRT-08',
    name: 'IDLE ROBOT PART',
    category: '11-Idle NR',
    model: 'HA006',
    manufacturer: 'NILL',
    location: 'Storage',
    type: 'Robot Part',
    status: 'Idle',
  },
  {
    id: 'DCMI-IDLM-CRT-09',
    name: 'IDLE ROBOT PART',
    category: '11-Idle NR',
    model: 'HH010L',
    manufacturer: 'NILL',
    location: 'Storage',
    type: 'Robot Part',
    status: 'Idle',
  },
  {
    id: 'DCMI-IDLM-CRT-10',
    name: 'IDLE ROBOT PART',
    category: '11-Idle NR',
    model: 'HA006',
    manufacturer: 'NILL',
    location: 'Storage',
    type: 'Robot Part',
    status: 'Idle',
  },
  {
    id: 'DCMI-IDLM-CRT-11',
    name: 'IDLE ROBOT PART',
    category: '11-Idle NR',
    model: 'HA006A',
    manufacturer: 'NILL',
    location: 'Storage',
    type: 'Robot Part',
    status: 'Idle',
  },

  // ===== SHEET 11A: IDLE R (미사용 - 재정비 필요) =====
  {
    id: 'DCMI-IDLM-CRT-12',
    name: 'IDLE ROBOT - TURN TABLE',
    category: '11A-Idle R',
    model: 'TM-1400WGIII',
    manufacturer: 'NILL',
    location: 'Maintenance',
    type: 'Robot',
    status: 'Under Maintenance',
  },
  {
    id: 'DCMI-IDLM-MWS-01',
    name: 'IDLE MANUAL WELDING',
    category: '11A-Idle R',
    model: '250A',
    manufacturer: 'NILL',
    location: 'Maintenance',
    type: 'Welding',
    status: 'Under Maintenance',
  },

  // ===== SHEET 12: FIXED SALE (판매용 판정) =====
  {
    id: 'DCMI-FRM-CRT-03',
    name: 'ROBOT FOR SALE',
    category: '12-Fixed Sale',
    model: 'HA006',
    manufacturer: 'NILL',
    location: 'Dispatch',
    type: 'Robot',
    status: 'For Sale',
  },

  // ===== SHEET 13: DISPOSAL (폐기) =====
  {
    id: 'DCMI-UTL-DIR-01-DISP',
    name: 'DISPOSED DRYER',
    category: '13-Disposal',
    model: 'DRIYER-1 TF251(800CFM-1140)',
    manufacturer: 'NILL',
    location: 'Scrap',
    type: 'Equipment',
    status: 'Disposed',
  },
  {
    id: 'DCMI-UTL-DIR-02-DISP',
    name: 'DISPOSED DRYER',
    category: '13-Disposal',
    model: 'DRIYER-2 TF203 (700CFM-1357)',
    manufacturer: 'NILL',
    location: 'Scrap',
    type: 'Equipment',
    status: 'Disposed',
  },
];

// 분류별 카운트
const categoryCounts = {
  '01-Utility': ASSETS.filter(a => a.category === '01-Utility').length,
  '02-Process': ASSETS.filter(a => a.category === '02-Process').length,
  '03-Press': ASSETS.filter(a => a.category === '03-Press').length,
  '04-Robot': ASSETS.filter(a => a.category === '04-Robot').length,
  '05-Welding': ASSETS.filter(a => a.category === '05-Welding').length,
  '06-Assembly': ASSETS.filter(a => a.category === '06-Assembly').length,
  '07-ETC': ASSETS.filter(a => a.category === '07-ETC').length,
  '08-Laser': ASSETS.filter(a => a.category === '08-Laser').length,
  '11-Idle NR': ASSETS.filter(a => a.category === '11-Idle NR').length,
  '11A-Idle R': ASSETS.filter(a => a.category === '11A-Idle R').length,
  '12-Fixed Sale': ASSETS.filter(a => a.category === '12-Fixed Sale').length,
  '13-Disposal': ASSETS.filter(a => a.category === '13-Disposal').length,
};

console.log('=== DSC FMS ASSET INVENTORY ===');
console.log(`Total Assets: ${ASSETS.length}`);
console.log('By Category:');
Object.entries(categoryCounts).forEach(([cat, count]) => {
  if (count > 0) console.log(`  ${cat}: ${count}`);
});

const BM_DATA=[
  {sl:1,date:"2026-02-02",assetNo:"DCMI-FRM-CRT-47",line:"FRAM",shift:"I",mainCat:"SENSOR",subCat:"SENSOR-SU2I BENCH & SPLIT",problem:"SENSOR PROBLEM",reason:"SENSOR FAILURE",action:"SENSOR CHANGED",pageNo:401,team:"HARI TEAM",checker:"HARI",start:"8:00AM",finish:"8:30AM",idle:0.5,type:"Machine"},
  {sl:2,date:"2026-02-02",assetNo:"DCMI-FRM-CRT-120",line:"FRAM",shift:"II",mainCat:"ASSEMBLY",subCat:"ASSEMBLY MACHINE-SENSOR PROBLEM",problem:"SENSOR PROBLEM",reason:"SENSOR FAILURE",action:"NEW SENSOR ISSUED",pageNo:402,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"5:30PM",finish:"6:00PM",idle:0.5,type:"Machine"},
  {sl:3,date:"2026-02-03",assetNo:"DCMI-FRM-CRT-47",line:"FRAM",shift:"I",mainCat:"WELD SHOP",subCat:"ROBOT MACHINE-LINEAR PROBLEM",problem:"LINER PROBLEM",reason:"LINER PROBLEM",action:"NEW LINER CHANGE WORK",pageNo:407,team:"HARI TEAM",checker:"SABARI",start:"8:20AM",finish:"8:40AM",idle:0.3,type:"Machine"},
  {sl:4,date:"2026-02-03",assetNo:"DCMI-FRM-PRJ-29",line:"PRESS",shift:"I",mainCat:"PRESS SHOP",subCat:"POWER PRESS MACHINE-OTHERS",problem:"COIL FEEDER PROBLEM",reason:"MOTOR COUPLING BROKEN",action:"HYD MOTOR COUPLING NEW CHANGE WORK",pageNo:1557,team:"HARI TEAM",checker:"SABARI",start:"2:10PM",finish:"2:50PM",idle:0.7,type:"Machine"},
  {sl:5,date:"2026-02-04",assetNo:"DCMI-FRM-CRT-128",line:"FRAM",shift:"II",mainCat:"WELD SHOP",subCat:"ROBOT MACHINE-LINEAR PROBLEM",problem:"ROBOT COIL FEEDING PROBLEM",reason:"LINER PROBLEM",action:"NEW LINER CHANGE WORK",pageNo:408,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"6:30PM",finish:"9:00PM",idle:2.5,type:"Machine"},
  {sl:6,date:"2026-02-06",assetNo:"DCMI-CCB-CRT-68",line:"CCB",shift:"I",mainCat:"SENSOR",subCat:"SENSOR-AI3 CCB",problem:"SENSOR PROBLEM",reason:"SENSOR FAILURE",action:"SENSOR CHANGED",pageNo:445,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"10:40PM",finish:"11:00PM",idle:0.3,type:"Machine"},
  {sl:7,date:"2026-02-11",assetNo:"DCMI-PWS-RSW-05",line:"PROJECTION",shift:"I",mainCat:"OTHERS",subCat:"PROJECTION MACHINE-OTHERS",problem:"M/C NOT WORKING",reason:"LIMIT SWITCH PROBLEM",action:"LIMIT SWITCH CHANGED OK",pageNo:1591,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"1:30PM",finish:"2:00PM",idle:0.5,type:"Machine"},
  {sl:8,date:"2026-02-16",assetNo:"DCMI-PRS-HYD-02",line:"PRESS",shift:"I",mainCat:"PRESS SHOP",subCat:"POWER PRESS MACHINE-OTHERS",problem:"POWER PROBLEM",reason:"POWER CABLE BURNED PROBLEM",action:"LINER COIL REMOVE AND FIXED WORK",pageNo:412,team:"SARAVANARAJ TEAM",checker:"ARAVIND",start:"11:00PM",finish:"11:30PM",idle:0.5,type:"Machine"},
  {sl:9,date:"2026-01-02",assetNo:"DCMI-PT-183",line:"PRESS",shift:"I",mainCat:"MOULD",subCat:"MOULD B/D-FORMING UNEVEN",problem:"MOULD B/D-FORMING UNEVEN ISSUE",reason:"GAS SPRING BROKEN",action:"2NOS GAS SPRINGS CHANGED & ASSY DONE",pageNo:1521,team:"PRAVEEN TEAM",checker:"JAYAKUMAR",start:"11:50AM",finish:"1:00PM",idle:1.2,type:"Mould"},
  {sl:10,date:"2026-01-04",assetNo:"DCMI-PT-297",line:"PRESS",shift:"II",mainCat:"MOULD",subCat:"MOULD B/D-HOLE BURR ISSUE",problem:"MOULD B/D-HOLE BURR ISSUE",reason:"ONE SIDE DAMAGE PUNCH",action:"NEW PUNCH DIA5.1MM 2NOS CHANGED",pageNo:1526,team:"PRABHU TEAM",checker:"KANNAN",start:"7:30PM",finish:"9:30PM",idle:2.0,type:"Mould"},
  {sl:11,date:"2026-01-06",assetNo:"DCMI-PT-176",line:"PRESS",shift:"I",mainCat:"MOULD",subCat:"MOULD B/D-PUNCH BROKEN",problem:"MOULD B/D-PUNCH BROKEN ISSUE",reason:"PUNCH BROKEN DURING RUNNING TIME",action:"NEW PUNCH CHANGED & ASSY DONE",pageNo:1536,team:"PRAVEEN TEAM",checker:"PRAVEEN",start:"12:30PM",finish:"1:30PM",idle:1.0,type:"Mould"},
];

const PM_DATA=[
  {id:"PM-001",assetNo:"DCMI-FRM-CRT-01",name:"Arc Welding Robot TR01",cat:"Machine",line:"FRAM",task:"TCP 교정 & 소모품 점검",detail:"CHECK TCP, WIRE CUTTER, TOUCH SENSING",legend:"PREDICTIVE",freq:"Once A Week",std:1,man:1,planDate:"2026-05-06",status:"prog",person:"이수현"},
  {id:"PM-002",assetNo:"DCMI-FRM-CRT-47",name:"Arc Welding Robot TR47",cat:"Machine",line:"FRAM",task:"Wire Liner 교체 & 토치 점검",detail:"LINER CHANGE, TORCH CHECK",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-08",status:"sched",person:"이수현"},
  {id:"PM-003",assetNo:"DCMI-CCB-LCT-01",name:"Laser Cutting MDI-01",cat:"Machine",line:"CCB",task:"렌즈 클리닝 & 레이저 출력 점검",detail:"LENS CLEANING, LASER OUTPUT CHECK",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-10",status:"sched",person:"Aravind"},
  {id:"PM-004",assetNo:"DCMI-PRS-02(A2)",name:"Mech. Press 200TON A2",cat:"Machine",line:"PRESS",task:"오일교환 & 클러치 점검",detail:"OIL CHANGE, CLUTCH INSPECTION",legend:"PREVENTIVE",freq:"2 Monthly",std:4,man:2,planDate:"2026-05-03",status:"delay",person:"Raj Kumar"},
  {id:"PM-005",assetNo:"DCMI-PWS-01",name:"Projection Welding PWS-01",cat:"Machine",line:"PROJECTION",task:"전극 점검 & 냉각수 교환",detail:"ELECTRODE CHECK, COOLING WATER CHANGE",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-12",status:"sched",person:"Sabari"},
  {id:"PM-006",assetNo:"DCMI-UTL-CMP-01",name:"Air Compressor 50HP-01",cat:"Machine",line:"COMMON",task:"에어 필터 교체 & 벨트 점검",detail:"AIR FILTER CHANGE, BELT CHECK",legend:"PREVENTIVE",freq:"2 Monthly",std:2,man:1,planDate:"2026-05-06",status:"done",person:"Saravanaraj"},
  {id:"PM-Q01",assetNo:"DCMI-FRM-CRT-01",name:"Arc Welding Robot TR01",cat:"Machine",line:"FRAM",task:"서보모터 점검 & 감속기 오일교환",detail:"SERVO MOTOR CHECK, GEARBOX OIL CHANGE",legend:"PREVENTIVE",freq:"4 Monthly",std:8,man:2,planDate:"2026-05-26",status:"sched",person:"이수현"},
  {id:"PM-A01",assetNo:"DCMI-CCB-LCT-03",name:"Laser Cutting MDI-03",cat:"Machine",line:"CCB",task:"레이저 헤드 오버홀",detail:"LASER HEAD OVERHAUL, OPTICAL SYSTEM CHECK",legend:"PREVENTIVE",freq:"6 Monthly",std:16,man:2,planDate:"2026-05-22",status:"sched",person:"MDI Engineer"},
  {id:"PM-M01",assetNo:"DCMI-PT-183",name:"Mould SU2I-LWB Forming-1",cat:"Mould",line:"PRESS",task:"펀치 마모 점검 & 스프링 교체",detail:"PUNCH WEAR CHECK, SPRING CHANGE",legend:"PREVENTIVE",freq:"Monthly",std:2,man:1,planDate:"2026-05-07",status:"done",person:"Praveen"},
  {id:"PM-J01",assetNo:"AI3 CCB / QXI CCB",name:"Jig AI3 CCB / QXI CCB",cat:"Jig",line:"CCB",task:"Sequence Checking (3개월 1회)",detail:"SEQUENCE CHECKING – BALAJI",legend:"PREVENTIVE",freq:"4 Monthly",std:4,man:1,planDate:"2026-05-01",status:"done",person:"Balaji"},
  {id:"PM-J02",assetNo:"SU2I/SU2I RDE/PS7I PE",name:"Jig SU2I FSB,RSB & PS7I PE",cat:"Jig",line:"FRAM",task:"4MONTH ONCE – Week I&II",detail:"SEQUENCE CHECK WEEK-I&II, MONITORING WEEK-IV",legend:"PREVENTIVE",freq:"4 Monthly",std:8,man:2,planDate:"2026-05-05",status:"sched",person:"Praveen"},
  {id:"PM-IN01",assetNo:"Various",name:"Fire Extinguisher Inspection",cat:"Inspection",line:"COMMON",task:"안전 검사 (정부 인증)",detail:"GOVERNMENT SAFETY INSPECTION & CERTIFICATION",legend:"INSPECTION",freq:"6 Monthly",std:4,man:1,planDate:"2026-06-01",status:"sched",person:"Praveen Team"},
  {id:"PM-AM01",assetNo:"DCMI-UTL-CMP-*",name:"Air Compressor AMC",cat:"AMC",line:"COMMON",task:"연간 유지보수 계약",detail:"ANNUAL MAINTENANCE CONTRACT – KAESER",legend:"AMC",freq:"Yearly",std:8,man:2,planDate:"2026-09-01",status:"sched",person:"KAESER"},
];

const LINES_DATA=[
  {l:"FRAM",v:87.1,c:"#378ADD",m:48,bm:7,idle:8.5},
  {l:"CCB",v:85.8,c:"#D4537E",m:62,bm:5,idle:5.2},
  {l:"PRESS",v:92.3,c:"#639922",m:31,bm:3,idle:2.1},
  {l:"PROJECTION",v:90.2,c:"#EF9F27",m:27,bm:2,idle:1.3},
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
const MENU_CATS=[
  {key:"master",icon:"ti-layout-list"},{key:"avail",icon:"ti-chart-bar"},
  {key:"bm",icon:"ti-alert-triangle"},{key:"pm",icon:"ti-tool"},
  {key:"wo",icon:"ti-clipboard-list"},{key:"parts",icon:"ti-package"},
  {key:"kpi",icon:"ti-chart-line"},{key:"team",icon:"ti-users"},
  {key:"settings",icon:"ti-settings"},
];

// ═══════════════════════════════════════════
// 공통 스타일
// ═══════════════════════════════════════════
const s={
  card:{background:"var(--color-background-primary,#fff)",border:"0.5px solid var(--color-border-tertiary,#e0e0e0)",borderRadius:10,padding:"12px 14px"},
  pill:(bg,cl)=>({fontSize:9,padding:"2px 7px",borderRadius:999,fontWeight:500,background:bg,color:cl,whiteSpace:"nowrap",display:"inline-block"}),
  th:{textAlign:"left",padding:"6px 8px",fontSize:10,fontWeight:500,color:"var(--color-text-tertiary,#999)",borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)",whiteSpace:"nowrap",background:"var(--color-background-secondary,#f5f5f5)"},
  td:{padding:"6px 8px",borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)",verticalAlign:"middle",fontSize:11},
  input:{fontSize:11,padding:"5px 9px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:6,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#1a1a1a)",width:155},
  select:{fontSize:11,padding:"5px 7px",border:"0.5px solid var(--color-border-secondary,#ccc)",borderRadius:6,background:"var(--color-background-primary,#fff)",color:"var(--color-text-primary,#1a1a1a)"},
  btn:(bg,cl)=>({fontSize:11,padding:"5px 12px",borderRadius:6,border:`0.5px solid ${bg}`,background:bg,color:cl,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}),
};

// ═══════════════════════════════════════════
// 페이지: 대시보드
// ═══════════════════════════════════════════
function Dashboard({t,setPage}){
  const BM_ALERTS=[
    {dot:"#E24B4A",title:"FRAM · DCMI-FRM-CRT-128 — 서보 에러",meta:"Robot / 08:42 · 라인정지 · IDLE 2.5h"},
    {dot:"#E24B4A",title:"CCB · DCMI-CCB-CRT-50 — Pendant 불량",meta:"Robot / 10:15 · IDLE 1.5h"},
    {dot:"#E24B4A",title:"PRESS · DCMI-PRS-HYD-01 — 유압 이상",meta:"Press / 11:30 · IDLE 1.3h"},
    {dot:"#EF9F27",title:"PROJECTION · DCMI-PWS-RSW-05 — 냉각수 누수",meta:"Welding / 13:05 · 임시조치 중"},
  ];
  const TODAY_PM=[
    {name:"DCMI-FRM-CRT-01",task:"TCP 교정",line:"FRAM",st:"prog"},
    {name:"DCMI-UTL-CMP-01",task:"에어필터 교체",line:"COMMON",st:"done"},
    {name:"AI3 CCB / QXI CCB",task:"Jig Sequence Check",line:"CCB",st:"done"},
    {name:"DCMI-PT-183",task:"Mould Punch 점검",line:"PRESS",st:"sched"},
    {name:"DCMI-PRS-NCLF-01",task:"NC Feeder 베어링",line:"PRESS",st:"delay"},
  ];
  return(
    <div>
      <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>
        {t.welcome} 👋 <span style={{color:"#185FA5"}}>나경태</span> — 오늘 현황 (2026.05.06)
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {lbl:"전체 가동률 Overall",val:"87.3%",sub:"목표 90%",cl:"#854F0B"},
          {lbl:"BM 미완료 Backlog",val:"11건",sub:"긴급 4 · 일반 7",cl:"#A32D2D"},
          {lbl:"PM 완료율 (5월)",val:"68%",sub:"목표 90%",cl:"#854F0B"},
          {lbl:"MTTR 평균",val:"2.1h",sub:"목표 ≤3h · 개선 ▼0.3h",cl:"#3B6D11"},
        ].map((k,i)=>(
          <div key={i} style={s.card}>
            <div style={{fontSize:9,color:"var(--color-text-tertiary,#999)",marginBottom:3}}>{k.lbl}</div>
            <div style={{fontSize:20,fontWeight:600,color:k.cl}}>{k.val}</div>
            <div style={{fontSize:9,color:"var(--color-text-tertiary,#999)",marginTop:2}}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10,marginBottom:10}}>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:10,display:"flex",justifyContent:"space-between"}}>
            라인별 가동률 Line Availability
            <span style={{fontSize:10,color:"#185FA5",cursor:"pointer",fontWeight:400}} onClick={()=>setPage("avail")}>상세 →</span>
          </div>
          {LINES_DATA.map(({l,v,m})=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
              <div style={{fontSize:10,width:90,flexShrink:0}}>{l} <span style={{fontSize:9,color:"#999"}}>({m}대)</span></div>
              <div style={{flex:1,height:10,background:"#f0f0f0",borderRadius:5,overflow:"hidden"}}>
                <div style={{width:`${v}%`,height:"100%",background:v>=90?"#639922":v>=85?"#EF9F27":"#E24B4A",borderRadius:5}}/>
              </div>
              <div style={{fontSize:10,fontWeight:600,width:36,textAlign:"right",color:v>=90?"#3B6D11":v>=85?"#854F0B":"#A32D2D"}}>{v}%</div>
            </div>
          ))}
        </div>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:10}}>Idle 설비 현황</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[
              {v:"5",cl:"#A32D2D",lbl:"Non-running",sub:"처분/폐기 검토"},
              {v:"12",cl:"#854F0B",lbl:"Running(대기)",sub:"재배치 검토"},
              {v:"168",cl:"#185FA5",lbl:"전체 등록",sub:"Machine 01~15"},
              {v:"5",cl:"#534AB7",lbl:"Fixed Asset Sale",sub:"매각 대상"},
            ].map((d,i)=>(
              <div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:17,fontWeight:600,color:d.cl}}>{d.v}대</div>
                <div style={{fontSize:9,color:"#999",marginTop:1,lineHeight:1.4}}>{d.lbl}<br/>{d.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
            BM 긴급 알림
            <span style={{fontSize:10,color:"#185FA5",cursor:"pointer",fontWeight:400}} onClick={()=>setPage("bm")}>전체 →</span>
          </div>
          {BM_ALERTS.map((b,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0",borderBottom:i<BM_ALERTS.length-1?"0.5px solid #e0e0e0":"none"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:b.dot,marginTop:3,flexShrink:0}}/>
              <div>
                <div style={{fontSize:11,fontWeight:500}}>{b.title}</div>
                <div style={{fontSize:10,color:"#999",marginTop:1}}>{b.meta}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={s.card}>
          <div style={{fontSize:11,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
            오늘 PM 일정
            <span style={{fontSize:10,color:"#185FA5",cursor:"pointer",fontWeight:400}} onClick={()=>setPage("pm")}>전체 →</span>
          </div>
          {TODAY_PM.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<TODAY_PM.length-1?"0.5px solid #e0e0e0":"none"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                <div style={{fontSize:10,color:"#999"}}>{p.task} · {p.line}</div>
              </div>
              {stPill(p.st,t)}
            </div>
          ))}
        </div>
      </div>
      <div style={{fontSize:11,fontWeight:500,marginBottom:8}}>빠른 이동 Quick Access</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {icon:"ti-layout-list",lbl:"설비 마스터",pg:"master",sub:"168대"},
          {icon:"ti-alert-triangle",lbl:"BM 이력",pg:"bm",sub:"긴급 4건"},
          {icon:"ti-tool",lbl:"PM Plan",pg:"pm",sub:"5월 68%"},
          {icon:"ti-chart-bar",lbl:"가동률 OEE",pg:"avail",sub:"87.3%"},
          {icon:"ti-clipboard-list",lbl:"작업지시",pg:"wo",sub:"미완료 3건"},
          {icon:"ti-package",lbl:"부품/재고",pg:"parts",sub:"준비중"},
          {icon:"ti-chart-line",lbl:"KPI 리포트",pg:"kpi",sub:"준비중"},
          {icon:"ti-settings",lbl:"설정",pg:"settings",sub:"언어·권한"},
        ].map(({icon,lbl,pg,sub})=>(
          <div key={pg} onClick={()=>setPage(pg)} style={{...s.card,textAlign:"center",cursor:"pointer",padding:14}}>
            <i className={`ti ${icon}`} style={{fontSize:20,color:"#185FA5",marginBottom:5,display:"block"}} aria-hidden="true"/>
            <div style={{fontSize:11,fontWeight:500}}>{lbl}</div>
            <div style={{fontSize:9,color:"#999",marginTop:2}}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 페이지: 설비 마스터
// ═══════════════════════════════════════════
function AssetMaster({t}){
  const [q,setQ]=useState("");
  const [fLine,setFLine]=useState("");
  const [fCat,setFCat]=useState("");
  const [fSt,setFSt]=useState("");

  const filtered=useMemo(()=>ASSETS.filter(a=>{
    if(q&&![a.id,a.no,a.name,a.model,a.make].some(v=>v.toLowerCase().includes(q.toLowerCase()))) return false;
    if(fLine&&a.line!==fLine) return false;
    if(fCat&&a.cat!==fCat) return false;
    if(fSt&&a.status!==fSt) return false;
    return true;
  }),[q,fLine,fCat,fSt]);

  const summary={
    total:filtered.length,
    active:filtered.filter(a=>a.status==="Active").length,
    idleR:filtered.filter(a=>a.status==="Idle-R").length,
    idleNR:filtered.filter(a=>a.status==="Idle-NR").length,
    machine:filtered.filter(a=>["01","02","03","04","05","06","07","08"].includes(a.cat)).length,
    jig:filtered.filter(a=>a.cat==="09").length,
    mould:filtered.filter(a=>a.cat==="10").length,
    idle:filtered.filter(a=>a.cat==="11").length,
  };

  return(
    <div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
        <input style={s.input} placeholder={t.search} value={q} onChange={e=>setQ(e.target.value)}/>
        <select style={s.select} value={fLine} onChange={e=>setFLine(e.target.value)}>
          <option value="">{t.allLines}</option>
          {["FRAM","CCB","PRESS","PROJECTION","COMMON"].map(l=><option key={l}>{l}</option>)}
        </select>
        <select style={s.select} value={fCat} onChange={e=>setFCat(e.target.value)}>
          <option value="">{t.allCat}</option>
          {Object.entries(CAT_META).map(([k,v])=><option key={k} value={k}>{k} · {v.label}</option>)}
        </select>
        <select style={s.select} value={fSt} onChange={e=>setFSt(e.target.value)}>
          <option value="">{t.allStatus}</option>
          {["Active","Idle-R","Idle-NR","Fixed-Sale"].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
        {[
          {lbl:"전체",val:summary.total,cl:"#185FA5"},
          {lbl:"Active",val:summary.active,cl:"#3B6D11"},
          {lbl:"Idle(R)",val:summary.idleR,cl:"#854F0B"},
          {lbl:"Idle(NR)",val:summary.idleNR,cl:"#A32D2D"},
        ].map((k,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:9,color:"#999"}}>{k.lbl}</div>
            <div style={{fontSize:16,fontWeight:600,color:k.cl}}>{k.val}대</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
        {filtered.map(a=>{
          const cm=CAT_META[a.cat]||{label:a.cat,color:"#555",bg:"#eee"};
          const st=ST_COLOR[a.status]||{bg:"#eee",cl:"#555"};
          const lc=LINE_COLOR[a.line]||"#888";
          return(
            <div key={a.id} style={{...s.card,cursor:"pointer"}} >
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,gap:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:9,color:"#185FA5",fontFamily:"monospace"}}>{a.id}</div>
                  <div style={{fontSize:9,color:"#185FA5",fontFamily:"monospace"}}>{a.no}</div>
                  <div style={{fontSize:12,fontWeight:500,marginTop:2,lineHeight:1.3}}>{a.name}</div>
                </div>
                <span style={s.pill(st.bg,st.cl)}>{a.status}</span>
              </div>
              <hr style={{border:"none",borderTop:"0.5px solid #e0e0e0",margin:"6px 0"}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                <div><div style={{fontSize:9,color:"#999"}}>라인</div><div style={{fontSize:11,fontWeight:500}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:lc,marginRight:3,verticalAlign:"middle"}}></span>{a.line}</div></div>
                <div><div style={{fontSize:9,color:"#999"}}>제조사</div><div style={{fontSize:11,fontWeight:500}}>{a.make}</div></div>
                <div><div style={{fontSize:9,color:"#999"}}>모델</div><div style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.model||"-"}</div></div>
                <div><div style={{fontSize:9,color:"#999"}}>분류</div><div style={{fontSize:11,fontWeight:500}}>{a.cat}</div></div>
              </div>
              <div style={{marginTop:5}}>
                <span style={{...s.pill(cm.bg,cm.color),fontSize:9}}>{a.cat} · {cm.label}</span>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"#999"}}>검색 결과가 없습니다</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 페이지: 가동률 OEE
// ═══════════════════════════════════════════
function Availability({t}){
  const [fMonth,setFMonth]=useState("5");
  const TARGET=90;

  const totalIdle=BM_DATA.filter(r=>r.type==="Machine").reduce((s,r)=>s+r.idle,0);
  const allMachines=168;
  const days=21;
  const allPlanned=allMachines*days*16;
  const overall=+((allPlanned-totalIdle)/allPlanned*100).toFixed(1);

  return(
    <div>
      <div style={{...s.card,marginBottom:12,padding:"10px 14px"}}>
        <div style={{fontSize:11,fontWeight:500,marginBottom:4}}>가동률 산정 공식 Availability Formula</div>
        <div style={{fontSize:11,fontFamily:"monospace",color:"#185FA5"}}>가동률(%) = (계획가동시간 - BM IDLE시간) ÷ 계획가동시간 × 100</div>
        <div style={{fontSize:10,color:"#999",marginTop:4}}>계획가동시간 = 설비대수 × 가동일수 × 16h (2교대) | Machine(01~08)만 산정 | Jig/Mould 제외</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7,marginBottom:14}}>
        {[
          {lbl:"전체 가동률",val:`${overall}%`,cl:overall>=TARGET?"#3B6D11":overall>=80?"#854F0B":"#A32D2D"},
          {lbl:"총 BM IDLE",val:`${totalIdle.toFixed(1)}h`,cl:"#A32D2D"},
          {lbl:"계획 가동시간",val:`${allPlanned.toLocaleString()}h`,cl:"#185FA5"},
          {lbl:"목표 가동률",val:`${TARGET}%`,cl:"#3B6D11"},
          {lbl:"BM 건수 (Machine)",val:`${BM_DATA.filter(r=>r.type==="Machine").length}건`,cl:"#854F0B"},
        ].map((k,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#999",marginBottom:2}}>{k.lbl}</div>
            <div style={{fontSize:16,fontWeight:600,color:k.cl}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {LINES_DATA.map(({l,v,m,bm,idle})=>(
          <div key={l} style={s.card}>
            <div style={{fontSize:12,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              {l}
              <span style={{fontSize:10,color:"#999",fontWeight:400}}>{m}대</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
              <span style={{color:"#999"}}>BM IDLE</span>
              <span style={{fontWeight:500,color:"#A32D2D"}}>{idle.toFixed(1)}h ({bm}건)</span>
            </div>
            <div style={{marginTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                <span style={{fontWeight:600,color:v>=TARGET?"#3B6D11":v>=85?"#854F0B":"#A32D2D"}}>{v}%</span>
                <span style={{fontSize:9,color:"#999"}}>목표 {TARGET}%</span>
              </div>
              <div style={{height:10,background:"#f0f0f0",borderRadius:5,overflow:"hidden"}}>
                <div style={{width:`${v}%`,height:"100%",background:v>=TARGET?"#639922":v>=85?"#EF9F27":"#E24B4A",borderRadius:5}}/>
              </div>
              <div style={{fontSize:9,marginTop:3,color:v>=TARGET?"#3B6D11":"#A32D2D"}}>{v>=TARGET?"✅ 목표 달성":`⚠️ 미달 ${(v-TARGET).toFixed(1)}%p`}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:10}}>BM IDLE 상위 설비 Top Assets</div>
        {[...BM_DATA.filter(r=>r.type==="Machine")].sort((a,b)=>b.idle-a.idle).slice(0,8).map((r,i)=>{
          const lc=LINE_COLOR[r.line]||"#888";
          return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{fontSize:10,width:160,flexShrink:0,color:lc,fontFamily:"monospace"}}>{r.assetNo.split("-").slice(-1)[0]} ({r.line})</div>
              <div style={{flex:1,height:12,background:"#f0f0f0",borderRadius:3,overflow:"hidden"}}>
                <div style={{width:`${r.idle/2.5*100}%`,height:"100%",background:lc,borderRadius:3,display:"flex",alignItems:"center",paddingLeft:4,fontSize:9,color:"#fff",fontWeight:500}}>{r.idle.toFixed(1)}h</div>
              </div>
              <div style={{fontSize:10,color:"#999",width:30,textAlign:"right"}}>{r.idle.toFixed(1)}h</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 페이지: BM 이력
// ═══════════════════════════════════════════
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

  const subCatColor=(c="")=>{
    if(c.includes("SENSOR")) return{bg:"#E6F1FB",cl:"#185FA5"};
    if(c.includes("WELD")||c.includes("ROBOT")) return{bg:"#FAEEDA",cl:"#854F0B"};
    if(c.includes("PRESS")) return{bg:"#EEEDFE",cl:"#534AB7"};
    if(c.includes("ASSEMBLY")) return{bg:"#EAF3DE",cl:"#3B6D11"};
    if(c.includes("MOULD")) return{bg:"#EEEDFE",cl:"#534AB7"};
    return{bg:"#F1EFE8",cl:"#5F5E5A"};
  };

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {["Machine","Mould","Jig"].map(tb=>(
          <button key={tb} onClick={()=>setTab(tb)}
            style={{...s.btn(tab===tb?"#185FA5":"transparent",tab===tb?"#fff":"var(--color-text-secondary,#555)"),border:`0.5px solid ${tab===tb?"#185FA5":"#ccc"}`,borderRadius:999}}>
            {tb==="Machine"?"Machine BM":tb==="Mould"?"Mould BM":"Jig/PED BM"}
          </button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:10}}>
        {[
          {lbl:"총 BM 건수",val:`${data.length}건`,cl:"#A32D2D"},
          {lbl:"총 IDLE 시간",val:`${totalIdle.toFixed(1)}h`,cl:"#854F0B"},
          {lbl:"건당 평균 IDLE",val:`${data.length?+(totalIdle/data.length).toFixed(2):0}h`,cl:"#185FA5"},
          {lbl:"최장 IDLE",val:`${data.length?Math.max(...data.map(r=>r.idle)).toFixed(1):0}h`,cl:"#A32D2D"},
        ].map((k,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:9,color:"#999"}}>{k.lbl}</div>
            <div style={{fontSize:16,fontWeight:600,color:k.cl}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
        <input style={s.input} placeholder={t.search} value={q} onChange={e=>setQ(e.target.value)}/>
        <select style={s.select} value={fShift} onChange={e=>setFShift(e.target.value)}>
          <option value="">{t.allShift}</option>
          {["I","II","III"].map(sh=><option key={sh} value={sh}>Shift {sh}</option>)}
        </select>
        <span style={{fontSize:11,color:"#999",display:"flex",alignItems:"center"}}>{data.length}건</span>
      </div>

      <div style={{overflowX:"auto",border:"0.5px solid #e0e0e0",borderRadius:10}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:900}}>
          <thead>
            <tr>
              {["SL","날짜","자산번호","Shift","분류","라인","문제","원인","조치","팀","담당","시작","완료","IDLE"].map(h=>(
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(r=>{
              const sc=subCatColor(r.subCat||r.mainCat);
              return(
                <tr key={r.sl} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                  <td style={{...s.td,color:"#999"}}>{r.sl}</td>
                  <td style={{...s.td,whiteSpace:"nowrap"}}>{r.date}</td>
                  <td style={{...s.td,fontFamily:"monospace",fontSize:10,color:"#185FA5"}}>{r.assetNo}</td>
                  <td style={s.td}><span style={s.pill(r.shift==="I"?"#E6F1FB":r.shift==="II"?"#FAEEDA":"#FCEBEB",r.shift==="I"?"#185FA5":r.shift==="II"?"#854F0B":"#A32D2D")}>{r.shift}</span></td>
                  <td style={s.td}><span style={s.pill(sc.bg,sc.cl)}>{r.mainCat}</span></td>
                  <td style={{...s.td,fontSize:10}}>{r.line}</td>
                  <td style={{...s.td,fontSize:10,maxWidth:120}}>{r.problem}</td>
                  <td style={{...s.td,fontSize:10,color:"#555",maxWidth:120}}>{r.reason}</td>
                  <td style={{...s.td,fontSize:10,color:"#3B6D11",maxWidth:130}}>{r.action}</td>
                  <td style={{...s.td,fontSize:10}}>{r.team}</td>
                  <td style={{...s.td,fontSize:10}}>{r.checker}</td>
                  <td style={{...s.td,fontSize:10,whiteSpace:"nowrap"}}>{r.start||"-"}</td>
                  <td style={{...s.td,fontSize:10,whiteSpace:"nowrap"}}>{r.finish||"-"}</td>
                  <td style={s.td}>{r.idle>0?<span style={s.pill("#FCEBEB","#A32D2D")}>{r.idle.toFixed(1)}h</span>:<span style={{color:"#ccc"}}>-</span>}</td>
                </tr>
              );
            })}
            {data.length===0&&<tr><td colSpan={14} style={{textAlign:"center",padding:30,color:"#999"}}>데이터 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 페이지: PM Plan
// ═══════════════════════════════════════════
function PMPlan({t}){
  const [tab,setTab]=useState("list");
  const [q,setQ]=useState("");
  const [fCat,setFCat]=useState("");
  const [fLine,setFLine]=useState("");
  const [fSt,setFSt]=useState("");
  const [calMonth,setCalMonth]=useState(4); // 0-indexed May

  const data=useMemo(()=>PM_DATA.filter(r=>{
    if(q&&![r.assetNo,r.name,r.task,r.detail].some(v=>v.toLowerCase().includes(q.toLowerCase()))) return false;
    if(fCat&&r.cat!==fCat) return false;
    if(fLine&&r.line!==fLine) return false;
    if(fSt&&r.status!==fSt) return false;
    return true;
  }),[q,fCat,fLine,fSt]);

  const done=PM_DATA.filter(r=>r.status==="done").length;
  const over=PM_DATA.filter(r=>r.status==="delay").length;
  const rate=Math.round(done/PM_DATA.length*100);

  const legColor={PREDICTIVE:{bg:"#E6F1FB",cl:"#185FA5"},PREVENTIVE:{bg:"#EAF3DE",cl:"#3B6D11"},INSPECTION:{bg:"#9FE1CB",cl:"#04342C"},AMC:{bg:"#FAEEDA",cl:"#854F0B"}};
  const catColor={Machine:{bg:"#E6F1FB",cl:"#185FA5"},Mould:{bg:"#EEEDFE",cl:"#534AB7"},Jig:{bg:"#EAF3DE",cl:"#3B6D11"},Inspection:{bg:"#9FE1CB",cl:"#04342C"},AMC:{bg:"#FAEEDA",cl:"#854F0B"}};

  // 캘린더
  const MONTHS_KO=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const evsByDay={};
  PM_DATA.forEach(r=>{const d=new Date(r.planDate);if(d.getMonth()===calMonth){const k=d.getDate();if(!evsByDay[k])evsByDay[k]=[];evsByDay[k].push(r);}});
  const firstDay=new Date(2026,calMonth,1).getDay();
  const daysInMonth=new Date(2026,calMonth+1,0).getDate();
  const evColor=(r)=>{
    if(r.status==="done") return{bg:"#F1EFE8",cl:"#5F5E5A"};
    if(r.status==="delay") return{bg:"#FCEBEB",cl:"#A32D2D"};
    if(r.cat==="Mould") return{bg:"#EEEDFE",cl:"#534AB7"};
    if(r.cat==="Jig") return{bg:"#EAF3DE",cl:"#3B6D11"};
    if(r.cat==="Inspection"||r.cat==="AMC") return{bg:"#FAEEDA",cl:"#854F0B"};
    return{bg:"#E6F1FB",cl:"#185FA5"};
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
        {[
          {lbl:"전체 PM",val:`${PM_DATA.length}건`,cl:"#185FA5"},
          {lbl:"완료",val:`${done}건`,cl:"#3B6D11"},
          {lbl:"예정",val:`${PM_DATA.filter(r=>r.status==="sched").length}건`,cl:"#854F0B"},
          {lbl:"지연",val:`${over}건`,cl:"#A32D2D"},
          {lbl:"완료율",val:`${rate}%`,cl:rate>=80?"#3B6D11":rate>=50?"#854F0B":"#A32D2D"},
        ].map((k,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:9,color:"#999"}}>{k.lbl}</div>
            <div style={{fontSize:16,fontWeight:600,color:k.cl}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[["list","ti-list","리스트"],["cal","ti-calendar","캘린더"],["yr","ti-calendar-stats","연간"]].map(([v,icon,lbl])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{...s.btn(tab===v?"#185FA5":"transparent",tab===v?"#fff":"var(--color-text-secondary,#555)"),border:`0.5px solid ${tab===v?"#185FA5":"#ccc"}`,borderRadius:999}}>
            <i className={`ti ${icon}`} style={{fontSize:12}} aria-hidden="true"/> {lbl}
          </button>
        ))}
      </div>

      {tab==="list"&&(
        <>
          <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
            <input style={s.input} placeholder={t.search} value={q} onChange={e=>setQ(e.target.value)}/>
            <select style={s.select} value={fCat} onChange={e=>setFCat(e.target.value)}>
              <option value="">{t.allCat}</option>
              {["Machine","Mould","Jig","Inspection","AMC"].map(c=><option key={c}>{c}</option>)}
            </select>
            <select style={s.select} value={fLine} onChange={e=>setFLine(e.target.value)}>
              <option value="">{t.allLines}</option>
              {["FRAM","CCB","PRESS","PROJECTION","COMMON"].map(l=><option key={l}>{l}</option>)}
            </select>
            <select style={s.select} value={fSt} onChange={e=>setFSt(e.target.value)}>
              <option value="">{t.allStatus}</option>
              {["done","sched","delay","prog"].map(s=><option key={s} value={s}>{t.status[s]}</option>)}
            </select>
          </div>
          <div style={{overflowX:"auto",border:"0.5px solid #e0e0e0",borderRadius:10}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:900}}>
              <thead><tr>
                {["No","자산번호","설비명","유형","라인","작업내용","Legend","주기","표준시간","계획일","담당자","상태"].map(h=><th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.map((r,i)=>{
                  const lc=legColor[r.legend]||{bg:"#eee",cl:"#555"};
                  const cc=catColor[r.cat]||{bg:"#eee",cl:"#555"};
                  return(
                    <tr key={r.id} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                      <td style={{...s.td,color:"#999"}}>{i+1}</td>
                      <td style={{...s.td,fontFamily:"monospace",fontSize:10,color:"#185FA5"}}>{r.assetNo}</td>
                      <td style={{...s.td,maxWidth:130,fontSize:11}}>{r.name}</td>
                      <td style={s.td}><span style={s.pill(cc.bg,cc.cl)}>{r.cat}</span></td>
                      <td style={s.td}>{r.line}</td>
                      <td style={{...s.td,fontSize:10,maxWidth:150}}>{r.task}</td>
                      <td style={s.td}><span style={s.pill(lc.bg,lc.cl)}>{r.legend}</span></td>
                      <td style={{...s.td,fontSize:10}}>{r.freq}</td>
                      <td style={{...s.td,textAlign:"center"}}>{r.std}h×{r.man}명</td>
                      <td style={{...s.td,whiteSpace:"nowrap"}}>{r.planDate}</td>
                      <td style={{...s.td,fontSize:10}}>{r.person}</td>
                      <td style={s.td}>{stPill(r.status,t)}</td>
                    </tr>
                  );
                })}
                {data.length===0&&<tr><td colSpan={12} style={{textAlign:"center",padding:30,color:"#999"}}>데이터 없음</td></tr>}
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
            {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i} style={{minHeight:70,background:"#f9f9f9",borderRadius:6,border:"0.5px solid #e0e0e0",opacity:.4}}/>)}
            {Array(daysInMonth).fill(null).map((_,d)=>{
              const day=d+1;
              const evs=evsByDay[day]||[];
              const isToday=new Date().getDate()===day&&new Date().getMonth()===calMonth;
              return(
                <div key={day} style={{minHeight:70,background:"var(--color-background-primary,#fff)",border:`${isToday?"1.5px solid #185FA5":"0.5px solid #e0e0e0"}`,borderRadius:6,padding:"3px 4px"}}>
                  <div style={{fontSize:9,fontWeight:500,color:isToday?"#185FA5":"#555",marginBottom:2}}>{day}</div>
                  {evs.slice(0,3).map((r,i)=>{const ec=evColor(r);return<div key={i} style={{fontSize:8,padding:"1px 3px",borderRadius:2,marginBottom:1,background:ec.bg,color:ec.cl,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.assetNo.split("-").slice(-1)[0]}</div>;})}
                  {evs.length>3&&<div style={{fontSize:8,color:"#999"}}>+{evs.length-3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="yr"&&(
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:10,width:"100%"}}>
            <thead><tr style={{background:"var(--color-background-secondary,#f5f5f5)"}}>
              <th style={{...s.th,minWidth:140,position:"sticky",left:0}}>설비 Asset</th>
              <th style={s.th}>유형</th>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m=><th key={m} style={{...s.th,textAlign:"center",minWidth:36}}>{m}</th>)}
            </tr></thead>
            <tbody>
              {PM_DATA.map(r=>{
                const m=new Date(r.planDate).getMonth();
                const cc=catColor[r.cat]||{bg:"#eee",cl:"#555"};
                return(
                  <tr key={r.id} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                    <td style={{...s.td,fontFamily:"monospace",fontSize:10,position:"sticky",left:0,background:"var(--color-background-secondary,#f5f5f5)",fontWeight:500}}>{r.assetNo}</td>
                    <td style={s.td}><span style={s.pill(cc.bg,cc.cl)}>{r.cat}</span></td>
                    {Array(12).fill(null).map((_,i)=>(
                      <td key={i} style={{...s.td,textAlign:"center"}}>
                        {i===m?<span style={s.pill(r.status==="done"?"#C0DD97":r.status==="delay"?"#F7C1C1":"#B5D4F4",r.status==="done"?"#173404":r.status==="delay"?"#501313":"#042C53")}>{r.status==="done"?"D":r.status==="delay"?"O":"P"}</span>:<span style={{color:"#ddd"}}>·</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 페이지: 설정
// ═══════════════════════════════════════════
function Settings({t,lang,setLang}){
  const [users,setUsers]=useState(INIT_USERS);
  const [perms,setPerms]=useState(INIT_PERMS);
  const [saved,setSaved]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",dept:"",role:"Technician"});
  const [showAdd,setShowAdd]=useState(false);
  const [editPerm,setEditPerm]=useState(null);
  const permColor=(v)=>({write:["#EAF3DE","#3B6D11"],read:["#E6F1FB","#185FA5"],none:["#F1EFE8","#5F5E5A"]}[v]||["#F1EFE8","#5F5E5A"]);

  return(
    <div>
      <div style={{fontSize:14,fontWeight:500,marginBottom:14}}>{t.settings.title}</div>

      {/* 언어 */}
      <div style={{...s.card,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:4}}>{t.settings.lang}</div>
        <div style={{fontSize:11,color:"#999",marginBottom:10}}>{t.settings.langSub}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {Object.entries(LANG_LABELS).map(([k,v])=>(
            <div key={k} onClick={()=>setLang(k)}
              style={{padding:"10px 12px",borderRadius:8,border:`${lang===k?"1.5px solid #185FA5":"0.5px solid #ccc"}`,background:lang===k?"#EBF3FC":"var(--color-background-secondary,#f5f5f5)",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:4}}>{LANG_FLAGS[k]}</div>
              <div style={{fontSize:12,fontWeight:lang===k?500:400,color:lang===k?"#185FA5":"var(--color-text-primary,#1a1a1a)"}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 사용자 */}
      <div style={{...s.card,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {t.settings.users}
          <button onClick={()=>setShowAdd(!showAdd)} style={s.btn("#185FA5","#fff")}>+ {t.settings.addUser}</button>
        </div>
        {showAdd&&(
          <div style={{background:"var(--color-background-secondary,#f5f5f5)",borderRadius:8,padding:"10px",marginBottom:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:7,alignItems:"center"}}>
            {["name","email","dept"].map(f=>(
              <input key={f} placeholder={t.settings[f]} value={newUser[f]}
                onChange={e=>setNewUser({...newUser,[f]:e.target.value})}
                style={{fontSize:11,padding:"5px 8px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",color:"#1a1a1a"}}/>
            ))}
            <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}
              style={{fontSize:11,padding:"5px 8px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",color:"#1a1a1a"}}>
              {Object.keys(INIT_PERMS).map(r=><option key={r}>{r}</option>)}
            </select>
            <button onClick={()=>{
              if(newUser.name&&newUser.email){
                setUsers([...users,{id:Date.now(),...newUser,status:"pending"}]);
                setNewUser({name:"",email:"",dept:"",role:"Technician"});
                setShowAdd(false);
              }
            }} style={s.btn("#185FA5","#fff")}>{t.settings.save}</button>
          </div>
        )}
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              {[t.settings.name,t.settings.email,t.settings.dept,t.settings.role,t.settings.status,t.settings.actions].map(h=><th key={h} style={s.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                  <td style={s.td}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:10,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{u.name[0]}</div>
                      {u.name}
                    </div>
                  </td>
                  <td style={{...s.td,fontSize:10,color:"#555"}}>{u.email}</td>
                  <td style={s.td}>{u.dept}</td>
                  <td style={s.td}><span style={s.pill("#E6F1FB","#185FA5")}>{u.role}</span></td>
                  <td style={s.td}><span style={s.pill(u.status==="active"?"#EAF3DE":"#FAEEDA",u.status==="active"?"#3B6D11":"#854F0B")}>{u.status==="active"?t.settings.active:t.settings.pending}</span></td>
                  <td style={s.td}>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>setEditPerm(editPerm===u.role?null:u.role)}
                        style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"0.5px solid #ccc",background:"transparent",color:"#185FA5",cursor:"pointer"}}>{t.settings.edit}</button>
                      {u.status==="pending"&&(
                        <button onClick={()=>setUsers(users.map(x=>x.id===u.id?{...x,status:"active"}:x))}
                          style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"0.5px solid #3B6D11",background:"#EAF3DE",color:"#3B6D11",cursor:"pointer"}}>{t.settings.approve}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 권한 */}
      <div style={s.card}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:4}}>{t.settings.permissions}</div>
        <div style={{fontSize:11,color:"#999",marginBottom:10}}>{t.settings.permSub}</div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {Object.keys(INIT_PERMS).map(r=>(
            <button key={r} onClick={()=>setEditPerm(editPerm===r?null:r)}
              style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`${editPerm===r?"1.5px solid #185FA5":"0.5px solid #ccc"}`,background:editPerm===r?"#EBF3FC":"var(--color-background-secondary,#f5f5f5)",color:editPerm===r?"#185FA5":"var(--color-text-primary,#1a1a1a)",cursor:"pointer",fontWeight:editPerm===r?500:400}}>
              {r}
            </button>
          ))}
        </div>
        {editPerm&&(
          <div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>
                  <th style={s.th}>{t.settings.role}: {editPerm}</th>
                  {[t.settings.write,t.settings.read,t.settings.none].map(h=><th key={h} style={{...s.th,textAlign:"center"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {MENU_CATS.map(({key,icon})=>{
                    const cur=perms[editPerm]?.[key]||"none";
                    const[bg,cl]=permColor(cur);
                    return(
                      <tr key={key} style={{borderBottom:"0.5px solid #e0e0e0"}}>
                        <td style={{...s.td,display:"flex",alignItems:"center",gap:7}}>
                          <i className={`ti ${icon}`} style={{fontSize:13,color:"#999"}} aria-hidden="true"/>
                          <span>{t.nav[key]}</span>
                          <span style={s.pill(bg,cl)}>{cur}</span>
                        </td>
                        {["write","read","none"].map(v=>(
                          <td key={v} style={{...s.td,textAlign:"center"}}>
                            <input type="radio" name={`${editPerm}-${key}`} checked={cur===v}
                              onChange={()=>setPerms(prev=>({...prev,[editPerm]:{...prev[editPerm],[key]:v}}))}/>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

// ═══════════════════════════════════════════
// 메인 앱
// ═══════════════════════════════════════════
export default function DSCFMSPortal(){
  const [lang,setLang]=useState("ko");
  const [page,setPage]=useState("dashboard");
  const t=T[lang];
  const n=t.nav;

  const NI=({pg,icon,label,badge})=>(
    <div onClick={()=>setPage(pg)}
      style={{display:"flex",alignItems:"center",gap:7,padding:"6px 14px",fontSize:11,
        color:page===pg?"#185FA5":"var(--color-text-secondary,#555)",cursor:"pointer",
        background:page===pg?"#EBF3FC":"transparent",
        borderRight:page===pg?"2px solid #185FA5":"2px solid transparent",fontWeight:page===pg?500:400}}>
      <i className={`ti ${icon}`} style={{fontSize:14,width:16,textAlign:"center"}} aria-hidden="true"/>
      <span style={{flex:1}}>{label}</span>
      {badge&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:999,fontWeight:600,background:badge.bg,color:badge.cl}}>{badge.v}</span>}
    </div>
  );

  const pageTitle={dashboard:"대시보드",master:"설비 마스터",avail:"가동률 OEE",bm:"BM 이력",pm:"PM Plan",settings:"설정",wo:"작업지시",parts:"부품/재고",kpi:"KPI 리포트",team:"팀 관리"};

  return(
    <>
      <Head>
        <title>DSC FMS Portal</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
        <style>{`body{margin:0;background:#f5f5f5;}`}</style>
      </Head>
      <div style={{display:"flex",height:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:"var(--color-text-primary,#1a1a1a)"}}>
        {/* SIDEBAR */}
        <nav style={{width:200,background:"var(--color-background-primary,#fff)",borderRight:"0.5px solid var(--color-border-tertiary,#e0e0e0)",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"12px 14px",borderBottom:"0.5px solid #e0e0e0"}}>
            <div style={{fontSize:13,fontWeight:500}}>{t.appName}</div>
            <div style={{fontSize:10,color:"#999",marginTop:1}}>{t.appSub}</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
            {[["개요","overview"]].map(()=>null)}
            <div style={{fontSize:9,color:"#999",padding:"6px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.overview}</div>
            <NI pg="dashboard" icon="ti-layout-dashboard" label={n.dashboard}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.asset}</div>
            <NI pg="master" icon="ti-layout-list" label={n.master} badge={{v:"168",bg:"#E6F1FB",cl:"#185FA5"}}/>
            <NI pg="avail"  icon="ti-chart-bar"   label={n.avail}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.maint}</div>
            <NI pg="bm" icon="ti-alert-triangle" label={n.bm}  badge={{v:"4",bg:"#FCEBEB",cl:"#A32D2D"}}/>
            <NI pg="pm" icon="ti-tool"           label={n.pm}  badge={{v:"7",bg:"#FAEEDA",cl:"#854F0B"}}/>
            <NI pg="wo" icon="ti-clipboard-list" label={n.wo}  badge={{v:"3",bg:"#FCEBEB",cl:"#A32D2D"}}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.inv}</div>
            <NI pg="parts" icon="ti-package"  label={n.parts}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.analytics}</div>
            <NI pg="kpi" icon="ti-chart-line" label={n.kpi}/>
            <div style={{fontSize:9,color:"#999",padding:"8px 14px 2px",textTransform:"uppercase",letterSpacing:".06em"}}>{n.system}</div>
            <NI pg="team"     icon="ti-users"    label={n.team}/>
            <NI pg="settings" icon="ti-settings" label={n.settings}/>
          </div>
          <div style={{padding:"10px 14px",borderTop:"0.5px solid #e0e0e0"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>나</div>
              <div>
                <div style={{fontSize:11,fontWeight:500}}>나경태</div>
                <div style={{fontSize:9,color:"#999"}}>{t.role}</div>
              </div>
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{background:"var(--color-background-primary,#fff)",borderBottom:"0.5px solid #e0e0e0",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",flexShrink:0}}>
            <div style={{fontSize:11,color:"#999"}}>
              {t.appName} › <span style={{color:"#1a1a1a",fontWeight:500}}>{pageTitle[page]||page}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
              {[{v:`${t.bmUrgent} 4`,bg:"#FCEBEB",cl:"#A32D2D"},{v:`${t.pmToday} 7`,bg:"#FAEEDA",cl:"#854F0B"},{v:`${t.idleR} 12`,bg:"#E6F1FB",cl:"#185FA5"},{v:`${t.idleNR} 5`,bg:"#FCEBEB",cl:"#A32D2D"}]
                .map((p,i)=><span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:999,fontWeight:500,background:p.bg,color:p.cl}}>{p.v}</span>)}
              <select value={lang} onChange={e=>setLang(e.target.value)}
                style={{fontSize:10,padding:"3px 6px",borderRadius:6,border:"0.5px solid #ccc",background:"#fff",cursor:"pointer"}}>
                {Object.entries(LANG_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
              <span style={{fontSize:10,color:"#999"}}>2026.05.06</span>
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
            {page==="dashboard" && <Dashboard t={t} setPage={setPage}/>}
            {page==="master"    && <AssetMaster t={t}/>}
            {page==="avail"     && <Availability t={t}/>}
            {page==="bm"        && <BMHistory t={t}/>}
            {page==="pm"        && <PMPlan t={t}/>}
            {page==="settings"  && <Settings t={t} lang={lang} setLang={setLang}/>}
            {["wo","parts","kpi","team"].includes(page)&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:10,color:"#999"}}>
                <i className="ti ti-tools" style={{fontSize:40}} aria-hidden="true"/>
                <div style={{fontSize:14,fontWeight:500,color:"#555"}}>{pageTitle[page]}</div>
                <div style={{fontSize:12,textAlign:"center",maxWidth:280,lineHeight:1.6}}>
                  {page==="wo"&&"BM 접수 → WO 발행 → 완료 처리 흐름\n추후 개발 예정"}
                  {page==="parts"&&"BM 수리 시 사용 부품 추적\n추후 개발 예정"}
                  {page==="kpi"&&"월별 종합 보고 · MTTR · MTTF · PM 완료율\n추후 개발 예정"}
                  {page==="team"&&"HARI TEAM · SARAVANARAJ TEAM · PRAVEEN TEAM\n담당자별 작업 현황"}
                </div>
                <button onClick={()=>setPage("dashboard")}
                  style={{marginTop:8,fontSize:12,padding:"7px 18px",borderRadius:8,background:"#185FA5",color:"#fff",border:"none",cursor:"pointer"}}>
                  ← Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
