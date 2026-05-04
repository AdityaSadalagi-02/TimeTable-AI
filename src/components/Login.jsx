import { useState } from "react";
import toast from "react-hot-toast";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const VALID_USER = "admin";
    const VALID_PASS = "admin123";

    if (username === VALID_USER && password === VALID_PASS) {
      toast.success("Welcome back, Admin!");
      onLogin();
    } else {
      setError("Invalid credentials. Try again.");
      // toast.error("Invalid credentials. Try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 style={{ color: "#4f46e5", marginBottom: "10px" }}>TimeTable AI</h2>
        <p style={{ color: "gray", marginBottom: "25px" }}>
          ISE Department Portal
        </p>

        <form onSubmit={handleLoginSubmit}>
          <div className="form-group" style={{ textAlign: "left" }}>
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div
            className="form-group"
            style={{ textAlign: "left", marginTop: "15px" }}
          >
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "30px" }}
          >
            Login to Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
