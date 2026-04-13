import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const RecentTimetables = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_timetables")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching history:", error);
    else setHistory(data || []);
    setLoading(false);
  };

  const deleteRecord = async (id) => {
    const { error } = await supabase
      .from("saved_timetables")
      .delete()
      .eq("id", id);

    if (!error) fetchHistory();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Recent Timetables</h2>
        <p>View or manage previously generated academic schedules.</p>
      </div>

      <div className="list" style={{ marginTop: "20px" }}>
        {loading ? (
          <p>Loading archives...</p>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--text-muted)" }}>
              No saved timetables found.
            </p>
          </div>
        ) : (
          <table
            className="data-table"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                <th style={{ padding: "15px" }}>Semester</th>
                <th style={{ padding: "15px" }}>Generated On</th>
                <th style={{ padding: "15px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "15px" }}>
                    <strong>{item.semester} Semester</strong>
                  </td>
                  <td style={{ padding: "15px", color: "#64748b" }}>
                    {formatDate(item.created_at)}
                  </td>
                  <td style={{ padding: "15px", textAlign: "right" }}>
                    <button
                      className="btn-ghost"
                      style={{
                        color: "#4f46e5",
                        marginRight: "15px",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        alert(
                          "Logic to open and display this JSON grid goes here!"
                        )
                      }
                    >
                      View Full View
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ color: "#ef4444", cursor: "pointer" }}
                      onClick={() => deleteRecord(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecentTimetables;
