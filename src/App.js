import React, { useState, useEffect } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import TeacherManager from "./components/TeacherManager";
import RoomManager from "./components/RoomManager";
import SubjectManager from "./components/SubjectManager";
import ConstraintManager from "./components/ConstraintManager";
import LiveStatus from "./components/LiveStatus";
import RecentTimetables from "./components/RecentTimetables";
import Login from "./components/Login";
import { Toaster } from "react-hot-toast";
import GenerateAI from "./components/GenerateAI";
import { Menu } from "lucide-react";

const Placeholder = ({ title }) => (
  <div className="card">
    <h1>{title}</h1>
    <p>Component for {title} management goes here.</p>
  </div>
);

function App() {
  const [activePage, setActivePage] = useState(() => {
    return sessionStorage.getItem("activePage") || "generate";
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem("isLoggedIn") === "true";
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("activePage", activePage);
  }, [activePage]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    sessionStorage.setItem("isLoggedIn", "true");
  };

  const handleLogout = () => {
    if (window.confirm("Do you want to logout?")) {
      setIsLoggedIn(false);
      sessionStorage.removeItem("isLoggedIn");
      sessionStorage.removeItem("activePage");
    }
  };

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;

  const renderPage = () => {
    switch (activePage) {
      case "generate":
        return <GenerateAI />;
      case "recent":
        return <RecentTimetables />;
      case "teachers":
        return <TeacherManager />;
      case "rooms":
        return <RoomManager />;
      case "subjects":
        return <SubjectManager />;
      case "constraints":
        return <ConstraintManager />;
      case "live":
        return <LiveStatus />;
      default:
        return <GenerateAI />;
    }
  };

  return (
    <div className="app-container">
      <Toaster position="top-right" reverseOrder={false} />

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content">
        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span className="mobile-title">TimeTable AI</span>
        </div>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;
