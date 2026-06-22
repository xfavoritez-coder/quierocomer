'use client'

import { useState } from 'react'

export default function WelcomeTutorial({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {step === 0 && (
        <div style={{
          maxWidth: 340, textAlign: 'center',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          {/* Logo */}
          <div style={{ fontSize: 40, marginBottom: 16 }}>🍽</div>

          <h1 style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 10px',
          }}>
            Bienvenido a QuieroComer.cl
          </h1>

          <p style={{
            fontSize: 17, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
            margin: '0 0 32px',
          }}>
            Descubre platos cerca de ti. Nuestro motor aprende tus gustos y te muestra lo que realmente te antoja.
          </p>

          <button onClick={() => setStep(1)} style={{
            padding: '14px 40px', borderRadius: 14,
            background: '#F4A623', border: 'none',
            color: '#000', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', width: '100%',
          }}>
            ¿Cómo funciona?
          </button>
        </div>
      )}

      {step === 1 && (
        <div style={{
          maxWidth: 340, textAlign: 'center',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          {/* Swipe animation */}
          <div style={{
            position: 'relative', width: 200, height: 260, margin: '0 auto 24px',
          }}>
            {/* Fake card */}
            <div className="tutorial-card" style={{
              width: 160, height: 200, borderRadius: 16,
              background: 'linear-gradient(135deg, #1a1a2e, #F4A623)',
              position: 'absolute', top: 10, left: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <span style={{ fontSize: 50 }}>🍔</span>
            </div>

            {/* Swipe hand animation */}
            <div className="tutorial-hand" style={{
              position: 'absolute', bottom: 0, left: '50%',
              fontSize: 36, transform: 'translateX(-50%)',
            }}>
              👆
            </div>

            {/* Like/pass indicators */}
            <div className="tutorial-like" style={{
              position: 'absolute', top: 20, right: -10,
              padding: '4px 10px', borderRadius: 8,
              background: 'rgba(34,197,94,0.9)', color: '#fff',
              fontSize: 11, fontWeight: 700, opacity: 0,
            }}>
              Me antoja 👍
            </div>
            <div className="tutorial-pass" style={{
              position: 'absolute', top: 20, left: -10,
              padding: '4px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,0.9)', color: '#fff',
              fontSize: 11, fontWeight: 700, opacity: 0,
            }}>
              Paso 👎
            </div>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px',
          }}>
            Desliza los platos
          </h2>

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5,
            margin: '0 0 10px',
          }}>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>Derecha</span> si te antoja,{' '}
            <span style={{ color: '#ef4444', fontWeight: 600 }}>izquierda</span> si no.
          </p>
          <p style={{
            fontSize: 15, color: '#F4A623', lineHeight: 1.5,
            margin: '0 0 28px', fontWeight: 500, fontStyle: 'italic',
            opacity: 0.6,
          }}>
            Mientras más explores, mejor serán las recomendaciones.
          </p>

          <button onClick={onDismiss} style={{
            padding: '14px 40px', borderRadius: 14,
            background: '#F4A623', border: 'none',
            color: '#000', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', width: '100%',
          }}>
            Empezar
          </button>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tutorial-card {
          animation: tutorialSwipe 3s ease-in-out infinite;
        }

        .tutorial-hand {
          animation: tutorialHandMove 3s ease-in-out infinite;
        }

        .tutorial-like {
          animation: tutorialLikeShow 3s ease-in-out infinite;
        }

        .tutorial-pass {
          animation: tutorialPassShow 3s ease-in-out infinite;
        }

        @keyframes tutorialSwipe {
          0%, 10% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(60px) rotate(8deg); }
          40%, 50% { transform: translateX(0) rotate(0deg); }
          65% { transform: translateX(-60px) rotate(-8deg); }
          80%, 100% { transform: translateX(0) rotate(0deg); }
        }

        @keyframes tutorialHandMove {
          0%, 10% { transform: translateX(-50%); }
          25% { transform: translateX(30px); }
          40%, 50% { transform: translateX(-50%); }
          65% { transform: translateX(-80px); }
          80%, 100% { transform: translateX(-50%); }
        }

        @keyframes tutorialLikeShow {
          0%, 10% { opacity: 0; }
          20%, 30% { opacity: 1; }
          40%, 100% { opacity: 0; }
        }

        @keyframes tutorialPassShow {
          0%, 50% { opacity: 0; }
          60%, 70% { opacity: 1; }
          80%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
