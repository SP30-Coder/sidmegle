import React from 'react';

export default function ControlBar({ micOn, cameraOn, onMic, onCamera, onNext, onEnd, onReport, onBlock, disabled }) {
  return (
    <div className="controls">
      <button onClick={onMic} className={micOn ? '' : 'off'} title="Mute/Unmute">🎤 {micOn ? 'Mute' : 'Unmute'}</button>
      <button onClick={onCamera} className={cameraOn ? '' : 'off'} title="Camera on/off">📷 {cameraOn ? 'Cam Off' : 'Cam On'}</button>
      <button onClick={onNext} className="next" disabled={disabled} title="Next stranger">⏭ Next</button>
      <button onClick={onReport} title="Report">🚨 Report</button>
      <button onClick={onBlock} title="Block">🚫 Block</button>
      <button onClick={onEnd} className="danger" title="End">🛑 End</button>
    </div>
  );
}
