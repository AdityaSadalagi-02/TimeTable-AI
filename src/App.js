import React, { useState, useEffect } from "react";
import "./App.css";
// import Dashboard from "./components/Dashboard";
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

  useEffect(() => {
    sessionStorage.setItem("activePage", activePage);
  }, [activePage]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    sessionStorage.setItem("isLoggedIn", "true");
  };

  const handleLogout = () => {
    const justConfirm = window.confirm("Do you want to logout ?");
    if (justConfirm) {
      setIsLoggedIn(false);
      sessionStorage.removeItem("isLoggedIn");
      sessionStorage.removeItem("activePage");
    }
    return;
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (activePage) {
      // case "dashboard":
      // return <Dashboard />;
      case "generate":
        return <GenerateAI />;
      case "recent":
        return <RecentTimetables />;
      case "teachers":
        return <TeacherManager />;
      case "rooms":
        return <RoomManager />;
      case "generate":
        return <Placeholder title="AI Generation Workspace" />;
      case "subjects":
        return <SubjectManager />;
      case "constraints":
        return <ConstraintManager />;
      case "live":
        return <LiveStatus />;
      default:
        return <Placeholder title="generate" />;
    }
  };

  return (
    <div className="app-container">
      <Toaster position="top-right" reverseOrder={false} />
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
      />
      <main className="main-content">{renderPage()}</main>
    </div>
  );
}

export default App;
