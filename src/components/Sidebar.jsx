import Button from "@mui/material/Button";
import logo from "../logo.png";
import {
  LayoutDashboard,
  Sparkles,
  Radio,
  History,
  Users,
  School,
  BookOpen,
  Settings2,
} from "lucide-react";

const Sidebar = ({ activePage, setActivePage, onLogout }) => {
  const mainItems = [
    // { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "generate", label: "Generate AI", icon: Sparkles },
    { id: "live", label: "Live Status", icon: Radio },
    { id: "recent", label: "Recent TimeTables", icon: History },
  ];

  const manageItems = [
    { id: "teachers", label: "Teachers", icon: Users },
    { id: "rooms", label: "Rooms", icon: School },
    { id: "subjects", label: "Subjects", icon: BookOpen },
    { id: "constraints", label: "Constraints", icon: Settings2 },
  ];

  return (
    <div className="sidebar">
      <h2>TimeTable AI</h2>
      <p
        style={{
          fontSize: "12px",
          fontWeight: "700",
          color: "gray",
          marginLeft: "-10px",
          marginBottom: "5px",
        }}
      >
        Operations
      </p>
      {mainItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${activePage === item.id ? "active" : ""}`}
          onClick={() => setActivePage(item.id)}
        >
          <item.icon size={18} strokeWidth={2} style={{ marginRight: 10 }} />
          {item.label}
        </div>
      ))}

      <p
        style={{
          fontSize: "12px",
          fontWeight: "700",
          color: "gray",
          marginLeft: "-10px",
          marginBottom: "5px",
        }}
      >
        Manage
      </p>

      {manageItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${activePage === item.id ? "active" : ""}`}
          onClick={() => setActivePage(item.id)}
        >
          <item.icon size={18} strokeWidth={2} style={{ marginRight: 10 }} />
          {item.label}
        </div>
      ))}

      <div
        style={{
          height: "40px",
          width: "40px",
          position: "absolute",
          bottom: 5,
          left: 5,
          color: "#cbd5e1",
          borderRadius: "50%",
          display: "flex",
          gap: "50px",
        }}
      >
        <img
          title="Team 17"
          style={{
            height: "40px",
            width: "40px",
            borderRadius: "50%",
            objectFit: "cover",
          }}
          src={logo}
          alt="Team logo"
        />
        <Button
          variant="contained"
          style={{
            padding: "0 60px",
            color: "red",
            backgroundImage:
              "linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 230, 230, 1) 40%, rgba(255, 200, 200, 1) 100%)",
          }}
          onClick={onLogout}
        >
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
