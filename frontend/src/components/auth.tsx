import { useState } from "react";

interface AuthScreenProps {
  onAuth: () => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Get auth config from env
  const authMode = import.meta.env.VITE_AUTH_MODE ?? "code"; // "code" or "credentials"
  const validCode = import.meta.env.VITE_AUTH_CODE ?? "";
  const validUsername = import.meta.env.VITE_AUTH_USERNAME ?? "marstc";
  const validPassword = import.meta.env.VITE_AUTH_PASSWORD ?? "1901";

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validCode) {
      // Auth disabled
      onAuth();
      return;
    }

    if (code === validCode) {
      sessionStorage.setItem("auth_token", "authenticated");
      onAuth();
    } else {
      setError("Ongeldige code");
      setCode("");
    }
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validUsername || !validPassword) {
      // Auth disabled
      onAuth();
      return;
    }

    if (username === validUsername && password === validPassword) {
      sessionStorage.setItem("auth_token", "authenticated");
      onAuth();
    } else {
      setError("Ongeldige gebruikersnaam of wachtwoord");
      setUsername("");
      setPassword("");
    }
  };

  return (
    <main className="screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 400, width: "100%", padding: "2rem" }}>
        <h1 style={{ textAlign: "center", marginBottom: "2rem", color: "var(--ink)" }}>
          Financieel Overzicht
        </h1>

        {authMode === "code" ? (
          <form onSubmit={handleCodeSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                Toegangscode
              </label>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Voer code in"
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid var(--ink-soft)",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              />
            </div>

            {error && (
              <div style={{ color: "var(--negative)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "var(--teal)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Inloggen
            </button>
          </form>
        ) : (
          <form onSubmit={handleCredentialsSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                Gebruikersnaam
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Gebruikersnaam"
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid var(--ink-soft)",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                Wachtwoord
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wachtwoord"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid var(--ink-soft)",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              />
            </div>

            {error && (
              <div style={{ color: "var(--negative)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "var(--teal)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Inloggen
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
