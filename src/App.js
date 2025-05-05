import React, { useState } from "react";
import LoginPage from "./LoginPage";
import ConverterApp from "./ConverterApp";
import "./App.css";






function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = (username, password) => {
    try {
      if (
        username === process.env.REACT_APP_USERNAME &&
        password === process.env.REACT_APP_PASSWORD
      ) {
        setIsAuthenticated(true);
        setLoginError("");
        console.log("Authentication successful");
      } else {
        setLoginError("Invalid username or password.");
        console.warn("Authentication failed");
      }
    } catch (error) {
      setLoginError("Something went wrong. Please try again.");
      console.warn("Environment variable error:", error);
    }
  };

  return (
    <div className="App">
      {!isAuthenticated ? (
        // <LoginPage onLogin={handleLogin} error={loginError} />
        <ConverterApp />
      ) : (
        <ConverterApp />
      )}
    </div>
  );
}

export default App;
