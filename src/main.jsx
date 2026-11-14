import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './orbita/styles.css'
import App from './orbita/App.jsx'

createRoot(document.getElementById('root')).render(<App />)
