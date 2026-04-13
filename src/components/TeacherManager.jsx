import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import toast from "react-hot-toast";
import Button from "@mui/material/Button";

const TeacherManager = () => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching:", error);
    else setTeachers(data);
    setLoading(false);
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!name || !subject) {
      toast.error("Please fill in the fields");
      return;
    }

    const loadingToast = toast.loading("Adding teacher...");

    const { error } = await supabase
      .from("teachers")
      .insert([{ name, subject }]);

    if (error) {
      toast.error("Failed to add teacher", { id: loadingToast });
    } else {
      setName("");
      setSubject("");
      fetchTeachers();
      toast.success("Teacher added successfully!", { id: loadingToast });
    }
  };

  const deleteTeacher = async (id) => {
    const { error } = await supabase.from("teachers").delete().eq("id", id);

    if (error) toast.error("Could not delete teacher");
    else {
      toast.success("Teacher removed");
      fetchTeachers();
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Faculty Management</h2>
        <p>Add and manage teachers for the AI to assign.</p>
      </div>

      <div className="form-section" style={{ marginBottom: "30px" }}>
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
            <label>Subject</label>
            <input
              type="text"
              placeholder="e.g. DBMS"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>
        {
          <Button onClick={handleAddTeacher} variant="contained">
            + Add Teacher to Records
          </Button>
        }
      </div>

      <div className="list">
        <h3>Current Faculty ({teachers.length})</h3>
        {loading ? (
          <div style={{ marginTop: "15px" }}>
            <div className="skeleton-box"></div>
            <div className="skeleton-box"></div>
            <div className="skeleton-box"></div>
          </div>
        ) : teachers.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginTop: "10px" }}>
            No teachers added yet.
          </p>
        ) : (
          teachers.map((teacher) => (
            <div key={teacher.id} className="data-item">
              <div className="item-info">
                <h4>{teacher.name}</h4>
                <p>
                  Subject: <b>{teacher.subject}</b>{" "}
                </p>
              </div>
              <button
                className="btn-ghost"
                style={{ color: "#ef4444", cursor: "pointer" }}
                onClick={() => deleteTeacher(teacher.id)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherManager;
