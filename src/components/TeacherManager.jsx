import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import toast from "react-hot-toast";
import Button from "@mui/material/Button";

const TeacherManager = () => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [name, setName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    // Each teacher row + all their subject assignments via teacher_subjects
    const { data: teacherData, error: te } = await supabase
      .from("teachers")
      .select(
        `
        id, name, created_at,
        teacher_subjects (
          id,
          subject_id,
          subjects ( id, subject_name, subject_code, department, semester )
        )
      `
      )
      .order("name", { ascending: true });

    if (te) console.error("Error fetching teachers:", te);
    else setTeachers(teacherData || []);

    const { data: subData } = await supabase
      .from("subjects")
      .select("id, subject_name, subject_code, department, semester")
      .order("subject_code", { ascending: true });

    setSubjects(subData || []);
    setLoading(false);
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    if (!name.trim() || !subjectCode.trim())
      return toast.error("Please fill in Teacher Name and Subject Code.");

    const cleanName = name.trim();
    const code = subjectCode.toUpperCase().trim();

    // Find matching subjects
    const matched = subjects.filter(
      (s) => s.subject_code?.toUpperCase() === code
    );
    if (matched.length === 0)
      return toast.error(
        `No subject found with code "${code}". Register the subject first.`
      );

    const tid = "add-teacher-toast";

    // ── Step 1: Find or create teacher ──────────────────────────────────────
    let teacherId = null;

    const { data: existing } = await supabase
      .from("teachers")
      .select("id, name")
      .ilike("name", cleanName) // case-insensitive match
      .maybeSingle();

    if (existing) {
      // Teacher already exists — reuse their id
      teacherId = existing.id;
    } else {
      // New teacher — insert
      const { data: created, error: ce } = await supabase
        .from("teachers")
        .insert([{ name: cleanName }])
        .select()
        .single();

      if (ce)
        return toast.error("Failed to create teacher: " + ce.message, {
          id: tid,
        });
      teacherId = created.id;
    }

    // ── Step 2: Link teacher → subjects (skip duplicates) ───────────────────
    // Fetch existing links for this teacher
    const { data: existingLinks } = await supabase
      .from("teacher_subjects")
      .select("subject_id")
      .eq("teacher_id", teacherId);

    const alreadyLinked = new Set(
      (existingLinks || []).map((l) => l.subject_id)
    );

    const newLinks = matched
      .filter((s) => !alreadyLinked.has(s.id))
      .map((s) => ({ teacher_id: teacherId, subject_id: s.id }));

    const skipped = matched.length - newLinks.length;

    if (newLinks.length === 0) {
      toast(
        `"${cleanName}" is already assigned to all subjects with code ${code}.`,
        {
          id: tid,
          icon: "ℹ️",
          duration: 4000,
        }
      );
      setName("");
      setSubjectCode("");
      return;
    }

    const { error: le } = await supabase
      .from("teacher_subjects")
      .insert(newLinks);
    if (le)
      return toast.error("Failed to link subjects: " + le.message, { id: tid });

    // Dismiss spinner FIRST before any async work
    const msg =
      skipped > 0
        ? `Linked ${newLinks.length} subject(s) to "${cleanName}" (${skipped} already existed).`
        : `"${cleanName}" linked to ${newLinks.length} subject(s) with code ${code}.`;

    toast.success("Teacher added successfully");
    setName("");
    setSubjectCode("");
    fetchAll(); // no await — let it refresh in background
  };

  // ── REMOVE A SINGLE SUBJECT LINK ──────────────────────────────────────────
  // Removes just the teacher_subjects row.
  // If it was the teacher's last link, also removes the teacher row itself.
  const handleRemoveLink = async (teacher, linkId, isLastLink) => {
    const tid = "remove-link-toast";

    const { error } = await supabase
      .from("teacher_subjects")
      .delete()
      .eq("id", linkId);

    if (error) return toast.error("Could not remove assignment", { id: tid });

    if (isLastLink) {
      await supabase.from("teachers").delete().eq("id", teacher.id);
      toast.success(`"${teacher.name}" fully removed (no subjects left).`, {
        id: tid,
      });
    } else {
      toast.success("Subject assignment removed.", { id: tid });
    }

    fetchAll(); // background refresh
  };

  // ── DELETE ENTIRE TEACHER (all links + teacher row) ───────────────────────
  const handleDeleteTeacher = async (teacher) => {
    if (
      !window.confirm(
        `Remove "${teacher.name}" and all their subject assignments?`
      )
    )
      return;
    const tid = "delete-teacher-toast";
    await supabase
      .from("teacher_subjects")
      .delete()
      .eq("teacher_id", teacher.id);
    const { error } = await supabase
      .from("teachers")
      .delete()
      .eq("id", teacher.id);
    if (error) return toast.error("Could not delete teacher", { id: tid });
    toast.success(`"${teacher.name}" removed.`, { id: tid });
    fetchAll(); // background refresh
  };

  // Unique subject codes for autocomplete
  const uniqueCodes = [
    ...new Set(subjects.map((s) => s.subject_code).filter(Boolean)),
  ];

  // Live preview — subjects matching current input code
  const previewSubjects =
    subjectCode.trim().length >= 2
      ? subjects.filter(
          (s) =>
            s.subject_code?.toUpperCase() === subjectCode.toUpperCase().trim()
        )
      : [];

  // Live preview — does teacher already exist?
  const existingTeacherPreview =
    name.trim().length >= 2
      ? teachers.find((t) => t.name.toLowerCase() === name.trim().toLowerCase())
      : null;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Faculty Management</h2>
        <p>
          Each teacher is one record. Assign multiple subjects to the same
          teacher by entering their name again — no duplicate records created.
        </p>
      </div>

      {/* ── FORM ── */}
      <div
        style={{
          marginBottom: 30,
          padding: 20,
          background: "#f8fafc",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <div className="grid-2">
          {/* Teacher name */}
          <div className="form-group">
            <label>Teacher Name</label>
            <input
              type="text"
              placeholder="e.g. Prof. JDP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="teacher-name-list"
            />
            {/* Autocomplete from existing teachers */}
            <datalist id="teacher-name-list">
              {teachers.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>

            {/* Preview: show if teacher already exists */}
            {existingTeacherPreview ? (
              <p
                style={{
                  marginTop: 5,
                  color: "#4f46e5",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                ↩ Existing teacher found — new subject will be added to their
                record
              </p>
            ) : name.trim().length >= 2 ? (
              <p
                style={{ marginTop: 5, color: "#059669", fontSize: "0.78rem" }}
              >
                ✦ New teacher will be created
              </p>
            ) : null}
          </div>

          {/* Subject code */}
          <div className="form-group">
            <label>
              Subject Code{" "}
              <span
                style={{
                  color: "#64748b",
                  fontWeight: 400,
                  fontSize: "0.82rem",
                }}
              >
                (must match a registered subject)
              </span>
            </label>
            <input
              type="text"
              placeholder="e.g. CS601"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              list="subject-code-list"
              style={{ textTransform: "uppercase" }}
            />
            <datalist id="subject-code-list">
              {uniqueCodes.map((code) => {
                const sub = subjects.find((s) => s.subject_code === code);
                return (
                  <option key={code} value={code}>
                    {sub
                      ? `${sub.subject_name} (${sub.department} Sem ${sub.semester})`
                      : code}
                  </option>
                );
              })}
            </datalist>

            {/* Live subject match preview */}
            {subjectCode.trim().length >= 2 &&
              (previewSubjects.length > 0 ? (
                <div style={{ marginTop: 6 }}>
                  {previewSubjects.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        display: "inline-block",
                        marginRight: 6,
                        marginTop: 4,
                        background: "#dcfce7",
                        color: "#15803d",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      ✓ {s.subject_name} — {s.department} Sem {s.semester}
                    </span>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    marginTop: 5,
                    color: "#ef4444",
                    fontSize: "0.78rem",
                  }}
                >
                  ✗ No subject found with this code
                </p>
              ))}
          </div>
        </div>

        <Button
          onClick={handleAddAssignment}
          variant="contained"
          style={{ marginTop: 16 }}
        >
          + Assign Subject to Teacher
        </Button>
      </div>

      {/* ── LIST ── */}
      <div className="list">
        <h3>Current Faculty ({teachers.length})</h3>

        {loading ? (
          <div style={{ marginTop: 15 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-box" />
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginTop: 10 }}>
            No teachers added yet.
          </p>
        ) : (
          teachers.map((teacher) => {
            const links = teacher.teacher_subjects || [];
            const linked = links.map((ts) => ts.subjects).filter(Boolean);

            return (
              <div
                key={teacher.id}
                style={{
                  marginBottom: 12,
                  padding: "14px 16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >
                {/* Teacher name row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        flexShrink: 0,
                      }}
                    >
                      {teacher.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "0.95rem",
                          color: "#1e293b",
                        }}
                      >
                        {teacher.name}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.75rem",
                          color: "#94a3b8",
                        }}
                      >
                        ID : <b>{teacher.id}</b> | Subjects : <b>{links.length}</b>
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-ghost"
                    style={{
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                    onClick={() => handleDeleteTeacher(teacher)}
                  >
                    Delete All
                  </button>
                </div>

                {/* Subject assignments */}
                <div style={{ marginTop: 10, paddingLeft: 46 }}>
                  {linked.length === 0 ? (
                    <span style={{ color: "#f59e0b", fontSize: "0.78rem" }}>
                      ⚠ No subjects assigned
                    </span>
                  ) : (
                    linked.map((s, idx) => {
                      const linkId = links[idx]?.id;
                      const isLastLink = links.length === 1;
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 10px",
                            marginBottom: 6,
                            background: "#f8fafc",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                padding: "2px 7px",
                                borderRadius: 5,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                              }}
                            >
                              {s.subject_code}
                            </span>
                            <span
                              style={{
                                fontSize: "0.85rem",
                                color: "#1e293b",
                                fontWeight: 500,
                              }}
                            >
                              {s.subject_name}
                            </span>
                            <span
                              style={{ fontSize: "0.72rem", color: "#94a3b8" }}
                            >
                              {s.department} · Sem {s.semester}
                            </span>
                          </div>
                          <button
                            className="btn-ghost"
                            style={{
                              color: "#ef4444",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              handleRemoveLink(teacher, linkId, isLastLink)
                            }
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeacherManager;
