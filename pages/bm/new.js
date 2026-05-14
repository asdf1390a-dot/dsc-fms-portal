import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/use-auth';
import BottomNav from '../../components/BottomNav';

// ────────────────────────────────────────────────────────────────────────
// i18n
// ────────────────────────────────────────────────────────────────────────
const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'ko', label: '한' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
];

const T = {
  en: {
    title: 'Breakdown Report',
    selectDept: 'Select Department',
    selectType: 'Select Equipment Type',
    selectCar: 'Select Car Model',
    selectProcess: 'Select Process Line',
    selectAsset: 'Select Asset',
    severity: 'Severity',
    low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
    sevHintLow: 'Minor issue', sevHintMed: 'Standard',
    sevHintHigh: 'Partial stop', sevHintCrit: 'Line down',
    symptom: 'Symptom (describe the problem)',
    symptomTa: 'Symptom in Tamil (optional)',
    breakdownTime: 'Breakdown Start Time',
    causeCode: 'Fault Category',
    causeUnknown: 'Unknown',
    reporterName: 'Reported By',
    attachPhoto: 'Attach Photo',
    addAnother: '+ Add another',
    submit: 'Submit Report',
    submitting: 'Submitting…',
    cancel: 'Cancel',
    success: 'Breakdown Reported Successfully',
    required: 'This field is required',
    loading: 'Loading…',
    deptMachine: 'Machine', deptMould: 'Mould', deptJig: 'JIG',
    unassigned: '(Unassigned)',
    placeholderType: '— Select equipment type —',
    placeholderCar: '— Select car model —',
    placeholderProcess: '— Select process line —',
    placeholderAsset: '— Select asset —',
    stepDept: 'Dept', stepType: 'Type', stepAsset: 'Asset', stepDetails: 'Details',
    searchAsset: 'Search asset…',
    noAssets: 'No assets found',
    progressUploading: 'Uploading photo',
    progressCreating: 'Creating report…',
    progressSaving: 'Saving photo links…',
    progressDone: 'Done.',
    symptomPlaceholder: 'Sound / smell / error code?',
    removePhoto: 'Remove',
    backToBM: 'Back to BM',
  },
  ko: {
    title: '고장 신고',
    selectDept: '부서 선택',
    selectType: '설비 유형 선택',
    selectCar: '차종 선택',
    selectProcess: '공정 선택',
    selectAsset: '자산 선택',
    severity: '심각도',
    low: '낮음', medium: '중간', high: '높음', critical: '위급',
    sevHintLow: '경미한 문제', sevHintMed: '일반',
    sevHintHigh: '부분 정지', sevHintCrit: '라인 정지',
    symptom: '고장 증상 (영어)',
    symptomTa: '고장 증상 (타밀어, 선택)',
    breakdownTime: '고장 발생 시각',
    causeCode: '고장 원인 분류',
    causeUnknown: '미상',
    reporterName: '보고자 이름',
    attachPhoto: '사진 첨부',
    addAnother: '+ 추가',
    submit: '제출',
    submitting: '제출 중…',
    cancel: '취소',
    success: '고장 접수 완료',
    required: '필수 항목입니다',
    loading: '불러오는 중…',
    deptMachine: '일반 설비', deptMould: '금형', deptJig: '지그',
    unassigned: '(미지정)',
    placeholderType: '— 설비 유형 선택 —',
    placeholderCar: '— 차종 선택 —',
    placeholderProcess: '— 공정 선택 —',
    placeholderAsset: '— 자산 선택 —',
    stepDept: '부서', stepType: '유형', stepAsset: '자산', stepDetails: '상세입력',
    searchAsset: '자산 검색…',
    noAssets: '자산이 없습니다',
    progressUploading: '사진 업로드 중',
    progressCreating: '보고서 생성 중…',
    progressSaving: '사진 링크 저장 중…',
    progressDone: '완료',
    symptomPlaceholder: '음향 / 냄새 / 에러코드?',
    removePhoto: '제거',
    backToBM: 'BM 목록으로',
  },
  ta: {
    title: 'கோளாறு அறிக்கை',
    selectDept: 'பிரிவு தேர்வு',
    selectType: 'இயந்திர வகை தேர்வு',
    selectCar: 'கார் மாடல் தேர்வு',
    selectProcess: 'செயல்முறை கோடு தேர்வு',
    selectAsset: 'சொத்து தேர்வு',
    severity: 'தீவிரம்',
    low: 'குறைவு', medium: 'நடுத்தரம்', high: 'அதிகம்', critical: 'அவசரம்',
    sevHintLow: 'சிறிய பிரச்சனை', sevHintMed: 'சாதாரண',
    sevHintHigh: 'பகுதி நிறுத்தம்', sevHintCrit: 'வரிசை நின்றது',
    symptom: 'கோளாறு அறிகுறி',
    symptomTa: 'தமிழில் அறிகுறி (விரும்பினால்)',
    breakdownTime: 'கோளாறு நேரம்',
    causeCode: 'கோளாறு வகை',
    causeUnknown: 'தெரியவில்லை',
    reporterName: 'புகாரளித்தவர்',
    attachPhoto: 'புகைப்படம்',
    addAnother: '+ மேலும் சேர்',
    submit: 'சமர்ப்பிக்கவும்',
    submitting: 'சமர்ப்பிக்கிறது…',
    cancel: 'ரத்து',
    success: 'கோளாறு பதிவு செய்யப்பட்டது',
    required: 'இது கட்டாயமான புலம்',
    loading: 'ஏற்றுகிறது…',
    deptMachine: 'இயந்திரம்', deptMould: 'அச்சு', deptJig: 'ஜிக்',
    unassigned: '(ஒதுக்கப்படவில்லை)',
    placeholderType: '— இயந்திர வகை தேர்வு —',
    placeholderCar: '— கார் மாடல் தேர்வு —',
    placeholderProcess: '— செயல்முறை தேர்வு —',
    placeholderAsset: '— சொத்து தேர்வு —',
    stepDept: 'பிரிவு', stepType: 'வகை', stepAsset: 'சொத்து', stepDetails: 'விவரம்',
    searchAsset: 'சொத்து தேடல்…',
    noAssets: 'சொத்து இல்லை',
    progressUploading: 'புகைப்படம் பதிவேற்றம்',
    progressCreating: 'அறிக்கை உருவாக்குகிறது…',
    progressSaving: 'புகைப்படம் இணைப்பு சேமிக்கிறது…',
    progressDone: 'முடிந்தது',
    symptomPlaceholder: 'ஒலி / வாசனை / பிழை குறியீடு?',
    removePhoto: 'நீக்கு',
    backToBM: 'BM பட்டியலுக்கு',
  },
  hi: {
    title: 'खराबी रिपोर्ट',
    selectDept: 'विभाग चुनें',
    selectType: 'उपकरण प्रकार चुनें',
    selectCar: 'कार मॉडल चुनें',
    selectProcess: 'प्रक्रिया लाइन चुनें',
    selectAsset: 'संपत्ति चुनें',
    severity: 'गंभीरता',
    low: 'कम', medium: 'मध्यम', high: 'अधिक', critical: 'आपातकाल',
    sevHintLow: 'छोटी समस्या', sevHintMed: 'सामान्य',
    sevHintHigh: 'आंशिक रुकावट', sevHintCrit: 'लाइन बंद',
    symptom: 'खराबी का विवरण',
    symptomTa: 'तमिल में विवरण (वैकल्पिक)',
    breakdownTime: 'खराबी का समय',
    causeCode: 'खराबी का कारण',
    causeUnknown: 'अज्ञात',
    reporterName: 'रिपोर्टकर्ता का नाम',
    attachPhoto: 'फ़ोटो संलग्न करें',
    addAnother: '+ और जोड़ें',
    submit: 'रिपोर्ट जमा करें',
    submitting: 'जमा हो रहा है…',
    cancel: 'रद्द करें',
    success: 'खराबी सफलतापूर्वक दर्ज की गई',
    required: 'यह फ़ील्ड आवश्यक है',
    loading: 'लोड हो रहा है…',
    deptMachine: 'मशीन', deptMould: 'मोल्ड', deptJig: 'जिग',
    unassigned: '(अनिर्धारित)',
    placeholderType: '— उपकरण प्रकार चुनें —',
    placeholderCar: '— कार मॉडल चुनें —',
    placeholderProcess: '— प्रक्रिया लाइन चुनें —',
    placeholderAsset: '— संपत्ति चुनें —',
    stepDept: 'विभाग', stepType: 'प्रकार', stepAsset: 'संपत्ति', stepDetails: 'विवरण',
    searchAsset: 'संपत्ति खोजें…',
    noAssets: 'कोई संपत्ति नहीं',
    progressUploading: 'फ़ोटो अपलोड',
    progressCreating: 'रिपोर्ट बना रहे हैं…',
    progressSaving: 'फ़ोटो लिंक सहेज रहे हैं…',
    progressDone: 'पूर्ण',
    symptomPlaceholder: 'ध्वनि / गंध / त्रुटि कोड?',
    removePhoto: 'हटाएं',
    backToBM: 'BM सूची पर',
  },
};

// ────────────────────────────────────────────────────────────────────────
// Severity → maps to bm_events.priority (low|medium|high|critical)
// and bm_events.severity (minor|normal|major|line_down)
// ────────────────────────────────────────────────────────────────────────
const SEVERITIES = [
  { v: 'low',      sev: 'minor',     tKey: 'low',      hintKey: 'sevHintLow'  },
  { v: 'medium',   sev: 'normal',    tKey: 'medium',   hintKey: 'sevHintMed'  },
  { v: 'high',     sev: 'major',     tKey: 'high',     hintKey: 'sevHintHigh' },
  { v: 'critical', sev: 'line_down', tKey: 'critical', hintKey: 'sevHintCrit' },
];

const SEV_COLORS = {
  low:      { border: '#475569', bg: '#1e293b', active: '#64748b' },
  medium:   { border: '#1e40af', bg: '#1e3a8a', active: '#2563eb' },
  high:     { border: '#a16207', bg: '#713f12', active: '#d97706' },
  critical: { border: '#b91c1c', bg: '#7f1d1d', active: '#dc2626' },
};

const PHOTO_BUCKET = 'bm-photos';

// Excluded category codes for the "Machine" department: JIG, MOULD, IDLE, FA-sale, FA-disposal
const MACHINE_EXCLUDED_CATS = new Set(['09', '10', '11', '11A', '12', '13']);

export default function NewBMPage() {
  const router = useRouter();
  const { user, isAuthed, fullName, loading: authLoading } = useAuth();
  const fileInputRef = useRef();

  // Locale
  const [locale, setLocale] = useState('en');
  const t = T[locale];

  // Master data
  const [categories, setCategories] = useState([]);   // categories table
  const [assetClasses, setAssetClasses] = useState([]); // asset_classes table
  const [assets, setAssets] = useState([]);
  const [causes, setCauses] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Hierarchy selections
  const [dept, setDept] = useState('');               // 'machine' | 'mould' | 'jig'
  const [machineCat, setMachineCat] = useState('');   // category_code (e.g. '01','03','04')
  const [carModel, setCarModel] = useState('');       // for mould/jig: model field
  const [assetId, setAssetId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');

  // Other form state
  const [severity, setSeverity] = useState('medium');
  const [symptom, setSymptom] = useState('');
  const [symptomTa, setSymptomTa] = useState('');
  const [downtimeStart, setDowntimeStart] = useState(() => toLocalInput(new Date()));
  const [causeCode, setCauseCode] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');

  // ── Auth gate ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      router.replace(`/login?next=${encodeURIComponent('/bm/new')}`);
    }
  }, [authLoading, isAuthed, router]);

  // ── Reporter prefill ──────────────────────────────────────────────
  useEffect(() => {
    if (fullName && !reporterName) setReporterName(fullName);
  }, [fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detect browser language ───────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('ko')) setLocale('ko');
    else if (nav.startsWith('ta')) setLocale('ta');
    else if (nav.startsWith('hi')) setLocale('hi');
    else setLocale('en');
  }, []);

  // ── Load master data ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMaster(true);

      // Fetch all assets with pagination
      const pageSize = 500;
      let allAssets = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && !cancelled) {
        const { data, error } = await supabase
          .from('assets')
          .select('id, machine_asset_number, name_en, name_ta, location, status, asset_class_code, model, extra')
          .order('machine_asset_number', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) {
          setError(`Asset load: ${error.message}`);
          setLoadingMaster(false);
          return;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allAssets = allAssets.concat(data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }
      }

      if (cancelled) return;

      const [
        { data: cats, error: catErr },
        { data: cls, error: clsErr },
        { data: c, error: cErr },
      ] = await Promise.all([
        supabase.from('categories').select('code, name_en').order('code'),
        supabase.from('asset_classes').select('code, name_en, category_code').order('code'),
        supabase
          .from('cause_codes')
          .select('code, name_en, name_ta, group_name')
          .order('group_name', { ascending: true })
          .order('name_en', { ascending: true }),
      ]);

      if (cancelled) return;
      if (catErr) setError(`Category load: ${catErr.message}`);
      if (clsErr) setError(prev => prev || `Class load: ${clsErr.message}`);
      if (cErr)   setError(prev => prev || `Cause load: ${cErr.message}`);
      setCategories(cats || []);
      setAssetClasses(cls || []);
      setAssets(allAssets);
      setCauses(c || []);
      setLoadingMaster(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────
  // Derive category_code from asset row (first 2 chars of asset_class_code,
  // but "11A" needs handling — categories table has 11 vs 11A. Most assets
  // use codes like 01.xxx so simple split works.)
  const assetCategoryCode = (row) => {
    const c = row.asset_class_code || '';
    return c.split('.')[0] || '';
  };

  // Department -> default asset universe
  const deptAssets = useMemo(() => {
    if (!dept) return [];
    if (dept === 'mould') {
      return assets.filter(a => (a.asset_class_code || '').startsWith('10.'));
    }
    if (dept === 'jig') {
      return assets.filter(a => (a.asset_class_code || '').startsWith('09.'));
    }
    // machine: everything NOT in excluded categories
    return assets.filter(a => !MACHINE_EXCLUDED_CATS.has(assetCategoryCode(a)));
  }, [dept, assets]);

  // For "Machine": Step 2 = list of category codes that actually have assets
  const machineCategoryOptions = useMemo(() => {
    if (dept !== 'machine') return [];
    const used = new Set();
    for (const a of deptAssets) used.add(assetCategoryCode(a));
    return categories
      .filter(c => used.has(c.code))
      .map(c => ({ code: c.code, name_en: c.name_en }));
  }, [dept, deptAssets, categories]);

  // For Mould/JIG: Step 2 = unique car model values (both use model field after DB restructure)
  const carModelOptions = useMemo(() => {
    if (dept !== 'mould' && dept !== 'jig') return [];
    const set = new Set();
    for (const a of deptAssets) {
      set.add((a.model || '').trim() || '__UNASSIGNED__');
    }
    const arr = Array.from(set);
    arr.sort((x, y) => {
      if (x === '__UNASSIGNED__') return 1;
      if (y === '__UNASSIGNED__') return -1;
      return x.localeCompare(y);
    });
    return arr;
  }, [dept, deptAssets]);

  // Step 3 — filtered asset list
  const finalAssets = useMemo(() => {
    if (!dept) return [];
    if (dept === 'machine') {
      if (!machineCat) return [];
      return deptAssets.filter(a => assetCategoryCode(a) === machineCat);
    }
    // mould / jig: filter by carModel only
    if (!carModel) return [];
    return deptAssets.filter(a => {
      const cm = (a.model || '').trim() || '__UNASSIGNED__';
      return cm === carModel;
    });
  }, [dept, deptAssets, machineCat, carModel]);

  // Search-filtered asset list for the card UI
  const visibleAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return finalAssets;
    return finalAssets.filter(a => {
      const num = (a.machine_asset_number || '').toLowerCase();
      const nm  = (a.name_en || '').toLowerCase();
      const ta  = (a.name_ta || '').toLowerCase();
      const loc = (a.location || '').toLowerCase();
      return num.includes(q) || nm.includes(q) || ta.includes(q) || loc.includes(q);
    });
  }, [finalAssets, assetSearch]);

  // Reset downstream selections when an upstream changes
  useEffect(() => { setMachineCat(''); setCarModel(''); setAssetId(''); setAssetSearch(''); }, [dept]);
  useEffect(() => { setAssetId(''); setAssetSearch(''); }, [carModel, machineCat]);

  // Causes grouped
  const causesByGroup = useMemo(() => {
    const m = new Map();
    for (const c of causes) {
      const g = c.group_name || 'Other';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(c);
    }
    return Array.from(m.entries());
  }, [causes]);

  // ── Pre-select from ?asset=DCMI-XXX ────────────────────────────────
  useEffect(() => {
    if (!router.query.asset || !assets.length) return;
    const tag = String(router.query.asset);
    const found = assets.find(x => x.machine_asset_number === tag);
    if (!found) return;
    const cat = assetCategoryCode(found);
    if (cat === '09') {
      setDept('jig');
      const cm = (found.model || '').trim() || '__UNASSIGNED__';
      setCarModel(cm);
    } else if (cat === '10') {
      setDept('mould');
      const cm = (found.model || '').trim() || '__UNASSIGNED__';
      setCarModel(cm);
    } else {
      setDept('machine');
      setMachineCat(cat);
    }
    // assetId is set after lists materialise via the chain above;
    // setting it directly here works because deptAssets/finalAssets
    // recompute on the same tick.
    setAssetId(found.id);
  }, [router.query.asset, assets]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Photo handling ────────────────────────────────────────────────
  function onPickFiles(e) {
    const files = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    setPhotoFiles(prev => [...prev, ...files]);
    files.forEach(f => {
      const fr = new FileReader();
      fr.onload = () => setPhotoPreviews(prev => [...prev, fr.result]);
      fr.readAsDataURL(f);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  function removePhoto(idx) {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  }
  async function uploadPhotos(eventId) {
    if (!photoFiles.length) return [];
    const urls = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const f = photoFiles[i];
      setProgressMsg(`${t.progressUploading} ${i + 1}/${photoFiles.length}…`);
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const safe = f.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
      const key = `${eventId}/${Date.now()}-${i}-${safe.endsWith(ext) ? safe : `${safe}.${ext}`}`;
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(key, f, { contentType: f.type, upsert: false });
      if (upErr) {
        console.warn(`[bm-photos] upload failed: ${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(key);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    }
    return urls;
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!assetId)             { setError(t.required + ': ' + t.selectAsset); return; }
    if (!symptom.trim())      { setError(t.required + ': ' + t.symptom);     return; }
    if (!reporterName.trim()) { setError(t.required + ': ' + t.reporterName); return; }

    const sevDef = SEVERITIES.find(s => s.v === severity) || SEVERITIES[1];

    setBusy(true);
    setProgressMsg(t.progressCreating);
    try {
      const payload = {
        asset_id: assetId,
        reported_at: new Date().toISOString(),
        reporter_name: reporterName.trim(),
        reported_by: user?.id || null,
        severity: sevDef.sev,
        priority: sevDef.v,
        symptom: symptom.trim(),
        symptom_ta: symptomTa.trim() || null,
        downtime_start: downtimeStart ? new Date(downtimeStart).toISOString() : null,
        cause_code: causeCode || null,
        status: 'open',
        photos: [],
      };
      const { data: ev, error: insErr } = await supabase
        .from('bm_events')
        .insert(payload)
        .select('id')
        .single();
      if (insErr) throw insErr;

      const urls = await uploadPhotos(ev.id);
      if (urls.length) {
        setProgressMsg(t.progressSaving);
        const { error: updErr } = await supabase
          .from('bm_events')
          .update({ photos: urls })
          .eq('id', ev.id);
        if (updErr) console.warn(`[bm-photos] link save failed: ${updErr.message}`);
      }

      setProgressMsg(t.progressDone);

      // Fire-and-forget Discord notification
      const selectedAsset = assets.find(a => a.id === assetId);
      const assetLabel = selectedAsset
        ? `${selectedAsset.machine_asset_number} — ${selectedAsset.name_en || ''}`.trim()
        : '-';
      fetch('/api/discord-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bm_created',
          title: symptom.trim().slice(0, 80) || '고장 신고',
          fields: [
            { name: '자산', value: assetLabel },
            { name: '우선순위', value: severity || '-' },
            { name: '원인', value: causeCode || '-' },
          ],
        }),
      }).catch(() => {});

      try {
        await router.push('/bm');
      } catch {
        alert(t.success);
      }
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
      setProgressMsg('');
    }
  }

  const submitDisabled =
    busy || loadingMaster || !assetId || !symptom.trim() || !reporterName.trim();

  // ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>{t.title} | DSC FMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <main style={S.page}>
        <header style={S.header}>
          <Link href="/bm" style={S.backLink} aria-label={t.backToBM}>← BM</Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={S.title}>{t.title}</h1>
          </div>
          <div style={S.langWrap}>
            {LOCALES.map(L => (
              <button
                key={L.code}
                type="button"
                onClick={() => setLocale(L.code)}
                style={{
                  ...S.langBtn,
                  ...(locale === L.code ? S.langBtnActive : null),
                }}
                aria-pressed={locale === L.code}
              >
                {L.label}
              </button>
            ))}
          </div>
        </header>

        {authLoading || !isAuthed ? (
          <div style={S.loading}>…</div>
        ) : (
          <form onSubmit={submit} style={S.form}>
            {/* ── Step indicator ─────────────────────────────────── */}
            <StepIndicator
              steps={[t.stepDept, t.stepType, t.stepAsset, t.stepDetails]}
              current={
                !dept ? 0
                : (dept === 'machine' ? !machineCat : !carModel) ? 1
                : !assetId ? 2
                : 3
              }
            />

            {/* ── Step 1 — Department ────────────────────────────── */}
            <Section title={t.selectDept}>
              <div style={S.deptGrid}>
                {[
                  { v: 'machine', label: t.deptMachine, color: '#2563eb' },
                  { v: 'mould',   label: t.deptMould,   color: '#7c3aed' },
                  { v: 'jig',     label: t.deptJig,     color: '#0d9488' },
                ].map(d => {
                  const active = dept === d.v;
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => setDept(d.v)}
                      style={{
                        ...S.deptBtn,
                        borderColor: active ? d.color : '#334155',
                        background: active ? d.color : '#0b1220',
                        color: active ? '#fff' : '#cbd5e1',
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* ── Step 2 — Type / Car Model ──────────────────────── */}
            {dept === 'machine' && (
              <Section title={t.selectType}>
                <select
                  value={machineCat}
                  onChange={(e) => setMachineCat(e.target.value)}
                  style={S.input}
                  disabled={loadingMaster}
                  required
                >
                  <option value="">{loadingMaster ? t.loading : t.placeholderType}</option>
                  {machineCategoryOptions.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name_en}
                    </option>
                  ))}
                </select>
              </Section>
            )}

            {(dept === 'mould' || dept === 'jig') && (
              <Section title={t.selectCar}>
                <select
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  style={S.input}
                  disabled={loadingMaster}
                  required
                >
                  <option value="">{loadingMaster ? t.loading : t.placeholderCar}</option>
                  {carModelOptions.map(cm => (
                    <option key={cm} value={cm}>
                      {cm === '__UNASSIGNED__' ? t.unassigned : cm}
                    </option>
                  ))}
                </select>
              </Section>
            )}

            {/* ── Step 3 — Asset (card list) ─────────────────────── */}
            {dept && (
              dept === 'machine'
                ? machineCat
                : carModel
            ) ? (
              <Section title={t.selectAsset + ' *'}>
                {finalAssets.length > 10 && (
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder={t.searchAsset}
                    style={{ ...S.input, marginBottom: 10 }}
                  />
                )}
                {visibleAssets.length === 0 ? (
                  <div style={S.emptyAssets}>{t.noAssets}</div>
                ) : (
                  <div style={S.assetList}>
                    {visibleAssets.map(a => {
                      const active = assetId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAssetId(a.id)}
                          style={{
                            ...S.assetCard,
                            borderColor: active ? '#2563eb' : '#334155',
                            background: active ? '#1e3a8a' : '#0b1220',
                          }}
                          aria-pressed={active}
                        >
                          <div style={S.assetNum}>{a.machine_asset_number}</div>
                          <div style={S.assetName}>{a.name_en || '—'}</div>
                          {a.location ? (
                            <div style={S.assetLoc}>{a.location}</div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Section>
            ) : null}

            {/* ── Severity ───────────────────────────────────────── */}
            <Section title={t.severity + ' *'}>
              <div style={S.sevGrid}>
                {SEVERITIES.map(s => {
                  const active = severity === s.v;
                  const c = SEV_COLORS[s.v];
                  return (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setSeverity(s.v)}
                      style={{
                        ...S.sevBtn,
                        borderColor: active ? c.active : c.border,
                        background: active ? c.active : c.bg,
                        color: '#fff',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{t[s.tKey]}</div>
                      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                        {t[s.hintKey]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* ── Symptom (EN) ───────────────────────────────────── */}
            <Section title={t.symptom + ' *'}>
              <textarea
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                placeholder={t.symptomPlaceholder}
                style={{ ...S.input, height: 110, fontFamily: 'inherit', resize: 'vertical' }}
                required
              />
            </Section>

            {/* ── Symptom (TA) ───────────────────────────────────── */}
            <Section title={t.symptomTa}>
              <textarea
                value={symptomTa}
                onChange={(e) => setSymptomTa(e.target.value)}
                placeholder="தமிழில் சிக்கல் விவரம்"
                style={{ ...S.input, height: 90, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Section>

            {/* ── Downtime start ─────────────────────────────────── */}
            <Section title={t.breakdownTime}>
              <input
                type="datetime-local"
                value={downtimeStart}
                onChange={(e) => setDowntimeStart(e.target.value)}
                style={S.input}
              />
            </Section>

            {/* ── Cause code ─────────────────────────────────────── */}
            <Section title={t.causeCode}>
              <select
                value={causeCode}
                onChange={(e) => setCauseCode(e.target.value)}
                style={S.input}
                disabled={loadingMaster}
              >
                <option value="">— {t.causeUnknown} —</option>
                {causesByGroup.map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name_en}{c.name_ta ? ` / ${c.name_ta}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Section>

            {/* ── Reporter ───────────────────────────────────────── */}
            <Section title={t.reporterName + ' *'}>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder={t.reporterName}
                style={S.input}
                required
              />
            </Section>

            {/* ── Photos ─────────────────────────────────────────── */}
            <Section title={t.attachPhoto}>
              {photoPreviews.length > 0 && (
                <div style={S.photoGrid}>
                  {photoPreviews.map((src, i) => (
                    <div key={i} style={S.photoTile}>
                      <img src={src} alt={`photo ${i + 1}`} style={S.photoImg} />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        style={S.photoDel}
                        aria-label={t.removePhoto}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                multiple
                onChange={onPickFiles}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={S.photoAdd}
              >
                {photoPreviews.length === 0 ? t.attachPhoto : t.addAnother}
              </button>
            </Section>

            {error && <div style={S.error}>{error}</div>}
            {busy && progressMsg && <div style={S.progress}>{progressMsg}</div>}

            <div style={S.actions}>
              <button
                type="button"
                onClick={() => router.push('/bm')}
                style={{ ...S.btn, ...S.btnSecondary }}
                disabled={busy}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                style={{
                  ...S.btn,
                  ...S.btnDanger,
                  ...(submitDisabled ? S.btnDisabled : null),
                }}
              >
                {busy ? t.submitting : t.submit}
              </button>
            </div>
          </form>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function StepIndicator({ steps, current }) {
  return (
    <div style={S.stepWrap}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={S.stepItem}>
            <div
              style={{
                ...S.stepDot,
                background: done ? '#16a34a' : active ? '#2563eb' : '#1f2937',
                color: done || active ? '#fff' : '#64748b',
                borderColor: done ? '#16a34a' : active ? '#2563eb' : '#334155',
              }}
            >
              {done ? '✓' : i + 1}
            </div>
            <div
              style={{
                ...S.stepLabel,
                color: active ? '#e2e8f0' : done ? '#94a3b8' : '#64748b',
                fontWeight: active ? 700 : 500,
              }}
            >
              {label}
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  ...S.stepBar,
                  background: done ? '#16a34a' : '#1f2937',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </section>
  );
}

// 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────
const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans Devanagari", "Noto Sans KR", sans-serif',
    background: '#0b1220', minHeight: '100vh', color: '#e2e8f0',
    paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 24px)',
    maxWidth: 480, margin: '0 auto',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    background: '#7f1d1d', color: '#fff', padding: '10px 12px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
    flexWrap: 'wrap',
  },
  backLink: {
    color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 14,
    padding: '8px 4px',
  },
  title: { fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.1 },
  langWrap: {
    display: 'flex', gap: 4,
    background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 8,
  },
  langBtn: {
    padding: '8px 10px', minHeight: 36, minWidth: 36,
    border: 'none', borderRadius: 6, cursor: 'pointer',
    background: 'transparent', color: 'rgba(255,255,255,0.75)',
    fontSize: 13, fontWeight: 600,
  },
  langBtnActive: {
    background: '#fff', color: '#7f1d1d',
  },
  loading: { padding: 32, textAlign: 'center', color: '#94a3b8' },
  form: { padding: 12 },
  section: {
    background: '#111827', borderRadius: 12, marginBottom: 10,
    border: '1px solid #1f2937', overflow: 'hidden',
  },
  sectionTitle: {
    padding: '10px 14px', fontSize: 12, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5,
    background: '#0f172a', borderBottom: '1px solid #1f2937',
  },
  sectionBody: { padding: 12 },
  input: {
    width: '100%', padding: '12px 12px',
    border: '1px solid #334155', borderRadius: 8,
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
    background: '#0b1220', color: '#f1f5f9',
    minHeight: 44,
  },
  deptGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
  },
  deptBtn: {
    padding: '14px 6px', borderRadius: 10, border: '2px solid',
    cursor: 'pointer', fontSize: 14, fontWeight: 700,
    minHeight: 56,
  },
  sevGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  sevBtn: {
    padding: '12px 10px', borderRadius: 10, border: '2px solid',
    textAlign: 'left', cursor: 'pointer',
    minHeight: 64,
  },
  photoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10,
  },
  photoTile: { position: 'relative' },
  photoImg: {
    width: '100%', aspectRatio: '1', objectFit: 'cover',
    borderRadius: 8, display: 'block', background: '#0f172a',
  },
  photoDel: {
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.7)', color: '#fff',
    width: 26, height: 26, borderRadius: '50%', border: 'none',
    fontSize: 18, lineHeight: '22px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: '100%', padding: '14px', borderRadius: 10,
    border: '2px dashed #334155', background: '#0b1220', color: '#cbd5e1',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 48,
  },
  error: {
    background: '#7f1d1d', color: '#fee2e2',
    padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 10,
    border: '1px solid #b91c1c',
  },
  progress: {
    background: '#1e3a8a', color: '#dbeafe',
    padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10,
    border: '1px solid #2563eb',
  },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  btn: {
    flex: 1, padding: '14px 18px', borderRadius: 10, border: 'none',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 48,
  },
  btnDanger: { background: '#dc2626', color: '#fff' },
  btnSecondary: { background: '#334155', color: '#e2e8f0' },
  btnDisabled: { background: '#1f2937', color: '#475569', cursor: 'not-allowed' },

  // Step indicator
  stepWrap: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '12px 4px 14px', marginBottom: 6, gap: 4,
  },
  stepItem: {
    position: 'relative', flex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: 0,
  },
  stepDot: {
    width: 30, height: 30, borderRadius: '50%',
    border: '2px solid', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, zIndex: 1,
  },
  stepLabel: {
    marginTop: 6, fontSize: 11, textAlign: 'center',
    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stepBar: {
    position: 'absolute', top: 14, left: '60%', right: '-40%',
    height: 2, zIndex: 0,
  },

  // Asset card list
  assetList: {
    display: 'grid', gridTemplateColumns: '1fr', gap: 8,
    maxHeight: 360, overflowY: 'auto',
  },
  assetCard: {
    textAlign: 'left', padding: '10px 12px',
    border: '2px solid', borderRadius: 10,
    cursor: 'pointer', minHeight: 56,
    color: '#e2e8f0',
  },
  assetNum: { fontWeight: 700, fontSize: 14, color: '#f1f5f9' },
  assetName: { fontSize: 13, color: '#cbd5e1', marginTop: 2 },
  assetLoc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  emptyAssets: {
    padding: 20, textAlign: 'center', color: '#94a3b8',
    fontSize: 13,
  },
};
