// pages/index.js — DSC FMS Portal 완성 코드
// Next.js 14 + React 18 기반
// 배포: vercel.com (무료)

import { useState } from "react";
import Head from "next/head";

// ─── 다국어 텍스트 ───────────────────────────────────────────
const T = {
  ko: {
    appName: "DSC FMS 포털", appSub: "Daechang Seat · Chennai Plant",
    welcome: "안녕하세요", role: "생산/기술/보전/생산관리 총괄",
    nav: { overview:"개요", dashboard:"대시보드", asset:"설비", master:"설비 마스터",
      avail:"가동률 OEE", maint:"보전", bm:"BM 이력", pm:"PM Plan",
      wo:"작업지시", inv:"재고", parts:"부품/재고", analytics:"분석",
      kpi:"KPI 리포트", system:"시스템", team:"팀 관리", settings:"설정" },
    dash: { title:"오늘 현황", avail:"전체 가동률", bm:"BM 미완료", pm:"PM 완료율",
      mttr:"MTTR 평균", target:"목표", urgent:"긴급", general:"일반", improve:"개선",
      lineAvail:"라인별 가동률", detail:"상세 →", idleStatus:"Idle 설비 현황",
      nonRun:"Non-running", running:"Running(대기)", total:"전체 등록",
      salePend:"Fixed Asset Sale", bmAlert:"BM 긴급 알림", allBm:"전체 →",
      todayPm:"오늘 PM 일정", quickNav:"빠른 이동",
      disposeReview:"처분/폐기 검토", relocReview:"재배치 검토",
      allMachine:"Machine 01~15", saleTarget:"매각 대상" },
    settings: { title:"설정", lang:"언어 설정", langSub:"앱 표시 언어를 선택하세요",
      access:"접근 권한 관리", accessSub:"신규 회원가입 시 카테고리별 접근 권한을 설정합니다",
      users:"사용자 목록", addUser:"신규 사용자 추가", name:"이름", email:"이메일",
      dept:"부서", role:"역할", status:"상태", actions:"액션",
      active:"활성", pending:"승인대기", edit:"편집", approve:"승인",
      permissions:"카테고리별 권한", permSub:"각 메뉴의 기본 접근 권한 (신규 사용자 기본값)",
      read:"읽기", write:"쓰기", none:"없음", save:"저장", cancel:"취소", saved:"저장되었습니다" },
    status: { done:"완료", sched:"예정", delay:"지연", prog:"진행중" },
    bmUrgent:"BM 긴급", pmToday:"PM 오늘", idleR:"Idle(R)", idleNR:"Idle(NR)",
  },
  en: {
    appName: "DSC FMS Portal", appSub: "Daechang Seat · Chennai Plant",
    welcome: "Hello", role: "Production / Tech / Maintenance GM",
    nav: { overview:"Overview", dashboard:"Dashboard", asset:"Assets",
      master:"Asset Master", avail:"Availability OEE", maint:"Maintenance",
      bm:"BM History", pm:"PM Plan", wo:"Work Order", inv:"Inventory",
      parts:"Parts / Stock", analytics:"Analytics", kpi:"KPI Report",
      system:"System", team:"Team", settings:"Settings" },
    dash: { title:"Today's Overview", avail:"Overall Availability", bm:"BM Backlog",
      pm:"PM Completion", mttr:"Avg MTTR", target:"Target", urgent:"Urgent",
      general:"General", improve:"Improved", lineAvail:"Line Availability",
      detail:"Detail →", idleStatus:"Idle Asset Status", nonRun:"Non-running",
      running:"Running (standby)", total:"Total Registered", salePend:"Fixed Asset Sale",
      bmAlert:"BM Urgent Alerts", allBm:"All →", todayPm:"Today's PM Schedule",
      quickNav:"Quick Access", disposeReview:"Disposal review",
      relocReview:"Relocation review", allMachine:"Machine 01~15", saleTarget:"Sale pending" },
    settings: { title:"Settings", lang:"Language", langSub:"Select display language",
      access:"Access Control", accessSub:"Set category-level permissions for new users",
      users:"User List", addUser:"Add New User", name:"Name", email:"Email",
      dept:"Department", role:"Role", status:"Status", actions:"Actions",
      active:"Active", pending:"Pending", edit:"Edit", approve:"Approve",
      permissions:"Category Permissions", permSub:"Default permissions for new users",
      read:"Read", write:"Write", none:"None", save:"Save", cancel:"Cancel", saved:"Saved" },
    status: { done:"Done", sched:"Sched.", delay:"Delayed", prog:"In Progress" },
    bmUrgent:"BM Urgent", pmToday:"PM Today", idleR:"Idle(R)", idleNR:"Idle(NR)",
  },
  hi: {
    appName: "DSC FMS पोर्टल", appSub: "Daechang Seat · चेन्नई प्लांट",
    welcome: "नमस्ते", role: "उत्पादन/तकनीक/रखरखाव प्रमुख",
    nav: { overview:"अवलोकन", dashboard:"डैशबोर्ड", asset:"संपत्ति",
      master:"एसेट मास्टर", avail:"उपलब्धता OEE", maint:"रखरखाव",
      bm:"BM इतिहास", pm:"PM योजना", wo:"कार्य आदेश", inv:"इन्वेंटरी",
      parts:"पुर्जे/स्टॉक", analytics:"विश्लेषण", kpi:"KPI रिपोर्ट",
      system:"सिस्टम", team:"टीम", settings:"सेटिंग्स" },
    dash: { title:"आज का अवलोकन", avail:"कुल उपलब्धता", bm:"BM बैकलॉग",
      pm:"PM पूर्णता", mttr:"औसत MTTR", target:"लक्ष्य", urgent:"जरूरी",
      general:"सामान्य", improve:"सुधार", lineAvail:"लाइन उपलब्धता",
      detail:"विस्तार →", idleStatus:"निष्क्रिय उपकरण", nonRun:"Non-running",
      running:"Running (प्रतीक्षा)", total:"कुल पंजीकृत", salePend:"Fixed Asset Sale",
      bmAlert:"BM आपातकालीन अलर्ट", allBm:"सभी →", todayPm:"आज PM शेड्यूल",
      quickNav:"त्वरित पहुँच", disposeReview:"निपटान समीक्षा",
      relocReview:"पुनर्स्थापन समीक्षा", allMachine:"Machine 01~15", saleTarget:"बिक्री लंबित" },
    settings: { title:"सेटिंग्स", lang:"भाषा", langSub:"प्रदर्शन भाषा चुनें",
      access:"एक्सेस नियंत्रण", accessSub:"नए उपयोगकर्ताओं के लिए श्रेणी अनुमतियाँ",
      users:"उपयोगकर्ता सूची", addUser:"नया उपयोगकर्ता", name:"नाम", email:"ईमेल",
      dept:"विभाग", role:"भूमिका", status:"स्थिति", actions:"कार्रवाई",
      active:"सक्रिय", pending:"लंबित", edit:"संपादित", approve:"स्वीकृत",
      permissions:"श्रेणी अनुमतियाँ", permSub:"नए उपयोगकर्ताओं के लिए डिफ़ॉल्ट अनुमतियाँ",
      read:"पढ़ें", write:"लिखें", none:"कोई नहीं", save:"सहेजें",
      cancel:"रद्द करें", saved:"सहेजा गया" },
    status: { done:"पूर्ण", sched:"निर्धारित", delay:"विलंबित", prog:"प्रगति में" },
    bmUrgent:"BM आपातकाल", pmToday:"PM आज", idleR:"Idle(R)", idleNR:"Idle(NR)",
  },
  ta: {
    appName: "DSC FMS போர்டல்", appSub: "Daechang Seat · சென்னை ஆலை",
    welcome: "வணக்கம்", role: "உற்பத்தி/தொழில்நுட்பம்/பராமரிப்பு தலைவர்",
    nav: { overview:"கண்ணோட்டம்", dashboard:"டாஷ்போர்டு", asset:"சொத்துக்கள்",
      master:"சொத்து பட்டியல்", avail:"கிடைக்கும் தன்மை OEE", maint:"பராமரிப்பு",
      bm:"BM வரலாறு", pm:"PM திட்டம்", wo:"பணி உத்தரவு", inv:"சரக்கு",
      parts:"பாகங்கள்/கையிருப்பு", analytics:"பகுப்பாய்வு", kpi:"KPI அறிக்கை",
      system:"அமைப்பு", team:"குழு", settings:"அமைப்புகள்" },
    dash: { title:"இன்றைய நிலை", avail:"மொத்த கிடைக்கும் தன்மை", bm:"BM நிலுவை",
      pm:"PM முடிவு விகிதம்", mttr:"சராசரி MTTR", target:"இலக்கு",
      urgent:"அவசரம்", general:"பொதுவான", improve:"மேம்பட்டது",
      lineAvail:"வரிசை கிடைக்கும் தன்மை", detail:"விவரம் →",
      idleStatus:"செயலற்ற இயந்திரங்கள்", nonRun:"Non-running",
      running:"Running (காத்திருப்பு)", total:"மொத்தம் பதிவு", salePend:"Fixed Asset Sale",
      bmAlert:"BM அவசர எச்சரிக்கை", allBm:"அனைத்தும் →",
      todayPm:"இன்றைய PM அட்டவணை", quickNav:"விரைவு அணுகல்",
      disposeReview:"அகற்றல் மதிப்பாய்வு", relocReview:"இடமாற்ற மதிப்பாய்வு",
      allMachine:"இயந்திரம் 01~15", saleTarget:"விற்பனை நிலுவை" },
    settings: { title:"அமைப்புகள்", lang:"மொழி", langSub:"காட்சி மொழியை தேர்ந்தெடுக்கவும்",
      access:"அணுகல் கட்டுப்பாடு", accessSub:"புதிய பயனர்களுக்கு வகை அனுமதிகளை அமைக்கவும்",
      users:"பயனர் பட்டியல்", addUser:"புதிய பயனர்", name:"பெயர்", email:"மின்னஞ்சல்",
      dept:"துறை", role:"பங்கு", status:"நிலை", actions:"செயல்கள்",
      active:"செயலில்", pending:"நிலுவையில்", edit:"திருத்து", approve:"அனுமதி",
      permissions:"வகை அனுமதிகள்", permSub:"புதிய பயனர்களுக்கான இயல்புநிலை அனுமதிகள்",
      read:"படி", write:"எழுது", none:"இல்லை", save:"சேமி",
      cancel:"ரத்து", saved:"சேமிக்கப்பட்டது" },
    status: { done:"முடிந்தது", sched:"திட்டமிட்டது", delay:"தாமதம்", prog:"நடப்பில்" },
    bmUrgent:"BM அவசரம்", pmToday:"PM இன்று", idleR:"Idle(R)", idleNR:"Idle(NR)",
  },
};

const LANG_LABELS = { ko:"한국어", en:"English", hi:"हिन्दी", ta:"தமிழ்" };
const LANG_FLAGS  = { ko:"🇰🇷", en:"🇬🇧", hi:"🇮🇳", ta:"🇮🇳" };

const LINES = [
  { l:"FRAM",       v:87.1, c:"#378ADD", m:48 },
  { l:"CCB",        v:85.8, c:"#D4537E", m:62 },
  { l:"PRESS",      v:92.3, c:"#639922", m:31 },
  { l:"PROJECTION", v:90.2, c:"#EF9F27", m:27 },
];

const INIT_USERS = [
  { id:1, name:"나경태",     email:"na.kt@dsc.com",    dept:"생산관리", role:"GM",          status:"active"  },
  { id:2, name:"Saravanaraj",email:"sara@dsc.com",     dept:"보전",     role:"Team Leader", status:"active"  },
  { id:3, name:"Praveen",    email:"praveen@dsc.com",  dept:"금형",     role:"Team Leader", status:"active"  },
  { id:4, name:"Raj Kumar",  email:"raj@dsc.com",      dept:"프레스",   role:"Engineer",    status:"pending" },
  { id:5, name:"Kannan",     email:"kannan@dsc.com",   dept:"CCB",      role:"Technician",  status:"pending" },
];

const MENU_CATS = [
  { key:"master", icon:"layout-list"    },
  { key:"avail",  icon:"chart-bar"      },
  { key:"bm",     icon:"alert-triangle" },
  { key:"pm",     icon:"tool"           },
  { key:"wo",     icon:"clipboard-list" },
  { key:"parts",  icon:"package"        },
  { key:"kpi",    icon:"chart-line"     },
  { key:"team",   icon:"users"          },
  { key:"settings",icon:"settings"      },
];

const INIT_PERMS = {
  GM:           { master:"write", avail:"write", bm:"write", pm:"write", wo:"write", parts:"write", kpi:"write", team:"write", settings:"write" },
  "Team Leader":{ master:"write", avail:"read",  bm:"write", pm:"write", wo:"write", parts:"read",  kpi:"read",  team:"read",  settings:"none"  },
  Engineer:     { master:"read",  avail:"read",  bm:"write", pm:"read",  wo:"write", parts:"read",  kpi:"none",  team:"none",  settings:"none"  },
  Technician:   { master:"read",  avail:"none",  bm:"write", pm:"read",  wo:"write", parts:"none",  kpi:"none",  team:"none",  settings:"none"  },
};

const BM_ALERTS = [
  { dot:"#E24B4A", title:"FRAM · DCMI-FRM-CRT-128 — 서보 에러",        meta:"Robot / 08:42 · 라인정지 · IDLE 2.5h" },
  { dot:"#E24B4A", title:"CCB · DCMI-CCB-CRT-50 — Pendant 불량",       meta:"Robot / 10:15 · IDLE 1.5h" },
  { dot:"#E24B4A", title:"PRESS · DCMI-PRS-HYD-01 — 유압 이상",        meta:"Press / 11:30 · IDLE 1.3h" },
  { dot:"#EF9F27", title:"PROJECTION · DCMI-PWS-RSW-05 — 냉각수 누수", meta:"Welding / 13:05 · 임시조치 중" },
];

const TODAY_PM = [
  { name:"DCMI-FRM-CRT-01",    task:"TCP 교정",           line:"FRAM",   st:"prog"  },
  { name:"DCMI-UTL-CMP-01",    task:"에어필터 교체",      line:"COMMON", st:"done"  },
  { name:"AI3 CCB / QXI CCB",  task:"Jig Sequence Check", line:"CCB",    st:"done"  },
  { name:"DCMI-PT-183",         task:"Mould Punch 점검",   line:"PRESS",  st:"sched" },
  { name:"DCMI-PRS-NCLF-01",   task:"NC Feeder 베어링",   line:"PRESS",  st:"delay" },
];

const QUICK = [
  { icon:"layout-list",  lbl:"master",  pg:"master" },
  { icon:"alert-triangle",lbl:"bm",     pg:"bm"     },
  { icon:"tool",          lbl:"pm",     pg:"pm"     },
  { icon:"chart-bar",     lbl:"avail",  pg:"avail"  },
  { icon:"clipboard-list",lbl:"wo",     pg:"wo"     },
  { icon:"package",       lbl:"parts",  pg:"parts"  },
  { icon:"chart-line",    lbl:"kpi",    pg:"kpi"    },
  { icon:"users",         lbl:"team",   pg:"team"   },
];

// ─── 헬퍼 ────────────────────────────────────────────────────
const stPill = (st, t) => {
  const m = { done:["#EAF3DE","#3B6D11"], sched:["#FAEEDA","#854F0B"], delay:["#FCEBEB","#A32D2D"], prog:["#E6F1FB","#185FA5"] };
  const [bg, cl] = m[st] || m.sched;
  return <span style={{ fontSize:9, padding:"2px 7px", borderRadius:999, fontWeight:500, background:bg, color:cl, whiteSpace:"nowrap" }}>{t.status[st]}</span>;
};

const permColor = (v) => ({ write:["#EAF3DE","#3B6D11"], read:["#E6F1FB","#185FA5"], none:["#F1EFE8","#5F5E5A"] }[v] || ["#F1EFE8","#5F5E5A"]);

// ─── 메인 컴포넌트 ───────────────────────────────────────────
export default function DSCFMSPortal() {
  const [lang,     setLang]     = useState("ko");
  const [page,     setPage]     = useState("dashboard");
  const [users,    setUsers]    = useState(INIT_USERS);
  const [perms,    setPerms]    = useState(INIT_PERMS);
  const [saved,    setSaved]    = useState(false);
  const [newUser,  setNewUser]  = useState({ name:"", email:"", dept:"", role:"Technician" });
  const [showAdd,  setShowAdd]  = useState(false);
  const [editPerm, setEditPerm] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 햄버거

  const t = T[lang];
  const n = t.nav;

  // ── 사이드바 아이템 ──
  const NI = ({ pg, icon, label, badge }) => (
    <div onClick={() => { setPage(pg); setMenuOpen(false); }}
      style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 14px", fontSize:11,
        color: page===pg ? "#185FA5" : "var(--color-text-secondary, #555)",
        cursor:"pointer", background: page===pg ? "#EBF3FC" : "transparent",
        borderRight: page===pg ? "2px solid #185FA5" : "2px solid transparent",
        fontWeight: page===pg ? 500 : 400 }}>
      <i className={`ti ti-${icon}`} style={{ fontSize:14, width:16, textAlign:"center" }} aria-hidden="true" />
      <span style={{ flex:1 }}>{label}</span>
      {badge && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:999, fontWeight:600, background:badge.bg, color:badge.cl }}>{badge.v}</span>}
    </div>
  );

  // ── 대시보드 ──
  const Dashboard = () => (
    <div>
      <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary,#1a1a1a)", marginBottom:12 }}>
        {t.welcome} 👋 <span style={{ color:"#185FA5" }}>나경태</span> — {t.dash.title}
      </div>

      {/* KPI 4종 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
        {[
          { lbl:t.dash.avail, val:"87.3%", sub:`${t.dash.target} 90%`,          cl:"#854F0B" },
          { lbl:t.dash.bm,    val:"11건",  sub:`${t.dash.urgent} 4 · ${t.dash.general} 7`, cl:"#A32D2D" },
          { lbl:t.dash.pm,    val:"68%",   sub:`${t.dash.target} 90%`,           cl:"#854F0B" },
          { lbl:t.dash.mttr,  val:"2.1h",  sub:`${t.dash.improve} ▼0.3h`,        cl:"#3B6D11" },
        ].map((k,i) => (
          <div key={i} style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"10px 12px" }}>
            <div style={{ fontSize:9, color:"var(--color-text-tertiary,#999)", marginBottom:3 }}>{k.lbl}</div>
            <div style={{ fontSize:20, fontWeight:600, color:k.cl }}>{k.val}</div>
            <div style={{ fontSize:9, color:"var(--color-text-tertiary,#999)", marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 라인 가동률 + Idle */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:10, marginBottom:10 }}>
        <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, fontWeight:500, marginBottom:10, display:"flex", justifyContent:"space-between" }}>
            {t.dash.lineAvail}
            <span style={{ fontSize:10, color:"#185FA5", cursor:"pointer", fontWeight:400 }} onClick={() => setPage("avail")}>{t.dash.detail}</span>
          </div>
          {LINES.map(({ l,v,m }) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
              <div style={{ fontSize:10, color:"var(--color-text-secondary,#555)", width:90, flexShrink:0 }}>{l} <span style={{ fontSize:9, color:"var(--color-text-tertiary,#999)" }}>({m}대)</span></div>
              <div style={{ flex:1, height:10, background:"var(--color-background-secondary,#f5f5f5)", borderRadius:5, overflow:"hidden" }}>
                <div style={{ width:`${v}%`, height:"100%", background:v>=90?"#639922":v>=85?"#EF9F27":"#E24B4A", borderRadius:5 }} />
              </div>
              <div style={{ fontSize:10, fontWeight:600, width:36, textAlign:"right", color:v>=90?"#3B6D11":v>=85?"#854F0B":"#A32D2D" }}>{v}%</div>
            </div>
          ))}
        </div>
        <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, fontWeight:500, marginBottom:10 }}>{t.dash.idleStatus}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {[
              { v:"5",   cl:"#A32D2D", lbl:t.dash.nonRun,   sub:t.dash.disposeReview },
              { v:"12",  cl:"#854F0B", lbl:t.dash.running,  sub:t.dash.relocReview   },
              { v:"168", cl:"#185FA5", lbl:t.dash.total,    sub:t.dash.allMachine    },
              { v:"5",   cl:"#534AB7", lbl:t.dash.salePend, sub:t.dash.saleTarget    },
            ].map((d,i) => (
              <div key={i} style={{ background:"var(--color-background-secondary,#f5f5f5)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                <div style={{ fontSize:17, fontWeight:600, color:d.cl }}>{d.v}{lang==="ko"?"대":""}</div>
                <div style={{ fontSize:9, color:"var(--color-text-tertiary,#999)", marginTop:1, lineHeight:1.4 }}>{d.lbl}<br/>{d.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BM 알림 + 오늘 PM */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, fontWeight:500, marginBottom:8, display:"flex", justifyContent:"space-between" }}>
            {t.dash.bmAlert}
            <span style={{ fontSize:10, color:"#185FA5", cursor:"pointer", fontWeight:400 }} onClick={() => setPage("bm")}>{t.dash.allBm}</span>
          </div>
          {BM_ALERTS.map((b,i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"6px 0", borderBottom:i<BM_ALERTS.length-1?"0.5px solid var(--color-border-tertiary,#e0e0e0)":"none" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:b.dot, marginTop:3, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-primary,#1a1a1a)" }}>{b.title}</div>
                <div style={{ fontSize:10, color:"var(--color-text-tertiary,#999)", marginTop:1 }}>{b.meta}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, fontWeight:500, marginBottom:8, display:"flex", justifyContent:"space-between" }}>
            {t.dash.todayPm}
            <span style={{ fontSize:10, color:"#185FA5", cursor:"pointer", fontWeight:400 }} onClick={() => setPage("pm")}>{t.dash.detail}</span>
          </div>
          {TODAY_PM.map((p,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:i<TODAY_PM.length-1?"0.5px solid var(--color-border-tertiary,#e0e0e0)":"none" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"var(--color-text-primary,#1a1a1a)" }}>{p.name}</div>
                <div style={{ fontSize:10, color:"var(--color-text-tertiary,#999)" }}>{p.task} · {p.line}</div>
              </div>
              {stPill(p.st, t)}
            </div>
          ))}
        </div>
      </div>

      {/* 퀵 네비 */}
      <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-primary,#1a1a1a)", marginBottom:8 }}>{t.dash.quickNav}</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {QUICK.map(({ icon,lbl,pg }) => (
          <div key={pg} onClick={() => setPage(pg)}
            style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:14, textAlign:"center", cursor:"pointer" }}>
            <i className={`ti ti-${icon}`} style={{ fontSize:20, color:"#185FA5", marginBottom:5, display:"block" }} aria-hidden="true" />
            <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-primary,#1a1a1a)" }}>{n[lbl]}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── 설정 ──
  const Settings = () => (
    <div>
      <div style={{ fontSize:14, fontWeight:500, marginBottom:16, color:"var(--color-text-primary,#1a1a1a)" }}>{t.settings.title}</div>

      {/* 언어 */}
      <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:500, marginBottom:4 }}>{t.settings.lang}</div>
        <div style={{ fontSize:11, color:"var(--color-text-tertiary,#999)", marginBottom:10 }}>{t.settings.langSub}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {Object.entries(LANG_LABELS).map(([k,v]) => (
            <div key={k} onClick={() => setLang(k)}
              style={{ padding:"10px 12px", borderRadius:8, border:`${lang===k?"1.5px solid #185FA5":"0.5px solid var(--color-border-secondary,#ccc)"}`, background:lang===k?"#EBF3FC":"var(--color-background-secondary,#f5f5f5)", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{LANG_FLAGS[k]}</div>
              <div style={{ fontSize:12, fontWeight:lang===k?500:400, color:lang===k?"#185FA5":"var(--color-text-primary,#1a1a1a)" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 사용자 목록 */}
      <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:500, marginBottom:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          {t.settings.users}
          <button onClick={() => setShowAdd(!showAdd)}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"none", background:"#185FA5", color:"#fff", cursor:"pointer" }}>
            + {t.settings.addUser}
          </button>
        </div>

        {showAdd && (
          <div style={{ background:"var(--color-background-secondary,#f5f5f5)", borderRadius:8, padding:"10px 12px", marginBottom:10, display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap:8, alignItems:"center" }}>
            {["name","email","dept"].map(f => (
              <input key={f} placeholder={t.settings[f]} value={newUser[f]}
                onChange={e => setNewUser({ ...newUser, [f]:e.target.value })}
                style={{ fontSize:11, padding:"5px 8px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary,#1a1a1a)" }} />
            ))}
            <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role:e.target.value })}
              style={{ fontSize:11, padding:"5px 8px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"var(--color-background-primary,#fff)", color:"var(--color-text-primary,#1a1a1a)" }}>
              {Object.keys(INIT_PERMS).map(r => <option key={r}>{r}</option>)}
            </select>
            <button onClick={() => {
              if(newUser.name && newUser.email){
                setUsers([...users, { id:Date.now(), ...newUser, status:"pending" }]);
                setNewUser({ name:"", email:"", dept:"", role:"Technician" });
                setShowAdd(false);
              }
            }} style={{ fontSize:11, padding:"5px 10px", borderRadius:6, border:"none", background:"#185FA5", color:"#fff", cursor:"pointer" }}>
              {t.settings.save}
            </button>
          </div>
        )}

        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ background:"var(--color-background-secondary,#f5f5f5)" }}>
                {[t.settings.name,t.settings.email,t.settings.dept,t.settings.role,t.settings.status,t.settings.actions].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"6px 8px", fontSize:10, fontWeight:500, color:"var(--color-text-tertiary,#999)", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)" }}>
                  <td style={{ padding:"6px 8px", fontWeight:500, color:"var(--color-text-primary,#1a1a1a)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:"#185FA5", color:"#fff", fontSize:10, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center" }}>{u.name[0]}</div>
                      {u.name}
                    </div>
                  </td>
                  <td style={{ padding:"6px 8px", fontSize:10, color:"var(--color-text-secondary,#555)" }}>{u.email}</td>
                  <td style={{ padding:"6px 8px", fontSize:10 }}>{u.dept}</td>
                  <td style={{ padding:"6px 8px" }}>
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:999, background:"#E6F1FB", color:"#185FA5", fontWeight:500 }}>{u.role}</span>
                  </td>
                  <td style={{ padding:"6px 8px" }}>
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:999, background:u.status==="active"?"#EAF3DE":"#FAEEDA", color:u.status==="active"?"#3B6D11":"#854F0B", fontWeight:500 }}>
                      {u.status==="active" ? t.settings.active : t.settings.pending}
                    </span>
                  </td>
                  <td style={{ padding:"6px 8px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => setEditPerm(editPerm===u.role ? null : u.role)}
                        style={{ fontSize:10, padding:"2px 7px", borderRadius:5, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"transparent", color:"#185FA5", cursor:"pointer" }}>
                        {t.settings.edit}
                      </button>
                      {u.status==="pending" && (
                        <button onClick={() => setUsers(users.map(x => x.id===u.id ? { ...x, status:"active" } : x))}
                          style={{ fontSize:10, padding:"2px 7px", borderRadius:5, border:"0.5px solid #3B6D11", background:"#EAF3DE", color:"#3B6D11", cursor:"pointer" }}>
                          {t.settings.approve}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 권한 설정 */}
      <div style={{ background:"var(--color-background-primary,#fff)", border:"0.5px solid var(--color-border-tertiary,#e0e0e0)", borderRadius:10, padding:"14px 16px" }}>
        <div style={{ fontSize:12, fontWeight:500, marginBottom:4 }}>{t.settings.permissions}</div>
        <div style={{ fontSize:11, color:"var(--color-text-tertiary,#999)", marginBottom:10 }}>{t.settings.permSub}</div>
        <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
          {Object.keys(INIT_PERMS).map(r => (
            <button key={r} onClick={() => setEditPerm(editPerm===r ? null : r)}
              style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:`${editPerm===r?"1.5px solid #185FA5":"0.5px solid var(--color-border-secondary,#ccc)"}`, background:editPerm===r?"#EBF3FC":"var(--color-background-secondary,#f5f5f5)", color:editPerm===r?"#185FA5":"var(--color-text-primary,#1a1a1a)", cursor:"pointer", fontWeight:editPerm===r?500:400 }}>
              {r}
            </button>
          ))}
        </div>
        {editPerm && (
          <div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ background:"var(--color-background-secondary,#f5f5f5)" }}>
                    <th style={{ textAlign:"left", padding:"6px 8px", fontSize:10, fontWeight:500, color:"var(--color-text-tertiary,#999)", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)" }}>{t.settings.role}: {editPerm}</th>
                    {[t.settings.write,t.settings.read,t.settings.none].map(h => (
                      <th key={h} style={{ textAlign:"center", padding:"6px 8px", fontSize:10, fontWeight:500, color:"var(--color-text-tertiary,#999)", borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MENU_CATS.map(({ key, icon }) => {
                    const cur = perms[editPerm]?.[key] || "none";
                    const [bg, cl] = permColor(cur);
                    return (
                      <tr key={key} style={{ borderBottom:"0.5px solid var(--color-border-tertiary,#e0e0e0)" }}>
                        <td style={{ padding:"6px 8px", display:"flex", alignItems:"center", gap:7 }}>
                          <i className={`ti ti-${icon}`} style={{ fontSize:13, color:"var(--color-text-tertiary,#999)" }} aria-hidden="true" />
                          <span>{n[key]}</span>
                          <span style={{ fontSize:9, padding:"1px 6px", borderRadius:999, background:bg, color:cl, marginLeft:4, fontWeight:500 }}>{cur}</span>
                        </td>
                        {["write","read","none"].map(v => (
                          <td key={v} style={{ textAlign:"center", padding:"6px 8px" }}>
                            <input type="radio" name={`${editPerm}-${key}`} checked={cur===v}
                              onChange={() => setPerms(prev => ({ ...prev, [editPerm]:{ ...prev[editPerm], [key]:v } }))} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
              <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                style={{ fontSize:11, padding:"5px 14px", borderRadius:6, border:"none", background:"#185FA5", color:"#fff", cursor:"pointer" }}>
                {t.settings.save}
              </button>
              <button onClick={() => setEditPerm(null)}
                style={{ fontSize:11, padding:"5px 14px", borderRadius:6, border:"0.5px solid var(--color-border-secondary,#ccc)", background:"transparent", color:"var(--color-text-secondary,#555)", cursor:"pointer" }}>
                {t.settings.cancel}
              </button>
              {saved && <span style={{ fontSize:11, color:"#3B6D11" }}>✓ {t.settings.saved}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── 플레이스홀더 ──
  const PH = () => {
    const q = QUICK.find(q => q.pg === page);
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--color-text-tertiary,#999)", gap:10 }}>
        {q && <i className={`ti ti-${q.icon}`} style={{ fontSize:40, color:"var(--color-text-tertiary,#999)" }} aria-hidden="true" />}
        <div style={{ fontSize:14, fontWeight:500, color:"var(--color-text-secondary,#555)" }}>{n[page]}</div>
        <div style={{ fontSize:12, textAlign:"center", maxWidth:280, lineHeight:1.6 }}>
          추후 개발 예정 · Coming soon
        </div>
        <button onClick={() => setPage("dashboard")}
          style={{ marginTop:8, fontSize:12, padding:"7px 18px", borderRadius:8, background:"#185FA5", color:"#fff", border:"none", cursor:"pointer" }}>
          ← Dashboard
        </button>
      </div>
    );
  };

  // ── 전체 레이아웃 ──
  return (
    <>
      <Head>
        <title>DSC FMS Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </Head>

      <div style={{ display:"flex", height:"100vh", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background:"#f5f5f5" }}>

        {/* 모바일 오버레이 */}
        {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:10 }} />}

        {/* SIDEBAR */}
        <nav style={{ width:200, background:"#fff", borderRight:"0.5px solid #e0e0e0", display:"flex", flexDirection:"column", flexShrink:0, zIndex:20,
          position: typeof window !== "undefined" && window.innerWidth < 768 ? "fixed" : "relative",
          left: menuOpen ? 0 : typeof window !== "undefined" && window.innerWidth < 768 ? -200 : 0,
          top:0, bottom:0, transition:"left .25s" }}>
          <div style={{ padding:"12px 14px", borderBottom:"0.5px solid #e0e0e0" }}>
            <div style={{ fontSize:13, fontWeight:500 }}>{t.appName}</div>
            <div style={{ fontSize:10, color:"#999", marginTop:1 }}>{t.appSub}</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"6px 0" }}>
            {[["개요","overview"],[n.dashboard,"dashboard","layout-dashboard"],].map(() => null)}
            <div style={{ fontSize:9, color:"#999", padding:"6px 14px 2px", textTransform:"uppercase", letterSpacing:".06em" }}>{n.overview}</div>
            <NI pg="dashboard" icon="layout-dashboard" label={n.dashboard} />
            <div style={{ fontSize:9, color:"#999", padding:"8px 14px 2px", textTransform:"uppercase", letterSpacing:".06em" }}>{n.asset}</div>
            <NI pg="master" icon="layout-list"    label={n.master}  badge={{ v:"168", bg:"#E6F1FB", cl:"#185FA5" }} />
            <NI pg="avail"  icon="chart-bar"      label={n.avail} />
            <div style={{ fontSize:9, color:"#999", padding:"8px 14px 2px", textTransform:"uppercase", letterSpacing:".06em" }}>{n.maint}</div>
            <NI pg="bm" icon="alert-triangle" label={n.bm} badge={{ v:"4", bg:"#FCEBEB", cl:"#A32D2D" }} />
            <NI pg="pm" icon="tool"           label={n.pm} badge={{ v:"7", bg:"#FAEEDA", cl:"#854F0B" }} />
            <NI pg="wo" icon="clipboard-list" label={n.wo} badge={{ v:"3", bg:"#FCEBEB", cl:"#A32D2D" }} />
            <div style={{ fontSize:9, color:"#999", padding:"8px 14px 2px", textTransform:"uppercase", letterSpacing:".06em" }}>{n.inv}</div>
            <NI pg="parts" icon="package"    label={n.parts} />
            <div style={{ fontSize:9, color:"#999", padding:"8px 14px 2px", textTransform:"uppercase", letterSpacing:".06em" }}>{n.analytics}</div>
            <NI pg="kpi"  icon="chart-line"  label={n.kpi} />
            <div style={{ fontSize:9, color:"#999", padding:"8px 14px 2px", textTransform:"uppercase", letterSpacing:".06em" }}>{n.system}</div>
            <NI pg="team"     icon="users"    label={n.team} />
            <NI pg="settings" icon="settings" label={n.settings} />
          </div>
          <div style={{ padding:"10px 14px", borderTop:"0.5px solid #e0e0e0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:"#185FA5", color:"#fff", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center" }}>나</div>
              <div>
                <div style={{ fontSize:11, fontWeight:500 }}>나경태</div>
                <div style={{ fontSize:9, color:"#999" }}>{t.role}</div>
              </div>
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* TOPBAR */}
          <div style={{ background:"#fff", borderBottom:"0.5px solid #e0e0e0", padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={() => setMenuOpen(!menuOpen)}
                style={{ display:"none", fontSize:18, border:"none", background:"transparent", cursor:"pointer", padding:2 }}
                aria-label="메뉴">☰</button>
              <div style={{ fontSize:11, color:"#999" }}>
                {t.appName} › <span style={{ color:"#1a1a1a", fontWeight:500 }}>{n[page] || page}</span>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
              {[
                { v:`${t.bmUrgent} 4`, bg:"#FCEBEB", cl:"#A32D2D" },
                { v:`${t.pmToday} 7`,  bg:"#FAEEDA", cl:"#854F0B" },
                { v:`${t.idleR} 12`,   bg:"#E6F1FB", cl:"#185FA5" },
                { v:`${t.idleNR} 5`,   bg:"#FCEBEB", cl:"#A32D2D" },
              ].map((p,i) => <span key={i} style={{ fontSize:10, padding:"3px 8px", borderRadius:999, fontWeight:500, background:p.bg, color:p.cl }}>{p.v}</span>)}
              <select value={lang} onChange={e => setLang(e.target.value)}
                style={{ fontSize:10, padding:"3px 6px", borderRadius:6, border:"0.5px solid #ccc", background:"#fff", cursor:"pointer" }}>
                {Object.entries(LANG_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span style={{ fontSize:10, color:"#999" }}>2026.05.06</span>
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
            {page === "dashboard" && <Dashboard />}
            {page === "settings"  && <Settings />}
            {!["dashboard","settings"].includes(page) && <PH />}
          </div>
        </div>
      </div>
    </>
  );
}
