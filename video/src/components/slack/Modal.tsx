import React from "react";
import { brand } from "../../data/brand";
import { Typewriter } from "../Typewriter";
import { SlackButton } from "./Button";

interface ModalField {
  label: string;
  placeholder: string;
  value: string;
  fillProgress: number;
}

interface SlackModalProps {
  title: string;
  fields: ModalField[];
  submitPulse?: boolean;
}

export const SlackModal: React.FC<SlackModalProps> = ({ title, fields, submitPulse = false }) => (
  <div
    style={{
      background: brand.bgModal,
      borderRadius: 8,
      width: 540,
      boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
      overflow: "hidden",
      fontFamily: brand.fontSans,
    }}
  >
    {/* Modal header */}
    <div
      style={{
        padding: "20px 24px 16px",
        borderBottom: `1px solid ${brand.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 18, color: brand.textStrong }}>{title}</span>
      <span style={{ fontSize: 20, color: brand.textMuted, cursor: "default" }}>✕</span>
    </div>

    {/* Fields */}
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {fields.map((field) => (
        <div key={field.label}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: brand.textPrimary,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {field.label}
          </div>
          <div
            style={{
              background: brand.bg,
              border: `1px solid ${field.fillProgress > 0 ? brand.accent : brand.border}`,
              borderRadius: 4,
              padding: "8px 12px",
              minHeight: 60,
              fontSize: 15,
              color: field.fillProgress > 0 ? brand.textPrimary : brand.textMuted,
              lineHeight: 1.5,
              transition: "border-color 0.2s",
            }}
          >
            {field.fillProgress > 0 ? (
              <Typewriter text={field.value} progress={field.fillProgress} />
            ) : (
              field.placeholder
            )}
          </div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div
      style={{
        padding: "16px 24px",
        borderTop: `1px solid ${brand.border}`,
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
      }}
    >
      <SlackButton label="Cancel" variant="default" />
      <SlackButton label="Submit" variant="primary" pulse={submitPulse} />
    </div>
  </div>
);
