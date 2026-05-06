import { ImageResponse } from "next/og";
import { BRAND_COLORS, SITE_TITLE } from "../_brand/constants";
import { Shield } from "../_brand/Shield";

export const OG_ALT = SITE_TITLE;
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export function renderSocialImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: BRAND_COLORS.dark,
        backgroundImage:
          "radial-gradient(circle at 85% 15%, rgba(0, 210, 180, 0.18), transparent 55%), radial-gradient(circle at 15% 85%, rgba(0, 210, 180, 0.10), transparent 55%)",
        color: BRAND_COLORS.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Shield size={80} strokeWidth={4} />
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              color: BRAND_COLORS.text,
              letterSpacing: "-1.5px",
            }}
          >
            AgentSec
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 24px",
            border: `2px solid ${BRAND_COLORS.teal}`,
            borderRadius: 999,
            fontSize: 22,
            color: BRAND_COLORS.teal,
            fontWeight: 600,
            letterSpacing: "0.5px",
          }}
        >
          OWASP AST10
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-2px",
            color: BRAND_COLORS.text,
            maxWidth: 1040,
          }}
        >
          Audit every skill your AI agents run.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 400,
            color: BRAND_COLORS.muted,
            lineHeight: 1.3,
            maxWidth: 960,
          }}
        >
          Vulnerabilities, supply chain risks, and policy violations — checked automatically.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "18px 28px",
            backgroundColor: BRAND_COLORS.secondary,
            border: `1px solid ${BRAND_COLORS.teal}`,
            borderRadius: 10,
            fontSize: 28,
            fontFamily: "ui-monospace, Menlo, Monaco, monospace",
            color: BRAND_COLORS.text,
          }}
        >
          <span style={{ color: BRAND_COLORS.teal, marginRight: 12 }}>$</span>
          agentsec audit
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: BRAND_COLORS.muted,
            fontWeight: 500,
          }}
        >
          agentsec.sh
        </div>
      </div>
    </div>,
    { ...OG_SIZE },
  );
}
