import React from "react";
import { brand } from "../../data/brand";

interface ButtonProps {
  label: string;
  variant?: "primary" | "default";
  pulse?: boolean;
}

export const SlackButton: React.FC<ButtonProps> = ({ label, variant = "default", pulse = false }) => (
  <div
    style={{
      display: "inline-block",
      padding: "8px 16px",
      borderRadius: 4,
      fontSize: 15,
      fontWeight: 700,
      fontFamily: brand.fontSans,
      cursor: "default",
      background: variant === "primary" ? brand.slackGreen : "transparent",
      color: variant === "primary" ? "#fff" : brand.textPrimary,
      border: variant === "primary" ? "none" : `1px solid ${brand.border}`,
      boxShadow: pulse ? `0 0 0 3px ${brand.slackGreen}55` : undefined,
      transition: "box-shadow 0.3s",
    }}
  >
    {label}
  </div>
);
