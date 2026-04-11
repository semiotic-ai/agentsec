import type { ImageResponse } from "next/og";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderSocialImage } from "./_og/shared";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage(): ImageResponse {
  return renderSocialImage();
}
