import React, { useState } from "react";
import { toast } from "react-hot-toast";
import Button from "@mui/material/Button";
import { supabase } from "../supabaseClient";

import {
  generateTimetableFull,
  generateWithGemini,
  fixTimetableWithJS,
  validateTimetable,
  getLabLabel,
} from "../services/aiService";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PALETTE = [
  "#dbeafe",
  "#dcfce7",
  "#fef9c3",
  "#fce7f3",
  "#ede9fe",
  "#ffedd5",
  "#e0f2fe",
  "#d1fae5",
  "#fef3c7",
  "#f3e8ff",
];
const colorCache = {};
let colorIdx = 0;
const subjectColor = (name) => {
  if (!name || name === "-") return "#f8fafc";
  if (!colorCache[name])
    colorCache[name] = PALETTE[colorIdx++ % PALETTE.length];
  return colorCache[name];
};

const GenerateAI = () => {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [matrix, setMatrix] = useState(null); // display rows
  const [conflicts, setConflicts] = useState([]);
  const [generationData, setGenerationData] = useState(null);

  const [selectedSem, setSelectedSem] = useState("6");
  const [selectedDept, setSelectedDept] = useState("ISE");

  const [draggedCell, setDraggedCell] = useState(null);
  const [modInput, setModInput] = useState("");
  const [modLoading, setModLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const rebuildMatrix = (timetable, slots, subjects) => {
    const labs = (subjects || []).filter((s) => s.is_lab);
    const combinedLabLabel = labs.length > 0 ? getLabLabel(labs) : null;

    const newMatrix = DAYS.reduce((acc, day) => {
      const row = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.type !== "class") {
          row.push({ ...slot });
          continue;
        }

        const subject = timetable[day]?.[slot.label] || "-";
        const isLab = combinedLabLabel && subject === combinedLabLabel;

        if (isLab) {
          let span = 1;
          for (let j = i + 1; j < slots.length; j++) {
            if (slots[j].type !== "class") break;
            if ((timetable[day]?.[slots[j].label] || "-") !== combinedLabLabel)
              break;
            span++;
          }

          row.push({
            type: "class",
            label: slot.label,
            subject,
            labSpan: span,
          });
          for (let k = 1; k < span; k++) {
            i++; // advance outer loop too
            row.push({
              type: "class",
              label: slots[i].label,
              subject,
              labSkip: true,
            });
          }
        } else {
          row.push({ type: "class", label: slot.label, subject });
        }
      }

      acc[day] = row;
      return acc;
    }, {});

    setMatrix(newMatrix);
  };

  const handleDragStart = (day, slotLabel) =>
    setDraggedCell({ day, slotLabel });

  const handleDrop = (targetDay, targetSlotLabel) => {
    if (!draggedCell) return;
    if (
      draggedCell.day === targetDay &&
      draggedCell.slotLabel === targetSlotLabel
    )
      return;

    const newTimetable = JSON.parse(JSON.stringify(generationData.timetable));
    const temp = newTimetable[draggedCell.day][draggedCell.slotLabel];
    newTimetable[draggedCell.day][draggedCell.slotLabel] =
      newTimetable[targetDay][targetSlotLabel];
    newTimetable[targetDay][targetSlotLabel] = temp;

    const newConflicts = validateTimetable(
      newTimetable,
      generationData.data.subjects,
      generationData.data.resources.teacherLinks,
      generationData.data.busyMap.teacherBusy
    );

    setGenerationData({ ...generationData, timetable: newTimetable });
    rebuildMatrix(
      newTimetable,
      generationData.slots,
      generationData.data.subjects
    );
    setConflicts(newConflicts);
    setDraggedCell(null);

    if (newConflicts.length > 0) {
      toast(`Swapped! But ${newConflicts.length} conflict(s) detected.`, {
        icon: "⚠️",
      });
    } else {
      toast.success("Slots swapped — no conflicts!");
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setMatrix(null);
    setConflicts([]);
    setGenerationData(null);
    // reset colour cache so each generation is fresh
    Object.keys(colorCache).forEach((k) => delete colorCache[k]);
    colorIdx = 0;

    const tid = toast.loading("Starting generation…");

    try {
      const { timetable, slots, data, remainingConflicts } =
        await generateTimetableFull(selectedSem, selectedDept, (msg) => {
          setStatusMsg(msg);
          toast.loading(msg, { id: tid });
        });

      setGenerationData({ timetable, slots, data });
      rebuildMatrix(timetable, slots, data.subjects);
      setConflicts(remainingConflicts);

      if (remainingConflicts.length > 0) {
        toast(
          `Generated with ${remainingConflicts.length} unresolved conflict(s)`,
          {
            id: tid,
            icon: "⚠️",
            duration: 5000,
          }
        );
      } else {
        toast.success("Timetable generated successfully!", { id: tid });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error generating timetable", { id: tid });
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  const handleApplyChanges = async () => {
    if (!modInput.trim()) return toast.error("Describe the change you want.");
    setModLoading(true);
    const tid = toast.loading("Applying changes…");

    try {
      const { timetable, slots, data } = generationData;

      const changePrompt = `You are a timetable editor.

Current timetable:
${JSON.stringify(timetable, null, 2)}

User request: "${modInput}"

Subject list (respect weekly limits):
${JSON.stringify(
  data.subjects.map((s) => ({ name: s.subject_name, max: s.weekly_hours }))
)}

Apply the user's requested change. Keep all other slots EXACTLY the same.
Do NOT exceed weekly_hours for any subject.
Do NOT place a theory subject twice on the same day.
Return ONLY the complete updated timetable as strict JSON — no explanation, no markdown.`;

      let updated = await generateWithGemini(changePrompt);
      updated = fixTimetableWithJS(updated, data.subjects);

      const newConflicts = validateTimetable(
        updated,
        data.subjects,
        data.resources.teacherLinks,
        data.busyMap.teacherBusy
      );

      setGenerationData({ ...generationData, timetable: updated });
      rebuildMatrix(updated, slots, data.subjects);
      setConflicts(newConflicts);
      setModInput("");

      if (newConflicts.length > 0) {
        toast(`Changes applied — ${newConflicts.length} conflict(s) detected`, {
          id: tid,
          icon: "⚠️",
        });
      } else {
        toast.success("Changes applied successfully!", { id: tid });
      }
    } catch (err) {
      toast.error(err.message || "Failed to apply changes", { id: tid });
    } finally {
      setModLoading(false);
    }
  };

  const handleSave = async () => {
    if (!generationData) return;
    setSaving(true);
    const tid = toast.loading("Saving timetable…");

    try {
      const { timetable } = generationData;
      const rows = [];
      for (const day in timetable) {
        for (const slot in timetable[day]) {
          const subject = timetable[day][slot];
          if (!subject || subject === "-") continue;
          rows.push({
            department: selectedDept,
            semester: parseInt(selectedSem),
            day_of_week: day,
            time_slot: slot,
            subject_name: subject,
          });
        }
      }

      const { error } = await supabase.from("timetable_entries").upsert(rows, {
        onConflict: "department,semester,day_of_week,time_slot",
      });

      if (error) throw new Error(error.message);
      toast.success(`Saved ${rows.length} entries!`, { id: tid });
    } catch (err) {
      toast.error("Save failed: " + err.message, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "1400px", margin: "30px auto", padding: "0 16px" }}>
      {/* CONTROL PANEL */}
      <div style={styles.card}>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>
          ⚡ AI Timetable Generator
        </h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 24 }}>
          Generates, validates and auto-resolves conflicts
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={styles.label}>Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={styles.select}
            >
              {["ISE", "CSE", "ECE", "ME", "CV"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={styles.label}>Semester</label>
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              style={styles.select}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          variant="contained"
          fullWidth
          onClick={handleGenerate}
          disabled={loading}
          style={{ marginTop: 20, height: 50, fontSize: "1rem" }}
        >
          {loading ? statusMsg || "Generating…" : "🚀 Generate Timetable"}
        </Button>

        {loading && statusMsg && (
          <p
            style={{
              marginTop: 10,
              color: "#6366f1",
              textAlign: "center",
              fontSize: "0.88rem",
            }}
          >
            {statusMsg}
          </p>
        )}
      </div>

      {/* CONFLICT PANEL */}
      {conflicts.length > 0 && (
        <div
          style={{
            ...styles.card,
            borderColor: "#f97316",
            background: "#fff7ed",
            marginTop: 16,
          }}
        >
          <h3 style={{ color: "#c2410c", marginBottom: 10 }}>
            ⚠️ {conflicts.length} Unresolved Conflict
            {conflicts.length > 1 ? "s" : ""}
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {conflicts.map((c, i) => (
              <li
                key={i}
                style={{
                  color: "#7c3aed",
                  fontSize: "0.88rem",
                  marginBottom: 4,
                }}
              >
                {c}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 10, color: "#64748b", fontSize: "0.82rem" }}>
            Drag-and-drop slots to fix manually, or use the chat box below.
          </p>
        </div>
      )}

      {/* TIMETABLE GRID */}
      {matrix && (
        <>
          <div style={{ ...styles.card, marginTop: 16, overflowX: "auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>📅 Generated Timetable</h3>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Drag cells to swap · {selectedDept} Sem {selectedSem}
              </span>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 700,
              }}
            >
              <thead>
                <tr>
                  <th style={styles.th}>Day</th>
                  {matrix["Monday"].map((slot, idx) => {
                    // Skip cells marked as labSkip (they're covered by the colspan above)
                    if (slot.labSkip) return null;
                    if (slot.type !== "class") {
                      return (
                        <th
                          key={idx}
                          style={{ ...styles.th, background: "#fde68a" }}
                        >
                          {slot.label}
                        </th>
                      );
                    }
                    if (slot.labSpan > 1) {
                      // Show combined time range in header
                      return (
                        <th
                          key={idx}
                          colSpan={slot.labSpan}
                          style={{ ...styles.th, background: "#e0e7ff" }}
                        >
                          LAB BLOCK
                        </th>
                      );
                    }
                    return (
                      <th key={idx} style={styles.th}>
                        {slot.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <td style={styles.dayCell}>{day}</td>
                    {matrix[day].map((cell, idx) => {
                      // Skip cells that are part of a merged lab block
                      if (cell.labSkip) return null;

                      if (cell.type === "lunch" || cell.type === "break") {
                        return (
                          <td key={idx} style={styles.breakCell}>
                            {cell.label}
                          </td>
                        );
                      }

                      // Lab cell with colspan
                      if (cell.labSpan > 1) {
                        const isConflicted = conflicts.some(
                          (c) =>
                            c.includes(`on ${day}`) && c.includes(cell.label)
                        );
                        return (
                          <td
                            key={idx}
                            colSpan={cell.labSpan}
                            draggable
                            onDragStart={() => handleDragStart(day, cell.label)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(day, cell.label)}
                            style={{
                              ...styles.labCell,
                              background: subjectColor(cell.subject),
                              outline: isConflicted
                                ? "2px solid #ef4444"
                                : "none",
                            }}
                            title={cell.subject}
                          >
                            {isConflicted && (
                              <span
                                style={{
                                  color: "#ef4444",
                                  fontSize: "0.7rem",
                                  display: "block",
                                }}
                              >
                                ⚠️
                              </span>
                            )}
                            <span style={styles.labBadge}>🔬 LAB</span>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                marginTop: 4,
                              }}
                            >
                              {cell.subject}
                            </div>
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "#64748b",
                                marginTop: 2,
                              }}
                            >
                              {cell.labSpan} consecutive slots
                            </div>
                          </td>
                        );
                      }

                      // Regular theory cell
                      const isConflicted = conflicts.some(
                        (c) => c.includes(`on ${day}`) && c.includes(cell.label)
                      );
                      return (
                        <td
                          key={idx}
                          draggable
                          onDragStart={() => handleDragStart(day, cell.label)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(day, cell.label)}
                          style={{
                            ...styles.classCell,
                            background: subjectColor(cell.subject),
                            outline: isConflicted
                              ? "2px solid #ef4444"
                              : "none",
                          }}
                          title={
                            isConflicted
                              ? "⚠️ Conflict detected here"
                              : cell.subject
                          }
                        >
                          {isConflicted && (
                            <span
                              style={{
                                color: "#ef4444",
                                fontSize: "0.7rem",
                                display: "block",
                              }}
                            >
                              ⚠️
                            </span>
                          )}
                          {cell.subject === "-" ? (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          ) : (
                            cell.subject
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MODIFICATION PANEL */}
          <div style={{ ...styles.card, marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>
              ✏️ Request Changes (Natural Language)
            </h3>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.85rem",
                marginBottom: 12,
              }}
            >
              Describe what you want to change — the AI will apply it while
              respecting all constraints.
            </p>
            <textarea
              value={modInput}
              onChange={(e) => setModInput(e.target.value)}
              placeholder="e.g. Move Machine Learning from Monday to Wednesday…"
              style={styles.textarea}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <Button
                variant="outlined"
                onClick={handleApplyChanges}
                disabled={modLoading || !modInput.trim()}
                style={{ flex: 1 }}
              >
                {modLoading ? "Applying…" : "Apply Changes"}
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1 }}
              >
                {saving ? "Saving…" : "💾 Save Timetable"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  card: {
    background: "#fff",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 600,
    fontSize: "0.88rem",
    color: "#374151",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: "0.95rem",
    background: "#f8fafc",
    cursor: "pointer",
  },
  th: {
    border: "1px solid #e2e8f0",
    padding: "10px 8px",
    background: "#f1f5f9",
    fontSize: "0.75rem",
    fontWeight: 700,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  dayCell: {
    border: "1px solid #e2e8f0",
    padding: "10px 12px",
    fontWeight: 700,
    fontSize: "0.85rem",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  breakCell: {
    border: "1px solid #e2e8f0",
    background: "#fde68a",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "0.8rem",
    padding: "6px",
  },
  classCell: {
    border: "1px solid #e2e8f0",
    padding: "10px 8px",
    textAlign: "center",
    cursor: "grab",
    fontSize: "0.78rem",
    fontWeight: 500,
    minWidth: 90,
  },
  labCell: {
    border: "2px solid #6366f1",
    padding: "10px 12px",
    textAlign: "center",
    cursor: "grab",
    borderRadius: 4,
    verticalAlign: "middle",
  },
  labBadge: {
    display: "inline-block",
    background: "#6366f1",
    color: "#fff",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: "0.68rem",
    fontWeight: 700,
  },
  textarea: {
    width: "100%",
    minHeight: 80,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: "0.9rem",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
};

export default GenerateAI;
