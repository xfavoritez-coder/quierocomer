"use client";
import React from "react";

interface State { hasError: boolean }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#1a0e05", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px" }}>
          <p style={{ fontSize: "2.5rem" }}>🧞</p>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "1.1rem", color: "#e8a84c", textAlign: "center" }}>Algo salió mal</p>
          <p style={{ fontFamily: "Georgia, serif", fontSize: "0.85rem", color: "rgba(240,234,214,0.5)", textAlign: "center" }}>Recarga la página para continuar</p>
          <button onClick={() => window.location.reload()} style={{ padding: "12px 28px", background: "#e8a84c", color: "#1a0e05", border: "none", borderRadius: "10px", fontFamily: "Georgia, serif", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Recargar página</button>
        </div>
      );
    }
    return this.props.children;
  }
}
