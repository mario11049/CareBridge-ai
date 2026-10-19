// Offline CareBridge Assistant — deterministic, template-built answers for
// demo mode when no Gemini key is available. Every answer is assembled from the
// validated plan facts (never from a language model) and labelled as a
// non-AI, offline response in the UI.

import type { AssistantContext, AssistantReply } from "./assistant";
import { PLAN_TE, durationTe, doseTe, FREQ_TE, ROUTE_TE, teLookup, INSTRUCTION_TE, WARNING_ACTION_TE, WARNING_SIGN_TE, SPECIAL_TE, DIAGNOSIS_TE } from "./telugu";
import { normalize } from "./util";

type Intent = "meds" | "frequency" | "duration" | "follow_up" | "warnings" | "diet_activity" | "telugu" | "term" | "greeting" | "how_it_works" | "unknown";

export function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/(telugu|తెలుగు)/i.test(s)) return "telugu";
  if (/(what does .{0,40}mean|meaning of|medical term|అర్థం ఏమిటి|అర్థం)/i.test(s)) return "term";
  if (/(follow.?ups?|appointments?|review|check.?up|x-?ray|\binr\b|ఫాలో)/i.test(s)) return "follow_up";
  if (/(warnings?|danger|emergency|red flags?|seek help|when to (call|go)|సంకేత|అత్యవసర)/i.test(s)) return "warnings";
  if (/(how often|frequency|times a day|times daily|what time|when (exactly )?(should|do|to) (i )?(take|use)|ఎన్నిసార్లు|ఎప్పుడు)/i.test(s)) return "frequency";
  if (/(how long|duration|for how many days|until when|how many days|stop when|ఎంతకాలం|ఎన్ని రోజులు)/i.test(s)) return "duration";
  if (/(medicines?|medications?|tablets?|capsules?|doses?|dosage|syrups?|injections?|pills?|మందు|ఔషధ|మోతాదు|టాబ్లెట్|క్యాప్సూల్)/i.test(s)) return "meds";
  if (/(diet|foods?|eat|eating|activity|exercise|walk|lifestyle|rest|ఆహారం|విశ్రాంతి|వ్యాయామ)/i.test(s)) return "diet_activity";
  if (/(hello|hi\b|hey|namaste|స్రావయ|నమస్తే|నమస్కారం)/i.test(s)) return "greeting";
  if (/(carebridge|how does .{0,15}work|what can you do)/i.test(s)) return "how_it_works";
  return "unknown";
}

const GLOSSARY: Array<{ terms: RegExp; en: string; te: string }> = [
  {
    terms: /appendectomy|appendicitis|appendix|అపెండిక్స్/,
    en: "Appendectomy means an operation to remove the appendix — a small pouch attached to the large intestine. Appendicitis is when the appendix becomes swollen and infected; it is usually treated by removing it.",
    te: "అపెండిక్స్ అనేది పెద్ద పేగుకు అతుక్కుని ఉండే చిన్న సంచి వంటిది. అది వాచి, ఇన్ఫెక్షన్ అయితే దాన్ని అపెండిసైటిస్ అంటారు. దాన్ని శస్త్రచికిత్సతో తొలగించడాన్ని అపెండెక్టమీ అంటారు.",
  },
  {
    terms: /pneumonia|న్యుమోనియా/,
    en: "Pneumonia is an infection of the lungs. It can cause cough, fever, and difficulty breathing. It is usually treated with antibiotics, rest, and fluids. Your care team will tell you when to review it.",
    te: "న్యుమోనియా అంటే ఊపిరితిత్తుల ఇన్ఫెక్షన్. దీని వల్ల దగ్గు, జ్వరం, శ్వాస ఇబ్బంది కలగవచ్చు. సాధారణంగా యాంటీబయాటిక్స్, విశ్రాంతి, ద్రవాలతో చికిత్స చేస్తారు.",
  },
  {
    terms: /atrial fibrillation|\bafib\b/,
    en: "Atrial fibrillation (AF) is an irregular heart rhythm. The upper chambers of the heart beat in a disorganised way. Medicines are used to control the rate and reduce the risk of clots.",
    te: "ఏట్రియల్ ఫిబ్రిలేషన్ (AF) అంటే గుండె అసాధారణంగా, క్రమం తప్పి కొట్టుకోవడం. మందులు గుండె వేగాన్ని నియంత్రించడానికి, గడ్డలు కట్టకుండా ఉండటానికి వాడతారు.",
  },
  {
    terms: /\binr\b/,
    en: "INR is a blood test that measures how long your blood takes to clot. It is used to monitor blood-thinning medicines such as Warfarin. Your doctor uses the result to adjust the dose.",
    te: "INR అనేది మీ రక్తం గడ్డకట్టడానికి పట్టే సమయాన్ని కొలిచే రక్త పరీక్ష. Warfarin వంటి రక్తం పలుచని చేసే మందులను పర్యవేక్షించడానికి దీన్ని వాడతారు. ఫలితం ఆధారంగా డాక్టర్ మోతాదు సరిచేస్తారు.",
  },
  {
    terms: /anticoagulant|blood thinner/,
    en: "An anticoagulant is a medicine that makes blood take longer to clot. It lowers the risk of dangerous clots but can increase bleeding — which is why unusual bleeding is a warning sign.",
    te: "యాంటికోయాగ్యులెంట్ అంటే రక్తం గడ్డకట్టడానికి ఎక్కువ సమయం పట్టేలా చేసే మందు. ఇది ప్రమాదకరమైన గడ్డల ప్రమాదాన్ని తగ్గిస్తుంది, కానీ రక్తస్రావం పెరగవచ్చు — అందుకే అసాధారణ రక్తస్రావం ఒక ప్రమాద సంకేతం.",
  },
  {
    terms: /sputum/,
    en: "Sputum is the mucus that you cough up from your lungs or airways.",
    te: "కఫం (స్పూటమ్) అంటే దగ్గినప్పుడు ఊపిరితిత్తుల నుండి వచ్చే శ్లేష్మం.",
  },
  {
    terms: /metformin/,
    en: "Metformin is a common medicine for type 2 diabetes. It helps control blood sugar. In your document, only the dose written by your doctor should be followed.",
    te: "మెట్‌ఫార్మిన్ టైపు 2 మధుమేహానికి సాధారణంగా వాడే మందు. రక్తంలో చక్కెర స్థాయిని నియంత్రించడంలో సహాయపడుతుంది. మీ పత్రంలో డాక్టర్ రాసిన మోతాదే అనుసరించాలి.",
  },
  {
    terms: /warfarin/,
    en: "Warfarin is a blood-thinning medicine (anticoagulant) that helps prevent harmful clots. The dose is very specific to each person and is often guided by INR blood tests. Never change it on your own.",
    te: "Warfarin రక్తం పలుచని చేసే మందు (యాంటికోయాగ్యులెంట్); హానికరమైన గడ్డలు ఏర్పడకుండా కాపాడుతుంది. మోతాదు ప్రతి వ్యక్తికీ ప్రత్యేకం, తరచుగా INR పరీక్షలతో నిర్ణయిస్తారు. మీ నుండి మీరు మార్చుకోవద్దు.",
  },
  {
    terms: /antibiotic/,
    en: "An antibiotic is a medicine that treats bacterial infections. It is important to complete the full prescribed course, exactly as your document says.",
    te: "యాంటీబయాటిక్ అంటే బ్యాక్టీరియా ఇన్ఫెక్షన్‌లను నయం చేసే మందు. మీ పత్రంలో రాసినట్లు కోర్సు పూర్తి చేయడం చాలా ముఖ్యం.",
  },
];

function medLineEn(ctx: AssistantContext): string[] {
  return ctx.facts.medications.map((m, i) => {
    const review = m.needsReview ? " [REVIEW NEEDED — source has unclear/conflicting details]" : "";
    return `${i + 1}. ${m.name ?? "Unreadable name [REVIEW NEEDED]"} ${m.strength ?? "(strength not stated)"} — take ${m.dose ?? "(dose not stated)"}${m.route ? " " + m.route : ""}, ${m.frequency ?? "(frequency not stated)"}, ${m.duration ? "for " + m.duration : "(duration not stated)"}.${m.special ? " Note: " + m.special : ""}${review}`;
  });
}

function medLineTe(ctx: AssistantContext): string[] {
  return ctx.facts.medications.map((m, i) => {
    const d = doseTe(m.dose).text;
    const r = m.route ? (teLookup(ROUTE_TE, m.route) ?? m.route) : "";
    const f = m.frequency ? (teLookup(FREQ_TE, m.frequency) ?? m.frequency) : "ఎన్నిసార్లు వాడాలో పేర్కొనలేదు";
    const dur = m.duration ? (durationTe(m.duration) ?? `for ${m.duration}`) : "ఎంతకాలం వాడాలో పేర్కొనలేదు";
    const sp = m.special ? (teLookup(SPECIAL_TE, m.special) ?? m.special) : null;
    const review = m.needsReview ? " [సమీక్ష అవసరం — మూలంలో అస్పష్ట/విరుద్ధ వివరాలు]" : "";
    return `${i + 1}. ${m.name ?? "చదవలేని పేరు [సమీక్ష అవసరం]"} ${m.strength ?? "(బలం పేర్కొనలేదు)"} — ${d} ${r} వాడండి, ${f}, ${dur}.${sp ? " గమనిక: " + sp : ""}${review}`;
  });
}

export function answerOffline(rawQuestion: string, ctx: AssistantContext | null, lang: "en" | "te"): AssistantReply {
  const intent = detectIntent(rawQuestion);
  const hasConflict = (ctx?.facts.medications ?? []).some((m) => m.needsReview) || (ctx?.facts.unclear.length ?? 0) > 0;

  // TERM intent works without a document.
  if (intent === "term") {
    const hit = GLOSSARY.find((g) => g.terms.test(rawQuestion));
    if (hit) {
      return {
        answer: lang === "te" ? hit.te : hit.en,
        language: lang,
        supportingSourceExcerpt: null,
        uncertaintyStatus: "confident",
        needsHumanReview: false,
        responseType: "term_explanation",
      };
    }
    return {
      answer:
        lang === "te"
          ? "క్షమించండి — ఆ పదానికి నా దగ్గర నమ్మకమైన వివరణ లేదు. సరైన అర్థం కోసం మీ డాక్టర్ లేదా ఫార్మసిస్ట్‌ను అడగండి. పేరు తప్పకుండా వ్రాసి చూపించండి."
          : "I don't have a reliable explanation for that term in my built-in glossary, and I won't guess medical meanings. Please ask your doctor or pharmacist — it can help to show them the word written down.",
      language: lang,
      supportingSourceExcerpt: null,
      uncertaintyStatus: "uncertain",
      needsHumanReview: false,
      responseType: "term_explanation",
    };
  }

  if (intent === "greeting") {
    return {
      answer:
        lang === "te"
          ? `నమస్తే! నేను కేర్‌బ్రిడ్జ్ అసిస్టెంట్‌ని. మీ డిశ్చార్జ్ సూచనలను సరళంగా వివరించడం నా పని. ${ctx ? "మీ పత్రం లోడ్ అయింది — మందులు, ఫాలో-అప్ లేదా ప్రమాద సంకేతాల గురించి అడగండి." : "ప్రస్తుతం పత్రం లోడ్ కాలేదు — వర్క్‌స్పేస్‌లో సింతటిక్ నమూనాను లోడ్ చేస్తే మీ పత్రం గురించి ప్రత్యేకంగా వివరించగలను."}`
          : `Hello! I'm the CareBridge Assistant — I explain discharge instructions in simple language. ${ctx ? "Your document is loaded, so ask me about your medicines, follow-up, or warning signs." : "No document is loaded right now — load a synthetic sample in the workspace and I can explain your specific instructions."}`,
      language: lang,
      supportingSourceExcerpt: null,
      uncertaintyStatus: "confident",
      needsHumanReview: false,
      responseType: "general",
    };
  }

  if (intent === "how_it_works") {
    return {
      answer:
        lang === "te"
          ? "కేర్‌బ్రిడ్జ్ మీ డిశ్చార్జ్ సారాంశాన్ని చదివి, మందులు, ఫాలో-అప్, ప్రమాద సంకేతాలను వేరు చేసి, వాటిని సరళమైన భాషలో — ఇంగ్లీషు, తెలుగులో — చూపిస్తుంది. ప్రతి సూచన మూల పంక్తికి లింక్ చేయబడి ఉంటుంది, ఏదైనా మారినా లేదా తప్పిపోయినా వెంటనే గుర్తుచేస్తుంది."
          : "CareBridge reads your discharge summary, separates medicines, follow-ups and warning signs, and shows them in simple language — English and Telugu. Every instruction links back to its source line, and the faithfulness engine flags anything changed, missing, or uncertain.",
      language: lang,
      supportingSourceExcerpt: null,
      uncertaintyStatus: "confident",
      needsHumanReview: false,
      responseType: "general",
    };
  }

  // Document-specific intents need a document.
  if (!ctx) {
    return {
      answer:
        lang === "te"
          ? "మీ మందులు లేదా పత్రంపై ప్రశ్న అడిగారు, కానీ ఇంకా ఏ పత్రం లోడ్ కాలేదు. దయచేసి వర్క్‌స్పేస్ పేజీలో సింథటిక్ నమూనాను లోడ్ చేయండి — అప్పుడు మీ డిశ్చార్జ్ సూచనలను ఖచ్చితంగా వివరించగలను. నేను మీరు చెప్పని మందుల గురించి ఊహించను."
          : "You've asked about personal instructions, but no document is loaded yet. Please load one of the synthetic samples in the workspace — then I can explain your medicines, follow-ups and warning signs exactly as written. I won't guess what medicines you take.",
      language: lang,
      supportingSourceExcerpt: null,
      uncertaintyStatus: "uncertain",
      needsHumanReview: false,
      responseType: "general",
    };
  }

  if (intent === "meds" || intent === "telugu") {
    const useTe = lang === "te" || intent === "telugu";
    const lines = useTe ? medLineTe(ctx) : medLineEn(ctx);
    const intro = useTe
      ? "మీ డిశ్చార్జ్ సారాంశంలో రాసిన మందులు ఇవి (ఖచ్చితంగా అలాగే):"
      : "Here are the medicines your discharge summary lists, exactly as written:";
    const note = useTe
      ? " ఏదైనా సందేహం ఉంటే మీ డాక్టర్ లేదా ఫార్మసిస్ట్‌ను అడగండి."
      : " If anything is unclear, ask your doctor or pharmacist before taking it.";
    const conflictNote = hasConflict
      ? useTe
        ? " గమనిక: మీ పత్రంలో కొన్ని వివరాలు అస్పష్టంగా/విరుద్ధంగా ఉన్నాయి — అవి 'సమీక్ష అవసరం' అని గుర్తించబడ్డాయి. వాటిని ఊహించకుండా నిర్ధారించుకోండి."
        : " Note: some details in your document are unclear or conflicting — they are marked REVIEW NEEDED. Please confirm those with the hospital instead of guessing."
      : "";
    return {
      answer: `${intro}\n${lines.join("\n")}${conflictNote}${note}`,
      language: useTe ? "te" : "en",
      supportingSourceExcerpt: ctx.facts.medications.map((m) => m.raw).join("\n") || null,
      uncertaintyStatus: hasConflict ? "uncertain" : "confident",
      needsHumanReview: hasConflict,
      responseType: "medication",
    };
  }

  if (intent === "frequency") {
    const useTe = lang === "te";
    const lines = ctx.facts.medications.map((m) => {
      if (useTe) {
        const f = m.frequency ? (teLookup(FREQ_TE, m.frequency) ?? m.frequency) : "ఎన్నిసార్లు వాడాలో పేర్కొనలేదు — నిర్ధారించుకోండి";
        return `• ${m.name ?? "చదవలేని పేరు"}: ${f}`;
      }
      return `• ${m.name ?? "Unreadable name"}: ${m.frequency ?? "frequency not stated — please confirm"}`;
    });
    const timing = useTe
      ? "\n\nమీ పత్రం ఖచ్చితమైన గడియార సమయాలను పేర్కొనలేదు — అందుకే నేను సమయాలను ఊహించి చెప్పలేను. 'రోజుకు మూడుసార్లు' అంటే సాధారణంగా దాదాపు సమాన విరామంతో మూడుసార్లు, కానీ ఖచ్చిత సమయాలు మీ డాక్టర్/ఫార్మసిస్ట్‌తో నిర్ధారించుకోండి."
      : "\n\nYour document does not state exact clock times, so I won't invent any. “Three times daily” usually means roughly evenly spaced doses, but the exact timing should be confirmed with your doctor or pharmacist.";
    return {
      answer:
        (useTe ? "మీ పత్రం చెప్పేది ఇదే — ఎన్నిసార్లు వాడాలో:\n" : "This is exactly how often your document says to take each medicine:\n") +
        lines.join("\n") +
        timing,
      language: useTe ? "te" : "en",
      supportingSourceExcerpt: ctx.facts.medications.map((m) => m.raw).join("\n") || null,
      uncertaintyStatus: "confident",
      needsHumanReview: false,
      responseType: "medication",
    };
  }

  if (intent === "duration") {
    const useTe = lang === "te";
    const lines = ctx.facts.medications.map((m) => {
      if (useTe) {
        const d = m.duration ? (durationTe(m.duration) ?? `for ${m.duration}`) : "ఎంతకాలం వాడాలో పేర్కొనలేదు — నిర్ధారించుకోండి";
        return `• ${m.name ?? "చదవలేని పేరు"}: ${d}`;
      }
      return `• ${m.name ?? "Unreadable name"}: ${m.duration ? `${m.duration}` : "duration not stated — please confirm"}`;
    });
    return {
      answer:
        (useTe ? "ఒక్కో మందు ఎంతకాలం వాడాలో మీ పత్రం చెప్పేది:\n" : "Here is exactly how long your document says to take each medicine:\n") +
        lines.join("\n") +
        (useTe ? "\n\nపేర్కొనని మందులకు ఊహించకుండా నిర్ధారించుకోండి." : "\n\nFor anything not stated, please confirm rather than guessing."),
      language: useTe ? "te" : "en",
      supportingSourceExcerpt: ctx.facts.medications.map((m) => m.raw).join("\n") || null,
      uncertaintyStatus: ctx.facts.medications.some((m) => !m.duration) ? "uncertain" : "confident",
      needsHumanReview: ctx.facts.medications.some((m) => !m.duration),
      responseType: "medication",
    };
  }

  if (intent === "follow_up") {
    const useTe = lang === "te";
    if (!ctx.facts.followUps.length) {
      return {
        answer: useTe ? "మీ పత్రంలో ఫాలో-అప్ సూచనలు కనిపించలేదు — డాక్టర్‌ను అడగండి." : "I could not find any follow-up instructions in your document — please ask your doctor when to come back.",
        language: useTe ? "te" : "en",
        supportingSourceExcerpt: null,
        uncertaintyStatus: "uncertain",
        needsHumanReview: false,
        responseType: "follow_up",
      };
    }
    const lines = ctx.facts.followUps.map((f) => {
      const base = `• ${f.title ?? (useTe ? "ఫాలో-అప్" : "Follow-up")}`;
      const when = `${f.date ?? (useTe ? "తేదీ పేర్కొనలేదు — నిర్ధారించండి" : "date NOT STATED — please confirm")}${f.time ? ` at ${f.time}` : `, ${useTe ? "సమయం పేర్కొనలేదు" : "time NOT STATED"}`}`;
      const where = f.location ? ` — ${f.location}` : "";
      const prep = f.preparation ? (useTe ? ` తీసుకురావడం: ${f.preparation}` : ` Prepare: ${f.preparation}`) : "";
      return `${base}: ${when}${where}.${prep}`;
    });
    return {
      answer:
        (useTe ? "మీ ఫాలో-అప్ సూచనలు, పత్రంలో ఉన్నట్లుగానే:\n" : "Your follow-up instructions, exactly as written:\n") + lines.join("\n"),
      language: useTe ? "te" : "en",
      supportingSourceExcerpt: ctx.facts.followUps.map((f) => f.raw).join("\n") || null,
      uncertaintyStatus: ctx.facts.followUps.some((f) => f.needsReview) ? "uncertain" : "confident",
      needsHumanReview: ctx.facts.followUps.some((f) => f.needsReview),
      responseType: "follow_up",
    };
  }

  if (intent === "warnings") {
    const useTe = lang === "te";
    const lines = ctx.facts.warningSigns.map((w) => {
      const sign = useTe ? (teLookup(WARNING_SIGN_TE, w.sign) ?? w.sign ?? w.raw) : (w.sign ?? w.raw);
      const action = useTe ? (teLookup(WARNING_ACTION_TE, w.action) ?? w.action ?? "") : (w.action ?? "");
      return `• ${sign} → ${action}`;
    });
    const head = useTe
      ? "మీ పత్రంలో ప్రమాద సంకేతాలు, చేయాల్సిన చర్యలతో:\n"
      : "The warning signs in your document, with the actions it states:\n";
    const tail = useTe
      ? "\n\nఇవి కనిపిస్తే ఆలస్యం చేయకండి. తీవ్రంగా అనిపిస్తే వెంటనే అత్యవసర సహాయం (108) పొందండి — చాట్‌పై ఆధారపడవద్దు."
      : "\n\nDo not wait if these appear. If anything feels severe, seek emergency care (call 108) rather than relying on this chat.";
    return {
      answer: head + lines.join("\n") + tail,
      language: useTe ? "te" : "en",
      supportingSourceExcerpt: ctx.facts.warningSigns.map((w) => w.raw).join("\n") || null,
      uncertaintyStatus: "confident",
      needsHumanReview: false,
      responseType: "warning_sign",
    };
  }

  if (intent === "diet_activity") {
    const useTe = lang === "te";
    const lines = ctx.facts.instructions.map((t) => `• ${useTe ? (teLookup(INSTRUCTION_TE, t) ?? t) : t}`);
    return {
      answer: (useTe ? "ఆహారం, శ్రమ గురించి మీ పత్రం చెప్పేది:\n" : "Here is what your document says about food, drink and activity:\n") + lines.join("\n"),
      language: useTe ? "te" : "en",
      supportingSourceExcerpt: ctx.facts.instructions.join("\n") || null,
      uncertaintyStatus: "confident",
      needsHumanReview: false,
      responseType: "diet_activity",
    };
  }

  return {
    answer:
      lang === "te"
        ? "క్షమించండి, ఆ ప్రశ్నకు నా దగ్గర సమాచారం లేదు — ఊహించి సమాధానం చెప్పను. మీరు ఇవి అడగవచ్చు: మందులు, ఎన్నిసార్లు, ఎంతకాలం, ఫాలో-అప్ వివరాలు, ప్రమాద సంకేతాలు, ఆహార/శ్రమ సూచనలు, లేదా వైద్య పదాల అర్థం."
        : "I'm not able to answer that from the information available to me — and I won't guess medical answers. You can ask about your medicines, how often and how long to take them, follow-up details, warning signs, diet/activity instructions, or the meaning of a medical term.",
    language: lang,
    supportingSourceExcerpt: null,
    uncertaintyStatus: "uncertain",
    needsHumanReview: false,
    responseType: "general",
  };
}
