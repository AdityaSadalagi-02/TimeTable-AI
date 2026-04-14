import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import toast from "react-hot-toast";
import Button from "@mui/material/Button";

const TeacherManager = () => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]); // teachers + their linked subjects
  const [subjects, setSubjects] = useState([]); // all subjects (for dropdown)

  // Form state
  const [name, setName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    // Fetch teachers with their teacher_subjects rows (joined to subjects)
    const { data: teacherData, error: te } = await supabase
      .from("teachers")
      .select(
        "id, name, subject_code, created_at, teacher_subjects(id, subject_id, subjects(id, subject_name, subject_code, department, semester))"
      )
      .order("created_at", { ascending: false });

    if (te) console.error("Error fetching teachers:", te);
    else setTeachers(teacherData || []);

    // Fetch all subjects for the dropdown / autocomplete
    const { data: subData } = await supabase
      .from("subjects")
      .select("id, subject_name, subject_code, department, semester")
      .order("subject_code", { ascending: true });

    setSubjects(subData || []);
    setLoading(false);
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!name.trim() || !subjectCode.trim())
      return toast.error("Please fill in the details.");

    const code = subjectCode.toUpperCase().trim();

    // Find subject(s) matching the code
    const matched = subjects.filter(
      (s) => s.subject_code?.toUpperCase() === code
    );

    if (matched.length === 0)
      return toast.error(
        `No subject found with code "${code}". Add the subject first.`
      );

    const tid = toast.loading("Adding teacher…");

    // 1. Insert into teachers
    const { data: newTeacher, error: te } = await supabase
      .from("teachers")
      .insert([{ name: name.trim(), subject_code: code }])
      .select()
      .single();

    if (te)
      return toast.error("Failed to add teacher: " + te.message, { id: tid });

    // 2. Insert into teacher_subjects for every subject with this code
    const links = matched.map((s) => ({
      teacher_id: newTeacher.id,
      subject_id: s.id,
    }));

    const { error: le } = await supabase.from("teacher_subjects").insert(links);
    if (le) console.warn("teacher_subjects link warn:", le.message);

    setName("");
    setSubjectCode("");
    await fetchAll();
    toast.success(`Teacher added successfully.`, { id: tid });
  };

  const handleDelete = async (teacher) => {
    const tid = toast.loading("Removing teacher…");
    // Delete teacher_subjects links first
    await supabase
      .from("teacher_subjects")
      .delete()
      .eq("teacher_id", teacher.id);
    const { error } = await supabase
      .from("teachers")
      .delete()
      .eq("id", teacher.id);
    if (error) return toast.error("Could not delete teacher", { id: tid });
    toast.success("Teacher removed", { id: tid });
    fetchAll();
  };

  // Group unique subject codes for datalist autocomplete
  const uniqueCodes = [
    ...new Set(subjects.map((s) => s.subject_code).filter(Boolean)),
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h2>Faculty Management</h2>
        <p>Add teachers and link them to subjects via subject code.</p>
      </div>

      {/* ── FORM ── */}
      <div style={{ marginBottom: 30 }}>
        <div className="grid-2">
          <div className="form-group">
            <label>Teacher Name</label>
            <input
              type="text"
              placeholder="e.g. Prof. Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
            {/* Datalist for autocomplete */}
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
            {/* Live preview of matched subject */}
            {subjectCode.trim().length >= 2 &&
              (() => {
                const found = subjects.filter(
                  (s) =>
                    s.subject_code?.toUpperCase() ===
                    subjectCode.toUpperCase().trim()
                );
                return found.length > 0 ? (
                  <div style={{ marginTop: 6 }}>
                    {found.map((s) => (
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
                );
              })()}
          </div>
        </div>

        <Button onClick={handleAddTeacher} variant="contained">
          + Add Teacher to Records
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
            // Collect linked subjects from teacher_subjects join
            const linked = (teacher.teacher_subjects || [])
              .map((ts) => ts.subjects)
              .filter(Boolean);

            return (
              <div key={teacher.id} className="data-item">
                <div className="item-info">
                  <h4>{teacher.name}</h4>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Subject code badge */}
                    <span
                      style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {teacher.subject_code || "—"}
                    </span>
                    {/* Linked subject names */}
                    {linked.length > 0 ? (
                      linked.map((s) => (
                        <span
                          key={s.id}
                          style={{
                            background: "#f0fdf4",
                            color: "#15803d",
                            border: "1px solid #bbf7d0",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: "0.75rem",
                          }}
                        >
                          {s.subject_name}
                          <span
                            style={{
                              color: "#94a3b8",
                              marginLeft: 4,
                              fontSize: "0.7rem",
                            }}
                          >
                            {s.department} Sem {s.semester}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#f59e0b", fontSize: "0.78rem" }}>
                        ⚠ No subject linked
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ color: "#ef4444", cursor: "pointer" }}
                  onClick={() => handleDelete(teacher)}
                >
                  Delete
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TeacherManager;
