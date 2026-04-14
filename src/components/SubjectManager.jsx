import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import Button from "@mui/material/Button";

const SubjectManager = () => {
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [isLab, setIsLab] = useState(false);
  const [semester, setSemester] = useState("1");
  const [department, setDepartment] = useState("ISE");
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState(null);
  const [expandedSem, setExpandedSem] = useState(null);

  const deptOptions = ["ISE", "CSE", "ECE", "ME", "CV"];
  const semOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("subject_name", { ascending: true });
    if (error) console.error("Error fetching subjects:", error);
    else setSubjects(data || []);
    setTimeout(() => setLoading(false), 500);
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!subjectName || !subjectCode || !weeklyHours)
      return toast.error("Please fill in Subject Name, Code and Credits.");

    const tid = toast.loading("Saving subject...");
    const { error } = await supabase.from("subjects").insert([
      {
        subject_name: subjectName,
        subject_code: subjectCode.toUpperCase().trim(),
        weekly_hours: parseFloat(weeklyHours),
        is_lab: isLab,
        semester: parseInt(semester),
        department,
      },
    ]);

    if (error) {
      toast.error(error.message || "Failed to save", { id: tid });
    } else {
      setSubjectName("");
      setSubjectCode("");
      setWeeklyHours("");
      setIsLab(false);
      fetchSubjects();
      toast.success("Subject added!", { id: tid });
    }
  };

  const deleteSubject = async (id) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) toast.error("Could not delete subject");
    else {
      fetchSubjects();
      toast.success("Subject removed");
    }
  };

  const toggleDept = (dept) =>
    setExpandedDept(expandedDept === dept ? null : dept);
  const toggleSem = (dept, sem) => {
    const key = `${dept}-${sem}`;
    setExpandedSem(expandedSem === key ? null : key);
  };

  const inp = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    marginTop: "5px",
    fontSize: "0.95rem",
  };

  return (
    <div
      className="card"
      style={{ maxWidth: "1000px", margin: "20px auto", padding: "30px" }}
    >
      <div className="card-header" style={{ marginBottom: "30px" }}>
        <h2 style={{ color: "#0f172a" }}>Subject Management</h2>
        <p style={{ color: "#64748b" }}>
          Define curriculum requirements and credits per department.
        </p>
      </div>

      {/* ── FORM ── */}
      <div
        style={{
          marginBottom: "40px",
          padding: "25px",
          background: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Row 1 — Name + Code */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Subject Name
            </label>
            <input
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Operating Systems"
              style={inp}
            />
          </div>
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Subject Code <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder="e.g. CS601"
              style={inp}
            />
          </div>
        </div>

        {/* Row 2 — Dept + Sem + Credits */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={inp}
            >
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              style={inp}
            >
              {semOptions.map((s) => (
                <option key={s} value={s}>
                  {s} Semester
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Weekly Hours
            </label>
            <input
              type="number"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              placeholder="e.g. 4"
              style={inp}
            />
          </div>
        </div>

        {/* Lab checkbox */}
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <input
            type="checkbox"
            id="labCheck"
            checked={isLab}
            onChange={(e) => setIsLab(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              cursor: "pointer",
              accentColor: "#4f46e5",
            }}
          />
          <label
            htmlFor="labCheck"
            style={{ color: "#475569", cursor: "pointer", fontWeight: 600 }}
          >
            Practical / Lab Subject
          </label>
        </div>

        <Button
          variant="contained"
          onClick={handleAddSubject}
          style={{
            marginTop: "25px",
            width: "100%",
            backgroundColor: "#3b82f6",
            textTransform: "none",
            fontWeight: "600",
          }}
        >
          Register Subject
        </Button>
      </div>

      {/* ── CATALOG ── */}
      <div className="list">
        <h3 style={{ color: "#0f172a", marginBottom: "20px" }}>
          Academic Catalog
        </h3>

        {loading
          ? [1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: 56,
                  backgroundColor: "#f1f5f9",
                  borderRadius: 8,
                  marginBottom: 12,
                }}
                className="skeleton-box"
              />
            ))
          : deptOptions.map((dept) => {
              const isDeptOpen = expandedDept === dept;
              const deptSubjects = subjects.filter(
                (s) => s.department === dept
              );
              return (
                <div
                  key={dept}
                  style={{
                    marginBottom: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    onClick={() => toggleDept(dept)}
                    style={{
                      padding: "16px 20px",
                      background: isDeptOpen ? "#f1f5f9" : "#fff",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderLeft: `5px solid ${
                        isDeptOpen ? "#3b82f6" : "#cbd5e1"
                      }`,
                    }}
                  >
                    <h4
                      style={{ margin: 0, color: "#1e293b", fontWeight: 700 }}
                    >
                      {dept} DEPARTMENT
                    </h4>
                    <span style={{ color: "#94a3b8" }}>
                      {isDeptOpen ? "▲" : "▼"}
                    </span>
                  </div>

                  {isDeptOpen && (
                    <div style={{ padding: 12, background: "#f8fafc" }}>
                      {semOptions.map((sem) => {
                        const semKey = `${dept}-${sem}`;
                        const isSemOpen = expandedSem === semKey;
                        const finalSubjects = deptSubjects.filter(
                          (s) => s.semester === sem
                        );
                        return (
                          <div
                            key={sem}
                            style={{
                              marginBottom: 8,
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              overflow: "hidden",
                              background: "#fff",
                            }}
                          >
                            <div
                              onClick={() => toggleSem(dept, sem)}
                              style={{
                                padding: "12px 15px",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                background: isSemOpen ? "#f1f5f9" : "#fff",
                                alignItems: "center",
                              }}
                            >
                              <h4
                                style={{
                                  margin: 0,
                                  color: "#475569",
                                  fontWeight: 600,
                                }}
                              >
                                Semester {sem}
                              </h4>
                              <span
                                style={{ fontSize: "0.7rem", color: "#94a3b8" }}
                              >
                                {isSemOpen ? "▲" : "▼"}
                              </span>
                            </div>

                            {isSemOpen && (
                              <div style={{ padding: 10 }}>
                                {finalSubjects.length === 0 ? (
                                  <p
                                    style={{
                                      color: "#94a3b8",
                                      fontSize: "0.8rem",
                                      fontStyle: "italic",
                                      textAlign: "center",
                                      padding: 10,
                                    }}
                                  >
                                    No subjects registered.
                                  </p>
                                ) : (
                                  finalSubjects.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className="data-item"
                                      style={{
                                        marginBottom: 8,
                                        padding: 12,
                                        border: "1px solid #f1f5f9",
                                        borderRadius: 6,
                                      }}
                                    >
                                      <div className="item-info">
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <h4
                                            style={{
                                              margin: 0,
                                              fontSize: "0.95rem",
                                            }}
                                          >
                                            {sub.subject_name}
                                          </h4>
                                          {/* Subject code badge */}
                                          <span
                                            style={{
                                              background: "#eff6ff",
                                              color: "#1d4ed8",
                                              padding: "2px 8px",
                                              borderRadius: 6,
                                              fontSize: "0.72rem",
                                              fontWeight: 700,
                                              letterSpacing: "0.5px",
                                            }}
                                          >
                                            {sub.subject_code || "—"}
                                          </span>
                                          {sub.is_lab && (
                                            <span
                                              style={{
                                                backgroundColor: "#fee2e2",
                                                color: "#b91c1c",
                                                padding: "2px 8px",
                                                borderRadius: 12,
                                                fontSize: "0.65rem",
                                                fontWeight: "bold",
                                              }}
                                            >
                                              LAB
                                            </span>
                                          )}
                                        </div>
                                        <p
                                          style={{
                                            margin: "4px 0 0",
                                            fontSize: "0.85rem",
                                            color: "#64748b",
                                          }}
                                        >
                                          Credits : <b>{sub.weekly_hours}</b>
                                          &nbsp;·&nbsp; {
                                            sub.department
                                          } Sem {sub.semester}
                                        </p>
                                      </div>
                                      <button
                                        className="btn-ghost"
                                        style={{
                                          color: "#ef4444",
                                          fontSize: "0.8rem",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                        onClick={() => deleteSubject(sub.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
};

export default SubjectManager;
