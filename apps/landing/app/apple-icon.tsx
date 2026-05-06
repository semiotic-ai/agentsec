import { ImageResponse } from "next/og";
import { BRAND_COLORS } from "./_brand/constants";
import { Shield } from "./_brand/Shield";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND_COLORS.dark,
      }}
    >
      <Shield size={140} strokeWidth={5} />
    </div>,
    { ...size },
  );
}
