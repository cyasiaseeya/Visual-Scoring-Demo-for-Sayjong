import { useState } from 'react';
import Calibration from './Calibration';
import CalibrationCapture from './Components/CalibrationCapture';

function App() {
  const [mode, setMode] = useState<'practice' | 'calibrate'>('practice');

  const modeButtons = (
    <div style={{
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
      marginTop: '10px',
    }}>
      <button
        onClick={() => setMode('practice')}
        style={{
          padding: '6px 12px',
          fontSize: '14px',
          backgroundColor: mode === 'practice' ? '#f04299' : '#fff',
          color: mode === 'practice' ? '#fff' : '#f04299',
          border: '2px solid #f04299',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600',
        }}
      >
        Practice Mode
      </button>
      <button
        onClick={() => setMode('calibrate')}
        style={{
          padding: '6px 12px',
          fontSize: '14px',
          backgroundColor: mode === 'calibrate' ? '#f04299' : '#fff',
          color: mode === 'calibrate' ? '#fff' : '#f04299',
          border: '2px solid #f04299',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '600',
        }}
      >
        Calibration Tool
      </button>
    </div>
  );

  return (
    <div>
      {mode === 'practice' ? <Calibration modeButtons={modeButtons} /> : <CalibrationCapture />}
    </div>
  );
}

export default App;
