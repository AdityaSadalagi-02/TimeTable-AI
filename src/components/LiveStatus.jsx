import React, { useState, useEffect } from "react";

const LiveStatus = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  const [rooms, setRooms] = useState([
    {
      id: 1,
      room: "Lab 101",
      dept: "ISE",
      subject: "DBMS",
      teacher: "Dr. Aditya",
      isOccupied: true,
    },
    {
      id: 2,
      room: "LH-202",
      dept: "ISE",
      subject: "None",
      teacher: "None",
      isOccupied: false,
    },
    {
      id: 3,
      room: "Lab 103",
      dept: "ISE",
      subject: "Web Dev",
      teacher: "Prof. Sharma",
      isOccupied: true,
    },
    {
      id: 4,
      room: "Lab 104",
      dept: "ISE",
      subject: "CN",
      teacher: "Prof. Sachin",
      isOccupied: true,
    },
    {
      id: 4,
      room: "CR-01",
      dept: "CSE",
      subject: "OS",
      teacher: "Dr. Patil",
      isOccupied: true,
    },
    {
      id: 5,
      room: "CR-02",
      dept: "CSE",
      subject: "None",
      teacher: "None",
      isOccupied: false,
    },
  ]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const departments = [...new Set(rooms.map((r) => r.dept))];

  return (
    <div className="card">
      <div
        className="card-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2>Live Status</h2>
          <p>Real-time room occupancy across departments.</p>
        </div>
        <div
          style={{
            textAlign: "right",
            background: "var(--sidebar-bg)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })}
          </div>
        </div>
      </div>

      {departments.map((dept) => (
        <div key={dept} style={{ marginTop: "30px" }}>
          <h3
            style={{
              borderLeft: "4px solid var(--primary-color)",
              paddingLeft: "15px",
              marginBottom: "20px",
              color: "var(--text-dark)",
            }}
          >
            Department of {dept}
          </h3>

          <div
            className="status-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {rooms
              .filter((r) => r.dept === dept)
              .map((room) => (
                <div
                  key={room.id}
                  className="room-card"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "20px",
                    background: room.isOccupied ? "#fff" : "#f8fafc",
                    position: "relative",
                  }}
                >
                  {room.isOccupied && <div className="blink-dot"></div>}

                  <div style={{ marginBottom: "10px" }}>
                    <h4 style={{ fontSize: "1.2rem" }}>{room.room}</h4>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "10px",
                    }}
                  >
                    {room.isOccupied ? (
                      <>
                        <div style={{ marginBottom: "5px" }}>
                          <small style={{ color: "var(--text-muted)" }}>
                            Subject:
                          </small>
                          <div
                            style={{ fontWeight: "600", fontSize: "0.9rem" }}
                          >
                            {room.subject}
                          </div>
                        </div>
                        <div>
                          <small style={{ color: "var(--text-muted)" }}>
                            Faculty:
                          </small>
                          <div
                            style={{ fontWeight: "600", fontSize: "0.9rem" }}
                          >
                            {room.teacher}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "0.85rem",
                          padding: "10px 0",
                        }}
                      >
                        No active sessions
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LiveStatus;
