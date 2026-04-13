import React from "react";

const Dashboard = () => {
  const departments = [
    "Information Science",
    "Computer Science",
    "Electronics & Comm.",
    "Mechanical Eng.",
    "Civil Engineering",
    "Electrical Eng.",
    "Artificial Intelligence",
    "Data Science",
  ];

  const ongoingRooms = [
    { name: "L101", dept: "ISE" },
    { name: "LH01", dept: "CSE" },
    { name: "Lab 3", dept: "ISE" },
    { name: "CR-06", dept: "ME" },
    { name: "AUDI-1", dept: "ECE" },
    { name: "LH-05", dept: "AI" },
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="header" style={{ marginBottom: "30px" }}>
        <h1>Campus Dashboard</h1>
        <p style={{ color: "var(--text-muted)" }}>
          Real-time monitoring and department status.
        </p>
      </div>

      <div className="card" style={{ marginBottom: "25px" }}>
        <div className="card-header-simple">
          <span className="icon-bg">✅</span>
          <h3>Scheduled Departments</h3>
        </div>
        <div className="split-list-container">
          <ul className="dept-column">
            {departments
              .slice(0, Math.ceil(departments.length / 2))
              .map((dept, i) => (
                <li key={i}>
                  <span className="dot-green"></span> {dept}
                </li>
              ))}
          </ul>
          <ul className="dept-column">
            {departments
              .slice(Math.ceil(departments.length / 2))
              .map((dept, i) => (
                <li key={i}>
                  <span className="dot-green"></span> {dept}
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header-simple">
          <span className="icon-bg">📡</span>
          <h3>Live Room Occupancy</h3>
        </div>
        <div className="heatmap-grid">
          {ongoingRooms.map((room, i) => (
            <div key={i} className="heatmap-box-occupied">
              <div className="room-top">
                <strong>{room.name}</strong>
                <div className="blink-dot-mini"></div>
              </div>
              <div className="room-dept">{room.dept}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
