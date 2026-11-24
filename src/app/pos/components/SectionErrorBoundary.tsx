'use client'

import React from 'react'

/** Aísla una sección: si falla al dibujarse, muestra el error ahí mismo (con
 *  botón para reintentar) en vez de tumbar toda la app con la pantalla genérica. */
export default class SectionErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) { return { error } }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.name}] error al mostrar la sección`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', fontFamily: 'var(--sans)' }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>Esta sección tuvo un error</div>
        <div style={{ fontSize: '0.74rem', color: '#7f1d1d', marginBottom: 12, wordBreak: 'break-word' }}>
          {this.state.error.message || String(this.state.error)}
        </div>
        <button onClick={() => this.setState({ error: null })} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }
}
