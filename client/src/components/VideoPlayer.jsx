import React, { useEffect, useRef } from 'react';

export default function VideoPlayer({ stream, muted = false, label, mirrored = false, placeholder = 'Camera off' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
      ref.current.volume = 1;
    }
  }, [stream]);
  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled);
  return (
    <div className="video-box">
      <video ref={ref} autoPlay playsInline muted={muted} className={mirrored ? 'mirrored' : ''} />
      {(!stream || !hasVideo) && <div className="video-off">{placeholder}</div>}
      {label && <div className="video-label">{label}</div>}
    </div>
  );
}
