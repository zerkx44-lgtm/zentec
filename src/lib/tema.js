import { useEffect, useState } from 'react'

// Tres opciones, como en iOS: automático sigue al sistema del dispositivo.
// La elección se guarda en este navegador; no es un dato del negocio y no
// tiene por qué ir a la base.
const CLAVE = 'zentec-tema'
export const TEMAS = ['auto', 'claro', 'oscuro']

function leer() {
  try {
    const v = localStorage.getItem(CLAVE)
    return TEMAS.includes(v) ? v : 'oscuro'
  } catch {
    return 'oscuro'
  }
}

const sistemaClaro = () =>
  window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false

function aplicar(tema) {
  const claro = tema === 'claro' || (tema === 'auto' && sistemaClaro())
  document.documentElement.dataset.tema = claro ? 'claro' : 'oscuro'
}

export function useTema() {
  const [tema, setTema] = useState(leer)

  useEffect(() => {
    aplicar(tema)
    try { localStorage.setItem(CLAVE, tema) } catch { /* modo privado */ }
    if (tema !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const cambio = () => aplicar('auto')
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [tema])

  return [tema, setTema]
}
