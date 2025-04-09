import React, { useState } from "react";
import LoginPage from "./LoginPage";
import ConverterApp from "./ConverterApp";
import "./App.css";

// --- Credentials ---
const SHARED_USERNAME = "user";
const SHARED_PASSWORD = "password";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = (username, password) => {
    if (username === SHARED_USERNAME && password === SHARED_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError("");
      console.log("Authentication successful");
    } else {
      setLoginError("Invalid username or password.");
      console.warn("Authentication failed");
    }
  };

  return (
    <div className="App">
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} error={loginError} />
      ) : (
        <ConverterApp />
      )}
    </div>
  );
}

export default App;
