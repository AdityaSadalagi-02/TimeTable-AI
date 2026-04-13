import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import Button from "@mui/material/Button";

const RoomManager = () => {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [roomType, setRoomType] = useState("Theory"); // Restored
  const [department, setDepartment] = useState("ISE"); // New input
  const [loading, setLoading] = useState(true);

  const [expandedDept, setExpandedDept] = useState(null);

  const deptOptions = ["ISE", "CSE", "ECE", "ME", "CV"];

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("room_name", { ascending: true });

    if (error) console.error("Error fetching rooms:", error);
    else setRooms(data || []);

    setTimeout(() => setLoading(false), 800);
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!roomName || !capacity) return toast.error("Fill in all the details");

    const tId = toast.loading("Registering room...");
    const { error } = await supabase.from("rooms").insert([
      {
        room_name: roomName,
        capacity: parseInt(capacity),
        room_type: roomType, // Restored
        department: department, // New input logic
      },
    ]);

    if (error) {
      toast.error("Error adding room", { id: tId });
    } else {
      setRoomName("");
      setCapacity("");
      setRoomType("Theory");
      fetchRooms();
      toast.success("Room registered", { id: tId });
    }
  };

  const deleteRoom = async (id) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Room deleted");
      fetchRooms();
    }
  };

  const toggleDept = (dept) =>
    setExpandedDept(expandedDept === dept ? null : dept);

  return (
    <div
      className="card"
      style={{ maxWidth: "1000px", margin: "20px auto", padding: "30px" }}
    >
      <div className="card-header" style={{ marginBottom: "30px" }}>
        <h2 style={{ color: "#0f172a" }}>Room Management</h2>
        <p style={{ color: "#64748b" }}>
          Define classroom capacities and specialized lab spaces per department.
        </p>
      </div>

      {/* --- FORM SECTION --- */}
      <div
        className="form-section"
        style={{
          marginBottom: "40px",
          padding: "25px",
          background: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Room Name / Number
            </label>
            <input
              type="text"
              placeholder="e.g. L-101 or Lab-3"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                marginTop: "5px",
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                marginTop: "5px",
              }}
            >
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Student Capacity
            </label>
            <input
              type="number"
              placeholder="e.g. 60"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                marginTop: "5px",
              }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: "#475569", fontWeight: "600" }}>
              Room Type
            </label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                marginTop: "5px",
              }}
            >
              <option value="Theory">Theory Classroom</option>
              <option value="Lab">Practical Lab</option>
              <option value="Seminar">Seminar Hall</option>
            </select>
          </div>
        </div>

        <Button
          variant="contained"
          onClick={handleAddRoom}
          style={{
            marginTop: "25px",
            width: "100%",
            backgroundColor: "#3b82f6",
            textTransform: "none",
            fontWeight: "600",
          }}
        >
          + Add Room to Records
        </Button>
      </div>

      {/* --- NESTED CATALOG --- */}
      <div className="list">
        <h3 style={{ color: "#0f172a", marginBottom: "20px" }}>
          Infrastructure Catalog
        </h3>

        {loading ? (
          <div className="skeleton-container">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: "56px",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "8px",
                  marginBottom: "12px",
                  animation: "pulse 1.5s infinite ease-in-out",
                }}
              />
            ))}
          </div>
        ) : (
          deptOptions.map((dept) => {
            const isDeptOpen = expandedDept === dept;
            const deptRooms = rooms.filter((r) => r.department === dept);

            return (
              <div
                key={dept}
                style={{
                  marginBottom: "12px",
                  borderRadius: "8px",
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
                    style={{ margin: 0, color: "#1e293b", fontWeight: "700" }}
                  >
                    {dept} DEPARTMENT
                  </h4>
                  <span style={{ color: "#94a3b8" }}>
                    {isDeptOpen ? "▲" : "▼"}
                  </span>
                </div>

                {isDeptOpen && (
                  <div style={{ padding: "12px", background: "#f8fafc" }}>
                    {deptRooms.length === 0 ? (
                      <p
                        style={{
                          color: "#94a3b8",
                          fontSize: "0.85rem",
                          fontStyle: "italic",
                          textAlign: "center",
                          padding: "10px",
                        }}
                      >
                        No rooms registered for this department.
                      </p>
                    ) : (
                      deptRooms.map((room) => (
                        <div key={room.id} className="data-item">
                          <div className="item-info">
                            <h4>{room.room_name}</h4>
                            <p>
                              Type: <strong>{room.room_type}</strong> |
                              Capacity: <b>{room.capacity}</b> students
                            </p>
                          </div>
                          <button
                            className="btn-ghost"
                            style={{ color: "#ef4444", cursor: "pointer" }}
                            onClick={() => deleteRoom(room.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RoomManager;
