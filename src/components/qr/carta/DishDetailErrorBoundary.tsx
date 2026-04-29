"use client";
import { Component } from "react";

export default class DishDetailErrorBoundary extends Component<{ children: React.ReactNode; onClose: () => void }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "Error desconocido" };
  }

  componentDidCatch(error: Error) {
    console.error("[DishDetail crash]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <p style={{ color: "#ef4444", fontSize: "0.9rem", textAlign: "center", marginBottom: 16 }}>Error: {this.state.error}</p>
          <button onClick={() => { this.setState({ error: null }); this.props.onClose(); }} style={{ padding: "10px 24px", borderRadius: 50, background: "#F4A623", color: "#0a0a0a", border: "none", fontSize: "0.9rem", fontWeight: 600 }}>Cerrar</button>
        </div>
      );
    }
    return this.props.children;
  }
}
