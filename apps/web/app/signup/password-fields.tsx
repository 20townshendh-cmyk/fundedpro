"use client";

import { useMemo, useState } from "react";

export function PasswordFields({
  passwordError = false,
  confirmPasswordError = false
}: {
  passwordError?: boolean;
  confirmPasswordError?: boolean;
}) {
  const [password, setPassword] = useState("");

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length === 0) return null;
    if (score <= 2) return { label: "Weak", className: "weak" };
    if (score <= 4) return { label: "Good", className: "good" };
    return { label: "Strong", className: "strong" };
  }, [password]);

  return (
    <>
      <div className="signup-two-up">
        <label className="signup-field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            className={passwordError ? "signup-input-error" : ""}
            onChange={(event) => setPassword(event.target.value)}
          />
          {strength ? (
            <small className={`signup-password-strength ${strength.className}`}>
              Password strength: {strength.label}
            </small>
          ) : null}
        </label>
        <label className="signup-field">
          <span>Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            required
            className={confirmPasswordError ? "signup-input-error" : ""}
          />
        </label>
      </div>
    </>
  );
}
