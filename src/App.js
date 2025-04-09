import React, { useState } from "react";
import LoginPage from "./LoginPage";
import ConverterApp from "./ConverterApp";
import "./App.css";



const SHARED_USERNAME = process.env.REACT_APP_USERNAME;
const SHARED_PASSWORD = process.env.REACT_APP_PASSWORD;


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = (username, password) => {
    if (SHARED_PASSWORD === undefined || SHARED_USERNAME === undefined) {
      setLoginError("Environment variables are not set.");
      console.warn("Environment variables are not set.");
      return;
    }
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
