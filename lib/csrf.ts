import { initCSRF } from "next-csrf"

// Configure your origin and cookie options as needed:
export const { csrf, setup } = initCSRF({
  secret: process.env.CSRF_TOKEN, // see "Setting the env var" below
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
})
