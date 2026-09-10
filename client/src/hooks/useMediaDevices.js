import { useCallback, useEffect, useRef, useState } from 'react';

export function useMediaDevices() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef(null);

  const requestMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED');
      }
      // stop old tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      setStream(s);
      setCameraOn(true);
      setMicOn(true);
      // listen for device disconnect
      s.getTracks().forEach((t) => {
        t.onended = () => {
          if (t.kind === 'video') setCameraOn(false);
          if (t.kind === 'audio') setMicOn(false);
        };
      });
      return s;
    } catch (e) {
      let msg = 'Could not access camera/microphone.';
      if (e?.name === 'NotAllowedError') msg = 'Camera/microphone permission denied. Please allow access and retry.';
      else if (e?.name === 'NotFoundError') msg = 'No camera or microphone found on this device.';
      else if (e?.name === 'NotReadableError') msg = 'Camera/microphone is busy or disconnected. Try again.';
      else if (e?.message === 'UNSUPPORTED') msg = 'This browser does not support video chat. Please use Chrome, Edge or Firefox.';
      // graceful fallback: try audio-only, then video-only
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        streamRef.current = audioOnly;
        setStream(audioOnly);
        setCameraOn(false);
        setMicOn(true);
        setError('Camera not available — continuing with audio only.');
        return audioOnly;
      } catch {
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          streamRef.current = videoOnly;
          setStream(videoOnly);
          setCameraOn(true);
          setMicOn(false);
          setError('Microphone not available — continuing with video only.');
          return videoOnly;
        } catch {
          setError(msg);
          return null;
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const tracks = s.getVideoTracks();
    if (!tracks.length) return;
    const next = !cameraOn;
    tracks.forEach((t) => { t.enabled = next; });
    setCameraOn(next);
  }, [cameraOn]);

  const toggleMic = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const tracks = s.getAudioTracks();
    if (!tracks.length) return;
    const next = !micOn;
    tracks.forEach((t) => { t.enabled = next; });
    setMicOn(next);
  }, [micOn]);

  const stopAll = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
  }, []);

  return { stream, error, cameraOn, micOn, loading, requestMedia, toggleCamera, toggleMic, stopAll };
}
