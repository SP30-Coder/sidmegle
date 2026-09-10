import React, { useState } from 'react';

const REASONS = [
  { v: 'harassment', l: 'Harassment' },
  { v: 'nudity', l: 'Nudity / sexual content' },
  { v: 'hate-speech', l: 'Hate speech' },
  { v: 'spam', l: 'Spam' },
  { v: 'threats', l: 'Threatening behavior' },
  { v: 'gender-misrepresentation', l: 'Gender misrepresentation' },
  { v: 'other', l: 'Other' },
];

export default function ReportModal({ onClose, onSubmit }) {
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>🚨 Report stranger</h3>
        <p className="muted">Reports are anonymous. Video is never recorded.</p>
        <div className="reasons">
          {REASONS.map((r) => (
            <label key={r.v} className={reason === r.v ? 'sel' : ''}>
              <input type="radio" name="reason" value={r.v} checked={reason === r.v} onChange={() => setReason(r.v)} /> {r.l}
            </label>
          ))}
        </div>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="Optional details (max 500 chars)" />
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSubmit(reason, details)}>Submit & Next</button>
        </div>
      </div>
    </div>
  );
}
