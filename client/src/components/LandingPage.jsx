import React, { useState } from 'react';

const ALL = ['gaming', 'music', 'movies', 'technology', 'sports', 'study', 'travel', 'food', 'art', 'fitness', 'books', 'random'];

export default function LandingPage({ onStart, online }) {
  const [interests, setInterests] = useState([]);
  const [gender, setGender] = useState('');
  const [preferredGender, setPreferredGender] = useState('any');
  const toggle = (v) => setInterests((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v].slice(0, 5)));

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="landing-logo">⚡ StrangerConnect</div>
        <p className="tagline">Talk to strangers around the world.</p>
        <p className="sub">Random 1-to-1 video, audio and text chat. No account needed. Be kind, stay safe.</p>
        {typeof online?.count === 'number' && <div className="pill">🟢 {online.count} online now</div>}
        <div className="gender-settings">
          <label>Your gender
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label>Chat with
            <select value={preferredGender} onChange={(e) => setPreferredGender(e.target.value)}>
              <option value="any">Anyone</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>
        <p className="gender-note">Gender is self-declared. Report anyone who misrepresents it.</p>
        <div className="interests">
          <div className="interests-title">Interests (optional, pick up to 5)</div>
          <div className="chips">
            {ALL.map((i) => (
              <button key={i} className={`chip ${interests.includes(i) ? 'active' : ''}`} onClick={() => toggle(i)}>{i}</button>
            ))}
          </div>
        </div>
        <button className="btn-primary big" disabled={!gender} onClick={() => onStart({ interests, gender, preferredGender })}>Start Chatting</button>
        <div className="safety">
          <h4>🔒 Safety first</h4>
          <ul>
            <li>Never share personal info (name, address, passwords).</li>
            <li>Use Report / Block for abuse. No recording allowed.</li>
            <li>You must be 18+ or use with a guardian. Be respectful.</li>
          </ul>
        </div>
        <div className="legal">
          <details><summary>Terms of Service</summary><p>Use respectfully. No nudity, harassment, hate speech, spam or illegal content. Violations may lead to blocking. Service provided as-is.</p></details>
          <details><summary>Privacy Policy</summary><p>No account needed. We do not record video/audio or store private messages. Reports store anonymous session IDs only.</p></details>
          <details><summary>Community Guidelines</summary><p>Be kind. No sexual content, threats, hate, or spam. Report violations. Moderators may review reports.</p></details>
        </div>
      </div>
    </div>
  );
}
