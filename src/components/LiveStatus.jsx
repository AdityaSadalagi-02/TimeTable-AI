import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const LiveStatus = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveData, setLiveData] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    fetchLiveStatus();

    const refresh = setInterval(() => {
      fetchLiveStatus();
    }, 60000);

    return () => {
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, []);

  const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const parseTime = (timeStr) => {
    const [time, modifier] = timeStr.trim().split(" ");

    let [hours, minutes] = time.split(":");

    hours = parseInt(hours);

    if (modifier === "PM" && hours !== 12) {
      hours += 12;
    }

    if (modifier === "AM" && hours === 12) {
      hours = 0;
    }

    return hours * 60 + parseInt(minutes);
  };

  const isCurrentSlot = (slotLabel) => {
    try {
      const [start, end] = slotLabel.split("-");

      const now = new Date();
      // now.setHours(8, 30, 0);
      // now.setDate(now.getDate() - now.getDay() + 1);

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const startMinutes = parseTime(start);
      const endMinutes = parseTime(end);

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch {
      return false;
    }
  };

  const fetchLiveStatus = async () => {
    try {
      const today = DAYS[new Date().getDay()];

      const { data: timetables, error } = await supabase
        .from("saved_timetables")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      const { data: teacherLinks } = await supabase.from("teacher_subjects")
        .select(`
          *,
          subjects(*),
          teachers(*)
        `);

      const result = [];

      for (const table of timetables || []) {
        const timetable = table.timetable_json || {};

        const todayData = timetable[today];

        if (!todayData) continue;

        let activeSubject = null;

        for (const slot in todayData) {
          if (isCurrentSlot(slot)) {
            activeSubject = todayData[slot];
            break;
          }
        }

        if (!activeSubject || activeSubject === "-") {
          result.push({
            id: table.id,
            dept: table.department,
            subject: "None",
            teacher: "None",
            isOccupied: false,
          });

          continue;
        }

        const teacherLinksForSubject =
          teacherLinks?.filter(
            (t) => t.subjects?.subject_name === activeSubject
          ) || [];

        result.push({
          id: table.id,
          dept: table.department,
          subject: activeSubject,
          teacher:
            teacherLinksForSubject.length > 0
              ? teacherLinksForSubject
                  .map((t) => t.teachers?.name)
                  .filter(Boolean)
                  .join(", ")
              : "Unknown",
          isOccupied: true,
        });
      }

      setLiveData(result);
    } catch (err) {
      console.error(err);
    }
  };

  const departments = [...new Set(liveData.map((r) => r.dept))];

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
          <p>Real-time ongoing classes across departments.</p>
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
          <div
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
            }}
          >
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
            {liveData
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
                    <h4 style={{ fontSize: "1.2rem" }}>{room.dept}</h4>
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
                          <small
                            style={{
                              color: "var(--text-muted)",
                            }}
                          >
                            Subject:
                          </small>

                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "0.9rem",
                            }}
                          >
                            {room.subject}
                          </div>
                        </div>

                        <div>
                          <small
                            style={{
                              color: "var(--text-muted)",
                            }}
                          >
                            Faculty:
                          </small>

                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "0.9rem",
                            }}
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
