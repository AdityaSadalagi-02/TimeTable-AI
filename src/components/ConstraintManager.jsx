import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import Button from "@mui/material/Button";

const to24Hour = (hour, min, period) => {
  let h = parseInt(hour);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return { hour: h, min: parseInt(min) };
};

const to12Hour = (hour) => {
  const period = hour >= 12 ? "PM" : "AM";
  let h = hour % 12;
  if (h === 0) h = 12;
  return { hour: h, period };
};

const ConstraintManager = () => {
  const [settings, setSettings] = useState({
    start: "09:00 AM",
    end: "05:00 PM",
    theory: "1",
    lab: "2",
    lunchStart: "01:00 PM",
    lunchDur: "1",
    breakStart: "11:00 AM",
    breakDur: "0.5",
  });

  const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutes = ["00", "15", "30", "45"];
  const periods = ["AM", "PM"];
  const durations = [0.5, 1, 2, 2.5, 3];

  const startH = useRef();
  const startM = useRef();
  const startP = useRef();
  const endH = useRef();
  const endM = useRef();
  const endP = useRef();
  const lunchH = useRef();
  const lunchM = useRef();
  const lunchP = useRef();
  const breakH = useRef();
  const breakM = useRef();
  const breakP = useRef();

  const theoryRef = useRef();
  const labRef = useRef();
  const lunchDurRef = useRef();
  const breakDurRef = useRef();

  useEffect(() => {
    fetchConstraints();
  }, []);

  const fetchConstraints = async () => {
    const { data, error } = await supabase
      .from("testconstraints")
      .select("*")
      .eq("id", 1)
      .limit(1)
      .maybeSingle();

    if (data) {
      const start = to12Hour(data.start_hour);
      const end = to12Hour(data.end_hour);
      const lunch = to12Hour(data.lunch_hour);
      const br = to12Hour(data.break_hour);

      setSettings({
        start: `${start.hour}:${String(data.start_min).padStart(2, "0")} ${
          start.period
        }`,
        end: `${end.hour}:${String(data.end_min).padStart(2, "0")} ${
          end.period
        }`,
        theory: data.period_duration,
        lab: data.lab_duration,
        lunchStart: `${lunch.hour}:${String(data.lunch_min).padStart(2, "0")} ${
          lunch.period
        }`,
        lunchDur: data.lunch_duration,
        breakStart: `${br.hour}:${String(data.break_min).padStart(2, "0")} ${
          br.period
        }`,
        breakDur: data.break_duration,
      });
    }
    if (!data) {
      toast.error("No constraints found in DB");
      return;
    }
  };

  const handleSave = async () => {
    const start = to24Hour(
      startH.current.value,
      startM.current.value,
      startP.current.value
    );

    const end = to24Hour(
      endH.current.value,
      endM.current.value,
      endP.current.value
    );

    const lunch = to24Hour(
      lunchH.current.value,
      lunchM.current.value,
      lunchP.current.value
    );

    const br = to24Hour(
      breakH.current.value,
      breakM.current.value,
      breakP.current.value
    );

    const newSettings = {
      start_hour: start.hour,
      start_min: start.min,

      end_hour: end.hour,
      end_min: end.min,

      lunch_hour: lunch.hour,
      lunch_min: lunch.min,
      lunch_duration: parseFloat(lunchDurRef.current.value),

      break_hour: br.hour,
      break_min: br.min,
      break_duration: parseFloat(breakDurRef.current.value),

      period_duration: parseFloat(theoryRef.current.value),
      lab_duration: parseFloat(labRef.current.value),
    };

    const { error } = await supabase
      .from("testconstraints")
      .update([newSettings])
      .eq("id", 1);

    if (error) {
      toast.error("Error saving");
    } else {
      toast.success("All constraints have been updated!");
      await fetchConstraints();
    }
  };

  const TimePicker = ({ hRef, mRef, pRef, defaultH, defaultP }) => (
    <div style={{ display: "flex", gap: "5px" }}>
      <select ref={hRef} className="custom-select" defaultValue={defaultH}>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select ref={mRef} className="custom-select">
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select ref={pRef} className="custom-select" defaultValue={defaultP}>
        {periods.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <h2>Global Constraints</h2>
      </div>

      <div
        className="list"
        style={{
          marginTop: "30px",
          background: "#f8fafc",
          padding: "20px",
          borderRadius: "10px",
          borderLeft: "5px solid var(--primary-color)",
        }}
      >
        <h4 style={{ color: "var(--primary-color)", marginBottom: "10px" }}>
          Active Rules :
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            fontSize: "0.9rem",
          }}
        >
          <p>
            🕒 College:{" "}
            <strong>
              {settings.start} - {settings.end}
            </strong>
          </p>
          <p>
            📖 Theory: <strong>{settings.theory} hr</strong>
          </p>
          <p>
            🧪 Lab: <strong>{settings.lab} hr</strong>
          </p>
          <p>
            🍱 Lunch:{" "}
            <strong>
              {settings.lunchDur} hr @ {settings.lunchStart}
            </strong>
          </p>
          <p>
            ☕ Break:{" "}
            <strong>
              {settings.breakDur} hr @ {settings.breakStart}
            </strong>
          </p>
        </div>
      </div>

      <div className="form-section">
        <h3 style={{ marginBottom: "15px", color: "var(--primary-color)" }}>
          1. College Hours
        </h3>
        <div className="grid-2">
          <div className="form-group">
            <label>Start Time</label>
            <TimePicker
              hRef={startH}
              mRef={startM}
              pRef={startP}
              defaultH="8"
              defaultP="AM"
            />
          </div>
          <div className="form-group">
            <label>End Time</label>
            <TimePicker
              hRef={endH}
              mRef={endM}
              pRef={endP}
              defaultH="4"
              defaultP="PM"
            />
          </div>
        </div>

        <hr
          style={{ margin: "25px 0", border: "0", borderTop: "1px solid #eee" }}
        />

        <h3 style={{ marginBottom: "15px", color: "var(--primary-color)" }}>
          2. Session Durations (Hours)
        </h3>
        <div className="grid-2">
          <div className="form-group">
            <label>Theory Duration</label>
            <select ref={theoryRef} className="custom-select" defaultValue="1">
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} hr
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Lab Duration</label>
            <select ref={labRef} className="custom-select" defaultValue="2">
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} hr
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr
          style={{ margin: "25px 0", border: "0", borderTop: "1px solid #eee" }}
        />

        <h3 style={{ marginBottom: "15px", color: "var(--primary-color)" }}>
          3. Breaks & Intervals
        </h3>
        <div className="grid-2" style={{ marginBottom: "20px" }}>
          <div className="form-group">
            <label>Lunch Start Time</label>
            <TimePicker
              hRef={lunchH}
              mRef={lunchM}
              pRef={lunchP}
              defaultH="1"
              defaultP="PM"
            />
          </div>
          <div className="form-group">
            <label>Lunch Duration</label>
            <select
              ref={lunchDurRef}
              className="custom-select"
              defaultValue="1"
            >
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} hr
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Short Break Start Time</label>
            <TimePicker
              hRef={breakH}
              mRef={breakM}
              pRef={breakP}
              defaultH="10"
              defaultP="AM"
            />
          </div>
          <div className="form-group">
            <label>Short Break Duration</label>
            <select
              ref={breakDurRef}
              className="custom-select"
              defaultValue="0.5"
            >
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d} hr
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          variant="contained"
          onClick={handleSave}
          style={{ marginTop: "30px", width: "100%" }}
        >
          Apply Constraints
        </Button>
      </div>
    </div>
  );
};

export default ConstraintManager;
