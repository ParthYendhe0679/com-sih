import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev overlay badge. The app still logs issues to the
  // console; this only stops the indicator appearing over the UI during
  // screen recording and demos.
  devIndicators: false,
};

export default nextConfig;
