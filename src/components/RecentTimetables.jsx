import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import Button from "@mui/material/Button";
import { createSlotsWithBreaks } from "../services/aiService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
const makeColorMap = (timetable) => {
  const map = {};
  let idx = 0;
  Object.values(timetable).forEach((daySlots) => {
    Object.values(daySlots).forEach((subject) => {
      if (subject && subject !== "-" && !map[subject])
        map[subject] = PALETTE[idx++ % PALETTE.length];
    });
  });
  return map;
};

// Parse "08:00 AM" → minutes from midnight (for sorting)
const parseSlotStart = (label) => {
  const start = label.split("-")[0].trim();
  const [time, period] = start.split(" ");
  const [h, m] = time.split(":").map(Number);
  let hours = h % 12;
  if (period === "PM") hours += 12;
  return hours * 60 + m;
};

// ─────────────────────────────────────────────────────────────────────────────
const RecentTimetables = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [constraints, setConstraints] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    fetchHistory();
    fetchConstraints();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_timetables")
      .select("id, department, semester, created_at, timetable_json")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load timetables");
      console.error(error);
    } else setHistory(data || []);
    setLoading(false);
  };

  const fetchConstraints = async () => {
    const { data } = await supabase
      .from("testconstraints")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) setConstraints(data);
  };

  // Build full slot list (class + break + lunch) from constraints
  const getFullSlots = () => {
    if (!constraints) return null;
    return createSlotsWithBreaks(constraints);
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDelete = async (item) => {
    if (
      !window.confirm(
        `Delete timetable for ${item.department} Sem ${
          item.semester
        } (${formatDate(item.created_at)})?`
      )
    )
      return;

    setDeleting(item.id);
    const tid = toast.loading("Deleting…");
    try {
      await supabase.from("room_bookings").delete().eq("timetable_id", item.id);
      const { error } = await supabase
        .from("saved_timetables")
        .delete()
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      toast.success("Timetable deleted", { id: tid });
      fetchHistory();
    } catch (err) {
      toast.error(err.message, { id: tid });
    } finally {
      setDeleting(null);
    }
  };

  // ── FORMAT DATE ───────────────────────────────────────────────────────────
  const formatDate = (ds) =>
    new Date(ds).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ── DOWNLOAD as PDF ───────────────────────────────────────────────────────
  const handleDownload = async (item) => {
    const tt = item.timetable_json;
    if (!tt) return toast.error("No timetable data");
    const tid = toast.loading("Generating PDF…");

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Full slots including break/lunch
      const fullSlots = getFullSlots();
      // Class-only slot labels sorted chronologically
      const firstDay = DAYS.find((d) => tt[d]) || DAYS[0];
      const classSlotKeys = [...Object.keys(tt[firstDay] || {})].sort(
        (a, b) => parseSlotStart(a) - parseSlotStart(b)
      );

      // Build ordered column list: interleave break/lunch in correct positions
      const columns = buildOrderedColumns(fullSlots, classSlotKeys);

      // Detect lab labels
      const labLabels = detectLabLabels(tt);

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${item.department} — Semester ${item.semester} Timetable`,
        14,
        16
      );
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${formatDate(item.created_at)}`, 14, 22);
      doc.setTextColor(0);

      // Build head row
      const headRow = [
        "Day",
        ...columns.map((c) => (c.type !== "class" ? c.label : c.label)),
      ];
      const head = [headRow];

      // Build body rows
      const body = DAYS.map((day) => {
        const cells = columns.map((col) => {
          if (col.type === "break") return "BREAK";
          if (col.type === "lunch") return "LUNCH";
          return tt[day]?.[col.label] || "—";
        });
        return [day, ...cells];
      });

      const colorMap = {};
      const hexPalette = [
        [219, 234, 254],
        [220, 252, 231],
        [254, 249, 195],
        [252, 231, 243],
        [237, 233, 254],
        [255, 237, 213],
        [224, 242, 254],
        [209, 250, 229],
        [254, 243, 199],
        [243, 232, 255],
      ];
      let ci = 0;
      body.forEach((row) =>
        row.slice(1).forEach((val) => {
          if (
            val &&
            val !== "—" &&
            val !== "BREAK" &&
            val !== "LUNCH" &&
            !colorMap[val]
          )
            colorMap[val] = hexPalette[ci++ % hexPalette.length];
        })
      );

      autoTable(doc, {
        head,
        body,
        startY: 28,
        styles: {
          fontSize: 7.5,
          cellPadding: 3,
          halign: "center",
          valign: "middle",
          lineColor: [226, 232, 240],
          lineWidth: 0.3,
          overflow: "linebreak",
          minCellHeight: 12,
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          fontStyle: "bold",
          fontSize: 7,
        },
        columnStyles: {
          0: {
            fontStyle: "bold",
            fillColor: [248, 250, 252],
            halign: "left",
            cellWidth: 22,
          },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 0) {
            const val = data.cell.raw;
            if (val === "BREAK" || val === "LUNCH") {
              data.cell.styles.fillColor = [253, 230, 138];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = [120, 80, 0];
            } else if (val && val !== "—") {
              if (labLabels.has(val)) {
                data.cell.styles.fillColor = [224, 231, 255];
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.textColor = [67, 56, 202];
              } else {
                data.cell.styles.fillColor = colorMap[val] || [255, 255, 255];
              }
            }
          }
          // Style break/lunch header cells
          if (data.section === "head" && data.column.index > 0) {
            const label = data.cell.raw;
            if (label === "BREAK" || label === "LUNCH") {
              data.cell.styles.fillColor = [253, 230, 138];
              data.cell.styles.textColor = [120, 80, 0];
            }
          }
        },
        theme: "grid",
        margin: { left: 10, right: 10 },
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: "center" }
        );
      }

      doc.save(`Timetable_${item.department}_Sem${item.semester}.pdf`);
      toast.success("PDF downloaded!", { id: tid });
    } catch (err) {
      console.error(err);
      toast.error("PDF generation failed: " + err.message, { id: tid });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS shared between modal & PDF
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Merge the full slots list (which has break/lunch markers) with the
   * sorted class slot keys from the saved timetable.
   * Returns an ordered array of { type, label } for every column.
   */
  const buildOrderedColumns = (fullSlots, classSlotKeys) => {
    if (!fullSlots) {
      // No constraints loaded yet — just show class slots
      return classSlotKeys.map((label) => ({ type: "class", label }));
    }
    // fullSlots already in correct day order; map class slots in order
    const result = [];
    let classIdx = 0;
    for (const slot of fullSlots) {
      if (slot.type === "class") {
        if (classIdx < classSlotKeys.length) {
          result.push({ type: "class", label: classSlotKeys[classIdx++] });
        }
      } else {
        result.push({ type: slot.type, label: slot.label }); // BREAK or LUNCH
      }
    }
    return result;
  };

  /** Detect which values in the timetable are lab blocks (appear consecutively) */
  const detectLabLabels = (tt) => {
    const labLabels = new Set();
    DAYS.forEach((day) => {
      const keys = Object.keys(tt[day] || {}).sort(
        (a, b) => parseSlotStart(a) - parseSlotStart(b)
      );
      for (let i = 0; i < keys.length - 1; i++) {
        const v = tt[day][keys[i]];
        if (v && v !== "-" && v === tt[day][keys[i + 1]]) labLabels.add(v);
      }
    });
    return labLabels;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TIMETABLE VIEWER MODAL
  // ─────────────────────────────────────────────────────────────────────────
  const TimetableModal = ({ item, onClose }) => {
    const tt = item.timetable_json || {};
    const colorMap = makeColorMap(tt);

    const firstDay = DAYS.find((d) => tt[d]) || DAYS[0];
    const classSlotKeys = [...Object.keys(tt[firstDay] || {})].sort(
      (a, b) => parseSlotStart(a) - parseSlotStart(b)
    );

    const fullSlots = getFullSlots();
    const columns = buildOrderedColumns(fullSlots, classSlotKeys);
    const labLabels = detectLabLabels(tt);

    // Build one row — handles lab colspan, skips break/lunch in body (they get their own td)
    const buildRow = (day) => {
      const cells = [];
      let skipCount = 0;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];

        if (col.type === "break" || col.type === "lunch") {
          cells.push({ colType: col.type, label: col.label });
          continue;
        }

        if (skipCount > 0) {
          skipCount--;
          continue;
        }

        const subject = tt[day]?.[col.label] || "-";
        const isLab = labLabels.has(subject);
        let span = 1;

        if (isLab) {
          // Count how many consecutive class columns share this value
          for (let j = i + 1; j < columns.length; j++) {
            if (columns[j].type !== "class") break;
            if ((tt[day]?.[columns[j].label] || "-") !== subject) break;
            span++;
          }
          skipCount = span - 1;
        }

        cells.push({
          colType: "class",
          label: col.label,
          subject,
          span,
          isLab,
        });
      }
      return cells;
    };

    return (
      <div style={modal.overlay} onClick={onClose}>
        <div style={modal.box} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={modal.header}>
            <div>
              <h2 style={{ margin: 0 }}>
                📅 {item.department} — Semester {item.semester}
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "0.85rem",
                }}
              >
                Generated on {formatDate(item.created_at)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleDownload(item)}
              >
                ⬇ Download PDF
              </Button>
              <button onClick={onClose} style={modal.closeBtn}>
                ✕
              </button>
            </div>
          </div>

          {/* Grid */}
          <div style={{ overflowX: "auto", marginTop: 16 }} ref={printRef}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                minWidth: 700,
              }}
            >
              <thead>
                <tr>
                  <th style={tStyle.th}>Day</th>
                  {columns.map((col, idx) => {
                    if (col.type === "break" || col.type === "lunch") {
                      return (
                        <th
                          key={idx}
                          style={{
                            ...tStyle.th,
                            background: "#fde68a",
                            color: "#92400e",
                            minWidth: 60,
                          }}
                        >
                          {col.label}
                        </th>
                      );
                    }
                    return (
                      <th key={idx} style={tStyle.th}>
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <td style={tStyle.dayCell}>{day}</td>
                    {buildRow(day).map((cell, idx) => {
                      // Break / Lunch cell
                      if (
                        cell.colType === "break" ||
                        cell.colType === "lunch"
                      ) {
                        return (
                          <td key={idx} style={tStyle.breakCell}>
                            {cell.label}
                          </td>
                        );
                      }
                      // Lab cell (colspan)
                      if (cell.isLab) {
                        return (
                          <td
                            key={idx}
                            colSpan={cell.span}
                            style={{
                              ...tStyle.labCell,
                              background: colorMap[cell.subject] || "#e0e7ff",
                            }}
                          >
                            {cell.subject}
                          </td>
                        );
                      }
                      // Regular theory cell
                      return (
                        <td
                          key={idx}
                          style={{
                            ...tStyle.cell,
                            background:
                              cell.subject === "-"
                                ? "#f8fafc"
                                : colorMap[cell.subject] || "#fff",
                          }}
                        >
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
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="card">
      <div className="card-header">
        <h2>Recent Timetables</h2>
        <p>Manage previously generated timetables.</p>
      </div>

      <div style={{ marginTop: 24 }}>
        {loading ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="skeleton-box"
                style={{ marginBottom: 12, height: 60, borderRadius: 10 }}
              />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📭</div>
            <p style={{ color: "#94a3b8", fontSize: "1rem" }}>
              No saved timetables yet. Generate one first!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {history.map((item) => (
              <div key={item.id} style={listCard}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flex: 1,
                  }}
                >
                  <div style={deptBadge}>
                    <span style={{ fontWeight: 800, fontSize: "1rem" }}>
                      {item.department}
                    </span>
                    <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                      Sem {item.semester}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>
                      {item.department} — Semester {item.semester}
                    </div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "#64748b",
                        marginTop: 2,
                      }}
                    >
                      🕐 {formatDate(item.created_at)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    style={{
                      ...actionBtn,
                      color: "#4f46e5",
                      borderColor: "#c7d2fe",
                    }}
                    onClick={() => setViewItem(item)}
                  >
                    👁 View
                  </button>
                  <button
                    style={{
                      ...actionBtn,
                      color: "#059669",
                      borderColor: "#a7f3d0",
                    }}
                    onClick={() => handleDownload(item)}
                  >
                    ⬇ Download PDF
                  </button>
                  <button
                    style={{
                      ...actionBtn,
                      color: "#ef4444",
                      borderColor: "#fecaca",
                      opacity: deleting === item.id ? 0.5 : 1,
                    }}
                    disabled={deleting === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    {deleting === item.id ? "…" : "🗑 Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewItem && (
        <TimetableModal item={viewItem} onClose={() => setViewItem(null)} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const listCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  flexWrap: "wrap",
  gap: 12,
};
const deptBadge = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#6366f1,#4f46e5)",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 14px",
  minWidth: 64,
};
const actionBtn = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid",
  background: "#fff",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 600,
  transition: "opacity .15s",
};
const modal = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  box: {
    background: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 1200,
    maxHeight: "92vh",
    overflowY: "auto",
    padding: 28,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  closeBtn: {
    background: "#f1f5f9",
    border: "none",
    borderRadius: 8,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontSize: "1rem",
  },
};
const tStyle = {
  th: {
    border: "1px solid #e2e8f0",
    padding: "8px 10px",
    background: "#f1f5f9",
    fontSize: "0.72rem",
    fontWeight: 700,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  dayCell: {
    border: "1px solid #e2e8f0",
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: "0.82rem",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  cell: {
    border: "1px solid #e2e8f0",
    padding: "10px 8px",
    textAlign: "center",
    fontSize: "0.75rem",
    fontWeight: 500,
  },
  breakCell: {
    border: "1px solid #e2e8f0",
    background: "#fde68a",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "0.78rem",
    padding: "6px 8px",
    color: "#92400e",
  },
  labCell: {
    border: "2px solid #6366f1",
    padding: "10px 12px",
    textAlign: "center",
    borderRadius: 4,
  },
  labBadge: {
    display: "inline-block",
    background: "#6366f1",
    color: "#fff",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: "0.65rem",
    fontWeight: 700,
  },
};

export default RecentTimetables;
