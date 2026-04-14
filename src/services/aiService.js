import { supabase } from "../supabaseClient";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI SETUP
// ─────────────────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const parseJSON = (text) => {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI RAW RESPONSE:", text);
    throw new Error("Invalid JSON from AI – could not parse timetable.");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FETCH ALL DATA NEEDED FOR GENERATION
// ─────────────────────────────────────────────────────────────────────────────
export const fetchGenerationData = async (semester, department) => {
  const { data: subjects, error: subErr } = await supabase
    .from("subjects")
    .select("*")
    .eq("semester", parseInt(semester))
    .eq("department", department);

  if (subErr) throw new Error("Failed to fetch subjects: " + subErr.message);
  if (!subjects || subjects.length === 0)
    throw new Error(
      `No subjects found for ${department} Semester ${semester}. Please add subjects first.`
    );

  const { data: constraints, error: conErr } = await supabase
    .from("testconstraints")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (conErr || !constraints)
    throw new Error(
      "Constraints not found. Please add a row in testConstraints."
    );

  const { data: teacherLinks, error: tlErr } = await supabase
    .from("teacher_subjects")
    .select("*, subjects(*), teachers(*)");

  if (tlErr) console.warn("Could not fetch teacher links:", tlErr.message);

  const { data: teacherBusy, error: tbErr } = await supabase
    .from("teacher_availability")
    .select("*")
    .eq("is_busy", true);

  if (tbErr)
    console.warn("Could not fetch teacher availability:", tbErr.message);

  const { data: rooms, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("department", department);

  if (roomErr) console.warn("Could not fetch rooms:", roomErr.message);

  return {
    subjects: subjects || [],
    constraints,
    resources: {
      teacherLinks: teacherLinks || [],
      rooms: rooms || [],
    },
    busyMap: {
      teacherBusy: teacherBusy || [],
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD SLOT LIST (with breaks / lunch)
// ─────────────────────────────────────────────────────────────────────────────
export const createSlotsWithBreaks = (c) => {
  const slots = [];

  const toMins = (h, m) => parseInt(h) * 60 + parseInt(m);
  const fromMins = (total) => {
    const h = Math.floor(total / 60);
    const m = total % 60;
    const date = new Date(2026, 0, 1, h, m);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  let curr = toMins(c.start_hour, c.start_min);
  const end = toMins(c.end_hour, c.end_min);
  const lunchStart = toMins(c.lunch_hour, c.lunch_min);
  const breakStart = toMins(c.break_hour, c.break_min);

  // duration fields are in hours (possibly fractional like 0.5)
  const periodMins = Math.round(parseFloat(c.period_duration) * 60);
  const lunchMins = Math.round(parseFloat(c.lunch_duration) * 60);
  const breakMins = Math.round(parseFloat(c.break_duration) * 60);

  const inserted = { lunch: false, break: false };

  while (curr < end) {
    if (!inserted.lunch && curr === lunchStart) {
      slots.push({ type: "lunch", label: "LUNCH", span: 1 });
      curr += lunchMins;
      inserted.lunch = true;
      continue;
    }
    if (!inserted.break && curr === breakStart) {
      slots.push({ type: "break", label: "BREAK", span: 1 });
      curr += breakMins;
      inserted.break = true;
      continue;
    }

    const next = curr + periodMins;
    if (next > end) break;

    const label = `${fromMins(curr)}-${fromMins(next)}`;
    slots.push({ type: "class", label });
    curr = next;
  }

  return slots;
};

// ─────────────────────────────────────────────────────────────────────────────
// LAB HELPERS — shared between scheduler and validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the combined display label for all labs.
 * e.g.  ["WEB LAB", "CN LAB"]  →  "WEB LAB/CN LAB"
 */
export const getLabLabel = (labs) =>
  labs.length > 1
    ? labs.map((l) => l.subject_name).join("/")
    : labs.length === 1
    ? labs[0].subject_name
    : null;

/**
 * Given the full ordered classSlots array (pre-lunch then post-lunch),
 * find the index of `slotLabel` — used to check adjacency correctly.
 */
const slotIndexIn = (orderedSlots, label) => orderedSlots.indexOf(label);

// ─────────────────────────────────────────────────────────────────────────────
// JS DETERMINISTIC SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────
export const buildTimetableWithJS = (subjects, slots, constraints) => {
  const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const labDuration = parseInt(constraints.lab_duration) || 2;

  // All class slot labels in the order they appear in the day
  const classSlots = slots
    .filter((s) => s.type === "class")
    .map((s) => s.label);

  // Pre-lunch / post-lunch split — used for priority ordering only
  const lunchIdx = slots.findIndex((s) => s.type === "lunch");
  const preLunchSlots = slots
    .slice(0, lunchIdx === -1 ? slots.length : lunchIdx)
    .filter((s) => s.type === "class")
    .map((s) => s.label);
  const postLunchSlots = slots
    .slice(lunchIdx === -1 ? slots.length : lunchIdx + 1)
    .filter((s) => s.type === "class")
    .map((s) => s.label);

  // orderedSlots = pre-lunch first, then post-lunch — used for fill priority
  const orderedSlots = [...preLunchSlots, ...postLunchSlots];

  // Init timetable: every class slot = "-"
  const timetable = {};
  DAYS.forEach((day) => {
    timetable[day] = {};
    classSlots.forEach((slot) => (timetable[day][slot] = "-"));
  });

  const remaining = {};
  subjects.forEach((s) => (remaining[s.subject_name] = s.weekly_hours));

  const labs = subjects.filter((s) => s.is_lab);
  const theories = subjects.filter((s) => !s.is_lab);

  // Combined label shown in every lab slot cell  e.g. "WEB LAB/CN LAB"
  const labLabel = getLabLabel(labs);

  // Track what's placed per day (avoid same-subject twice on same day)
  const dayUsed = {};
  DAYS.forEach((d) => (dayUsed[d] = new Set()));

  // ── STEP 1: Place each lab in exactly `labDuration` CONSECUTIVE slots ──
  // Key fix: we work from classSlots (the true order), not a filtered list,
  // so consecutive means adjacent in the actual day schedule.
  // We prefer pre-lunch blocks; fall back to post-lunch if needed.
  // Each lab gets its own day (round-robin across days).
  let labDayIdx = 0;

  labs.forEach((lab) => {
    let placed = false;

    for (let di = 0; di < DAYS.length && !placed; di++) {
      const day = DAYS[(labDayIdx + di) % DAYS.length];

      // Build candidate starting indices — pre-lunch positions first
      const preLunchStarts = preLunchSlots
        .map((sl) => classSlots.indexOf(sl))
        .filter(
          (idx) => idx !== -1 && idx + labDuration - 1 < classSlots.length
        );
      const postLunchStarts = postLunchSlots
        .map((sl) => classSlots.indexOf(sl))
        .filter(
          (idx) => idx !== -1 && idx + labDuration - 1 < classSlots.length
        );

      const startCandidates = [
        ...new Set([...preLunchStarts, ...postLunchStarts]),
      ];

      for (const startIdx of startCandidates) {
        if (placed) break;
        // Grab `labDuration` consecutive slots from classSlots starting at startIdx
        const block = classSlots.slice(startIdx, startIdx + labDuration);
        if (block.length < labDuration) continue;
        // All must be free
        if (!block.every((sl) => timetable[day][sl] === "-")) continue;

        // Place lab label in every slot of the block
        block.forEach((sl) => {
          timetable[day][sl] = labLabel;
        });
        dayUsed[day].add(labLabel);
        // Decrement remaining for this lab
        remaining[lab.subject_name] = Math.max(
          0,
          (remaining[lab.subject_name] || 0) - 1
        );
        placed = true;
        labDayIdx = (labDayIdx + di + 1) % DAYS.length;
      }
    }
  });

  // ── STEP 2: Round-robin theory placement ───────────────────────────────
  // Iterate orderedSlots (pre-lunch first) so mornings fill before afternoons.
  // For each slot, rotate which day we start from (dayOffset = slotIdx % 6)
  // so that the same time column gets DIFFERENT subjects across days.
  for (let slotIdx = 0; slotIdx < orderedSlots.length; slotIdx++) {
    const slot = orderedSlots[slotIdx];
    const dayOffset = slotIdx % DAYS.length;

    for (let di = 0; di < DAYS.length; di++) {
      const day = DAYS[(dayOffset + di) % DAYS.length];
      if (timetable[day][slot] !== "-") continue; // already occupied

      const candidates = theories.filter(
        (s) =>
          remaining[s.subject_name] > 0 && !dayUsed[day].has(s.subject_name)
      );
      if (candidates.length === 0) continue;

      const pick = candidates[(slotIdx + di) % candidates.length];
      timetable[day][slot] = pick.subject_name;
      remaining[pick.subject_name]--;
      dayUsed[day].add(pick.subject_name);
    }
  }

  // ── STEP 3: Guarantee every day has at least one class ─────────────────
  DAYS.forEach((emptyDay) => {
    const hasClass = classSlots.some((sl) => timetable[emptyDay][sl] !== "-");
    if (hasClass) return;

    let filled = false;

    // Use a subject that still has remaining quota
    for (const s of theories) {
      if (remaining[s.subject_name] > 0) {
        const targetSlot = orderedSlots.find(
          (sl) => timetable[emptyDay][sl] === "-"
        );
        if (!targetSlot) break;
        timetable[emptyDay][targetSlot] = s.subject_name;
        remaining[s.subject_name]--;
        dayUsed[emptyDay].add(s.subject_name);
        filled = true;
        break;
      }
    }

    // Borrow from a donor day that has 2+ theory classes
    if (!filled) {
      for (const donor of DAYS) {
        if (donor === emptyDay) continue;
        const donorSlots = classSlots.filter(
          (sl) =>
            timetable[donor][sl] !== "-" && timetable[donor][sl] !== labLabel
        );
        if (donorSlots.length <= 1) continue;
        const donorSlot = donorSlots[donorSlots.length - 1];
        const subjectToMove = timetable[donor][donorSlot];
        if (dayUsed[emptyDay].has(subjectToMove)) continue;
        const freeSlot = orderedSlots.find(
          (sl) => timetable[emptyDay][sl] === "-"
        );
        if (!freeSlot) continue;
        timetable[emptyDay][freeSlot] = subjectToMove;
        timetable[donor][donorSlot] = "-";
        dayUsed[emptyDay].add(subjectToMove);
        filled = true;
        break;
      }
    }
  });

  return timetable;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCT PROMPT (AI reviews & patches the JS-generated timetable)
// ─────────────────────────────────────────────────────────────────────────────
export const constructGeminiPrompt = (
  subjects,
  slots,
  department,
  constraints,
  jsTimetable
) => {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const classSlots = slots
    .filter((s) => s.type === "class")
    .map((s) => s.label);
  const labDuration = parseInt(constraints.lab_duration) || 2;

  const cleanSubjects = subjects.map((s) => ({
    name: s.subject_name,
    hours: s.weekly_hours,
    isLab: s.is_lab || false,
  }));

  const labs = cleanSubjects.filter((s) => s.isLab);
  const labLabel =
    labs.length > 1
      ? labs.map((l) => l.name).join("/")
      : labs.length === 1
      ? labs[0].name
      : null;

  return `You are an expert academic timetable validator and patcher.

A JS scheduling algorithm already generated this timetable. Your job is ONLY to:
1. Check for any remaining rule violations
2. Fix ONLY broken slots — do NOT reshuffle correct slots
3. Return the full corrected timetable

Department: ${department}

===== CURRENT TIMETABLE =====
${JSON.stringify(jsTimetable, null, 2)}

===== SUBJECTS & WEEKLY LIMITS =====
${JSON.stringify(cleanSubjects)}

===== RULES =====
1. Every day MUST have at least one class (not all dashes)
2. No theory subject appears more than once per day
3. Pre-lunch slots must be filled BEFORE post-lunch — if pre-lunch is "-" but post-lunch has a subject on the same day, swap them
4. No same subject in the same time column for more than 2 consecutive days
5. Lab ("${
    labLabel || "LAB"
  }") must occupy exactly ${labDuration} consecutive slots on same day
6. No subject exceeds its weekly_hours total

===== OUTPUT =====
Return ONLY the complete corrected timetable as strict JSON. No markdown. No explanation.
`;
};

// ─────────────────────────────────────────────────────────────────────────────
// CALL GEMINI
// ─────────────────────────────────────────────────────────────────────────────
export const generateWithGemini = async (prompt) => {
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    });
    const text = result.response.text();
    return parseJSON(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("AI generation failed: " + error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// JS VALIDATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const buildSubjectTeacherMap = (teacherLinks) => {
  const map = {};
  (teacherLinks || []).forEach((link) => {
    const name = link.subjects?.subject_name;
    if (name) map[name] = link.teacher_id;
  });
  return map;
};

/**
 * Full conflict detection.
 * Returns array of conflict strings.
 */
export const validateTimetable = (
  timetable,
  subjects,
  teacherLinks,
  teacherBusy
) => {
  const conflicts = [];
  const subjectTeacherMap = buildSubjectTeacherMap(teacherLinks);

  const busySet = new Set(
    (teacherBusy || []).map(
      (b) => `${b.teacher_id}_${b.day_of_week}_${b.time_slot}`
    )
  );

  const subjectWeeklyCount = {};
  subjects.forEach((s) => (subjectWeeklyCount[s.subject_name] = 0));

  const teacherSlotUsage = {};

  // Combined lab label — cells with this value are intentionally repeated across consecutive slots
  const labSubjectList = subjects.filter((s) => s.is_lab);
  const combinedLabLabel =
    labSubjectList.length > 0 ? getLabLabel(labSubjectList) : null;

  for (const day in timetable) {
    const daySubjectSeen = new Set();

    for (const slot in timetable[day]) {
      const subject = timetable[day][slot];
      if (!subject || subject === "-") continue;

      // Weekly count
      if (subjectWeeklyCount[subject] !== undefined) {
        subjectWeeklyCount[subject]++;
      }

      // isLab = combined label match OR individual subject marked is_lab
      const subjectMeta = subjects.find((s) => s.subject_name === subject);
      const isLab =
        (combinedLabLabel && subject === combinedLabLabel) ||
        subjectMeta?.is_lab ||
        false;

      // Skip duplicate check for lab cells — multiple slots intentionally share the same label
      if (!isLab) {
        if (daySubjectSeen.has(subject)) {
          conflicts.push(
            `DUPLICATE: "${subject}" appears more than once on ${day}`
          );
        } else {
          daySubjectSeen.add(subject);
        }
      }

      // Teacher checks
      const teacherId = subjectTeacherMap[subject];
      if (teacherId) {
        const key = `${teacherId}_${day}_${slot}`;

        if (busySet.has(key)) {
          conflicts.push(
            `TEACHER_BUSY: Teacher for "${subject}" is unavailable on ${day} at ${slot}`
          );
        }

        if (teacherSlotUsage[key] && teacherSlotUsage[key] !== subject) {
          conflicts.push(
            `TEACHER_CONFLICT: Teacher for "${subject}" is already teaching "${teacherSlotUsage[key]}" on ${day} at ${slot}`
          );
        }
        teacherSlotUsage[key] = subject;
      }
    }
  }

  // Weekly hours over-limit
  subjects.forEach((s) => {
    const actual = subjectWeeklyCount[s.subject_name] || 0;
    if (actual > s.weekly_hours) {
      conflicts.push(
        `OVER_LIMIT: "${s.subject_name}" has ${actual} slots but weekly limit is ${s.weekly_hours}`
      );
    }
  });

  // Lab continuity check
  // The timetable stores the COMBINED lab label (e.g. "WEB LAB/CN LAB") in every
  // slot of a lab block. We just need to verify each occurrence is adjacent to
  // another slot with the same combined label.
  const labsInSubjects = subjects.filter((s) => s.is_lab);
  if (labsInSubjects.length > 0) {
    const combinedLabel = getLabLabel(labsInSubjects);
    for (const day in timetable) {
      const slotKeys = Object.keys(timetable[day]);
      for (let i = 0; i < slotKeys.length; i++) {
        const val = timetable[day][slotKeys[i]];
        if (val !== combinedLabel) continue;

        const prevVal = i > 0 ? timetable[day][slotKeys[i - 1]] : null;
        if (prevVal === combinedLabel) continue; // middle/end of block — OK

        // Start of a lab block: next slot must also be the lab
        const nextVal =
          i + 1 < slotKeys.length ? timetable[day][slotKeys[i + 1]] : null;
        if (nextVal !== combinedLabel) {
          conflicts.push(
            `LAB_NOT_CONSECUTIVE: Lab block on ${day} at ${slotKeys[i]} is not followed by a consecutive lab slot`
          );
        }
      }
    }
  }

  return conflicts;
};

// ─────────────────────────────────────────────────────────────────────────────
// JS FAST-FIXER
// ─────────────────────────────────────────────────────────────────────────────
export const fixTimetableWithJS = (timetable, subjects) => {
  const result = JSON.parse(JSON.stringify(timetable));

  // 1. Count current usage
  const counts = {};
  subjects.forEach((s) => (counts[s.subject_name] = 0));

  for (const day in result) {
    for (const slot in result[day]) {
      const sub = result[day][slot];
      if (counts[sub] !== undefined) counts[sub]++;
    }
  }

  // 2. Remove over-limit occurrences
  for (const day in result) {
    for (const slot in result[day]) {
      const sub = result[day][slot];
      const meta = subjects.find((s) => s.subject_name === sub);
      if (meta && counts[sub] > meta.weekly_hours) {
        result[day][slot] = "-";
        counts[sub]--;
      }
    }
  }

  // 3. Fix duplicate-per-day (theory only — skip combined lab labels)
  const labSubjects = subjects.filter((s) => s.is_lab);
  const combinedLabLabel =
    labSubjects.length > 0 ? getLabLabel(labSubjects) : null;

  for (const day in result) {
    const seen = new Set();
    for (const slot in result[day]) {
      const sub = result[day][slot];
      if (!sub || sub === "-") continue;
      // Skip lab combined label — multiple slots intentionally carry the same value
      if (combinedLabLabel && sub === combinedLabLabel) continue;
      const meta = subjects.find((s) => s.subject_name === sub);
      if (meta?.is_lab) continue;
      if (seen.has(sub)) {
        result[day][slot] = "-";
        if (counts[sub] !== undefined) counts[sub]--;
      } else {
        seen.add(sub);
      }
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT-FIX PROMPT
// ─────────────────────────────────────────────────────────────────────────────
export const constructConflictFixPrompt = (timetable, conflicts, subjects) => {
  return `You are an expert timetable conflict resolver.

===== CURRENT TIMETABLE =====
${JSON.stringify(timetable, null, 2)}

===== CONFLICTS TO FIX =====
${conflicts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

===== SUBJECT WEEKLY LIMITS =====
${JSON.stringify(
  subjects.map((s) => ({
    name: s.subject_name,
    max: s.weekly_hours,
    isLab: s.is_lab,
  })),
  null,
  2
)}

===== YOUR TASK =====
Fix ONLY the listed conflicts. Keep everything else identical.

Rules:
1. Resolve ALL conflicts listed above
2. Do NOT exceed any subject's weekly limit
3. No subject can appear twice on the same day (except labs which span consecutive slots)
4. Labs MUST remain in consecutive slots on the same day
5. Maintain all slot keys exactly as they appear
6. Use "-" for truly empty slots

Strategy:
- TEACHER_CONFLICT / TEACHER_BUSY: move the subject to a free slot on another day
- DUPLICATE: remove the extra occurrence (set to "-")
- OVER_LIMIT: remove excess occurrences (set to "-")
- LAB_NOT_CONSECUTIVE: place the lab in two consecutive free slots on the same day

Return ONLY the complete updated timetable as strict JSON.
NO explanation, NO markdown, ONLY JSON.
`;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export const generateTimetableFull = async (
  semester,
  department,
  onStatusUpdate
) => {
  const MAX_RETRIES = 2;

  const status = (msg) => {
    console.log("[TimetableGen]", msg);
    if (onStatusUpdate) onStatusUpdate(msg);
  };

  // 1. Fetch all data
  status("Fetching subjects, constraints, teachers & rooms…");
  const data = await fetchGenerationData(semester, department);

  // 2. Build slot list
  status("Building time slots…");
  const slots = createSlotsWithBreaks(data.constraints);

  // 3. JS deterministic scheduler (fast, no AI, produces spread timetable)
  status("Building timetable with JS scheduler…");
  let timetable = buildTimetableWithJS(data.subjects, slots, data.constraints);

  // 4. JS fix pass (clean up any over-limits / duplicates)
  timetable = fixTimetableWithJS(timetable, data.subjects);

  // 5. AI review pass — give the JS result to AI to patch any remaining issues
  status("AI reviewing and patching timetable…");
  try {
    const reviewPrompt = constructGeminiPrompt(
      data.subjects,
      slots,
      department,
      data.constraints,
      timetable
    );
    const aiPatched = await generateWithGemini(reviewPrompt);
    // Only accept AI patch if it returns a valid object with same day keys
    const aiDays = Object.keys(aiPatched);
    const expectedDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    if (aiDays.length >= 6 && expectedDays.every((d) => aiPatched[d])) {
      timetable = fixTimetableWithJS(aiPatched, data.subjects);
    }
  } catch (err) {
    status("AI review skipped (using JS result)…");
    console.warn("AI review failed:", err.message);
  }

  // 6. Validate
  let conflicts = validateTimetable(
    timetable,
    data.subjects,
    data.resources.teacherLinks,
    data.busyMap.teacherBusy
  );

  // 7. Conflict fix loop (teacher conflicts etc.)
  let attempt = 0;
  while (conflicts.length > 0 && attempt < MAX_RETRIES) {
    attempt++;
    status(
      `Found ${conflicts.length} conflict(s) — fixing (attempt ${attempt}/${MAX_RETRIES})…`
    );
    console.log("Conflicts:", conflicts);

    const fixPrompt = constructConflictFixPrompt(
      timetable,
      conflicts,
      data.subjects
    );
    try {
      timetable = await generateWithGemini(fixPrompt);
    } catch (err) {
      status("AI fix failed, keeping JS result…");
    }

    timetable = fixTimetableWithJS(timetable, data.subjects);
    conflicts = validateTimetable(
      timetable,
      data.subjects,
      data.resources.teacherLinks,
      data.busyMap.teacherBusy
    );
  }

  if (conflicts.length > 0) {
    status(
      `⚠️ ${conflicts.length} conflict(s) remain after ${MAX_RETRIES} attempts.`
    );
  } else {
    status("✅ Timetable generated and validated successfully!");
  }

  return { timetable, slots, data, remainingConflicts: conflicts };
};
